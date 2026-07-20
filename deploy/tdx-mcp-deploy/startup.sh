#!/bin/bash
set -e

echo "Starting TDX MCP Connector..."
cd /home/site/wwwroot

# Install dependencies
echo "Installing dependencies..."
npm ci --production

# Set NODE_ENV
export NODE_ENV=production

# Start app with PORT from Azure (defaults to 3000)
echo "Starting Node.js application..."
exec node dist/http-wrapper.js
