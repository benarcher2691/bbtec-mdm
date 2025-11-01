# Enrollment Setup Checklist

## ✅ Completed Setup

### 1. Service Account Credentials
- ✅ Service account key file exists: `config/service-account-key.json`
- ✅ File is in .gitignore (not committed to git)
- ✅ Environment variable set: `GOOGLE_APPLICATION_CREDENTIALS=./config/service-account-key.json`

### 2. Enterprise Configuration
- ✅ Enterprise created: `enterprises/LC03fy18qv`
- ✅ Environment variable set: `ENTERPRISE_NAME=enterprises/LC03fy18qv`
- ✅ Project ID set: `GOOGLE_CLOUD_PROJECT_ID=bbtec-mdm`

### 3. Code Implementation
- ✅ Server Actions created (`src/app/actions/android-management.ts`)
- ✅ QR Code Generator UI (`src/components/qr-code-generator.tsx`)
- ✅ Device List Table (`src/components/device-list-table.tsx`)
- ✅ Authentication checks (Clerk auth required)

---

## 🔧 One-Time Setup Required

Before you can enroll your first device, you need to create the default policy:

### Create Default Policy

**Option 1: Via UI (Recommended)**
1. Navigate to **Enrollment → QR Codes**
2. Click **"Generate Enrollment QR Code"**
3. The system will automatically create the default policy if it doesn't exist
4. Check browser console for any errors

**Option 2: Via Code (If needed)**

If automatic creation fails, you can manually create it using Node.js:

```javascript
// Run this once in Node.js or add to a setup script
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: './config/service-account-key.json',
  scopes: ['https://www.googleapis.com/auth/androidmanagement'],
});

const androidmanagement = google.androidmanagement({
  version: 'v1',
  auth: auth,
});

async function createDefaultPolicy() {
  const response = await androidmanagement.enterprises.policies.patch({
    name: 'enterprises/LC03fy18qv/policies/default-policy',
    requestBody: {
      passwordRequirements: {
        passwordMinimumLength: 6,
        passwordQuality: 'NUMERIC',
      },
      statusReportingSettings: {
        applicationReportsEnabled: true,
        deviceSettingsEnabled: true,
        softwareInfoEnabled: true,
      },
      applications: [
        {
          packageName: 'com.android.chrome',
          installType: 'AVAILABLE',
        },
      ],
    },
  });
  console.log('Policy created:', response.data);
}

createDefaultPolicy().catch(console.error);
```

---

## 🧪 Testing the Enrollment Flow

### Step 1: Generate QR Code
1. Sign in to the app
2. Go to **Enrollment → QR Codes**
3. Click **"Generate Enrollment QR Code"**
4. Expected result:
   - ✅ QR code image appears
   - ✅ Token string displayed
   - ✅ Expiration time shown (1 hour from now)
   - ✅ No errors in console

### Step 2: Enroll a Test Device
You need a physical Android device OR Android emulator:

**Physical Device:**
1. Factory reset the device
2. During initial setup, when asked to scan QR code, scan the generated QR
3. Device should automatically enroll and apply the default policy

**Android Emulator:**
1. Create an emulator via Android Studio
2. Start fresh (wipe data)
3. During setup, scan the QR code from your screen
4. Device enrolls automatically

### Step 3: Verify Enrollment
1. Go to **Management → Devices**
2. Click **Refresh** button
3. You should see your newly enrolled device in the table
4. Check device details (model, Android version, status)

---

## ⚠️ Common Issues & Solutions

### Issue: "ENTERPRISE_NAME not configured"
**Solution:** Check `.env.local` has `ENTERPRISE_NAME=enterprises/LC03fy18qv`

### Issue: "Failed to create enrollment token"
**Possible causes:**
1. Service account key file missing or invalid
2. Service account doesn't have Android Management API permissions
3. Default policy doesn't exist yet
4. Enterprise name is incorrect

**Solution:**
- Verify service account key exists: `ls config/service-account-key.json`
- Check Google Cloud Console: https://console.cloud.google.com
- Ensure Android Management API is enabled
- Verify service account has "Android Management User" role

### Issue: "Not authenticated" error
**Solution:**
- Make sure you're signed in via Clerk
- Check browser console for auth errors
- Try signing out and back in

### Issue: No devices showing in device list
**Possible causes:**
1. No devices have been enrolled yet
2. Enterprise name mismatch
3. API permissions issue

**Solution:**
- Enroll a test device using the QR code
- Verify enterprise name in `.env.local` matches Google Cloud
- Check Google Play EMM API console for enrolled devices

---

## 🔐 Security Notes

**Never commit these files:**
- ❌ `config/service-account-key.json` (contains sensitive credentials)
- ❌ `.env.local` (contains API keys)

Both are already in `.gitignore`.

**Service Account Permissions:**
The service account needs these roles in Google Cloud:
- Android Management User
- Service Account Token Creator (if using impersonation)

---

## 📚 Documentation Links

- [Android Management API Documentation](https://developers.google.com/android/management)
- [Create an Enterprise](https://developers.google.com/android/management/create-enterprise)
- [Enrollment Tokens](https://developers.google.com/android/management/provision-device)
- [Device Policies](https://developers.google.com/android/management/manage-policy)

---

## ✅ Ready to Test!

With the service account key in place, you're ready to:
1. Generate enrollment QR codes
2. Enroll Android devices
3. View and manage enrolled devices

Try generating a QR code now to test the connection!
