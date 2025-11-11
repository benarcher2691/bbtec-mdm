# Device Deletion Guide

## Overview

The bbtec-mdm system provides two ways to remove enrolled devices, depending on whether you want to wipe the device data or just remove it from the management system.

---

## Deletion Methods

### 1. Delete & Wipe Device (Ordered Removal)

**Use this when:** You want to completely remove a device AND erase all its data.

**What happens:**
1. System issues `RELINQUISH_OWNERSHIP` command to the device via Android Management API
2. Device receives the command and performs a factory reset
3. All data on the device is permanently erased
4. Device is removed from the enterprise management
5. Device returns to setup screen (like brand new)

**Steps:**
1. Go to **Management → Devices**
2. Find the device you want to remove
3. Click the **⋮** (more actions) button
4. Select **"Delete & Wipe Device"** (red option)
5. Confirm the action in the dialog
6. Device will be factory reset and removed

**Important Notes:**
- ⚠️ **All data on the device will be permanently lost**
- The device must be online and connected to receive the wipe command
- This is a secure way to decommission devices
- Use this for lost/stolen devices or before giving device to someone else

---

### 2. Remove from List (Cleanup Only)

**Use this when:** The device has already been manually factory reset and you just want to clean up your device list.

**What happens:**
1. Device is removed from the enterprise in Android Management API
2. No commands are sent to the device
3. Device disappears from your device list

**Steps:**
1. Go to **Management → Devices**
2. Find the device you want to remove
3. Click the **⋮** (more actions) button
4. Select **"Remove from List"**
5. Confirm the action in the dialog
6. Device is removed from the list

**Important Notes:**
- ⚠️ If the device is still enrolled and powered on, it will continue to be managed by the policy until manually reset
- Use this ONLY if:
  - Device has already been factory reset manually
  - Device is permanently offline/broken
  - You want to clean up old device entries

---

## Technical Implementation

### Server Actions

**`deleteDevice(deviceId: string, wipeData: boolean)`**

Located in: `src/app/actions/android-management.ts`

**Parameters:**
- `deviceId` - The device ID extracted from the full device name
- `wipeData` - Boolean flag:
  - `true` = Issue RELINQUISH_OWNERSHIP command before deletion (factory reset)
  - `false` = Just delete from enterprise (no wipe)

**Returns:**
```typescript
{
  success: boolean,
  wiped?: boolean,
  error?: string
}
```

**Process Flow (with wipe):**
1. Authenticate user via Clerk
2. Get Android Management API client
3. Issue `RELINQUISH_OWNERSHIP` command to device
4. Wait 1 second for command to be processed
5. Delete device from enterprise
6. Return success

**Process Flow (without wipe):**
1. Authenticate user via Clerk
2. Get Android Management API client
3. Delete device from enterprise
4. Return success

### UI Components

**Device Actions Dropdown**

Each device row has a three-dot menu (⋮) with two options:

1. **Delete & Wipe Device** (red text)
   - Calls `handleDeleteClick(device, true)`
   - Opens confirmation dialog
   - Shows warning about data loss

2. **Remove from List**
   - Calls `handleDeleteClick(device, false)`
   - Opens confirmation dialog
   - Explains this is for already-reset devices

**Confirmation Dialog**

Uses shadcn/ui `AlertDialog` component with:
- Different titles based on action type
- Warning text with consequences
- Cancel button (always available)
- Confirm button:
  - Red background for "Delete & Wipe"
  - Default for "Remove"
  - Shows "Processing..." during operation
  - Disabled during deletion

---

## Security Considerations

### Authentication
- All deletion operations require Clerk authentication
- Server Actions verify userId before proceeding
- No client-side deletion allowed

### Authorization
- Users can only delete devices in their enterprise
- Enterprise name validated from environment variables
- Device IDs validated before deletion

### Audit Trail
**Future Enhancement:** Log all device deletions to audit log:
```typescript
await logAction({
  action: wipeData ? 'delete_device_with_wipe' : 'delete_device',
  resourceType: 'device',
  resourceId: deviceId,
  metadata: {
    deviceName: device.hardwareInfo?.model,
  },
})
```

---

## Error Handling

### Common Errors

**"Device not found"**
- Device ID doesn't exist in enterprise
- Device was already deleted
- Enterprise name mismatch

**"Unauthorized"**
- User not signed in
- Session expired
- Invalid Clerk token

**"ENTERPRISE_NAME not configured"**
- Environment variable missing
- Check `.env.local` file

**"Failed to issue device command"**
- Device is offline
- Network connectivity issue
- API permissions problem

### UI Error Display

Errors are shown in the device list table:
- Red alert box with error icon
- Clear error message
- "Try Again" button to retry

---

## Best Practices

### When to Use "Delete & Wipe"
✅ Device is being decommissioned
✅ Device is being reassigned to another person
✅ Device is lost or stolen
✅ Company policy requires data wiping
✅ Device is being returned to vendor

### When to Use "Remove from List"
✅ Device was manually factory reset
✅ Device is broken/non-functional
✅ Cleaning up old test devices
✅ Device is permanently offline

### What NOT to Do
❌ Don't use "Remove from List" for active devices (they'll stay managed)
❌ Don't wipe devices that belong to users without warning
❌ Don't delete devices with important data without backing up first
❌ Don't assume wipe succeeded - verify device status

---

## Testing Device Deletion

### Test Scenario 1: Delete & Wipe
1. Enroll a test device
2. Go to Management → Devices
3. Click ⋮ on test device
4. Select "Delete & Wipe Device"
5. Confirm deletion
6. Verify device factory resets
7. Check device disappears from list

### Test Scenario 2: Remove from List
1. Manually factory reset a test device
2. Device should still appear in list (as offline)
3. Click ⋮ on the device
4. Select "Remove from List"
5. Confirm removal
6. Verify device disappears from list

---

## API Reference

### Android Management API

**Issue Command:**
```
POST https://androidmanagement.googleapis.com/v1/{name}:issueCommand
```

**Command Types:**
- `RELINQUISH_OWNERSHIP` - Factory reset device
- `REBOOT` - Restart device
- `LOCK` - Lock device screen

**Delete Device:**
```
DELETE https://androidmanagement.googleapis.com/v1/{name}
```

**Documentation:**
- [Device Commands](https://developers.google.com/android/management/reference/rest/v1/enterprises.devices/issueCommand)
- [Delete Device](https://developers.google.com/android/management/reference/rest/v1/enterprises.devices/delete)

---

## Future Enhancements

1. **Bulk Deletion**
   - Select multiple devices
   - Delete all at once
   - Progress indicator

2. **Scheduled Deletion**
   - Schedule device wipe for future time
   - Useful for end-of-lease scenarios

3. **Soft Delete**
   - Mark as deleted but keep in database
   - Allow undelete within 30 days

4. **Deletion Confirmation Email**
   - Send email when device is deleted
   - Include device details and timestamp

5. **Device Recovery**
   - Track recently deleted devices
   - Allow re-enrollment without losing customizations

---

## Troubleshooting

### Device Won't Wipe

**Symptoms:**
- "Delete & Wipe" completes but device still enrolled
- Device still shows in list
- Device not factory reset

**Possible Causes:**
1. Device is offline/not connected
2. Command delivery failed
3. Device policy prevents wiping

**Solutions:**
1. Ensure device has internet connection
2. Try again when device is online
3. Use "Remove from List" as last resort
4. Contact device owner to manually reset

### Deletion Appears Successful but Device Still Shows

**Symptoms:**
- Deletion completes without error
- Device still appears in list after refresh

**Possible Causes:**
1. List not refreshed
2. Cache issue
3. API sync delay

**Solutions:**
1. Click the "Refresh" button
2. Wait 30 seconds and refresh again
3. Sign out and back in
4. Check Google Play EMM API console

---

**Last Updated:** 2025-11-01
