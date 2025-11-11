#!/bin/bash
# Deploy Convex schema to cloud dev without modifying .env.local

echo "📦 Deploying to Convex cloud dev (kindly-mule-339)..."

# Backup current .env.local
cp .env.local .env.local.backup

# Deploy to cloud dev
CONVEX_DEPLOYMENT=dev:kindly-mule-339 npx convex dev --once

# Restore original .env.local
mv .env.local.backup .env.local

echo "✅ Deployed! Local .env.local preserved."
