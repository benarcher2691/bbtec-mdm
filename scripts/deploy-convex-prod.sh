#!/bin/bash
# Deploy Convex schema to cloud production without modifying .env.local

echo "🚀 Deploying to Convex PRODUCTION (expert-lemur-691)..."
echo "⚠️  This will update PRODUCTION! Press Ctrl+C to cancel, or Enter to continue..."
read

# Backup current .env.local
cp .env.local .env.local.backup

# Deploy to production
CONVEX_DEPLOYMENT=prod:expert-lemur-691 npx convex dev --once

# Restore original .env.local
mv .env.local.backup .env.local

echo "✅ Deployed to PRODUCTION! Local .env.local preserved."
