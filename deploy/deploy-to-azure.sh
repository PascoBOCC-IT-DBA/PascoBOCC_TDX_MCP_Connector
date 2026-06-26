#!/bin/bash

# Deploy TDX MCP Connector to Azure Container Apps with public access and authentication

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n\n${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

# Check prerequisites
print_header "Checking Prerequisites"

# Check if azd is installed
if ! command -v azd &> /dev/null; then
    print_error "Azure Developer CLI (azd) is not installed"
    print_info "Install from: https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd"
    exit 1
fi
print_success "Azure Developer CLI (azd) found"

# Check if docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    print_info "Install Docker from: https://www.docker.com/products/docker-desktop"
    exit 1
fi
print_success "Docker found"

# Check if .env.example exists
if [ ! -f ".env.example" ]; then
    print_error ".env.example not found in current directory"
    print_info "Please run this script from the project root directory"
    exit 1
fi
print_success "Project files found"

# Environment configuration
print_header "Environment Configuration"

if [ -f ".env" ]; then
    print_info ".env file already exists, skipping creation"
else
    print_info ".env file not found, creating from template..."
    cp .env.example .env
    print_success ".env file created"
    
    print_info "Please edit .env with your TDX credentials:"
    print_info "  - TDX_BASE_URL: Your TeamDynamix instance URL"
    print_info "  - TDX_BEID: Your Business Entity ID"
    print_info "  - TDX_WEB_SERVICES_KEY: Your Web Services API Key"
    print_info "  - TDX_APP_ID, TDX_ASSETS_APP_ID, TDX_KB_APP_ID: Your application IDs"
    print_info "  - MCP_API_KEY: Will be auto-generated if empty"
    
    echo -e "${CYAN}Press Enter to continue after updating .env...${NC}"
    read
fi

# Load .env file
print_info "Loading environment configuration..."
export $(cat .env | xargs)

# Validate required variables
required_vars=(
    "TDX_BASE_URL"
    "TDX_BEID"
    "TDX_WEB_SERVICES_KEY"
    "TDX_APP_ID"
    "TDX_ASSETS_APP_ID"
    "TDX_KB_APP_ID"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    value=$(eval echo \$$var)
    if [ -z "$value" ] || [[ "$value" == "your-"* ]]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    print_error "Missing or invalid required environment variables:"
    for var in "${missing_vars[@]}"; do
        print_error "  - $var"
    done
    exit 1
fi

print_success "All required TDX credentials configured"

# Generate API key if not set
if [ -z "$MCP_API_KEY" ] || [ "$MCP_API_KEY" = "your-secure-api-key-here" ]; then
    print_info "Generating secure API key..."
    API_KEY=$(openssl rand -hex 16)
    
    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/MCP_API_KEY=.*/MCP_API_KEY=$API_KEY/" .env
    else
        sed -i "s/MCP_API_KEY=.*/MCP_API_KEY=$API_KEY/" .env
    fi
    
    export MCP_API_KEY=$API_KEY
    print_success "API key generated and saved to .env"
fi

# Azure authentication
print_header "Azure Authentication"

if ! azd auth list &> /dev/null; then
    print_info "Logging in to Azure..."
    azd auth login
fi
print_success "Authenticated with Azure"

# Get deployment parameters
ENVIRONMENT_NAME="${1:-dev}"
LOCATION="${2:-eastus}"

# Initialize azd (if needed)
if [ ! -d ".azure" ]; then
    print_header "Initializing Azure Developer CLI"
    print_info "Setting up Azure Developer CLI infrastructure..."
    azd env new "$ENVIRONMENT_NAME"
fi

# Set environment configuration
print_header "Configuring Deployment"

azd env set AZURE_ENV_NAME "$ENVIRONMENT_NAME"
azd env set AZURE_LOCATION "$LOCATION"

print_success "Environment: $ENVIRONMENT_NAME"
print_success "Location: $LOCATION"

# Deploy
print_header "Deploying to Azure"

print_info "Starting deployment (this may take 5-10 minutes)..."
print_info "Building and pushing container image..."
print_info "Provisioning Azure resources..."

azd up

# Post-deployment info
print_header "Deployment Complete!"

print_success "Your TDX MCP Connector is now live!"

print_info "Next steps:"
print_info "1. The container app URL is displayed above"
print_info "2. Your API key is stored in .env (MCP_API_KEY)"
print_info "3. Use Bearer token authentication for all API calls"
echo ""
print_info "Example curl command:"
print_info "  curl -H 'Authorization: Bearer <API_KEY>' https://<YOUR_URL>/health"
echo ""
print_info "For more information, see: AZURE_CONTAINER_APPS_DEPLOYMENT.md"
