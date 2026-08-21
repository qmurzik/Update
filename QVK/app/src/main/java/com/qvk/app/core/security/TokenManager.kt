package com.qvk.app.core.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.qvk.app.core.common.Constants
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class VkAccount(
    val userId: Long,
    val accessToken: String,
    val firstName: String,
    val lastName: String,
    val avatarUrl: String? = null,
    val expiresAt: Long = 0L, // 0 = "offline" scope, token does not expire
)

/**
 * Stores every logged-in account's access token in an AES-256-GCM EncryptedSharedPreferences
 * file (backed by a hardware-bound MasterKey where available). Tokens are never written to
 * Room, logs, or plain SharedPreferences. Supports multiple simultaneously logged-in accounts,
 * matching how the official app lets you switch profiles without re-authenticating.
 */
@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val json = Json { ignoreUnknownKeys = true }

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        Constants.SECURE_PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val _accounts = MutableStateFlow(loadAccounts())
    val accounts: StateFlow<List<VkAccount>> = _accounts.asStateFlow()

    private val _activeAccountId = MutableStateFlow(prefs.getLong(KEY_ACTIVE_ID, -1L).takeIf { it != -1L })
    val activeAccountId: StateFlow<Long?> = _activeAccountId.asStateFlow()

    val activeAccount: VkAccount?
        get() = _activeAccountId.value?.let { id -> _accounts.value.firstOrNull { it.userId == id } }

    val activeAccessToken: String?
        get() = activeAccount?.accessToken

    fun saveAccount(account: VkAccount, makeActive: Boolean = true) {
        val updated = _accounts.value.filterNot { it.userId == account.userId } + account
        persistAccounts(updated)
        _accounts.value = updated
        if (makeActive) setActiveAccount(account.userId)
    }

    fun setActiveAccount(userId: Long) {
        prefs.edit().putLong(KEY_ACTIVE_ID, userId).apply()
        _activeAccountId.value = userId
    }

    fun removeAccount(userId: Long) {
        val updated = _accounts.value.filterNot { it.userId == userId }
        persistAccounts(updated)
        _accounts.value = updated
        if (_activeAccountId.value == userId) {
            val next = updated.firstOrNull()?.userId
            if (next != null) setActiveAccount(next) else clearActive()
        }
    }

    fun logoutAll() {
        prefs.edit().clear().apply()
        _accounts.value = emptyList()
        _activeAccountId.value = null
    }

    private fun clearActive() {
        prefs.edit().remove(KEY_ACTIVE_ID).apply()
        _activeAccountId.value = null
    }

    private fun persistAccounts(accounts: List<VkAccount>) {
        prefs.edit().putString(KEY_ACCOUNTS, json.encodeToString(accounts)).apply()
    }

    private fun loadAccounts(): List<VkAccount> {
        val raw = prefs.getString(KEY_ACCOUNTS, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<VkAccount>>(raw) }.getOrDefault(emptyList())
    }

    private companion object {
        const val KEY_ACCOUNTS = "accounts_json"
        const val KEY_ACTIVE_ID = "active_account_id"
    }
}
