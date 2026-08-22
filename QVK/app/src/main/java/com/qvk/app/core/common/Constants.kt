package com.qvk.app.core.common

import com.qvk.app.BuildConfig

object Constants {
    const val VK_API_BASE_URL = "https://api.vk.com/"
    const val VK_API_VERSION = BuildConfig.VK_API_VERSION
    const val VK_CLIENT_ID = BuildConfig.VK_CLIENT_ID
    const val VK_REDIRECT_URI = BuildConfig.VK_REDIRECT_URI

    /**
     * VK ID — VK's current OAuth 2.1 + PKCE login system (https://id.vk.com). The older classic
     * "Standalone application" implicit flow (oauth.vk.com/authorize, response_type=token) is no
     * longer usable for apps created after VK's platform migration — it returns
     * {"error":"invalid_request","error_description":"application is disabled"} regardless of
     * app settings. See feature/auth/data/OAuthRedirectParser for the PKCE flow itself.
     */
    const val VK_ID_AUTHORIZE_URL = "https://id.vk.com/authorize"
    const val VK_ID_TOKEN_URL = "https://id.vk.com/oauth2/auth"

    /** vk.com/dev/permissions — the exact set of rights QVK asks for at login. */
    const val VK_AUTH_SCOPE = "friends,photos,wall,groups,messages,video,docs,notifications,stats,offline"

    const val DEFAULT_PAGE_SIZE = 20
    const val DATABASE_NAME = "qvk.db"
    const val SECURE_PREFS_NAME = "qvk_secure_prefs"
    const val SETTINGS_DATASTORE_NAME = "qvk_settings"

    const val LONG_POLL_WAIT_SECONDS = 25
}
