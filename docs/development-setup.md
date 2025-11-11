# Development Setup Guide

Complete guide for setting up and working with the BBTec MDM project.

**Tech Stack:**
- Next.js 15 (App Router) + React 19 RC + TypeScript 5
- Convex (realtime database)
- Clerk (authentication)
- Vercel (deployment)

---

## Multi-Environment Architecture

This project uses a 3-tier development workflow:

| Environment | Purpose | Convex Deployment | Vercel | Database |
|-------------|---------|-------------------|--------|----------|
| **Local** | Offline development | `127.0.0.1:3210` | localhost:3000 | `~/.convex/` (offline) |
| **Cloud Dev** (Staging) | Preview/testing | `kindly-mule-339` | Preview deploy | Cloud (isolated) |
| **Production** | Live system | `expert-lemur-691` | Production deploy | Cloud (production) |

---

## Local Development Setup (Recommended)

### Terminal 1: Convex Local Backend

```bash
npx convex dev --local
```

**What it does:**
- Runs Convex backend at `http://127.0.0.1:3210`
- Database stored in `~/.convex/` (completely offline)
- No cloud quota usage
- No internet required after initial setup
- Local Convex dashboard available

### Terminal 2: Next.js Dev Server

```bash
NEXT_PRIVATE_TURBOPACK=0 npm run dev
```

**Important:** Disable Turbopack for Next.js 15 + React 19 RC compatibility

**If you get webpack chunk loading errors:**
```bash
rm -rf .next && rm -rf node_modules/.cache
NEXT_PRIVATE_TURBOPACK=0 npm run dev
```

### Local Development Features

- ✅ **Completely offline** (after initial Convex setup)
- ✅ **No cloud quota usage** (develop without limits)
- ✅ **Isolated database** (changes don't affect dev/prod)
- ✅ **Fast iteration** (no network latency)
- ✅ **Dynamic IP detection** (auto-detects LAN IP for device enrollment)

---

## Dynamic IP Detection (Local Development)

### Problem

When your development machine's IP changes (DHCP reassignment, different network), QR codes with hardcoded IPs break.

### Solution

Automatic LAN IP detection for local development only.

### How It Works

```
┌─────────────────────┐
│  Enrollment Page    │
│  (Browser)          │
└──────────┬──────────┘
           │ Fetch LAN IP
           ▼
┌─────────────────────┐
│ /api/network-info   │
│ (detects actual IP) │
└──────────┬──────────┘
           │ Returns: http://192.168.1.13:3000
           ▼
┌─────────────────────┐
│ QR Code Generated   │
│ (with detected IP)  │
└─────────────────────┘
```

### Environment Behavior

**Local** (`NEXT_PUBLIC_CONVEX_URL` contains `127.0.0.1`):
- Detects actual LAN IP from network interfaces
- Automatically updates when IP changes
- APK downloaded via streaming (offline-friendly)
- Shows detected IP in enrollment UI

**Cloud** (staging/production on Vercel):
- Uses configured `NEXT_PUBLIC_APP_URL`
- No dynamic detection (not needed)
- APK redirected to Convex CDN (efficient)

### Files Involved

- **`/src/lib/network-detection.ts`** - Core detection logic (shared utility)
- **`/src/app/api/network-info/route.ts`** - API endpoint for client-side consumption
- **`/src/hooks/useServerUrl.ts`** - React hook for components
- **`/src/app/actions/enrollment.ts`** - Server action uses detection for QR generation
- **`/src/components/qr-code-generator.tsx`** - Displays detected network info

### Logs to Watch

```bash
[NETWORK-INFO] Environment detected: local/cloud
[NETWORK-INFO] Detected LAN IP: 192.168.1.13 (wlan0)
[NETWORK-INFO] Server URL: http://192.168.1.13:3000
[QR-GEN] Network detection result: {...}
```

### When IP Changes

1. Restart Next.js dev server
2. Enrollment page auto-detects new IP
3. Generate new QR code (old ones have old IP)
4. Test enrollment with new QR

**No manual configuration needed!** 🎉

---

## Environment Variables

### Local Development (`.env.local`)

```bash
# Convex Local Backend (runs on your machine)
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
CONVEX_DEPLOYMENT=local:local-ben_archer2691-bbtec_mdm

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_ISSUER_URL=https://living-skunk-13.clerk.accounts.dev

# Next.js
NODE_ENV=development
```

**Note:** Convex will auto-update `CONVEX_DEPLOYMENT` when you run `npx convex dev --local`.

### Cloud Dev (`.env.development`)

⚠️ **Do NOT commit this file** - Set these in Vercel dashboard instead.

```bash
# Convex Dev Deployment (for Vercel preview)
NEXT_PUBLIC_CONVEX_URL=https://kindly-mule-339.convex.cloud
CONVEX_DEPLOYMENT=prod:kindly-mule-339

# Clerk (same test keys as local)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Cloud Production (`.env.production`)

⚠️ **Do NOT commit this file** - Set these in Vercel dashboard instead.

```bash
# Convex Production Deployment
NEXT_PUBLIC_CONVEX_URL=https://expert-lemur-691.convex.cloud
CONVEX_DEPLOYMENT=prod:expert-lemur-691

# Clerk (same test keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**Security:** Never commit `.env.local`, `.env.development`, or `.env.production` - they contain secrets!

---

## Git Workflow

### Branch Protection

**CRITICAL:** Branch protection is enabled on `master` and `development`. All changes MUST go through Pull Requests.

### Branch Structure

```
master (production)          ← Protected, auto-deploys to production
  ↑
  PR + Review
  ↑
development (staging)        ← Protected, auto-deploys to Vercel preview
  ↑
  PR + Review
  ↑
feature/* branches           ← Local development
```

### Daily Workflow

**1. Start new feature:**
```bash
git checkout development
git pull
git checkout -b feature/your-feature-name
```

**2. Develop locally:**
- Run `npx convex dev --local` + `NEXT_PRIVATE_TURBOPACK=0 npm run dev`
- Make changes, test, commit

**3. Push and create PR to development:**
```bash
git add .
git commit -m "feat: Your feature description"
git push -u origin feature/your-feature-name
```
- Create PR: `feature/your-feature-name` → `development` on GitHub
- Vercel automatically creates preview deployment
- Preview uses `kindly-mule-339` (Convex dev deployment)

**4. Test on Vercel preview, then merge to development**

**5. When ready for production:**
- Create PR: `development` → `master` on GitHub
- Review and merge
- Auto-deploys to production (uses `expert-lemur-691` Convex deployment)

### Branch Naming Conventions

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

---

## Convex Best Practices

### Schema Changes

**CRITICAL:** After modifying `convex/schema.ts` or any Convex functions:

```bash
# Deploy to cloud dev (staging)
npm run convex:deploy:dev

# Deploy to production
npm run convex:deploy:prod
```

**Why this matters:**
- Schema changes are NOT automatically deployed
- Frontend deployment (Vercel) does NOT deploy Convex backend
- Symptoms of missing deployment: crashes, missing fields, "field not found" errors
- These scripts preserve your local .env.local settings

**Always ask before deploying:** "Should I run deployment scripts to deploy schema changes?"

### Optional Fields

**CRITICAL:** Convex optional fields use `undefined`, NOT `null`

```typescript
// Schema definition
defineTable({
  name: v.optional(v.string()),  // → TypeScript: string | undefined
})

// Correct usage
{ name: name || undefined }  // ✅

// Wrong usage
{ name: name || null }       // ❌ TypeScript error!
```

**Error you'll see:** `Type 'null' is not assignable to type 'string | undefined'`

### Authentication in Convex Functions

**All Convex queries/mutations must check auth:**

```typescript
export const getDevices = query({
  args: {},
  handler: async (ctx) => {
    // CRITICAL: Check auth server-side
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    // Only return user's own devices
    return await ctx.db
      .query("devices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});
```

**Pattern:**
1. Call `ctx.auth.getUserIdentity()` at the start
2. Throw error if not authenticated
3. Extract `userId` from identity
4. Filter all queries by `userId`

### Performance

- Use indexes for all common query patterns (userId, deviceId, etc.)
- Use Convex authentication wrapper components (`<Authenticated>`, `<AuthLoading>`)
- See `docs/authentication-patterns.md` for preventing sign-out errors

---

## Android Build Variants

The Android client uses **Product Flavors** for multiple environments.

### Quick Reference

```bash
cd android-client

# Local development
./gradlew installLocalDebug

# Staging
./gradlew assembleStagingRelease

# Production
./gradlew assembleProductionRelease
```

**Full documentation:** See `docs/android-build-variants.md`

---

## Common Commands

### Development
```bash
# Start local Convex
npx convex dev --local

# Start Next.js (disable Turbopack)
NEXT_PRIVATE_TURBOPACK=0 npm run dev

# Linting
npm run lint

# Type checking (if configured)
npm run type-check
```

### Deployment
```bash
# Deploy Convex schema/functions to cloud dev (staging)
npm run convex:deploy:dev

# Deploy Convex schema/functions to production
npm run convex:deploy:prod

# Vercel deployments happen automatically via Git push
# (no manual command needed)
```

### Android Build
```bash
cd android-client

# Build local debug APK
./gradlew clean assembleLocalDebug

# Install on connected device
./gradlew installLocalDebug

# List installed variants
adb shell pm list packages | grep bbtec
```

---

## Troubleshooting

### Webpack Chunk Loading Errors

**Symptom:** `Loading chunk X failed` errors in browser console

**Solution:**
```bash
rm -rf .next && rm -rf node_modules/.cache
NEXT_PRIVATE_TURBOPACK=0 npm run dev
```

### "Not authenticated" Errors During Sign-Out

**Symptom:** Convex queries fail when user signs out

**Solution:** See `docs/authentication-patterns.md` for the complete fix using `useAppAuth()` hook and `<Authenticated>` wrapper components.

### Convex Schema Mismatch

**Symptom:** "Field not found" or crashes after code changes

**Solution:**
```bash
# Deploy to cloud dev (staging)
npm run convex:deploy:dev

# Deploy to production
npm run convex:deploy:prod
```

Schema changes are NOT automatically deployed. Always deploy after modifying `convex/schema.ts`.

### IP Address Changed (Local Development)

**Symptom:** Device enrollment fails after network change

**Solution:**
1. Restart Next.js dev server
2. Enrollment page auto-detects new IP
3. Generate new QR code
4. Test enrollment

**No configuration needed** - dynamic IP detection handles this automatically.

---

## Platform Management Philosophy

**Use web dashboards first, CLI later.**

### Why This Matters

- Dashboards provide visual feedback
- Prevent costly mistakes
- Better for learning
- Troubleshooting shows true state

### When to Use What

**Use Web Dashboard:**
- ✅ Setting up for the first time
- ✅ Learning a new feature
- ✅ Troubleshooting issues
- ✅ Making critical changes (production deployments, secrets)

**Use CLI Commands:**
- ✅ Daily development workflow
- ✅ Tasks you've done 3+ times via dashboard
- ✅ Automation and CI/CD pipelines

**Golden Rule:** "If you wouldn't click 'Apply' on a web form, don't run the terminal command."

---

## Security Guidelines

- ✅ Never expose Clerk secret keys client-side
- ✅ Validate all user input
- ✅ Rate limit write operations
- ✅ Scope all Convex queries by userId
- ✅ All Convex functions must check `ctx.auth.getUserIdentity()`
- ✅ All endpoints must be protected (not open)
- ✅ Never commit `.env.*` files

---

**Last Updated:** 2025-11-11
**Version:** 1.0 (Extracted from CLAUDE.md for permanence)
