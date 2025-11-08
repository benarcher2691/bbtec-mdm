package com.bbtec.mdm.client

import android.content.Context
import android.os.SystemClock
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking

/**
 * Manages heartbeat state persistence using DataStore.
 *
 * Uses monotonic clock (SystemClock.elapsedRealtime()) to avoid issues with
 * wall-clock changes (timezone, user adjustment, etc.).
 *
 * Thread-safe and survives process death.
 */
class HeartbeatStateManager(private val context: Context) {

    companion object {
        private const val TAG = "HeartbeatStateManager"

        // DataStore instance
        private val Context.heartbeatDataStore: DataStore<Preferences> by preferencesDataStore(
            name = "heartbeat_state"
        )

        // Keys for state persistence
        private val LAST_SUCCESS_AT = longPreferencesKey("last_success_at")
        private val LAST_ATTEMPT_AT = longPreferencesKey("last_attempt_at")
        private val CONSECUTIVE_FAILURES = intPreferencesKey("consecutive_failures")
        private val CURRENT_BACKOFF_MS = longPreferencesKey("current_backoff_ms")
    }

    private val dataStore = context.heartbeatDataStore

    /**
     * Records a successful heartbeat.
     * Resets failures and backoff.
     */
    suspend fun recordSuccess() {
        val now = SystemClock.elapsedRealtime()
        dataStore.edit { prefs ->
            prefs[LAST_SUCCESS_AT] = now
            prefs[LAST_ATTEMPT_AT] = now
            prefs[CONSECUTIVE_FAILURES] = 0
            prefs[CURRENT_BACKOFF_MS] = 0L
        }
    }

    /**
     * Records a failed heartbeat attempt.
     * Increments failure count and calculates new backoff.
     */
    suspend fun recordFailure(newBackoffMs: Long) {
        val now = SystemClock.elapsedRealtime()
        dataStore.edit { prefs ->
            prefs[LAST_ATTEMPT_AT] = now
            val failures = (prefs[CONSECUTIVE_FAILURES] ?: 0) + 1
            prefs[CONSECUTIVE_FAILURES] = failures
            prefs[CURRENT_BACKOFF_MS] = newBackoffMs
        }
    }

    /**
     * Gets the timestamp (elapsedRealtime) of last successful heartbeat.
     * Returns 0 if never succeeded.
     */
    suspend fun getLastSuccessAt(): Long {
        return dataStore.data.map { prefs ->
            prefs[LAST_SUCCESS_AT] ?: 0L
        }.first()
    }

    /**
     * Gets the timestamp (elapsedRealtime) of last heartbeat attempt.
     * Returns 0 if never attempted.
     */
    suspend fun getLastAttemptAt(): Long {
        return dataStore.data.map { prefs ->
            prefs[LAST_ATTEMPT_AT] ?: 0L
        }.first()
    }

    /**
     * Gets the current consecutive failure count.
     * Returns 0 if no failures.
     */
    suspend fun getConsecutiveFailures(): Int {
        return dataStore.data.map { prefs ->
            prefs[CONSECUTIVE_FAILURES] ?: 0
        }.first()
    }

    /**
     * Gets the current backoff duration in milliseconds.
     * Returns 0 if no backoff.
     */
    suspend fun getCurrentBackoffMs(): Long {
        return dataStore.data.map { prefs ->
            prefs[CURRENT_BACKOFF_MS] ?: 0L
        }.first()
    }

    /**
     * Blocking variant for non-coroutine contexts.
     * Use sparingly - prefer suspend functions when possible.
     */
    fun getLastSuccessAtBlocking(): Long {
        return runBlocking { getLastSuccessAt() }
    }

    /**
     * Blocking variant for non-coroutine contexts.
     * Use sparingly - prefer suspend functions when possible.
     */
    fun getConsecutiveFailuresBlocking(): Int {
        return runBlocking { getConsecutiveFailures() }
    }

    /**
     * Blocking variant for non-coroutine contexts.
     * Use sparingly - prefer suspend functions when possible.
     */
    fun getCurrentBackoffMsBlocking(): Long {
        return runBlocking { getCurrentBackoffMs() }
    }

    /**
     * Flow of heartbeat state for reactive UI updates.
     */
    fun getStateFlow(): Flow<HeartbeatState> {
        return dataStore.data.map { prefs ->
            HeartbeatState(
                lastSuccessAt = prefs[LAST_SUCCESS_AT] ?: 0L,
                lastAttemptAt = prefs[LAST_ATTEMPT_AT] ?: 0L,
                consecutiveFailures = prefs[CONSECUTIVE_FAILURES] ?: 0,
                currentBackoffMs = prefs[CURRENT_BACKOFF_MS] ?: 0L
            )
        }
    }

    /**
     * Data class representing heartbeat state.
     */
    data class HeartbeatState(
        val lastSuccessAt: Long,
        val lastAttemptAt: Long,
        val consecutiveFailures: Int,
        val currentBackoffMs: Long
    ) {
        /**
         * Returns human-readable time since last success.
         */
        fun timeSinceLastSuccess(): String {
            if (lastSuccessAt == 0L) return "Never"
            val elapsedMs = SystemClock.elapsedRealtime() - lastSuccessAt
            return formatDuration(elapsedMs)
        }

        /**
         * Returns true if heartbeat is overdue based on expected interval.
         */
        fun isOverdue(expectedIntervalMs: Long): Boolean {
            if (lastSuccessAt == 0L) return false
            val elapsed = SystemClock.elapsedRealtime() - lastSuccessAt
            return elapsed > (expectedIntervalMs * 2)
        }

        private fun formatDuration(ms: Long): String {
            val seconds = ms / 1000
            val minutes = seconds / 60
            val hours = minutes / 60
            val days = hours / 24

            return when {
                days > 0 -> "${days}d ${hours % 24}h ago"
                hours > 0 -> "${hours}h ${minutes % 60}m ago"
                minutes > 0 -> "${minutes}m ${seconds % 60}s ago"
                else -> "${seconds}s ago"
            }
        }
    }
}
