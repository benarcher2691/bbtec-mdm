# Deployment Scripts

This directory contains helper scripts for deploying Convex schema changes to different environments while preserving your local development settings.

## Available Scripts

### `deploy-convex-dev.sh`

Deploys Convex schema and functions to **cloud dev** environment (staging).

**Usage:**
```bash
./scripts/deploy-convex-dev.sh
# OR
npm run convex:deploy:dev
```

**What it does:**
- Backups your `.env.local` file
- Deploys to `kindly-mule-339` (cloud dev)
- Restores your original `.env.local` (preserves local settings)

**When to use:**
- After modifying `convex/schema.ts`
- After changing any Convex functions
- Before testing in Vercel preview deployment
- When promoting features to staging

---

### `deploy-convex-prod.sh`

Deploys Convex schema and functions to **production** environment.

**Usage:**
```bash
./scripts/deploy-convex-prod.sh
# OR
npm run convex:deploy:prod
```

**What it does:**
- Shows confirmation prompt (Press Enter to continue, Ctrl+C to cancel)
- Backups your `.env.local` file
- Deploys to `expert-lemur-691` (production)
- Restores your original `.env.local` (preserves local settings)

**When to use:**
- Before merging PR to `master` branch
- When schema changes need to be live before frontend deploy
- After thorough testing in staging

---

### `extract-apk-signature.sh`

Extracts APK signature hash in URL-safe Base64 format for Android device enrollment.

**Usage:**
```bash
./scripts/extract-apk-signature.sh path/to/app.apk
```

**What it does:**
- Uses `apksigner verify --print-certs` to extract SHA-256 hash
- Converts to URL-safe Base64 format (removes `=` padding, replaces `+/` with `-_`)
- Outputs the signature hash for use in enrollment configuration

**When to use:**
- After building a new APK variant
- When rotating keystores
- When adding new environment configuration

---

## Why These Scripts Exist

### The Problem

When deploying Convex schema changes, the standard command:
```bash
CONVEX_DEPLOYMENT=prod:kindly-mule-339 npx convex dev --once
```

...modifies your `.env.local` file, switching it from local development to cloud dev. This breaks your local development workflow until you manually revert the changes.

### The Solution

These scripts:
1. ✅ Backup your `.env.local` before deployment
2. ✅ Deploy to the target environment
3. ✅ Restore your original `.env.local`
4. ✅ Keep your local development settings intact

### Environment Architecture

| Environment | Convex Deployment | Config Location |
|------------|-------------------|-----------------|
| **Local Dev** | `http://127.0.0.1:3210` | `.env.local` (git-ignored) |
| **Staging** | `https://kindly-mule-339.convex.cloud` | Vercel Preview env vars |
| **Production** | `https://expert-lemur-691.convex.cloud` | Vercel Production env vars |

---

## Troubleshooting

### Script Permission Denied

```bash
chmod +x scripts/*.sh
```

### Wrong Environment After Running Script

Check your `.env.local`:
```bash
cat .env.local | grep CONVEX
```

Should show:
```
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
CONVEX_DEPLOYMENT=local:local-ben_archer2691-bbtec_mdm
```

If not, manually restore:
```bash
# Restore local settings
echo "NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210" > .env.local.temp
echo "CONVEX_DEPLOYMENT=local:local-ben_archer2691-bbtec_mdm" >> .env.local.temp
# Then merge with rest of your .env.local
```

### Deployment Failed

If deployment fails mid-script, your `.env.local.backup` file will still exist. Restore it manually:
```bash
mv .env.local.backup .env.local
```

---

## See Also

- **[docs/deployment-procedures.md](../docs/deployment-procedures.md)** - Complete deployment workflows
- **[docs/development-setup.md](../docs/development-setup.md)** - Local development setup
- **[planning/PLAN.md](../planning/PLAN.md)** - Current development plan
