#!/bin/sh
echo "Testing TDX connectivity from Azure Container App..."
echo ""
curl -v --max-time 10 https://service.pascocountyfl.net/TDWebApi/api 2>&1 | head -20
