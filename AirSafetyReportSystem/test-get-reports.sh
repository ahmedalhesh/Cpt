#!/bin/bash
# Test GET /api/reports endpoint

echo "🧪 Testing GET /api/reports endpoint..."
echo ""

# Test without auth (should work with fallback)
echo "1️⃣ Testing without auth token..."
curl -s -X GET "https://23c523eb.report-sys.pages.dev/api/reports" | jq '. | length' || echo "Failed"

echo ""
echo "2️⃣ Full response (first report):"
curl -s -X GET "https://23c523eb.report-sys.pages.dev/api/reports" | jq '.[0]' || echo "No reports"

echo ""
echo "✅ Test complete!"

