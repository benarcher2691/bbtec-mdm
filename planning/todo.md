# Project TODO List

## High Priority

### ✅ RESOLVED: Private APK Installation Strategy

**Decision:** Use "Unknown Sources" + Download Links approach

**Reason:** User requirements:
- Private APKs not in Google Play
- No Managed Google Play workflow desired
- Need direct control over APK distribution

**Implementation:**
1. ✅ Policy updated to allow `installUnknownSourcesAllowed: true`
2. ✅ APKs stored in Convex, served via `/api/apps/[storageId]`
3. ✅ UI provides download links for manual installation
4. ✅ Clear instructions shown to users

**Workflow:**
1. Admin uploads APK to system
2. Admin selects device and clicks "Install App"
3. System provides download link
4. User on device:
   - Clicks download link (Unknown Sources already allowed by policy)
   - Confirms installation
   - App installs

**Limitations:**
- Requires one user tap to confirm installation (Android security requirement)
- Not fully automated, but as automated as possible without Google Play

**Next Steps:**
1. Update policy on Google servers: Visit `/api/update-policy`
2. Generate new QR code for enrollment
3. Test workflow with actual device

**Status:** 🟢 Implemented
**Priority:** High → Complete

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
