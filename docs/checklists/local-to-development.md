# Local → Development Checklist

**Purpose:** Deploy feature branch to staging environment
**Branch:** `feature/[name]` → `development`
**Environment:** Staging (Vercel preview + Convex dev)

---

## Pre-Flight

- [ ] 1. All tests passing locally
- [ ] 2. Local dev server working (`npm run dev` + `npx convex dev --local`)
- [ ] 3. Git working tree clean (no uncommitted changes)

---

## Version & Build

- [ ] 4. Check current version:
```bash
cd /home/ben/sandbox/bbtec-mdm/android-client
grep -E "versionCode|versionName" app/build.gradle.kts | head -2
```

- [ ] 5. Check latest released version:
```bash
git tag -l "android-v*" | sort -V | tail -1
```

- [ ] 6. Bump version if needed (only if code version = latest tag):
```bash
# Example: 45 → 46
sed -i 's/versionCode = 45/versionCode = 46/' app/build.gradle.kts
sed -i 's/versionName = "0.0.45"/versionName = "0.0.46"/' app/build.gradle.kts
```

- [ ] 7. **Commit version bump immediately** (ensures git SHA in APK matches source):
```bash
cd /home/ben/sandbox/bbtec-mdm
git add android-client/app/build.gradle.kts
git commit -m "chore: bump Android client to v0.0.XX"
```

---

## Deploy Backend

- [ ] 8. Deploy Convex to dev:
```bash
cd /home/ben/sandbox/bbtec-mdm
npm run convex:deploy:dev
```
Wait for: "Deployment complete!"

---

## Build Android APK

- [ ] 9. Build staging APK:
```bash
cd android-client
./gradlew clean assembleStagingRelease
```

- [ ] 10. Verify build:
```bash
ls -lh app/build/outputs/apk/staging/release/app-staging-release.apk
```
Expected: ~12 MB file exists

- [ ] 11. Archive APK:
```bash
./archive-apk.sh staging
```

---

## Git Operations

- [ ] 12. Tag release:
```bash
cd /home/ben/sandbox/bbtec-mdm
git tag -a android-v0.0.XX -m "Staging release v0.0.XX

- [Feature/fix description]
"
```

- [ ] 13. Push to GitHub:
```bash
git push origin feature/[name] --tags
```

---

## Create PR

- [ ] 14. Create PR to development:
```bash
gh pr create --base development --head feature/[name] \
  --title "Android v0.0.XX + [description]" \
  --body "See commits for details"
```
OR: Create PR manually on GitHub

- [ ] 15. Wait for PR review and approval

- [ ] 16. Merge PR (squash/rebase/merge based on team preference)

---

## Upload & Test

- [ ] 17. Upload staging APK to dashboard:
  - Navigate to: `/enrollment/update-client`
  - Upload: `artifacts/apks/staging/app-staging-release-0.0.XX-[sha].apk`

- [ ] 18. Test enrollment on staging:
  - Generate QR code
  - Factory reset test device
  - Scan QR code
  - Verify successful enrollment

- [ ] 19. Monitor heartbeats for 24 hours

---

## Notes

**Branch after merge:**
```bash
git checkout development
git pull
git branch -d feature/[name]  # Delete local feature branch (optional)
```

**Rollback if needed:**
```bash
git checkout android-v0.0.XX  # Go back to tagged version
```

---

**Last Updated:** 2025-11-14
