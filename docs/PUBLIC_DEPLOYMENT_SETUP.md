# Azure Container Apps Deployment - Quick Start Guide

Your TDX MCP Connector is configured for **production-ready deployment to Azure Container Apps** with **API key authentication** and **auto-scaling**.

> **This is the recommended deployment method** for all new deployments. For detailed information, see [AZURE_CONTAINER_APPS_DEPLOYMENT.md](AZURE_CONTAINER_APPS_DEPLOYMENT.md).

## ✅ What's Been Set Up

### Infrastructure Files
- **`infra/main.bicep`** - Bicep template for Azure Container Apps deployment
- **`infra/main.parameters.json`** - Deployment parameters

### Deployment Configuration
- **`azure.yaml`** - Azure Developer CLI (azd) project configuration
- **`.env.example`** - Template for environment variables
- **`.env`** - Your actual secrets (⚠️ keep this private, don't commit)

### Deployment Scripts
- **`deploy-to-azure.ps1`** - PowerShell deployment script (Windows)
- **`deploy-to-azure.sh`** - Bash deployment script (macOS/Linux)

### Documentation
- **`AZURE_CONTAINER_APPS_DEPLOYMENT.md`** - Comprehensive deployment guide

### Updated Files
- **`Dockerfile`** - Now runs the HTTP wrapper for public access (instead of stdio)

## 🚀 Quick Start

### Option 1: Automated Deployment (Recommended)

**Windows:**
```powershell
.\deploy-to-azure.ps1
```

**macOS/Linux:**
```bash
chmod +x deploy-to-azure.sh
./deploy-to-azure.sh
```

The script will:
1. ✅ Check prerequisites (azd, Docker)
2. ✅ Create `.env` from template
3. ✅ Validate TDX credentials
4. ✅ Generate a secure API key
5. ✅ Authenticate with Azure
6. ✅ Deploy to Container Apps

### Option 2: Manual Deployment

```bash
# Install Azure Developer CLI
# https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd

# Set up environment
cp .env.example .env
# Edit .env with your TDX credentials and generate an API key

# Deploy
azd up
```

## 📋 Required Configuration

Before deployment, you need:

```env
# TDX Connection Details
TDX_BASE_URL=https://your-tdx-instance.com
TDX_BEID=your-business-entity-id
TDX_WEB_SERVICES_KEY=your-web-services-api-key
TDX_APP_ID=your-ticket-app-id
TDX_ASSETS_APP_ID=your-assets-app-id
TDX_KB_APP_ID=your-kb-app-id

# Security
MCP_API_KEY=<your-secure-api-key>  # Generate with: openssl rand -hex 16
```

## 🔐 Authentication

All API calls require Bearer token authentication:

```bash
# Example
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://<your-container-app-url>/health

# Or with curl auth shorthand
curl --bearer YOUR_API_KEY \
  https://<your-container-app-url>/health
```

### Public Endpoints (No Auth Required)
- `GET /health` - Health check (for load balancers)

### Protected Endpoints (Auth Required - Bearer Token)
- `GET /status` - Service status
- `GET /tools` - List available tools
- `POST /mcp` - MCP tool calls
- `GET /` - MCP HTTP transport
- `POST /` - MCP HTTP transport

**All endpoints except `/health` require an API key in the Authorization header:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://your-app-url/status
```

## 📊 What Gets Deployed

### Azure Resources
1. **Container App** - Your MCP server running on Azure's managed infrastructure
   - Public HTTPS endpoint
   - Auto-scaling (1-5 replicas)
   - Health checks

2. **Container App Environment** - Managed runtime environment
   - Log Analytics integration
   - Networking isolation

3. **Log Analytics Workspace** - Application logging and monitoring
   - 30-day retention
   - Full request/response logging

### Container Configuration
- **Image**: Your application built from Dockerfile
- **Port**: 3000 (HTTP)
- **Protocol**: Auto-upgraded to HTTPS by Azure
- **User**: Non-root for security
- **Entrypoint**: Node.js HTTP wrapper with API key authentication

## 💰 Cost Estimate

**Typical monthly cost (dev environment):**
- Container App (1 vCPU, 2GB RAM, 1-5 replicas): ~$40/month
- Log Analytics (data ingestion): ~$10-20/month
- **Total: ~$50-60/month**

**Ways to reduce costs:**
- Reduce max replicas from 5 to 2
- Use smaller CPU allocation (0.25 vCPU)
- Use standard tier instead of premium
- Set up request rate limiting

## 🔍 Verification After Deployment

After deployment completes, you'll see output like:

```
✓ Deployment completed successfully

Outputs:
  containerAppUrl: https://tdx-mcp-dev-abc123.eastus.azurecontainer.io
  apiKey: <your-generated-key>
  containerAppName: tdx-mcp-dev-abc123
```

Test your deployment:

```bash
# Health check (no auth)
curl https://tdx-mcp-dev-abc123.eastus.azurecontainer.io/health

# API call (with auth)
curl -H "Authorization: Bearer <API_KEY>" \
  https://tdx-mcp-dev-abc123.eastus.azurecontainer.io/tools
```

## 📚 Additional Resources

- **Deployment Guide**: See [AZURE_CONTAINER_APPS_DEPLOYMENT.md](AZURE_CONTAINER_APPS_DEPLOYMENT.md)
- **HTTP Wrapper**: [src/http-wrapper.ts](src/http-wrapper.ts) - Handles public HTTP access
- **MCP Server**: [src/index.ts](src/index.ts) - Core MCP server (runs inside wrapper)
- **Azure Docs**: [Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)

## ⚠️ Important Notes

### Security
- ✅ API key is required for all protected endpoints
- ✅ All communication is HTTPS
- ✅ Secrets stored in Azure Container App secrets management
- ⚠️ **Never commit `.env` file to git** - it contains secrets!

### Limitations
- By default, **modification operations are disabled** (create/update/delete)
- To enable: Set `ALLOW_MODIFICATIONS=true` in `.env`
- Use with caution in production

### Git Configuration
Add to `.gitignore` (if not already there):
```
.env
.azure/
dist/
node_modules/
```

## 🐛 Troubleshooting

### Deployment fails
1. Verify azd is installed: `azd --version`
2. Authenticate: `azd auth login`
3. Check resource group permissions
4. Review Azure Portal for deployment errors

### Authentication errors (401)
1. Verify API key in `.env` matches what's being sent
2. Check Authorization header format: `Bearer <key>`
3. Verify environment variable is set in Container App

### TDX API errors (403)
1. Verify TDX credentials are correct
2. Check that service account has API access permissions
3. Verify app IDs match your TDX environment

### Container won't start
1. Check logs: `azd logs`
2. Verify Docker build succeeds locally: `docker build -t test .`
3. Check environment variables are set

See [AZURE_CONTAINER_APPS_DEPLOYMENT.md](AZURE_CONTAINER_APPS_DEPLOYMENT.md) for detailed troubleshooting.

## 🔄 Updating Your Deployment

After code changes:

```bash
# Rebuild and redeploy
azd up

# Or just redeploy without rebuilding
azd deploy
```

## ❌ Removing Your Deployment

To delete all Azure resources:

```bash
azd down
```

This will prompt for confirmation and remove the entire resource group.

---

**Next Step**: Run the deployment script or follow the [Deployment Guide](AZURE_CONTAINER_APPS_DEPLOYMENT.md)
