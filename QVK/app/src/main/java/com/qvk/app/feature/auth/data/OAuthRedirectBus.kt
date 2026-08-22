package com.qvk.app.feature.auth.data

import android.net.Uri
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Delivers the VK ID OAuth redirect (vk<client_id>://vk.ru/blank.html?code=...) from
 * MainActivity's onNewIntent — where Android routes it after the system browser finishes the
 * login — to whichever LoginViewModel is currently listening. A plain WebView can't be used for
 * this login: VK ID's own page detects embedded WebViews (a standard anti-phishing measure, same
 * as Google's OAuth policy) and refuses to complete the flow, so the browser is launched via a
 * normal ACTION_VIEW intent instead and the redirect comes back as a deep link.
 */
@Singleton
class OAuthRedirectBus @Inject constructor() {
    private val _redirects = MutableSharedFlow<Uri>(replay = 0, extraBufferCapacity = 1)
    val redirects: SharedFlow<Uri> = _redirects.asSharedFlow()

    fun emit(uri: Uri) {
        _redirects.tryEmit(uri)
    }
}
