package com.qvk.app.feature.auth.data

import android.net.Uri
import com.qvk.app.core.common.Constants

sealed class OAuthResult {
    data class Success(val accessToken: String, val userId: Long, val expiresIn: Long) : OAuthResult()
    data class Failure(val reason: String) : OAuthResult()
}

/**
 * VK's classic "Standalone app" OAuth flow (https://oauth.vk.com/authorize?response_type=token...)
 * redirects back to `vk<client_id>://authorize#access_token=...&expires_in=...&user_id=...` (or
 * `?error=...` on denial). Everything lives in the URL fragment, so it must be parsed manually —
 * Android's Uri.getQueryParameter only reads the query part, not the fragment.
 */
object OAuthRedirectParser {

    fun isRedirect(url: String): Boolean = url.startsWith(Constants.VK_REDIRECT_URI)

    fun parse(url: String): OAuthResult {
        val uri = Uri.parse(url)
        val raw = uri.fragment ?: uri.encodedQuery
        if (raw.isNullOrBlank()) return OAuthResult.Failure("Пустой ответ VK")

        val params = raw.split("&").mapNotNull { part ->
            val idx = part.indexOf('=')
            if (idx <= 0) return@mapNotNull null
            Uri.decode(part.substring(0, idx)) to Uri.decode(part.substring(idx + 1))
        }.toMap()

        params["error"]?.let { return OAuthResult.Failure(params["error_description"] ?: it) }

        val token = params["access_token"] ?: return OAuthResult.Failure("Токен не получен")
        val userId = params["user_id"]?.toLongOrNull() ?: return OAuthResult.Failure("user_id не получен")
        val expiresIn = params["expires_in"]?.toLongOrNull() ?: 0L
        return OAuthResult.Success(token, userId, expiresIn)
    }

    fun buildAuthorizeUrl(): String = Uri.parse(Constants.VK_OAUTH_AUTHORIZE_URL).buildUpon()
        .appendQueryParameter("client_id", Constants.VK_CLIENT_ID)
        .appendQueryParameter("display", "mobile")
        .appendQueryParameter("redirect_uri", Constants.VK_REDIRECT_URI)
        .appendQueryParameter("scope", Constants.VK_AUTH_SCOPE)
        .appendQueryParameter("response_type", "token")
        .appendQueryParameter("v", Constants.VK_API_VERSION)
        .build()
        .toString()
}
