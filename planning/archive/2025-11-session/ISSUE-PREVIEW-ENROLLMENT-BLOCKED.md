# Issue: Preview Enrollment Blocked by Vercel Authentication

**Date:** 2025-11-12
**Status:** ✅ RESOLVED - Two Issues Fixed
**Severity:** CRITICAL - Blocks all preview enrollment testing (FIXED)

---

## Problem Summary

Android device enrollment fails on Vercel preview deployments with error: **"Couldn't download admin app"**

Production enrollment works perfectly. Preview enrollment fails consistently.

**Root Cause:** Vercel Deployment Protection returns **HTTP 401 Unauthorized** when Android devices attempt to download the APK, blocking enrollment before the request reaches Next.js code.

---

## Investigation Timeline

### Initial Symptom: QR Code Density (SOLVED ✅)

**Issue:** QR codes appeared unscannable with web QR readers
**Cause:** Long preview URLs (56-65 chars vs 24 chars production)
**Solution:** Reduced QR error correction from 'M' to 'L', margin from 4 to 2
**Result:** QR codes now scan successfully ✅

### Actual Root Cause: Vercel Authentication (UNSOLVED ❌)

**Issue:** APK download returns HTTP 401
**Evidence:**
```bash
$ curl -I "https://bbtec-4dpkzqkf0-ben-archers-projects.vercel.app/api/apps/kg27..."
HTTP/2 401
set-cookie: _vercel_sso_nonce=...
```

**Comparison with Production:**
```bash
$ curl -I "https://bbtec-mdm.vercel.app/api/apps/kg237..."
HTTP/2 307
location: https://expert-lemur-691.convex.cloud/api/storage/...
```

**Key Finding:** Vercel Deployment Protection intercepts requests at the edge BEFORE reaching Next.js functions.

---

## Technical Details

### What's Happening

1. **Production Flow (WORKS):**
   ```
   Android → https://bbtec-mdm.vercel.app/api/apps/[id]
   → Next.js handler (no auth)
   → 307 redirect to Convex storage
   → Android downloads APK (200 OK)
   → Enrollment succeeds ✅
   ```

2. **Preview Flow (FAILS):**
   ```
   Android → https://bbtec-4dpkzqkf0-.../api/apps/[id]
   → Vercel Auth Protection (edge)
   → 401 Unauthorized ❌
   → Android never reaches Next.js
   → "Couldn't download admin app"
   ```

### Evidence from Logs

**Vercel logs show:**
- ✅ QR generation succeeds (multiple `[QR GEN]` entries)
- ❌ NO `[APK DOWNLOAD]` logs during enrollment attempt
- **Conclusion:** Request blocked before reaching Next.js

**cURL test shows:**
```
< HTTP/2 401
< cache-control: no-store, max-age=0
< set-cookie: _vercel_sso_nonce=P4b3zYrKXQcVUjPWqMJa4zqv
< x-vercel-id: arn1::kn72d-1762959740833-aba0502ac2f3
```

This is **Vercel SSO authentication page** being returned instead of the APK.

### Why Production Works

- Production has **NO Vercel Deployment Protection** enabled
- Preview has **Vercel Authentication** enabled (default for preview deployments)
- Android devices during factory reset **cannot authenticate** with Vercel SSO

---

## Solution

### Recommended: Add Bypass Token to APK URLs

**Vercel provides:** `x-vercel-protection-bypass` parameter for automation

**Implementation Steps:**

1. **Get bypass token from Vercel:**
   - Dashboard → Settings → Deployment Protection
   - "Protection Bypass for Automation"
   - Token: `tsT7Hz1bOUWw87B23j6PbT99QVK5X9MF`

2. **Add to Vercel environment variables:**
   - Settings → Environment Variables
   - Name: `VERCEL_AUTOMATION_BYPASS_SECRET`
   - Value: `tsT7Hz1bOUWw87B23j6PbT99QVK5X9MF`
   - **Environments: Preview ONLY** ⚠️

3. **Update code** (src/app/actions/enrollment.ts):
   ```typescript
   let apkUrl = `${serverUrl}/api/apps/${currentApk.storageId}`

   // Add bypass token for preview deployments
   const bypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
   if (bypassToken) {
     apkUrl += `?x-vercel-protection-bypass=${bypassToken}`
   }
   ```

**Result:**
- ✅ Production: No token (not needed, no protection)
- ✅ Local: No token (not needed, no Vercel)
- ✅ Preview: Token added → Bypass auth → Download works

---

## Why This Happened

**Common Misunderstanding:** "I set up other projects without this issue"

**Explanation:** Vercel Deployment Protection is **opt-in**, not automatic:
- You (or someone) explicitly enabled it for this project
- Other projects likely don't have it enabled
- Production doesn't have it (that's why it works)

**Where to check:**
- Vercel Dashboard → Project Settings → Deployment Protection
- Look for "Vercel Authentication" toggle

---

## Alternative Solutions (Not Recommended)

### Option 1: Disable Deployment Protection for Preview
**Why not:** Removes all protection, less secure

### Option 2: Use Custom Domain for Preview
**Why not:** Adds complexity, doesn't solve auth issue

### Option 3: Test Only on Local/Production
**Why not:** Defeats purpose of staging environment

---

## Testing Plan

**After implementing fix:**

1. Add env var to Vercel (Preview only)
2. Deploy code change to preview
3. Generate new enrollment QR code
4. Attempt enrollment on factory-reset device
5. Verify APK downloads successfully (no 401)
6. Confirm enrollment completes

**Expected logs after fix:**
```
[QR GEN] Added Vercel bypass token to APK URL (preview deployment)
[APK DOWNLOAD] Request received
[APK DOWNLOAD] SUCCESS: Redirecting to Convex storage
```

---

## Related Files

- **Code:** `src/app/actions/enrollment.ts` (QR generation with APK URL)
- **API Route:** `src/app/api/apps/[storageId]/route.ts` (APK download handler)
- **Documentation:** `docs/ISSUE-PREVIEW-QR-DENSITY.md` (QR density analysis - archived)

---

## Lessons Learned

1. **Vercel edge protection** intercepts requests before Next.js
2. **Factory-reset Android devices** cannot authenticate with browser-based SSO
3. **Always test with actual device enrollment**, not just web UI
4. **Check HTTP headers with curl** when debugging blocked requests
5. **Vercel logs only show requests that reach Next.js**, not edge blocks

---

## ✅ Solution Implemented (2025-11-12)

### Issue #1: Vercel Authentication Blocking APK Downloads

**Problem:** HTTP 401 when Android devices tried to download APK from preview deployments

**Solution:** Disabled "Vercel Authentication" for preview deployments in project settings
- Path: Vercel Dashboard → Settings → Deployment Protection
- Turned off "Vercel Authentication" toggle
- Result: APK downloads now return HTTP 307 (redirect) instead of HTTP 401 ✅

**Alternative (Not Used):** Add `VERCEL_AUTOMATION_BYPASS_SECRET` environment variable with bypass token. We chose to disable authentication instead for simplicity.

### Issue #2: Package Name Mismatch

**Problem:** QR code hardcoded `com.bbtec.mdm.client` but staging APK used `com.bbtec.mdm.client.staging`

**Solution:** Made QR code generation environment-aware in `src/app/actions/enrollment.ts`
```typescript
// Environment detection
const isPreview = process.env.VERCEL_ENV === 'preview'
const isLocal = process.env.NEXT_PUBLIC_CONVEX_URL?.includes('127.0.0.1')

// Package name selection
if (isPreview) {
  packageName = 'com.bbtec.mdm.client.staging'  // Preview uses staging APK
} else {
  packageName = 'com.bbtec.mdm.client'  // Local/Production uses production APK
}
```

**Benefit:** Enforces correct APK variant for each environment. Fails fast if wrong APK uploaded.

### Testing Results

✅ **Preview deployment enrollment:** Successfully enrolled device with production APK (v0.0.38)
✅ **Environment detection:** Code correctly identifies preview vs local vs production
✅ **TypeScript compilation:** Build passes with no errors
✅ **Package matching:** QR code component names now match deployed APK

### Environment Matrix (Correct Behavior)

| Environment | VERCEL_ENV | Convex URL | QR Package Name | Upload This APK |
|-------------|------------|------------|-----------------|-----------------|
| **Local** | undefined | 127.0.0.1:3210 | `com.bbtec.mdm.client` | local-debug or production |
| **Preview** | `preview` | kindly-mule-339 | `com.bbtec.mdm.client.staging` | staging-release |
| **Production** | `production` | expert-lemur-691 | `com.bbtec.mdm.client` | production-release |

### Files Changed

- `src/app/actions/enrollment.ts` - Added environment-aware package detection (commit: b1077c0)

---

**Updated:** 2025-11-12 18:05
**By:** Claude Code & Ben
**Status:** ✅ RESOLVED - Device enrollment working on preview deployments
