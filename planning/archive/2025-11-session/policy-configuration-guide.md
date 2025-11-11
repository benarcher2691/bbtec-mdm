# Device Policy Configuration Guide

## Current Policy

The default policy applied to all enrolled devices is defined in:
`src/app/actions/android-management.ts` (lines 149-162)

---

## What's Currently Applied

```typescript
{
  // ✅ NO PASSWORD REQUIRED - Device can be unlocked without PIN
  statusReportingSettings: {
    applicationReportsEnabled: true,
    deviceSettingsEnabled: true,
    softwareInfoEnabled: true,
  },
  applications: [
    {
      packageName: 'com.android.chrome',
      installType: 'AVAILABLE',  // Chrome available but not required
    },
  ],
}
```

### Current Settings:

- ✅ **No PIN/Password Required** - Devices can be unlocked freely
- ✅ **Status Reporting Enabled** - Device sends status updates
- ✅ **Chrome Available** - Users can install Chrome if they want

---

## Common Policy Options

### Password/PIN Requirements

#### Option 1: No Password (Current)
```typescript
// Just omit passwordRequirements entirely
{
  statusReportingSettings: { ... }
}
```

#### Option 2: Require Numeric PIN
```typescript
{
  passwordRequirements: {
    passwordMinimumLength: 6,        // 6-digit PIN
    passwordQuality: 'NUMERIC',      // Numbers only
  },
}
```

#### Option 3: Require Complex Password
```typescript
{
  passwordRequirements: {
    passwordMinimumLength: 8,
    passwordQuality: 'COMPLEX',      // Letters + numbers + symbols
    requireLettersInPassword: true,
    requireSymbolsInPassword: true,
  },
}
```

#### Option 4: Pattern Lock
```typescript
{
  passwordRequirements: {
    passwordQuality: 'SOMETHING',    // Pattern, PIN, or password
  },
}
```

---

### Application Management

#### Install Required Apps
```typescript
{
  applications: [
    {
      packageName: 'com.android.chrome',
      installType: 'REQUIRED_FOR_SETUP',  // Must be installed during setup
    },
    {
      packageName: 'com.google.android.apps.docs',
      installType: 'AVAILABLE',           // Available but optional
    },
  ],
}
```

#### Block Specific Apps
```typescript
{
  applications: [
    {
      packageName: 'com.facebook.katana',  // Facebook
      installType: 'BLOCKED',              // Cannot be installed
    },
  ],
}
```

#### Pre-approve Play Store Apps
```typescript
{
  applications: [
    {
      packageName: 'com.slack',
      installType: 'AVAILABLE',
      autoUpdateMode: 'AUTO_UPDATE_HIGH_PRIORITY',
    },
  ],
}
```

---

### Device Restrictions

#### Lock Screen Features
```typescript
{
  keyguardDisabledFeatures: [
    'CAMERA',           // Disable camera from lock screen
    'NOTIFICATIONS',    // Hide notifications on lock screen
    'FINGERPRINT',      // Disable fingerprint unlock
  ],
}
```

#### System Settings
```typescript
{
  addUserDisabled: true,              // Prevent adding new users
  factoryResetDisabled: true,         // Prevent factory reset
  screenCaptureDisabled: true,        // Prevent screenshots
  debuggingFeaturesAllowed: false,    // Disable USB debugging
  adjustVolumeDisabled: false,        // Allow volume adjustment
}
```

#### Network Settings
```typescript
{
  wifiConfigDisabled: false,          // Allow WiFi configuration
  bluetoothDisabled: false,           // Allow Bluetooth
  cellBroadcastsConfigDisabled: true, // Disable emergency alerts config
}
```

---

### Kiosk Mode (Single App)

Lock device to single app:

```typescript
{
  applications: [
    {
      packageName: 'com.your.app',
      installType: 'KIOSK',
      lockTaskAllowed: true,
    },
  ],
  kioskCustomization: {
    powerButtonActions: 'POWER_BUTTON_BLOCKED',
    statusBar: 'STATUS_BAR_DISABLED',
    systemNavigation: 'SYSTEM_NAVIGATION_DISABLED',
  },
}
```

---

### Device Compliance

#### Encryption Requirements
```typescript
{
  encryptionPolicy: 'ENABLED_WITH_PASSWORD',  // Require device encryption
}
```

#### System Updates
```typescript
{
  systemUpdate: {
    type: 'AUTOMATIC',              // Auto-install updates
    startMinutes: 180,              // 3 AM (180 mins after midnight)
    endMinutes: 300,                // 5 AM
  },
}
```

---

## Complete Policy Examples

### 1. Educational Device (Minimal Restrictions)
```typescript
const educationalPolicy = {
  statusReportingSettings: {
    applicationReportsEnabled: true,
    deviceSettingsEnabled: true,
    softwareInfoEnabled: true,
  },
  applications: [
    {
      packageName: 'com.google.android.apps.docs',
      installType: 'AVAILABLE',
    },
    {
      packageName: 'com.google.android.apps.classroom',
      installType: 'AVAILABLE',
    },
  ],
  // No password required for easy access
}
```

### 2. Corporate Device (High Security)
```typescript
const corporatePolicy = {
  passwordRequirements: {
    passwordMinimumLength: 8,
    passwordQuality: 'COMPLEX',
    requireLettersInPassword: true,
    requireSymbolsInPassword: true,
  },
  encryptionPolicy: 'ENABLED_WITH_PASSWORD',
  factoryResetDisabled: true,
  debuggingFeaturesAllowed: false,
  screenCaptureDisabled: true,
  applications: [
    {
      packageName: 'com.microsoft.office.outlook',
      installType: 'REQUIRED_FOR_SETUP',
    },
    {
      packageName: 'com.slack',
      installType: 'AVAILABLE',
    },
  ],
  statusReportingSettings: {
    applicationReportsEnabled: true,
    deviceSettingsEnabled: true,
    softwareInfoEnabled: true,
  },
}
```

### 3. Retail Kiosk (Single App)
```typescript
const kioskPolicy = {
  applications: [
    {
      packageName: 'com.your.pos.app',
      installType: 'KIOSK',
      lockTaskAllowed: true,
    },
  ],
  kioskCustomization: {
    powerButtonActions: 'POWER_BUTTON_BLOCKED',
    statusBar: 'STATUS_BAR_DISABLED',
    systemNavigation: 'SYSTEM_NAVIGATION_DISABLED',
  },
  factoryResetDisabled: true,
  statusReportingSettings: {
    applicationReportsEnabled: true,
    deviceSettingsEnabled: true,
    softwareInfoEnabled: true,
  },
}
```

### 4. Shared/Guest Device (Current - Recommended for Testing)
```typescript
const guestPolicy = {
  // No password - easy access
  // No restrictions - full device functionality
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
}
```

---

## How to Change the Policy

### Method 1: Edit the Code (Current)

1. Open `src/app/actions/android-management.ts`
2. Find the `defaultPolicy` object (line 149)
3. Modify the settings as desired
4. Save the file
5. Restart the dev server if running

**Then apply to existing devices:**
- Devices will receive the updated policy automatically
- Changes take effect within a few minutes
- Some changes may require device restart

### Method 2: Create Multiple Policies

You can create different policies for different use cases:

```typescript
// In android-management.ts
export async function createCustomPolicy(policyId: string, policyConfig: object) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const enterpriseName = process.env.ENTERPRISE_NAME
  if (!enterpriseName) throw new Error('ENTERPRISE_NAME not configured')

  try {
    const androidmanagement = await getAndroidManagementClient()
    const policyName = `${enterpriseName}/policies/${policyId}`

    const response = await androidmanagement.enterprises.policies.patch({
      name: policyName,
      requestBody: policyConfig,
    })

    return { success: true, policy: response.data }
  } catch (error) {
    console.error('Error creating policy:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create policy',
    }
  }
}
```

Then create different policies:
- `default-policy` - For general use
- `guest-policy` - For temporary/guest devices
- `secure-policy` - For sensitive devices
- `kiosk-policy` - For single-purpose devices

---

## Testing Policy Changes

### Before Enrolling New Devices:
1. Update the policy in code
2. Restart dev server
3. Generate new QR code
4. Enroll test device
5. Verify settings are applied

### For Already-Enrolled Devices:
1. Update the policy in code
2. Policy syncs automatically
3. Wait 5-10 minutes
4. Check device for changes
5. May need to restart device

---

## Policy Best Practices

### For Testing/Development:
✅ **No password requirements** (current setting)
✅ **Minimal restrictions**
✅ **Easy to reset devices**
✅ **Allow all apps**

### For Production:
✅ **Require PIN/password** for security
✅ **Enable encryption**
✅ **Disable factory reset**
✅ **Block debugging**
✅ **Whitelist approved apps**
✅ **Enable automatic updates**

### For Kiosk Devices:
✅ **Single app mode**
✅ **Disable power button**
✅ **Hide status bar**
✅ **Prevent system navigation**
✅ **Disable factory reset**

---

## Common Scenarios

### "I want devices to be completely open for testing"
**Current policy is perfect!** No password, no restrictions.

### "I want basic security but not too strict"
Add simple PIN:
```typescript
passwordRequirements: {
  passwordMinimumLength: 4,
  passwordQuality: 'NUMERIC',
}
```

### "I want to block social media apps"
```typescript
applications: [
  { packageName: 'com.facebook.katana', installType: 'BLOCKED' },
  { packageName: 'com.instagram.android', installType: 'BLOCKED' },
  { packageName: 'com.twitter.android', installType: 'BLOCKED' },
]
```

### "I want to force specific apps to be installed"
```typescript
applications: [
  {
    packageName: 'com.your.required.app',
    installType: 'REQUIRED_FOR_SETUP',
  },
]
```

---

## API Documentation

**Android Management API Policy Reference:**
https://developers.google.com/android/management/reference/rest/v1/enterprises.policies#Policy

**Common Fields:**
- `passwordRequirements` - Password/PIN settings
- `applications` - App management
- `statusReportingSettings` - What data is reported
- `systemUpdate` - Update management
- `encryptionPolicy` - Device encryption
- `kioskCustomization` - Kiosk mode settings

---

## Next Steps

**Current Setup:** ✅ No PIN required (good for testing!)

**To customize:**
1. Review the examples above
2. Edit `src/app/actions/android-management.ts`
3. Modify the `defaultPolicy` object
4. Test with a new enrollment

**Need help?** Check the examples or Android Management API docs!

---

**Last Updated:** 2025-11-01
**Current Policy:** Guest/Testing (No restrictions)
