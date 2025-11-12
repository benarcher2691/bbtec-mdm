# Issue: Preview QR Codes Too Dense to Scan

**Date:** 2025-11-12
**Status:** IDENTIFIED - Awaiting fix
**Severity:** Blocks testing on preview/staging environments

---

## Problem Summary

QR codes generated on Vercel preview deployments are too dense (too many small squares) to be scannable by Android device setup, while production QR codes work perfectly.

**Root Cause:** Vercel preview URLs are 2-3x longer than production URLs, making the QR code data too large to encode readably.

---

## Detailed Analysis

### URL Length Comparison

| Environment | URL | Length | QR Scannable |
|-------------|-----|--------|--------------|
| **Production** | `https://bbtec-mdm.vercel.app` | 24 chars | ✅ YES |
| **Preview (random)** | `https://bbtec-ozer6vbbr-ben-archers-projects.vercel.app` | 56 chars | ❌ NO |
| **Preview (branch)** | `https://bbtec-mdm-git-development-ben-archers-projects.vercel.app` | 65 chars | ❌ NO |

### QR Code Content Breakdown

**Production QR Code JSON:**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg237dhardcww0m2cr0fhpemtd7v1zj9",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://bbtec-mdm.vercel.app",
    "enrollment_token": "dc08d962-96da-4425-1011-06fc310dcaf8"
  }
}
```

**Estimated size:** ~480 bytes

**Preview QR Code JSON:**
Same structure, but with longer URLs:
```
APK URL: https://bbtec-ozer6vbbr-ben-archers-projects.vercel.app/api/apps/kg27... (+32 chars)
Server URL: https://bbtec-ozer6vbbr-ben-archers-projects.vercel.app (+32 chars)
```

**Estimated size:** ~550+ bytes (+70 bytes = +15% larger)

### Why This Matters

- QR codes encode data as a grid of black/white squares
- More data = more squares = smaller individual squares
- Android cameras struggle to scan QR codes with very small squares
- Recommended max: ~400-500 bytes for reliable scanning
- Preview deployments: ~550+ bytes (above threshold)

---

## Solutions

### ✅ Solution 1: Custom Preview Domain (RECOMMENDED)

Set up a custom domain for the development branch in Vercel:

**Example:** `dev.yourdomain.com` or `staging.yourdomain.com`

**Benefits:**
- Short, stable URL (similar to production)
- Professional appearance
- Reliable QR code scanning

**Steps:**
1. Purchase/configure domain (if not already owned)
2. In Vercel Dashboard → Project Settings → Domains
3. Add custom domain: `dev.yourdomain.com`
4. Point to `development` branch
5. Configure DNS records

**Result:**
```
Before: https://bbtec-mdm-git-development-ben-archers-projects.vercel.app (65 chars)
After:  https://dev.yourdomain.com (25 chars)
```

---

### ⚠️ Solution 2: Reduce QR Complexity (PARTIAL FIX)

**Implemented in PR #3:**
- Changed error correction level from 'M' to 'L'
- Reduced margin from 4 to 2 pixels
- Makes QR codes slightly less dense

**Limitations:**
- May help with borderline cases
- Won't fully solve the URL length problem
- Requires testing to verify effectiveness

**Code change:**
```typescript
// src/app/actions/enrollment.ts
const qrCodeDataUrl = await QRCode.toDataURL(qrContent, {
  width: 512,
  margin: 2,  // Was: 4
  errorCorrectionLevel: 'L',  // Was: 'M'
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
})
```

---

### ❌ Solution 3: URL Shortening Service

**Why NOT recommended:**
- Adds external dependency
- Requires maintaining shortener service
- Android provisioning expects direct URLs
- Adds latency/failure points

---

### ❌ Solution 4: Reduce JSON Payload

**Why NOT possible:**
- Android provisioning format is fixed by Google
- All fields are required for Device Owner provisioning
- Cannot omit server_url or enrollment_token

---

## Workaround for Testing

**Option A: Test on Production**
- Merge to production for final testing
- Production URL is short enough

**Option B: Test Locally**
- Use local development: `http://192.168.x.x:3000`
- Offline development has dynamic IP detection
- QR codes work with local IPs

**Option C: Accept Limited Preview Testing**
- Test web UI changes on preview
- Test enrollment flow on local/production only

---

## Recommended Workflow

**Current state:**
```
local → PR → development (❌ QR broken) → PR → production (✅ QR works)
```

**With custom domain:**
```
local → PR → development (✅ QR works with dev.domain.com) → PR → production (✅ QR works)
```

**Without custom domain:**
```
local (✅ QR works with local IP) → PR → development (⚠️ skip QR test) → PR → production (✅ QR works)
```

---

## Action Items

1. **Short-term:** Merge PR #3 (QR optimization) and test if it helps
2. **Medium-term:** Test locally for enrollment validation
3. **Long-term:** Set up custom domain for development branch

---

## References

- PR #2: Initial offline-first workflow
- PR #3: QR density optimization
- Vercel Docs: [Custom Domains](https://vercel.com/docs/concepts/projects/custom-domains)
- Android Docs: [QR Code Provisioning](https://developers.android.com/work/dpc/qr-code)

---

**Updated:** 2025-11-12
**By:** Claude Code
