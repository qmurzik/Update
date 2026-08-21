package com.qvk.app.feature.auth.data

import com.qvk.app.core.common.Resource
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.safeApiCall
import com.qvk.app.core.security.TokenManager
import com.qvk.app.core.security.VkAccount
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: VkApiService,
    private val tokenManager: TokenManager,
) {
    val accounts: StateFlow<List<VkAccount>> get() = tokenManager.accounts
    val activeAccountId: StateFlow<Long?> get() = tokenManager.activeAccountId
    val isLoggedIn: Boolean get() = tokenManager.activeAccount != null

    /**
     * Persists the freshly-issued token immediately (so the auth interceptor can use it), then
     * fetches the real name/avatar to replace the placeholder values in the stored account.
     */
    suspend fun completeLogin(oauth: OAuthResult.Success): Resource<VkAccount> {
        val placeholder = VkAccount(
            userId = oauth.userId,
            accessToken = oauth.accessToken,
            firstName = "VK",
            lastName = "User",
            expiresAt = if (oauth.expiresIn > 0) System.currentTimeMillis() / 1000 + oauth.expiresIn else 0L,
        )
        tokenManager.saveAccount(placeholder, makeActive = true)

        return when (val result = safeApiCall { api.getUsers(userIds = oauth.userId.toString()) }) {
            is Resource.Success -> {
                val me = result.data.firstOrNull()
                val enriched = placeholder.copy(
                    firstName = me?.first_name ?: placeholder.firstName,
                    lastName = me?.last_name ?: placeholder.lastName,
                    avatarUrl = me?.photo_200,
                )
                tokenManager.saveAccount(enriched, makeActive = true)
                Resource.Success(enriched)
            }
            is Resource.Error -> {
                // Login itself still succeeded — profile enrichment can retry later from Settings.
                Resource.Success(placeholder)
            }
            Resource.Loading -> Resource.Success(placeholder)
        }
    }

    fun switchAccount(userId: Long) = tokenManager.setActiveAccount(userId)

    fun logout(userId: Long) = tokenManager.removeAccount(userId)

    fun logoutAll() = tokenManager.logoutAll()
}
