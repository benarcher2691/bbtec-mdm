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

### ⚠️ Ping Interval Update Delay

**Current Behavior:**
- Admin changes ping interval in web UI (e.g., 15 min → 1 min)
- Change is saved to Convex database immediately ✅
- Android client only learns about change on **next heartbeat**
- **Result:** Up to 15 minutes delay before new interval takes effect

**Technical Details:**
- Client polls server at current interval (e.g., every 15 min)
- Server returns updated `pingInterval` in heartbeat response
- Client updates SharedPreferences and reschedules polling
- See: `ApiClient.kt:44-50` (reads interval), `heartbeat/route.ts:23-26` (returns interval)

**Enhancement Opportunity: In-App Interval Configuration**

**Why this makes sense:**
- ✅ Convex supports direct client connections (not just HTTP APIs)
- ✅ Android app could call Convex mutations directly
- ✅ Instant feedback - no waiting for heartbeat cycle
- ✅ Better UX for device users

**Implementation Approach:**
1. Add Convex Android SDK to `android-client/app/build.gradle.kts`
2. Create settings screen in Android app with interval slider
3. Call `api.deviceClients.updatePingInterval` mutation directly
4. Update local SharedPreferences immediately
5. Reschedule polling service with new interval
6. Keep web UI control as admin override

**Benefits:**
- Device users can adjust their own check-in frequency
- Immediate effect (no delay)
- Reduces server load if users choose longer intervals
- Better battery life control for users

**Considerations:**
- Need auth strategy for Convex client (device API tokens?)
- Should admin be able to lock interval (prevent user changes)?
- Min/max bounds enforcement (1-180 minutes)

**Status:** 💡 Idea / Not Started
**Priority:** Medium
**Complexity:** Low-Medium (2-3 hours)
**Dependencies:** None

---

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

**Last Updated:** 2025-11-03
