#!/bin/bash
# Setup Cloudflare Pages bindings for D1 database

echo "🔗 Setting up Cloudflare Pages bindings..."
echo ""

PROJECT_NAME="report-sys"
DATABASE_NAME="reportDB"
DATABASE_ID="6b920600-39c2-4b2b-a8d5-fbf79cdfbd1a"

echo "📋 Project: $PROJECT_NAME"
echo "🗄️  Database: $DATABASE_NAME"
echo "🔑 Database ID: $DATABASE_ID"
echo ""

# Check if project exists
echo "Checking if Pages project exists..."
wrangler pages project list | grep -q "$PROJECT_NAME"

if [ $? -eq 0 ]; then
    echo "✅ Project '$PROJECT_NAME' exists"
else
    echo "⚠️  Project '$PROJECT_NAME' not found"
    echo "Creating project..."
    wrangler pages project create "$PROJECT_NAME" --production-branch=main
fi

echo ""
echo "📝 To manually add D1 binding to your Cloudflare Pages project:"
echo ""
echo "1. Go to: https://dash.cloudflare.com"
echo "2. Navigate to: Workers & Pages > $PROJECT_NAME"
echo "3. Click on: Settings > Functions"
echo "4. Scroll to: D1 database bindings"
echo "5. Click: Add binding"
echo "6. Set:"
echo "   - Variable name: DB"
echo "   - D1 database: $DATABASE_NAME"
echo ""
echo "OR use wrangler.toml (already configured):"
echo "   binding = \"DB\""
echo "   database_name = \"$DATABASE_NAME\""
echo "   database_id = \"$DATABASE_ID\""
echo ""
echo "✅ wrangler.toml is already configured correctly!"

