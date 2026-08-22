package com.qvk.app.feature.auth.data

import android.net.Uri
import android.util.Base64
import com.qvk.app.core.common.Constants
import java.security.MessageDigest
import java.security.SecureRandom

sealed class OAuthResult {
    data class Success(val code: String, val deviceId: String, val state: String) : OAuthResult()
    data class Failure(val reason: String) : OAuthResult()
}

data class PkceParams(val codeVerifier: String, val codeChallenge: String, val state: String)

/**
 * VK ID (https://id.vk.com) — VK's current OAuth 2.1 + PKCE login system, which replaced the
 * classic "Standalone application" implicit flow. That old flow (oauth.vk.com/authorize,
 * response_type=token) now returns {"error":"invalid_request","error_description":
 * "application is disabled"} for apps created after VK's platform migration to VK ID, regardless
 * of any app setting — there's no toggle to fix it, the endpoint itself is closed to new apps.
 *
 * The redirect URI format below (`vk<client_id>://vk.ru/blank.html`) is VK ID's required format
 * for native/mobile apps; other custom-scheme shapes are rejected as invalid redirect_uri.
 */
object OAuthRedirectParser {

    fun generatePkce(): PkceParams {
        val verifier = randomUrlSafeString()
        val challenge = codeChallengeFor(verifier)
        val state = randomUrlSafeString(16)
        return PkceParams(verifier, challenge, state)
    }

    fun buildAuthorizeUrl(pkce: PkceParams): String = Uri.parse(Constants.VK_ID_AUTHORIZE_URL).buildUpon()
        .appendQueryParameter("response_type", "code")
        .appendQueryParameter("client_id", Constants.VK_CLIENT_ID)
        .appendQueryParameter("redirect_uri", Constants.VK_REDIRECT_URI)
        .appendQueryParameter("code_challenge", pkce.codeChallenge)
        .appendQueryParameter("code_challenge_method", "S256")
        .appendQueryParameter("state", pkce.state)
        .appendQueryParameter("scope", Constants.VK_AUTH_SCOPE)
        .build()
        .toString()

    fun isRedirect(url: String): Boolean = url.startsWith(Constants.VK_REDIRECT_URI)

    fun parseRedirect(url: String, expectedState: String): OAuthResult {
        val uri = Uri.parse(url)

        uri.getQueryParameter("error")?.let { error ->
            return OAuthResult.Failure(uri.getQueryParameter("error_description") ?: error)
        }

        val code = uri.getQueryParameter("code") ?: return OAuthResult.Failure("Код авторизации не получен")
        val deviceId = uri.getQueryParameter("device_id") ?: return OAuthResult.Failure("device_id не получен")
        val state = uri.getQueryParameter("state").orEmpty()
        if (state != expectedState) return OAuthResult.Failure("Несовпадение state — возможна подмена запроса")

        return OAuthResult.Success(code, deviceId, state)
    }

    private fun randomUrlSafeString(byteLength: Int = 32): String {
        val bytes = ByteArray(byteLength)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    private fun codeChallengeFor(verifier: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII))
        return Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
}
