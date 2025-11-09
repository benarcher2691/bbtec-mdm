# MDM Heartbeat Resilience System - Issue Report

**Date:** 2025-11-08
**Version:** v0.0.38
**Devices:** #621 (USB connected), #110 (independent)

## Executive Summary

The MDM client's heartbeat resilience system appears to be failing in production. While Device #621 (USB-connected) shows normal operation, Device #110 (running independently) missed a heartbeat at the 15-minute mark and failed to recover within the expected 15-25 minute WorkManager recovery window, showing "28 minutes ago" at time of investigation.

## Observed Behavior

### Device #621 (USB Connected)
- **Status:** "less than a minute ago" (1-minute test interval)
- **Service State:** Running, foreground service confirmed
- **Conclusion:** Works perfectly while USB-powered (device never enters Doze mode)

### Device #110 (Independent)
- **Status:** "28 minutes ago" (15-minute production interval)
- **Expected:** Should update every ~15 minutes, max gap 25 minutes with WorkManager recovery
- **Actual:** Missed heartbeat at T=15, no recovery by T=28
- **Conclusion:** Service died and resilience system failed to recover

## Technical Analysis

### 1. Service Status Investigation

Service appears running but with suspicious behavior:

```bash
$ adb shell dumpsys activity services com.bbtec.mdm.client/.PollingService
  createTime=-3m48s
  lastActivity=-3m48s  # ← IDENTICAL timestamps
  isForeground=true
```

**Key Finding:** `lastActivity` timestamp never updates because `Handler.postDelayed()` runs internally without triggering Android system callbacks. This is normal for our architecture but makes service health monitoring via dumpsys unreliable.

### 2. WorkManager Not Scheduled

```bash
$ adb shell dumpsys jobscheduler | grep -B5 -A15 "HeartbeatHealthWorker"
# NO RESULTS - WorkManager periodic job not found
```

**Expected:** Should find `HeartbeatHealthWorker` scheduled with 15-minute repeat interval + 10-minute flex window.

**Code that should schedule it (ProvisioningSuccessActivity.kt:125-142):**

```kotlin
private fun schedulePeriodicHealthCheck() {
    Log.d(TAG, "📅 Scheduling WorkManager periodic health check")

    val healthCheckRequest = PeriodicWorkRequestBuilder<HeartbeatHealthWorker>(
        repeatInterval = 15,
        repeatIntervalTimeUnit = TimeUnit.MINUTES,
        flexTimeInterval = 10,
        flexTimeIntervalUnit = TimeUnit.MINUTES
    ).build()

    WorkManager.getInstance(this).enqueueUniquePeriodicWork(
        "mdm-heartbeat-health-check",
        ExistingPeriodicWorkPolicy.KEEP,
        healthCheckRequest
    )

    Log.d(TAG, "✅ WorkManager health check scheduled")
}
```

**Also called in BootReceiver.kt:73-90** for device reboot and app upgrade scenarios.

### 3. Battery Optimization Not Granted

```bash
$ adb shell dumpsys power | grep -i "whitelist"
mDeviceIdleWhitelist=[1001, 2000, 10055, 10114]  # ← UID 10140 (our app) NOT present
mDeviceIdleTempWhitelist=[]
```

**Expected:** App should be on battery whitelist after requesting exemption.

**Code that should request it (ProvisioningSuccessActivity.kt:150-159):**

```kotlin
private fun requestBatteryOptimization() {
    val batteryHelper = BatteryOptimizationHelper(this)

    if (!batteryHelper.isIgnoringBatteryOptimizations()) {
        Log.d(TAG, "🔋 Requesting battery optimization exemption")
        batteryHelper.requestBatteryOptimizationExemption(this)
    } else {
        Log.d(TAG, "✅ Already exempt from battery optimization")
    }
}
```

### 4. No Application Logs

Despite service running, **zero logs** appear from application code:

```bash
$ adb logcat -d -s PollingService:* ApiClient:* BootReceiver:*
# NO OUTPUT

$ adb logcat -d --pid=6648
# NO OUTPUT (0 lines)
```

**Expected:** Should see initialization logs, heartbeat success/failure logs, watchdog checks.

**Example logs that should appear (PollingService.kt:53-62):**

```kotlin
override fun onCreate() {
    isRunning = true
    Log.d(TAG, "🚀 PollingService onCreate - starting service")

    pollingThread.start()
    pollingHandler = Handler(pollingThread.looper)
    watchdogHandler = Handler(android.os.Looper.getMainLooper())

    // ... should produce logs during initialization
}
```

**This suggests either:**
- Logging framework issue
- Code path not executing as expected
- Log level filtering (though unlikely since we check all levels)

### 5. Version Verification

```bash
$ adb shell dumpsys package com.bbtec.mdm.client | grep version
    versionCode=38
    versionName=0.0.38
    firstInstallTime=2025-11-08 17:59:36
    lastUpdateTime=2025-11-08 17:59:36
```

**Confirmed:** Both devices running v0.0.38 with resilience code.

## Resilience System Architecture

The v0.0.38 resilience system consists of 8 components designed to ensure the service never stays dead for more than 15-25 minutes:

### Component Overview

```
1. HeartbeatStateManager.kt
   └─ Persists state across process death (DataStore)

2. ApiClient.kt (hardened)
   └─ Exponential backoff with jitter (1s → 15min cap)

3. PollingService.kt (watchdog)
   └─ Self-monitoring every 60 seconds
   └─ Detects if no heartbeat for 2x interval (30min on 15min interval)

4. HeartbeatHealthWorker.kt (WorkManager)
   └─ Periodic check every 15-25 minutes
   └─ Restarts service if dead or silent >30min

5. ServiceKickWorker.kt
   └─ One-off job for safe restart from background

6. BatteryOptimizationHelper.kt
   └─ Request whitelist during provisioning

7. BootReceiver.kt
   └─ Handle BOOT_COMPLETED, MY_PACKAGE_REPLACED, USER_UNLOCKED

8. ProvisioningSuccessActivity.kt
   └─ Initialize WorkManager + battery optimization
```

### Recovery Guarantees (Design Spec)

| Failure Scenario | Recovery Method | Max Downtime |
|-----------------|-----------------|--------------|
| Service killed by Android | WorkManager health check | 15-25 minutes |
| Watchdog detects silence | Self-restart via ServiceKickWorker | ~1 minute |
| Device reboot | BootReceiver.BOOT_COMPLETED | Immediate |
| App upgrade | BootReceiver.MY_PACKAGE_REPLACED | Immediate |
| Network failure | Exponential backoff retry | Up to 15 minutes |

### Critical Code: HeartbeatHealthWorker.kt

This is the backstop that should have recovered Device #110:

```kotlin
class HeartbeatHealthWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    override fun doWork(): Result {
        Log.d(TAG, "⏰ WorkManager health check running")

        val stateManager = HeartbeatStateManager(applicationContext)
        val isServiceRunning = PollingService.isServiceRunning()

        if (!isServiceRunning) {
            Log.w(TAG, "🚨 Service NOT running - starting now")
            PollingService.startService(applicationContext)
            return Result.success()
        }

        // Service is running - check if it's responsive
        val lastSuccessAt = stateManager.getLastSuccessAtBlocking()

        if (lastSuccessAt == 0L) {
            Log.d(TAG, "⚠️ No heartbeat record yet (first run)")
            return Result.success()
        }

        val now = SystemClock.elapsedRealtime()
        val minutesSinceSuccess = (now - lastSuccessAt) / 60_000

        if (minutesSinceSuccess > 30) {
            Log.w(TAG, "🚨 Service silent for ${minutesSinceSuccess}m - restarting")
            PollingService.startService(applicationContext)
        } else {
            Log.d(TAG, "✅ Service healthy (last success ${minutesSinceSuccess}m ago)")
        }

        return Result.success()
    }
}
```

**Why it should have recovered Device #110:**
- Service died around T=15 (13 minutes before investigation)
- WorkManager runs every 15-25 minutes
- Should have detected dead service and restarted it
- At T=28, we're past the recovery window

## Root Cause Hypotheses

### Hypothesis 1: Initialization Failure
**Evidence:**
- WorkManager not showing in jobscheduler dumps
- Battery whitelist not granted
- Both should have been set up during provisioning

**Possible causes:**
- `ProvisioningSuccessActivity.schedulePeriodicHealthCheck()` never called
- `WorkManager.enqueueUniquePeriodicWork()` failed silently
- Device Owner provisioning happened before v0.0.38, then upgraded

**Test:** Check when devices were provisioned vs when v0.0.38 was installed.

### Hypothesis 2: WorkManager Scheduled But Not Running
**Evidence:**
- Device #110 at 28 minutes (past recovery window)
- No WorkManager logs visible

**Possible causes:**
- WorkManager scheduled but crashes during execution
- HeartbeatHealthWorker.doWork() throws exception
- JobScheduler restrictions preventing execution
- WorkManager database corruption

**Test:** Force-trigger WorkManager job manually on Device #621.

### Hypothesis 3: Device Owner Apps Don't Need Battery Optimization
**Evidence:**
- Device Owner apps have elevated privileges
- Foreground service running successfully
- Device #621 works perfectly (though USB-powered)

**Possible causes:**
- Battery optimization request fails silently for Device Owner apps
- Not actually needed - service should survive anyway
- Different power management rules apply

**Test:** Check Android documentation for Device Owner power management behavior.

### Hypothesis 4: Logging Completely Broken
**Evidence:**
- Zero logs from any app code
- Service appears running in dumpsys
- Web UI updates prove code IS executing

**Possible causes:**
- ProGuard stripping Log calls in release build
- Log tags changed but search patterns don't match
- Custom logging framework issue
- Android 10+ log restrictions for Device Owner apps

**Test:** Check ProGuard config, try different log filters, verify Log.d/w/e work.

### Hypothesis 5: USB Connection Affects Behavior
**Evidence:**
- Device #621 (USB): Works perfectly
- Device #110 (independent): Failed at 28 minutes

**Possible causes:**
- USB keeps device awake, preventing Doze mode
- WorkManager/JobScheduler behaves differently when USB connected
- Battery optimization doesn't apply when USB-powered
- Real-world power management not testable via USB

**Test:** Disconnect Device #621 from USB, observe if it starts failing.

## Critical Questions

1. **When were these devices provisioned?**
   - Before or after v0.0.38 was developed?
   - Were they upgraded from earlier version?

2. **Why are there no logs?**
   - Is the code actually executing?
   - Is ProGuard stripping logs in release builds?

3. **Is WorkManager actually scheduled?**
   - Maybe jobscheduler dump doesn't show WorkManager jobs correctly?
   - Can we query WorkManager database directly?

4. **Do Device Owner apps need battery optimization?**
   - Maybe foreground services already exempt?
   - Is the whitelist check even relevant?

5. **Why didn't BootReceiver initialize on upgrade?**
   - MY_PACKAGE_REPLACED should trigger WorkManager scheduling
   - Did it run but fail?

## Code Snippets for Investigation

### Check WorkManager Status Programmatically

Add to MainActivity.kt to verify WorkManager state:

```kotlin
import androidx.work.WorkInfo
import androidx.work.WorkManager

// In onCreate() or diagnostic button:
val workManager = WorkManager.getInstance(this)
workManager.getWorkInfosForUniqueWorkLiveData("mdm-heartbeat-health-check")
    .observe(this) { workInfos ->
        if (workInfos.isEmpty()) {
            Log.e(TAG, "❌ WorkManager health check NOT scheduled!")
        } else {
            workInfos.forEach { workInfo ->
                Log.d(TAG, "WorkManager status: ${workInfo.state}")
                Log.d(TAG, "Next run: ${workInfo.nextScheduleTimeMillis}")
            }
        }
    }
```

### Force Battery Optimization Check

```kotlin
// Add diagnostic logging to BatteryOptimizationHelper
val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
val isIgnoring = powerManager.isIgnoringBatteryOptimizations(packageName)
Log.d(TAG, "Battery optimization status: $isIgnoring")

// Also check if Device Owner apps are automatically exempt
val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)
Log.d(TAG, "Is Device Owner: $isDeviceOwner")
```

### Verify Logs Are Working

```kotlin
// Add to MainActivity.onCreate() as first line
Log.wtf("MainActivity", "🚨 WTF LOG TEST - If you see this, logging works!")
Log.e("MainActivity", "❌ ERROR LOG TEST")
Log.w("MainActivity", "⚠️ WARN LOG TEST")
Log.i("MainActivity", "ℹ️ INFO LOG TEST")
Log.d("MainActivity", "🐛 DEBUG LOG TEST")
```

## Recommended Next Steps

1. **Add WorkManager status check to MainActivity**
   - Verify if it's scheduled at all
   - Log next scheduled run time
   - Force-schedule if missing

2. **Add comprehensive logging to initialization paths**
   - ProvisioningSuccessActivity.schedulePeriodicHealthCheck()
   - BootReceiver.schedulePeriodicHealthCheck()
   - MainActivity.onCreate()

3. **Test without USB connection**
   - Disconnect Device #621 from USB
   - Observe if it enters same failure mode as Device #110
   - Confirms if USB is masking the problem

4. **Force-trigger WorkManager job**
   - Manually enqueue HeartbeatHealthWorker via WorkManager test utils
   - Verify it can run and detect service state

5. **Check ProGuard/R8 configuration**
   - Ensure Log.* calls aren't being stripped
   - Verify worker classes aren't being obfuscated

6. **Add resilience check to MainActivity**
   - On every app open, verify WorkManager is scheduled
   - Re-schedule if missing
   - Fail-safe for devices that missed initialization

## Conclusion

The resilience system was designed with comprehensive recovery mechanisms, but evidence suggests **it never initialized properly** on the production devices. Both WorkManager scheduling and battery optimization appear to be missing, which explains why Device #110 failed to recover after service death.

The fact that Device #621 works perfectly while USB-connected but shows no resilience infrastructure suggests the service only survives because USB prevents Doze mode. Once disconnected, it would likely exhibit the same failure as Device #110.

**Priority:** Determine why initialization failed and add fail-safe checks to ensure resilience system is always active.
