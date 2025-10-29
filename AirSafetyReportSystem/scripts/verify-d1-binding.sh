#!/bin/bash
# Verify D1 binding is working

echo "🔍 Verifying D1 Database Binding..."
echo ""

PROJECT_URL="https://report-sys.pages.dev"

# Test health endpoint
echo "1️⃣ Testing health endpoint..."
echo "GET $PROJECT_URL/api/health"
echo ""

curl -s "$PROJECT_URL/api/health" | jq '.'

echo ""
echo "2️⃣ Expected response:"
echo '{
  "status": "ok",
  "database": "D1 connected",
  "environment": "production"
}'

echo ""
echo "3️⃣ If you see D1 errors, manually add the binding:"
echo ""
echo "   🌐 Go to: https://dash.cloudflare.com"
echo "   📁 Navigate to: Workers & Pages > report-sys > Settings > Functions"
echo "   🔗 Add D1 database binding:"
echo "      Variable name: DB"
echo "      D1 database: reportDB"
echo ""

