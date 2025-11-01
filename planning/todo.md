# Project TODO List

## High Priority

### 🔴 CRITICAL: Self-Hosted APK Installation Limitation

**Issue:** Android Management API cannot directly install self-hosted APK files.

**Current Situation:**
- APKs uploaded to our system are stored in Convex
- Adding package name to policy doesn't install the app
- Android Management API only supports:
  1. Apps from Google Play (public)
  2. Apps from Managed Google Play (private/enterprise apps)
  3. Pre-installed system apps

**Solutions (Pick One):**

**Option A: Managed Google Play (Recommended)**
- Upload APKs to Google Play Console as private apps
- Apps become available in managed Google Play
- Can then install via package name in policy
- **Pros:** Proper MDM integration, automatic updates, secure
- **Cons:** Requires Google Play Console account, approval process

**Option B: Manual Installation Link**
- Provide download link to users
- Users manually install APK (requires "Unknown Sources")
- Track installations separately
- **Pros:** Simple, no Google approval needed
- **Cons:** Not true MDM, requires user interaction, security concerns

**Option C: Web App Wrapper**
- Create a simple web app that downloads and installs APK
- Use webApps policy feature
- **Pros:** Semi-automated
- **Cons:** Still requires user permission, complex

**Recommended Next Steps:**
1. Research managed Google Play private app upload process
2. Update UI to indicate current limitations
3. Consider hybrid approach (Google Play for production, manual for testing)

**References:**
- [Android Management API Apps](https://developers.google.com/android/management/apps)
- [Managed Google Play](https://support.google.com/googleplay/work)

**Status:** 🔴 Blocker
**Priority:** Critical
**Decision Needed:** Choose installation strategy

---

### ⚠️ Google Android Management API - Default Policy Setup

**Issue:** Need to properly configure the default policy in Google's Android Management API console.

**Current Situation:**
- Policy is defined in code (`src/app/actions/android-management.ts`)
- Policy updates via API endpoint (`/api/update-policy`)
- Still experiencing issues:
  - Screen lock/PIN prompts during enrollment
  - App installation affecting all devices on shared policy

**Actions Needed:**
1. **Visit Google Cloud Console**
   - Navigate to Android Management API
   - Review/set the `default-policy` properly
   - Ensure `PASSWORD_QUALITY_UNSPECIFIED` is set

2. **Consider Policy Architecture**
   - Current: Single `default-policy` for all devices
   - Option A: Keep shared policy (simpler, affects all devices)
   - Option B: Create device-specific policies (more complex, per-device control)
   - Decision needed based on use case

3. **Test Enrollment Flow**
   - Verify no PIN/password required
   - Confirm app installation works correctly
   - Document expected behavior

**References:**
- Policy configuration: `src/app/actions/android-management.ts` (line 170)
- Policy guide: `planning/policy-configuration-guide.md`
- Update endpoint: `src/app/api/update-policy/route.ts`

**Status:** 🔴 Not Started
**Priority:** High
**Assigned:** TBD
**Due:** ASAP

---

## Medium Priority

### Future Enhancements

- [ ] Device-specific policies for granular control
- [ ] Policy templates/presets (Guest, Corporate, Kiosk)
- [ ] Bulk device operations
- [ ] Real-time device status updates
- [ ] Audit log viewer UI
- [ ] Device notes/tags UI integration

---

## Low Priority

### Nice to Have

- [ ] Export device list to CSV
- [ ] Application version tracking/updates
- [ ] Device grouping/organization
- [ ] Custom branding for enrollment

---

**Last Updated:** 2025-11-01
