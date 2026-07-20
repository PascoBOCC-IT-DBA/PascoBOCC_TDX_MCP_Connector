#!/bin/bash

################################################################################
# TDX MCP Connector - Ubuntu Initial Setup Script
# 
# This script automates the initial setup and deployment of the TDX MCP 
# Connector on Ubuntu 24.04 LTS servers.
#
# Usage:
#   sudo ./setup-ubuntu.sh
#
# Prerequisites:
#   - Ubuntu 24.04 LTS
#   - sudo/root access
#   - Internet connectivity
#
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_USER="tdx-mcp"
APP_HOME="/opt/tdx-mcp"
PORT="${MCP_HTTP_PORT:-3000}"
NODE_VERSION="22"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TDX MCP Connector - Ubuntu Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}✗ This script must be run as root (use sudo)${NC}"
   exit 1
fi

echo -e "${YELLOW}Step 1: System Updates${NC}"
apt-get update
apt-get upgrade -y
apt-get install -y curl wget git build-essential

echo -e "${GREEN}✓ System updated${NC}"
echo ""

echo -e "${YELLOW}Step 2: Install Node.js ${NODE_VERSION}${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}"
else
    echo -e "${GREEN}✓ Node.js already installed: $(node --version)${NC}"
fi
echo ""

echo -e "${YELLOW}Step 3: Create Service User and Directory${NC}"
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -s /bin/bash -d "$APP_HOME" -m "$APP_USER"
    echo -e "${GREEN}✓ Created service user: $APP_USER${NC}"
else
    echo -e "${GREEN}✓ Service user already exists: $APP_USER${NC}"
fi

# Ensure home directory has correct permissions
mkdir -p "$APP_HOME"
chown -R "$APP_USER:$APP_USER" "$APP_HOME"
chmod 750 "$APP_HOME"
echo -e "${GREEN}✓ Directory permissions set: $APP_HOME${NC}"
echo ""

echo -e "${YELLOW}Step 4: Install Application Dependencies${NC}"
if [ -f "$APP_HOME/package.json" ]; then
    cd "$APP_HOME"
    sudo -u "$APP_USER" npm ci --production
    sudo -u "$APP_USER" npm run build
    echo -e "${GREEN}✓ Dependencies installed and built${NC}"
else
    echo -e "${YELLOW}⚠ package.json not found in $APP_HOME${NC}"
    echo -e "${YELLOW}  (Copy project files manually to $APP_HOME first)${NC}"
fi
echo ""

echo -e "${YELLOW}Step 5: Create Systemd Service${NC}"
cat > /etc/systemd/system/tdx-mcp.service << 'EOFSERVICE'
[Unit]
Description=TDX MCP HTTP Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=tdx-mcp
Group=tdx-mcp
WorkingDirectory=/opt/tdx-mcp
Environment="NODE_ENV=production"
Environment="MCP_HTTP_PORT=3000"
Environment="PORT=3000"
ExecStart=/usr/bin/node /opt/tdx-mcp/dist/http-wrapper.js

# Restart configuration
Restart=on-failure
RestartSec=10s
StartLimitInterval=300
StartLimitBurst=5

# Resource limits
LimitNOFILE=65536
LimitNPROC=512

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tdx-mcp

# Security
PrivateTmp=yes
NoNewPrivileges=yes
ReadOnlyPaths=/etc:/usr

[Install]
WantedBy=multi-user.target
EOFSERVICE

systemctl daemon-reload
echo -e "${GREEN}✓ Systemd service created: /etc/systemd/system/tdx-mcp.service${NC}"
echo ""

echo -e "${YELLOW}Step 6: Configuration${NC}"
echo -e "${BLUE}Environment Setup:${NC}"
echo "  - Service User: $APP_USER"
echo "  - Application Home: $APP_HOME"
echo "  - HTTP Port: $PORT"
echo "  - Node Version: $(node --version)"
echo "  - npm Version: $(npm --version)"
echo ""

echo -e "${YELLOW}Step 7: .env Configuration${NC}"
ENV_FILE="$APP_HOME/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Creating .env file at $ENV_FILE${NC}"
    cat > "$ENV_FILE" << 'EOFENV'
# TDX API Configuration
TDX_BASE_URL=https://service.pascocountyfl.net/TDXWebApi/api
TDX_BEID=1
TDX_WEB_SERVICES_KEY=your_web_services_key_here
TDX_APP_ID=your_app_id_here
TDX_ASSETS_APP_ID=your_assets_app_id_here
TDX_KB_APP_ID=your_kb_app_id_here

# HTTP Server Configuration
MCP_HTTP_PORT=3000
NODE_ENV=production

# API Security
MCP_API_KEY=your_secure_api_key_here

# Tool Access Control (false = read-only, true = allow modifications)
ALLOW_MODIFICATIONS=false

# Optional: Request Timeouts (milliseconds)
MCP_REQUEST_TIMEOUT_MS=60000
MCP_INIT_TIMEOUT_MS=30000
MCP_TOOLS_LIST_TIMEOUT_MS=30000
MCP_TOOLS_CALL_TIMEOUT_MS=180000
EOFENV
    
    chown "$APP_USER:$APP_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo -e "${YELLOW}⚠ .env file created with placeholder values${NC}"
    echo -e "${YELLOW}  Edit $ENV_FILE and add your actual credentials${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi
echo ""

echo -e "${YELLOW}Step 8: Service Verification${NC}"
systemctl enable tdx-mcp
systemctl start tdx-mcp

# Give it a moment to start
sleep 2

if systemctl is-active --quiet tdx-mcp; then
    echo -e "${GREEN}✓ Service started successfully${NC}"
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo -e "${YELLOW}Check logs with: sudo journalctl -u tdx-mcp -n 50${NC}"
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Edit .env file with your credentials:"
echo "   sudo nano $ENV_FILE"
echo ""
echo "2. Restart the service after updating .env:"
echo "   sudo systemctl restart tdx-mcp"
echo ""
echo "3. Verify the service is running:"
echo "   sudo systemctl status tdx-mcp"
echo ""
echo "4. Check the logs:"
echo "   sudo journalctl -u tdx-mcp -f"
echo ""
echo "5. Test the API (replace YOUR_IP):"
echo "   curl http://YOUR_IP:$PORT/health"
echo "   curl http://YOUR_IP:$PORT/tools"
echo ""
echo -e "${BLUE}Service Management:${NC}"
echo "  Start:   sudo systemctl start tdx-mcp"
echo "  Stop:    sudo systemctl stop tdx-mcp"
echo "  Restart: sudo systemctl restart tdx-mcp"
echo "  Status:  sudo systemctl status tdx-mcp"
echo "  Logs:    sudo journalctl -u tdx-mcp -f"
echo ""
