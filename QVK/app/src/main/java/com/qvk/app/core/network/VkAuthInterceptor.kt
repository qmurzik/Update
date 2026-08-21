package com.qvk.app.core.network

import com.qvk.app.core.common.Constants
import com.qvk.app.core.security.TokenManager
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import java.util.Locale
import javax.inject.Inject

/** Appends `access_token`, `v` and `lang` to every outgoing api.vk.com request. */
class VkAuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = tokenManager.activeAccessToken

        val newUrl: HttpUrl = original.url.newBuilder()
            .addQueryParameter("v", Constants.VK_API_VERSION)
            .addQueryParameter("lang", Locale.getDefault().language.ifBlank { "ru" })
            .apply { if (!token.isNullOrBlank()) addQueryParameter("access_token", token) }
            .build()

        val newRequest = original.newBuilder().url(newUrl).build()
        return chain.proceed(newRequest)
    }
}
