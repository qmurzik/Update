package com.qvk.app.feature.auth.data

import com.qvk.app.core.common.Constants
import com.qvk.app.core.common.Resource
import com.qvk.app.core.di.LongPollClient
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.safeApiCall
import com.qvk.app.core.security.TokenManager
import com.qvk.app.core.security.VkAccount
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: VkApiService,
    private val tokenManager: TokenManager,
    @LongPollClient private val plainHttpClient: OkHttpClient, // no VkAuthInterceptor — id.vk.com is not api.vk.com
    private val json: Json,
) {
    val accounts: StateFlow<List<VkAccount>> get() = tokenManager.accounts
    val activeAccountId: StateFlow<Long?> get() = tokenManager.activeAccountId
    val isLoggedIn: Boolean get() = tokenManager.activeAccount != null

    /**
     * Exchanges a VK ID authorization code for an access token (POST id.vk.com/oauth2/auth),
     * persists it immediately (so the auth interceptor can use it), then fetches the real
     * name/avatar to replace the placeholder values in the stored account.
     */
    suspend fun completeLogin(oauth: OAuthResult.Success, codeVerifier: String): Resource<VkAccount> {
        val tokenResult = exchangeCodeForToken(oauth.code, oauth.deviceId, codeVerifier)
        val tokenResponse = when (tokenResult) {
            is Resource.Success -> tokenResult.data
            is Resource.Error -> return tokenResult
            Resource.Loading -> return Resource.Error("...")
        }

        if (tokenResponse.error != null) {
            return Resource.Error(tokenResponse.error_description ?: tokenResponse.error)
        }
        val accessToken = tokenResponse.access_token ?: return Resource.Error("VK ID не вернул access_token")
        val userId = tokenResponse.user_id ?: return Resource.Error("VK ID не вернул user_id")

        val placeholder = VkAccount(
            userId = userId,
            accessToken = accessToken,
            firstName = "VK",
            lastName = "User",
            expiresAt = tokenResponse.expires_in?.let { System.currentTimeMillis() / 1000 + it } ?: 0L,
        )
        tokenManager.saveAccount(placeholder, makeActive = true)

        return when (val result = safeApiCall { api.getUsers(userIds = userId.toString()) }) {
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

    private suspend fun exchangeCodeForToken(code: String, deviceId: String, codeVerifier: String): Resource<VkIdTokenResponse> =
        withContext(Dispatchers.IO) {
            try {
                val body = FormBody.Builder()
                    .add("grant_type", "authorization_code")
                    .add("code", code)
                    .add("redirect_uri", Constants.VK_REDIRECT_URI)
                    .add("client_id", Constants.VK_CLIENT_ID)
                    .add("device_id", deviceId)
                    .add("code_verifier", codeVerifier)
                    .build()
                val request = Request.Builder().url(Constants.VK_ID_TOKEN_URL).post(body).build()

                val responseBody = plainHttpClient.newCall(request).execute().use { response ->
                    response.body?.string()
                } ?: return@withContext Resource.Error("Пустой ответ VK ID")

                Resource.Success(json.decodeFromString<VkIdTokenResponse>(responseBody))
            } catch (e: Exception) {
                Timber.e(e, "VK ID token exchange failed")
                Resource.Error("Не удалось обменять код на токен: ${e.message}")
            }
        }

    fun switchAccount(userId: Long) = tokenManager.setActiveAccount(userId)

    fun logout(userId: Long) = tokenManager.removeAccount(userId)

    fun logoutAll() = tokenManager.logoutAll()
}
