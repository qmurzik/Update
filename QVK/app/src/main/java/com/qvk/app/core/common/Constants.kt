package com.qvk.app.core.common

import com.qvk.app.BuildConfig

object Constants {
    const val VK_API_BASE_URL = "https://api.vk.com/"
    const val VK_OAUTH_AUTHORIZE_URL = "https://oauth.vk.com/authorize"
    const val VK_API_VERSION = BuildConfig.VK_API_VERSION
    const val VK_CLIENT_ID = BuildConfig.VK_CLIENT_ID
    const val VK_REDIRECT_URI = BuildConfig.VK_REDIRECT_URI

    /** vk.com/dev/permissions — the exact set of rights QVK asks for at login. */
    const val VK_AUTH_SCOPE = "friends,photos,wall,groups,messages,video,docs,notifications,stats,offline"

    const val DEFAULT_PAGE_SIZE = 20
    const val DATABASE_NAME = "qvk.db"
    const val SECURE_PREFS_NAME = "qvk_secure_prefs"
    const val SETTINGS_DATASTORE_NAME = "qvk_settings"

    const val LONG_POLL_WAIT_SECONDS = 25
}
