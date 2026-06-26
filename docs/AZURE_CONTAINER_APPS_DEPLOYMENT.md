# Azure Container Apps Deployment Guide - Public with Authentication

This guide walks through deploying the TDX MCP Connector to **Azure Container Apps** with **public HTTP access** and **API key authentication**.

## Overview

- **Public Access**: The MCP server is accessible via HTTPS on the public internet
- **Authentication**: Requires an API key in the `Authorization: Bearer <API_KEY>` header
- **Infrastructure as Code**: Uses Bicep for infrastructure management
- **Automated Deployment**: Uses Azure Developer CLI (azd) for one-command deployment

## Prerequisites

1. **Azure Subscription** - with appropriate permissions
2. **Azure CLI** or **Azure Developer CLI (azd)** installed
3. **Docker** - for building container images
4. **TDX Credentials** - API Key, URL, App IDs, Business Entity ID

## Quick Start (5 minutes)

### 1. Prepare Environment Variables

Create a `.env` file with your TDX credentials:

```bash
# Copy the example
cp .env.example .env

# Edit with your TDX details
cat > .env << EOF
TDX_BASE_URL=https://your-tdx-instance.com
TDX_BEID=your-business-entity-id
TDX_WEB_SERVICES_KEY=your-web-services-api-key
TDX_APP_ID=your-ticket-app-id
TDX_ASSETS_APP_ID=your-assets-app-id
TDX_KB_APP_ID=your-kb-app-id
MCP_API_KEY=$(openssl rand -hex 32)
EOF
```

### 2. Deploy with Azure Developer CLI

```bash
# Initialize azd (first time only)
azd init

# Authenticate with Azure
azd auth login

# Provision and deploy
azd up
```

Follow the prompts to:
- Select your Azure subscription
- Choose a deployment environment name (e.g., 'dev', 'prod')
- Select region (e.g., 'eastus', 'westus2')

### 3. Get Your Public URL

After deployment, azd outputs the Container App URL:

```
✓ Deployment completed successfully

Outputs:
  containerAppUrl: https://tdx-mcp-dev-xyz123.eastus.azurecontainer.io
  apiKey: <your-api-key>
```

## Making API Requests

### Using curl

```bash
# List available tools
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://tdx-mcp-dev-xyz123.eastus.azurecontainer.io/tools

# Call an MCP tool
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"call_tool","params":{"name":"tdx-ticket-search","arguments":{"description":"test"}}}' \
  https://tdx-mcp-dev-xyz123.eastus.azurecontainer.io/mcp
```

### Health Check (No Auth Required)

```bash
curl https://tdx-mcp-dev-xyz123.eastus.azurecontainer.io/health
```

## Architecture

### Infrastructure (Bicep)

The `infra/main.bicep` file defines:

- **Log Analytics Workspace** - for application logging
- **Container App Environment** - managed container runtime
- **Container App** - publicly accessible MCP server
- **Secrets Management** - stored in Container App secrets

### Public Access

The Container App is configured with:
- `ingress.external: true` - publicly accessible HTTPS
- `ingress.targetPort: 3000` - internal HTTP port
- Automatic HTTPS with platform-managed certificates

### Authentication

API key authentication is implemented in the HTTP wrapper:

1. Checks `Authorization: Bearer <key>` header
2. Compares against `MCP_API_KEY` environment variable
3. Returns 401 Unauthorized if missing or invalid
4. Exception endpoints (no auth required):
   - `/health` - health check
   - `/status` - service status
   - `/tools` - list available tools

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TDX_BASE_URL` | Yes | TeamDynamix API base URL |
| `TDX_BEID` | Yes | Business Entity ID |
| `TDX_WEB_SERVICES_KEY` | Yes | Web Services API Key |
| `TDX_APP_ID` | Yes | Ticket application ID |
| `TDX_ASSETS_APP_ID` | Yes | Assets application ID |
| `TDX_KB_APP_ID` | Yes | Knowledge Base application ID |
| `MCP_HTTP_PORT` | No | HTTP server port (default: 3000) |
| `MCP_API_KEY` | Yes | API key for authentication |
| `NODE_ENV` | No | Environment (default: production) |
| `ALLOW_MODIFICATIONS` | No | Enable create/update/delete operations (default: false) |

## Deployment Files

```
infra/
├── main.bicep              # Main infrastructure template
└── main.parameters.json    # Deployment parameters

azure.yaml                   # Azure Developer CLI config
Dockerfile                   # Multi-stage Docker build (uses http-wrapper)
package.json                # Node.js dependencies and scripts
.env.example                # Example environment variables
```

## Scaling Configuration

The Container App automatically scales based on:

- **Min Replicas**: 1 (always running)
- **Max Replicas**: 5 (scales under load)
- **Scale Rule**: HTTP requests (max 100 concurrent per replica)

Adjust in `infra/main.bicep` under `template.scale`.

## Monitoring and Logs

View logs in Azure Portal:

```bash
# Or via Azure CLI
az containerapp logs show \
  --resource-group <rg-name> \
  --name tdx-mcp-dev-<suffix>
```

View application metrics:
- CPU and memory usage
- Request count and latency
- Container restart events

## Cost Considerations

**Typical monthly cost** (dev environment):

- **Container App**: ~$40 (1 vCPU, 2 GB memory)
- **Log Analytics**: ~$10-20 (data ingestion)
- **Storage**: minimal
- **Data Transfer**: varies by usage

**Cost Optimization**:
- Reduce max replicas for lower environments
- Use smaller container specifications (0.25 vCPU / 512 MB)
- Implement request rate limiting

## Security Best Practices

✅ **Already Implemented**:
- API key authentication required
- HTTPS-only communication
- Non-root container user
- Health checks for resilience
- Secrets stored in Container App secrets

✅ **Recommended Additions**:
- Implement rate limiting
- Use Azure Key Vault for secrets (advanced)
- Enable Network Security Groups for additional filtering
- Implement request logging/auditing
- Rotate API keys regularly

## Troubleshooting

### Container won't start
```bash
# Check container app logs
az containerapp logs show \
  --resource-group <rg-name> \
  --name tdx-mcp-dev-<suffix>
```

### 401 Unauthorized responses
- Verify `MCP_API_KEY` environment variable is set
- Check Authorization header format: `Bearer <key>`
- Ensure key matches in both code and Container App secrets

### 403 Forbidden on TDX API
- Verify TDX API key and URL are correct
- Check Business Entity ID and App IDs
- Ensure service account has appropriate permissions in TDX

### High latency or timeouts
- Check Container App resource allocation (CPU/memory)
- Review TDX API response times
- Consider increasing max replicas for scale-out

## Updating Deployment

To update after code changes:

```bash
# Rebuild and redeploy
azd up

# Or specific components
azd deploy
```

## Removing Deployment

To delete all Azure resources:

```bash
azd down
```

This removes the resource group and all associated resources.

## Advanced Configuration

### Custom Domain Name

To use a custom domain with your Container App:

1. Update your DNS provider with the Container App FQDN
2. Configure custom domain in Container App settings
3. Update client applications with new URL

### VNet Integration

For private network connectivity, modify `infra/main.bicep`:

```bicep
managedEnvironmentId: containerAppEnvironment.id
// Add vnetConfiguration for private network
```

### CI/CD Pipeline

Integrate with GitHub Actions or Azure Pipelines:

```yaml
# .github/workflows/deploy.yml
- name: Deploy with Azure Developer CLI
  run: azd up --no-prompt
```

## Support

For issues:
1. Check Azure Container App logs
2. Verify environment variables are set correctly
3. Test TDX API connectivity independently
4. Review Azure service health status
