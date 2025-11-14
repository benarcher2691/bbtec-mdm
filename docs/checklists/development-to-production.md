# Development → Production Checklist

**Purpose:** Deploy staging changes to production
**Branch:** `development` → `master`
**Environment:** Production (Vercel + Convex prod)

---

## Pre-Flight

- [ ] 1. Staging tested and approved (minimum 24 hours monitoring)
- [ ] 2. No critical bugs reported in staging
- [ ] 3. Stakeholder approval obtained
- [ ] 4. Maintenance window scheduled (if needed)

---

## Create PR

- [ ] 5. Create PR: `development` → `master`
```bash
cd /home/ben/sandbox/bbtec-mdm
git checkout development
git pull
gh pr create --base master --head development \
  --title "Production Release: v0.0.XX" \
  --body "Tested in staging [dates]

Changes:
- [List major changes]

Approval: [name/date]
"
```
OR: Create PR manually on GitHub

- [ ] 6. Wait for PR review and approval

- [ ] 7. Merge PR to master

---

## Deploy Production

- [ ] 8. Checkout master and pull:
```bash
git checkout master
git pull origin master
```

- [ ] 9. Verify version matches staging (already committed via PR merge):
```bash
cd android-client
grep -E "versionCode|versionName" app/build.gradle.kts | head -2
```
**Expected:** Version should match what was tested in staging
**Note:** Version was committed in feature branch → merged to development → merged to master
**Result:** Building from committed source ensures git SHA in APK matches exact source

- [ ] 10. Deploy Convex to production:
```bash
cd /home/ben/sandbox/bbtec-mdm
npm run convex:deploy:prod
```
Wait for: "Deployment complete!"

---

## Build Production APK

- [ ] 11. Build production APK:
```bash
cd android-client
./gradlew clean assembleProductionRelease
```

- [ ] 12. Verify build extensively:
```bash
# Check file exists and size
ls -lh app/build/outputs/apk/production/release/app-production-release.apk

# Check package and version
/opt/android-sdk/build-tools/34.0.0/aapt dump badging \
  app/build/outputs/apk/production/release/app-production-release.apk | \
  grep -E "package:|versionCode|versionName"

# Expected: package='com.bbtec.mdm.client' versionCode='XX' versionName='0.0.XX'
```

- [ ] 13. Check build provenance:
```bash
cat app/build/generated/source/buildConfig/production/release/com/bbtec/mdm/client/BuildConfig.java | \
  grep -E "VERSION|GIT_|BUILD_"
```
Verify: VERSION_CODE, GIT_COMMIT_SHA, GIT_BRANCH=master

- [ ] 14. Verify signing:
```bash
/opt/android-sdk/build-tools/34.0.0/apksigner verify --verbose \
  app/build/outputs/apk/production/release/app-production-release.apk | \
  grep "Verified using"
```
Expected: v2 scheme = true

- [ ] 15. Archive APK:
```bash
./archive-apk.sh production
```

---

## Git Tag (if not already tagged)

- [ ] 16. Tag release on master:
```bash
cd /home/ben/sandbox/bbtec-mdm
git tag -a android-v0.0.XX -m "Android client v0.0.XX - PRODUCTION

Production release
- [Feature/fix description]

Tested in staging: [dates]
Approved by: [name]
"
```

- [ ] 17. Push tag:
```bash
git push origin master --tags
```

---

## Deploy & Monitor

- [ ] 18. Upload production APK to dashboard:
  - Navigate to: `/enrollment/update-client`
  - Upload: `artifacts/apks/production/app-production-release-0.0.XX-[sha].apk`

- [ ] 19. Backup APK to secure storage (optional):
```bash
# Copy to backup location
cp artifacts/apks/production/app-production-release-0.0.XX-*.apk \
   /secure/backup/location/
```

- [ ] 20. Test production enrollment:
  - Generate production QR code
  - Factory reset test device
  - Scan QR code (production URL)
  - Verify successful enrollment
  - Check device appears in production dashboard

- [ ] 21. Verify production heartbeats:
  - Wait 15 minutes
  - Check device "Last Heartbeat" updates
  - No errors in device status

- [ ] 22. Monitor production logs for 24 hours:
  - Check Convex logs
  - Check Vercel logs
  - Monitor device heartbeats
  - Watch for error reports

---

## Post-Deployment

- [ ] 23. Update team in Slack/Discord/Email:
```
✅ Production deployment complete: v0.0.XX
- Convex: deployed
- APK: uploaded
- Test device: enrolled and verified
- Monitoring: active
```

- [ ] 24. Document any issues in production log

- [ ] 25. Create rollback plan (if first deployment):
```bash
# Rollback command (if needed):
git checkout android-v0.0.[PREVIOUS]
# Then rebuild and redeploy
```

---

## Emergency Rollback

**If critical issues detected:**

- [ ] 1. Remove production APK from dashboard
- [ ] 2. Upload previous stable APK
- [ ] 3. Notify team immediately
- [ ] 4. Create incident report
- [ ] 5. Debug in staging environment

---

## Notes

**Production Safety:**
- ⚠️ Never push directly to master (use PR)
- ⚠️ Always test in staging first (minimum 24 hours)
- ⚠️ Have rollback plan ready
- ⚠️ Monitor closely for first 24 hours

**Branch cleanup after deployment:**
```bash
git checkout development
git pull  # Get latest from master (via PR merge)
```

---

**Last Updated:** 2025-11-14
