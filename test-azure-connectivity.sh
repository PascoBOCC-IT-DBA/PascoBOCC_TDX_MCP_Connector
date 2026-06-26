#!/bin/sh
# Test connectivity from inside Azure container

echo "===================================================="
echo "Testing TDX connectivity from Azure Container"
echo "===================================================="
echo ""

echo "1. Testing DNS resolution..."
nslookup service.pascocountyfl.net
echo ""

echo "2. Testing HTTPS connectivity..."
curl -v --max-time 5 https://service.pascocountyfl.net/TDWebApi/api 2>&1 | head -20
echo ""

echo "3. Testing TDX authentication..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"BEID":"20AE9C5F-5CAE-4FDD-B530-117577ED5CA4","WebServicesKey":"C61CF0AA-C7A5-40FF-A033-AED09449E8B8"}' \
  https://service.pascocountyfl.net/TDWebApi/api/auth/loginadmin \
  --max-time 5 | head -c 100
echo ""
echo ""
echo "Done."
