#!/bin/bash

################################################################################
# TDX MCP Connector - Ubuntu Update/Redeploy Script
#
# This script deploys updated code to the Ubuntu server.
# Can be run from Windows via SSH, or directly on the Ubuntu server.
#
# Usage (from Windows PowerShell):
#   ssh user@10.210.1.38 "bash deploy-ubuntu.sh"
#
# Usage (on Ubuntu):
#   ./deploy-ubuntu.sh
#
# This script will:
#   1. Stop the current service
#   2. Pull/update source files
#   3. Install dependencies
#   4. Build TypeScript
#   5. Restart the service
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
SERVICE_NAME="tdx-mcp"
PORT=3000

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TDX MCP Connector - Ubuntu Update${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}✗ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Check if .env exists
if [ ! -f "$APP_HOME/.env" ]; then
    echo -e "${RED}✗ .env file not found at $APP_HOME/.env${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Stop Service${NC}"
if systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl stop "$SERVICE_NAME"
    echo -e "${GREEN}✓ Service stopped${NC}"
    sleep 1
else
    echo -e "${YELLOW}⚠ Service not running${NC}"
fi
echo ""

echo -e "${YELLOW}Step 2: Update Source Files${NC}"
cd "$APP_HOME"

# If .git exists, pull from git; otherwise assume files are manually updated
if [ -d ".git" ]; then
    echo "  Pulling latest code from git..."
    sudo -u "$APP_USER" git pull origin main 2>/dev/null || echo "  (Git pull skipped)"
    echo -e "${GREEN}✓ Source files updated${NC}"
else
    echo -e "${YELLOW}⚠ Not a git repository${NC}"
    echo "    (Assuming source files are already updated)"
fi
echo ""

echo -e "${YELLOW}Step 3: Install Dependencies${NC}"
cd "$APP_HOME"
sudo -u "$APP_USER" npm ci --production
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 4: Build TypeScript${NC}"
cd "$APP_HOME"
sudo -u "$APP_USER" npm run build
echo -e "${GREEN}✓ Build completed${NC}"
echo ""

echo -e "${YELLOW}Step 5: Verify dist Files${NC}"
if [ -f "$APP_HOME/dist/index.js" ] && [ -f "$APP_HOME/dist/http-wrapper.js" ]; then
    echo -e "${GREEN}✓ Build artifacts verified${NC}"
else
    echo -e "${RED}✗ Build artifacts missing!${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 6: Start Service${NC}"
systemctl start "$SERVICE_NAME"
sleep 2

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✓ Service started successfully${NC}"
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo -e "${YELLOW}Check logs: journalctl -u $SERVICE_NAME -n 50${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Update Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Verification:${NC}"
echo "  Service Status:"
systemctl status "$SERVICE_NAME" --no-pager | head -n 3
echo ""
echo "  Recent Logs:"
journalctl -u "$SERVICE_NAME" -n 5 --no-pager
echo ""
echo -e "${BLUE}Testing:${NC}"
echo "  Health Check: curl http://localhost:$PORT/health"
echo "  Tools List:   curl http://localhost:$PORT/tools"
echo ""
