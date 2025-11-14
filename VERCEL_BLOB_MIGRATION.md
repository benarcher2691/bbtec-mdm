# Vercel Blob Storage Migration Guide

## What Changed

Successfully migrated APK storage from Convex File Storage to Vercel Blob Storage to reduce bandwidth costs.

### Architecture Changes

**Before:**
- APKs stored in Convex file storage
- Download costs charged to Convex quota
- Local dev: Streamed through Next.js
- Cloud: Redirected to Convex CDN

**After:**
- APKs stored in Vercel Blob (shared across all environments)
- Download costs minimal (Vercel Blob pricing)
- All environments: Direct CDN redirect
- Metadata stored in Convex (version, variant, blobUrl)

### Code Changes Summary

1. **Schema (`convex/schema.ts`)**
   - `apkMetadata.storageId` → `apkMetadata.blobUrl` (string)
   - Added `apkMetadata.variant` field (local/staging/production)
   - Added indexes: `by_variant`, `by_variant_current`

2. **Convex Functions (`convex/apkStorage.ts`)**
   - Removed `generateUploadUrl` mutation
   - Updated `saveApkMetadata` to accept `blobUrl` + `variant`
   - Added `getCurrentApkByVariant` query
   - Updated `deleteApk` to return blobUrl for deletion

3. **Upload Component (`src/components/apk-uploader.tsx`)**
   - Uses `@vercel/blob/client` upload()
   - Added variant selector UI (production/staging/local)
   - Uploads to `/api/blobs/upload` handler

4. **API Routes**
   - Created `/api/blobs/upload` - Upload handler
   - Created `/api/blobs/delete` - Deletion handler
   - Updated `/api/apps/[storageId]` - Now redirects to Vercel Blob URL
   - Updated `/api/apk/extract-signature` - Accepts blobUrl

5. **QR Generation (`src/app/actions/enrollment.ts`)**
   - Uses `getCurrentApkByVariant` with environment detection
   - APK URL now uses `apkId` instead of `storageId`

## Setup Instructions

### 1. Get Vercel Blob Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **bbtec-mdm**
3. Go to **Storage** → **Blob**
4. Click **Create Blob Store** (if not created)
5. Go to **Settings** → **Tokens**
6. Generate a **Read & Write** token
7. Copy the token (starts with `vercel_blob_...`)

### 2. Configure Local Environment

Add to `.env.local`:

```bash
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXXXXXXXXXXXX
```

### 3. Deploy Convex Schema Changes

The schema has been updated but needs to be pushed to your local Convex backend.

**Terminal 1:**
```bash
# Stop your current Convex dev process if running (Ctrl+C)

# Restart with local backend
npx convex dev --local
```

Convex will detect the schema changes and prompt you to push them. Type `y` to confirm.

**Terminal 2:**
```bash
# Start Next.js dev server
NEXT_PRIVATE_TURBOPACK=0 npm run dev
```

### 4. Clear Old Data (Recommended)

Since the schema changed (`storageId` → `blobUrl`), existing APK metadata is incompatible.

**Option A: Use Convex Dashboard**
1. Open Convex dashboard: `http://127.0.0.1:3210`
2. Go to **Data** → `apkMetadata` table
3. Delete all existing records

**Option B: Let it fail gracefully**
- Old records will be ignored (query returns null)
- Upload new APK to create fresh metadata

### 5. Upload New APK

1. Open web UI: `http://localhost:3000/enrollment/update-client`
2. Upload your APK file (e.g., `app-local-debug.apk`)
   - **Variant is auto-detected** from package name!
   - `.local` → local variant
   - `.staging` → staging variant
   - Base package → production variant
3. Verify upload completes successfully
4. Check console for: `[DPC APK] Auto-detected variant: local`

### 6. Test Enrollment Flow

1. Go to **Enrollment** page
2. Select a policy and generate QR code
3. Check console logs for:
   - `[QR GEN] Variant: production`
   - `[QR GEN] APK ID: <convex_id>`
   - `[QR GEN] APK URL: .../api/apps/<apk_id>?token=...`
4. Scan QR code on test device
5. Verify APK downloads successfully

## Verification Checklist

- [ ] Vercel Blob token configured in `.env.local`
- [ ] Convex schema updated (dev server restarted)
- [ ] Old apkMetadata records cleared
- [ ] New APK uploaded with variant selector
- [ ] QR code generates successfully
- [ ] APK downloads on device
- [ ] Check Vercel Blob dashboard shows uploaded file

## Cost Comparison

### Before (Convex Storage)
- 30MB APK × 100 downloads/month = 3GB bandwidth
- Convex: ~$X/GB (pricing varies by plan)
- **Estimated: $10-20/month** (depending on scale)

### After (Vercel Blob)
- 30MB APK × 100 downloads/month = 3GB bandwidth
- Vercel Blob: $0.30/GB bandwidth + $0.015/GB storage
- Storage: 30MB × $0.015 = $0.0005/month
- Bandwidth: 3GB × $0.30 = $0.90/month
- **Estimated: $0.90/month** 📉

**Savings: ~90% reduction in storage/bandwidth costs!**

## Troubleshooting

### "Missing BLOB_READ_WRITE_TOKEN"
- Add token to `.env.local`
- Restart Next.js dev server

### "No production DPC APK uploaded"
- Upload APK via web UI
- Ensure variant matches environment (production for local dev)

### APK upload fails
- Check Vercel Blob token is valid
- Check console for upload errors
- Verify `/api/blobs/upload` route is working

### Schema validation errors
- Restart Convex dev server
- Clear old apkMetadata records
- Ensure schema push succeeded

### APK download fails (404)
- Check APK was uploaded successfully
- Verify blob URL is valid in Convex data
- Check enrollment token is valid

## Rollback Plan (If Needed)

If something goes wrong, revert to Convex storage:

1. `git stash` or `git reset --hard HEAD~1`
2. Restart Convex dev server
3. Upload APK via old flow

## Next Steps (Optional)

1. **Migrate cloud environments:**
   - Add `BLOB_READ_WRITE_TOKEN` to Vercel project settings
   - Deploy schema changes to dev/prod Convex deployments
   - Upload APKs for staging/production variants

2. **Migrate applications table:**
   - Apply same pattern to `applications` table
   - Reduce costs for user-uploaded APKs too

3. **Monitor costs:**
   - Check Vercel Blob usage in dashboard
   - Set up billing alerts if needed

## Files Modified

- `package.json` - Added @vercel/blob
- `convex/schema.ts` - Updated apkMetadata table
- `convex/apkStorage.ts` - Removed storage operations
- `src/components/apk-uploader.tsx` - Vercel Blob upload
- `src/app/api/blobs/upload/route.ts` - NEW: Upload handler
- `src/app/api/blobs/delete/route.ts` - NEW: Delete handler
- `src/app/api/apk/extract-signature/route.ts` - Accept blobUrl
- `src/app/api/apps/[storageId]/route.ts` - Redirect to blob
- `src/app/actions/enrollment.ts` - Variant-aware QR generation
- `convex/applications.ts` - Added note (no changes yet)

---

**Migration completed!** 🎉

Questions? Check console logs or review the diff.
