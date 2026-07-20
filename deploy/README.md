# Deployment Guide

This folder contains deployment scripts and configurations for TDX MCP Connector to Azure.

## Folder Structure

```
deploy/
├── ubuntu/                      # Ubuntu/Linux self-hosted deployment
│   ├── setup-ubuntu.sh         # Initial setup automation script
│   ├── update-ubuntu.sh        # Code update script
│   ├── deploy-to-ubuntu.ps1    # Windows deployment script (PowerShell)
│   ├── .env.example            # Environment configuration template
│   └── README.md               # Ubuntu deployment documentation
├── azure-container-apps/        # Azure Container Apps deployment
│   ├── Dockerfile              # Multi-stage Docker image build
│   ├── container-app-deploy.yaml  # Container App configuration template
│   └── deploy-container-app.ps1   # Deployment automation script
└── azure-app-service/          # Azure App Service deployment (future)
```

## Deployment Options

### Ubuntu / Self-Hosted Linux

**Location:** `deploy/ubuntu/`  
**Status:** ✓ Active (http://10.210.1.38:3000/tools)

For self-hosted deployments on Ubuntu 24.04 LTS servers.

**Quick Start:**
```powershell
# From Windows PowerShell
.\deploy\ubuntu\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode update
```

**Files:**
- `setup-ubuntu.sh` - Initial system setup, Node.js installation, service configuration
- `update-ubuntu.sh` - Deploy code updates to existing installation
- `deploy-to-ubuntu.ps1` - Windows deployment automation (SSH/SCP)
- `.env.example` - Environment configuration template
- `README.md` - Complete Ubuntu deployment guide

**Quick Commands:**
- Initial deployment: `.\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode setup`
- Code updates: `.\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode update`
- Service status: `sudo systemctl status tdx-mcp`
- View logs: `sudo journalctl -u tdx-mcp -f`

**See Also:** [Ubuntu Deployment Guide](./ubuntu/README.md)

---

### Azure Container Apps

**Location:** `deploy/azure-container-apps/`

Container Apps provides serverless container hosting with automatic scaling.

**Quick Start:**
```powershell
cd .\deploy\azure-container-apps
.\deploy-container-app.ps1 `
    -SubscriptionId "YOUR_SUBSCRIPTION_ID" `
    -ResourceGroup "TDX_MCP" `
    -Location "eastus2"
```

**Files:**
- `Dockerfile` - Multi-stage build with production optimization
- `deploy-container-app.ps1` - Handles ACR creation, image build/push, and Container App deployment
- `container-app-deploy.yaml` - YAML configuration for Container App (auto-generated during deployment)

**Prerequisites:**
- Azure CLI (`az` command)
- Docker
- Appropriate Azure permissions (create resources, manage registries, etc.)

**What It Does:**
1. Verifies resource group exists
2. Creates/verifies Azure Container Registry (ACR)
3. Builds Docker image locally
4. Pushes image to ACR
5. Creates/updates Container App environment
6. Deploys Container App with environment variables and secrets from Key Vault
7. Configures auto-scaling and health checks

**See Also:** [Container Apps Deployment Guide](../docs/DEPLOYMENT_CONTAINER_APPS.md)

### Azure App Service

**Location:** `deploy/azure-app-service/`

(Coming soon) Deploy to Azure App Service for traditional web app hosting.

## Migration

If moving between deployment types, ensure:
1. Both deployments have access to the same secrets in Key Vault
2. Update client applications to use the new endpoint URL
3. Test thoroughly before decommissioning the old deployment
