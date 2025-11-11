# Claude Code Context

This file provides context for Claude Code when working on this project.

## On Start-Up


## Project Overview

Educational Android Mobile Device Management (MDM) system for managing Android Enterprise devices. Allows creation of enrollment tokens, QR code generation, APK distribution, and device management.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19 RC, TypeScript 5
- **Backend**: Convex (realtime database, queries, mutations)
- **Authentication**: Clerk
- **Styling**: Tailwind CSS + shadcn/ui (New York style, Radix primitives)
- **Deployment**: Vercel (frontend), Convex (hosted), Clerk (hosted)

## Architecture Principles

1. **Server Actions**: Use sparingly, only for auth/session bridging or device management operations
2. **Data Operations**: All CRUD operations go through Convex queries/mutations
3. **Realtime First**: Leverage Convex's built-in realtime capabilities
4. **Type Safety**: Strict TypeScript throughout - NEVER use `any` type
5. **Component Composition**: Prefer composition over inheritance, use shadcn/ui patterns
6. **Security**: All Convex functions must have server-side auth checks (`ctx.auth.getUserIdentity()`)

## Coding Conventions

### TypeScript
- Use strict mode
- **NEVER use `any` type** - always use proper types, `unknown`, or generics
- Prefer `interface` over `type` for object shapes
- Explicitly type function returns
- Use Convex's generated types for queries/mutations

### React
- Functional components only
- Use hooks (useState, useEffect, custom hooks)
- Prefer named exports
- Keep components small and focused
- Use `"use client"` directive only when necessary
- **Authentication**: Always use `useAppAuth()` hook and Convex auth wrapper components (`<Authenticated>`, `<Unauthenticated>`, `<AuthLoading>`)

### Styling
- Tailwind utility classes preferred
- Use shadcn/ui components as base
- Responsive design: mobile-first, then tablet/desktop

### Naming
- Components: PascalCase (e.g., `DeviceList.tsx`)
- Files: kebab-case for utilities (e.g., `format-date.ts`)
- Convex functions: camelCase (e.g., `getDevices.ts`)
- Constants: UPPER_SNAKE_CASE

### File Organization
- One component per file
- Colocate related components
- Index files for clean exports
- Keep utils/helpers in `/lib`

## Development Workflow

### Multi-Environment Setup

This project uses a 3-tier development workflow:
- **Local**: True offline development (Convex backend on your machine, Next.js on localhost)
- **Cloud Dev**: Staging environment (Vercel preview + Convex dev deployment)
- **Cloud Production**: Production (Vercel + Convex production deployment)

### Starting Local Development (Recommended)

**Terminal 1 - Convex Local Backend:**
```bash
npx convex dev --local
# Runs Convex backend at http://127.0.0.1:3210
# Database stored in ~/.convex/ (completely offline!)
# No quota usage, no internet required after initial setup
```

**Terminal 2 - Next.js Dev Server:**
```bash
NEXT_PRIVATE_TURBOPACK=0 npm run dev
# Runs at http://localhost:3000
# IMPORTANT: Disable Turbopack (Next.js 15 + React 19 RC compatibility)
```

**Note:** If you get webpack chunk loading errors, clean build cache:
```bash
rm -rf .next && rm -rf node_modules/.cache
NEXT_PRIVATE_TURBOPACK=0 npm run dev
```

### Local Development Features
- ✅ **Completely offline** (after initial Convex setup)
- ✅ **No cloud quota usage** (develop without limits!)
- ✅ **Isolated database** (changes don't affect dev/prod)
- ✅ **Fast iteration** (no network latency)
- ✅ **Local Convex dashboard** available
- ✅ **Dynamic IP detection** (automatically detects LAN IP for device enrollment)

### Dynamic IP Detection (Local Development)

**Problem:** When your development machine's IP changes (DHCP reassignment, different network), QR codes with hardcoded IPs break.

**Solution:** Automatic LAN IP detection for local development only.

#### How It Works

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

#### Environment Behavior

- **Local** (`NEXT_PUBLIC_CONVEX_URL` contains `127.0.0.1`):
  - Detects actual LAN IP from network interfaces
  - Automatically updates when IP changes
  - APK downloaded via streaming (offline-friendly)
  - Shows detected IP in enrollment UI

- **Cloud** (staging/production on Vercel):
  - Uses configured `NEXT_PUBLIC_APP_URL`
  - No dynamic detection (not needed)
  - APK redirected to Convex CDN (efficient)

#### Files Involved

- **`/src/lib/network-detection.ts`** - Core detection logic (shared utility)
- **`/src/app/api/network-info/route.ts`** - API endpoint for client-side consumption
- **`/src/hooks/useServerUrl.ts`** - React hook for components
- **`/src/app/actions/enrollment.ts`** - Server action uses detection for QR generation
- **`/src/components/qr-code-generator.tsx`** - Displays detected network info

#### Logs to Watch

```bash
[NETWORK-INFO] Environment detected: local/cloud
[NETWORK-INFO] Detected LAN IP: 192.168.1.13 (wlan0)
[NETWORK-INFO] Server URL: http://192.168.1.13:3000
[QR-GEN] Network detection result: {...}
```

#### When IP Changes

1. Restart Next.js dev server
2. Enrollment page auto-detects new IP
3. Generate new QR code (old ones have old IP)
4. Test enrollment with new QR

**No manual configuration needed!** 🎉

### Alternative: Cloud Dev Workflow

If you need to test against cloud dev deployment:
```bash
# Terminal 1: Cloud Convex dev deployment
npx convex dev  # Connects to kindly-mule-339 (dev)

# Terminal 2: Next.js
npm run dev
```

Uses `.env.local` pointing to cloud dev deployment.

### Other Commands

- **Type checking**: `npm run type-check` (if available)
- **Linting**: `npm run lint`
- **Deploy Convex schema**: `npx convex deploy` (production deployment)

## Git Workflow

**CRITICAL: NEVER PUSH DIRECTLY TO MAIN/MASTER OR DEVELOPMENT**

Branch protection is enabled on both `master` and `development` branches. All changes must go through Pull Requests.

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

1. **Start new feature:**
   ```bash
   git checkout development
   git pull
   git checkout -b feature/your-feature-name
   ```

2. **Develop locally:**
   - Run `npx convex dev --local` + `NEXT_PRIVATE_TURBOPACK=0 npm run dev`
   - Make changes, test, commit

3. **Push and create PR to development:**
   ```bash
   git add .
   git commit -m "feat: Your feature description"
   git push -u origin feature/your-feature-name
   ```
   - Create PR: `feature/your-feature-name` → `development` on GitHub
   - Vercel automatically creates preview deployment
   - Preview uses `kindly-mule-339` (Convex dev deployment)

4. **Test on Vercel preview, then merge to development**

5. **When ready for production:**
   - Create PR: `development` → `master` on GitHub
   - Review and merge
   - Auto-deploys to production (uses `expert-lemur-691` Convex deployment)

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

## Platform Management: Web UI First, CLI Later

**Philosophy:** Use web dashboards (Vercel, Convex) for learning and setup. Graduate to CLI commands when you understand the platform and need automation.

### Why This Matters

- **Dashboards provide visual feedback** - See exactly what you're changing before applying
- **Prevent costly mistakes** - Visual confirmation reduces deployment errors
- **Better for learning** - Explore features by clicking around
- **Troubleshooting** - Dashboard shows true state when CLI acts weird

### When to Use What

**Use Web Dashboard:**
- ✅ Setting up for the first time (environment variables, deployments)
- ✅ Learning a new feature or platform
- ✅ Troubleshooting issues (verify actual state)
- ✅ Making critical changes (production deployments, secrets)

**Use CLI Commands:**
- ✅ Daily development workflow (convex dev, npm run dev)
- ✅ Tasks you've done 3+ times via dashboard
- ✅ Automation and CI/CD pipelines
- ✅ Repetitive operations

### Platform-Specific Guidance

**Vercel Dashboard:** Use for environment variables, deployment management, build settings
**Convex Dashboard:** Use for creating deployments, schema inspection, deploy key management

### Golden Rule

**"If you wouldn't click 'Apply' on a web form, don't run the terminal command."**

## Security

- Never expose Clerk secret keys client-side
- Validate all user input
- Rate limit write operations
- Scope all Convex queries by userId
- **All Convex functions must check `auth.getUserIdentity()` for authorization**
- **All endpoints must be protected (not open)

## Important Notes

### Convex
- All queries/mutations must check `auth.getUserIdentity()` for authorization
- Use indexes for performance (userId, deviceId, etc.)
- Use Convex authentication wrapper components to prevent sign-out errors
- **CRITICAL - Schema Changes**: After modifying `convex/schema.ts` or any Convex functions, ALWAYS run `npx convex deploy` to deploy to production
  - Schema changes are NOT automatically deployed
  - Frontend deployment (Vercel) does NOT deploy Convex backend
  - Symptoms of missing deployment: crashes, missing fields, "field not found" errors
  - **ALWAYS ASK USER**: "Should I run `npx convex deploy` to deploy schema changes?"
- **CRITICAL - Optional Fields**: Convex optional fields use `undefined`, NOT `null`
  - Schema: `v.optional(v.string())` → TypeScript: `string | undefined`
  - When inserting/updating: Use `field: value || undefined`, NOT `field: value || null`
  - Example: `{ name: name || undefined }` ✅ NOT `{ name: name || null }` ❌
  - TypeScript error: "Type 'null' is not assignable to type 'string | undefined'"

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

### Cloud Dev (`.env.development` - reference only, set in Vercel)

```bash
# Convex Dev Deployment (for Vercel preview)
NEXT_PUBLIC_CONVEX_URL=https://kindly-mule-339.convex.cloud
CONVEX_DEPLOYMENT=prod:kindly-mule-339

# Clerk (same test keys as local)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Cloud Production (`.env.production` - reference only, set in Vercel)

```bash
# Convex Production Deployment
NEXT_PUBLIC_CONVEX_URL=https://expert-lemur-691.convex.cloud
CONVEX_DEPLOYMENT=prod:expert-lemur-691

# Clerk (same test keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**Security:** Never commit `.env.local`, `.env.development`, or `.env.production` - they contain secrets!

## Android Client Build Variants

The Android client uses **Product Flavors** to support multiple server environments:

### Build Variants

| Flavor | Server URL | Application ID | Use Case |
|--------|------------|----------------|----------|
| **local** | `http://localhost:3000/api/client` | `com.bbtec.mdm.client.local` | Local development (physical device + `adb reverse`) |
| **staging** | `https://bbtec-mdm-git-development.vercel.app/api/client` | `com.bbtec.mdm.client.staging` | Testing against Vercel preview |
| **production** | `https://bbtec-mdm.vercel.app/api/client` | `com.bbtec.mdm.client` | Production deployment |

### Build Commands

```bash
cd android-client

# Local development (install on physical device)
./gradlew installLocalDebug
adb reverse tcp:3000 tcp:3000  # Forward localhost to device

# Staging testing
./gradlew assembleStagingRelease
adb install -r app/build/outputs/apk/staging/release/app-staging-release.apk

# Production release (for MDM distribution)
./gradlew assembleProductionRelease
# APK: app/build/outputs/apk/production/release/app-production-release.apk
```

### Multiple Variants on Same Device

Because each flavor has a different Application ID, you can install all three simultaneously for testing/comparison.

**Full documentation:** See [`docs/android-build-variants.md`](docs/android-build-variants.md)
