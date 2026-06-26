#!/bin/bash

# Deploy and Setup TDX MCP Connector on Ubuntu 26.04 LTS
# This script installs Node.js, builds the project, and sets up a systemd service

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== TDX MCP Connector Ubuntu Setup ===${NC}\n"

# Configuration
PROJECT_DIR="/opt/tdx-mcp"
SERVICE_USER="tdx-mcp"
SERVICE_NAME="tdx-mcp"
NODE_VERSION="22"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Step 1: Update system
echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Step 2: Install Node.js
echo -e "${YELLOW}Step 2: Installing Node.js ${NODE_VERSION}...${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Step 3: Create project directory and user
echo -e "${YELLOW}Step 3: Setting up project directory and service user...${NC}"

if ! id "$SERVICE_USER" &>/dev/null; then
    useradd -r -s /bin/bash -d "$PROJECT_DIR" "$SERVICE_USER"
    echo -e "${GREEN}Created user: $SERVICE_USER${NC}"
fi

mkdir -p "$PROJECT_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$PROJECT_DIR"

# Step 4: Clone or copy project
echo -e "${YELLOW}Step 4: Project files location: $PROJECT_DIR${NC}"
echo -e "${YELLOW}        (Copy your entire project directory here: source files, package.json, tsconfig.json)${NC}"

# Step 5: Install dependencies
echo -e "${YELLOW}Step 5: Installing project dependencies...${NC}"
cd "$PROJECT_DIR"
sudo -u "$SERVICE_USER" npm install --production

# Step 6: Build TypeScript
echo -e "${YELLOW}Step 6: Building TypeScript project...${NC}"
sudo -u "$SERVICE_USER" npm run build

# Step 7: Verify .env file
echo -e "${YELLOW}Step 7: Checking for .env configuration file...${NC}"
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo -e "${RED}WARNING: .env file not found at $PROJECT_DIR/.env${NC}"
    echo -e "${YELLOW}Please create/copy .env file with your TDX API credentials before starting the service${NC}"
else
    echo -e "${GREEN}.env file found${NC}"
fi

# Step 8: Create systemd service file (HTTP Wrapper Mode)
echo -e "${YELLOW}Step 8: Creating systemd service (HTTP Wrapper mode)...${NC}"

# Generate API key
API_KEY=$(openssl rand -hex 32)
echo -e "${YELLOW}Generated API Key: ${GREEN}$API_KEY${NC}"
echo -e "${YELLOW}Save this key - you'll need it for Copilot Studio configuration${NC}\n"

cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=TDX MCP HTTP Server
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_DIR
Environment="NODE_ENV=production"
Environment="MCP_HTTP_PORT=3000"
Environment="MCP_API_KEY=$API_KEY"
Environment="ALLOW_MODIFICATIONS=false"
ExecStart=/usr/bin/node $PROJECT_DIR/dist/http-wrapper.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chmod 644 /etc/systemd/system/${SERVICE_NAME}.service

# Reload systemd
systemctl daemon-reload

# Step 9: Enable auto-start on boot
echo -e "${YELLOW}Step 9: Enabling auto-start on boot...${NC}"
systemctl enable ${SERVICE_NAME}
echo -e "${GREEN}Service enabled for auto-start${NC}"

echo -e "${GREEN}=== Setup Complete ===${NC}\n"
echo -e "${GREEN}✅ Service is configured and enabled for auto-start${NC}\n"
echo -e "${GREEN}Next steps:${NC}"
echo "1. Copy your project files to: $PROJECT_DIR"
echo "2. Copy your .env file to: $PROJECT_DIR/.env (chmod 600 for security)"
echo "3. Run: sudo systemctl start $SERVICE_NAME"
echo "4. Check status: sudo systemctl status $SERVICE_NAME"
echo "5. View logs: sudo journalctl -u $SERVICE_NAME -f"
echo "6. Test HTTP endpoint: curl http://localhost:3000/health\n"
echo -e "${GREEN}API Configuration:${NC}"
echo "- HTTP Port: 3000"
echo "- API Key: $API_KEY"
echo "- Save this API key for Copilot Studio configuration!"
echo "- Public endpoint (no auth): http://<server>:3000/health"
echo "- Protected endpoints (require API key): /status, /tools, /mcp"
