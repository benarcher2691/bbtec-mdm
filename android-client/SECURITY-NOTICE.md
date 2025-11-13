# Android Keystore Security Notice

## ⚠️  Current Keystore Status: COMPROMISED

**Date of Compromise:** 2025-11-12
**Affected Keystore:** `bbtec-mdm.keystore`
**Compromised in Commit:** `ae3d684bb4de9f445ff31de3a8ce4f200cce0465`

### What Was Leaked

1. **Keystore Passwords** exposed in documentation:
   - `storePassword=android`
   - `keyPassword=android`
   - Location: `docs/android-build-tutorial.md`

2. **APK Files** containing signing certificate committed to git:
   - `artifacts/apks/*.apk` (multiple versions)
   - Location: Git history (commits 51dd243 and others)

3. **Public Availability:**
   - Leaked to GitHub repository: `benarcher2691/bbtec-mdm`
   - Branch: `feature/offline-local-dev`

### Impact Assessment

**Severity:** Medium (for educational/development project)

Anyone with access to the git history can:
- Extract the signing certificate from APKs
- Use the password to sign new APKs with the same certificate
- Potentially impersonate the app (if published)

### Current Usage Status

✅ **SAFE FOR:**
- Local development and testing
- Educational purposes
- Internal prototyping
- Non-production devices

❌ **DO NOT USE FOR:**
- Production releases
- Google Play Store distribution
- Public app distribution
- Enterprise production deployments
- Apps handling sensitive user data

### Mitigation Strategy

**Approach:** Accept compromise for development keystore, create new keystore for production.

**Reasoning:**
1. This is a learning/educational project
2. No production users are affected
3. Rewriting git history is disruptive for active development
4. Clear documentation prevents future misuse

### Production Keystore Plan

When ready for production deployment:

1. **Generate NEW production keystore:**
   ```bash
   cd android-client
   keytool -genkey -v \
     -keystore bbtec-mdm-PRODUCTION.keystore \
     -alias bbtec-mdm-prod \
     -keyalg RSA \
     -keysize 2048 \
     -validity 10000
   ```

2. **Use STRONG passwords:**
   - Generate random 32+ character passwords
   - Store in password manager (GNU pass)
   - Never commit to git

3. **Update build configuration:**
   - Create `keystore.properties.production`
   - Update `app/build.gradle.kts` for production flavor
   - Keep production keystore OFF development machines

4. **Backup production keystore:**
   - Store encrypted in GNU pass
   - Keep offline backup in secure location
   - **NEVER lose production keystore** (cannot republish apps)

### Lessons Learned

1. ✅ Always use `.gitignore` for sensitive files
2. ✅ Never put passwords in documentation (even as examples)
3. ✅ Never commit binary artifacts (APKs) to git
4. ✅ Use password placeholders in example files
5. ✅ Review commits before pushing to remote

### Related Files

- `keystore.properties` - Gitignored (contains compromised passwords)
- `keystore.properties.example` - Safe template (no real passwords)
- `bbtec-mdm.keystore` - Gitignored (compromised certificate)
- `.gitignore` - Updated to prevent future leaks

### Questions?

Contact project maintainer for:
- Production keystore generation
- Certificate rotation procedures
- Google Play signing setup

---

**Last Updated:** 2025-11-13
**Status:** Documented and accepted for development use
