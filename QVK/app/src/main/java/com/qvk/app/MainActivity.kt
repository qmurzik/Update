package com.qvk.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.core.common.Constants
import com.qvk.app.core.datastore.QvkSettings
import com.qvk.app.core.ui.theme.QvkTheme
import com.qvk.app.feature.auth.data.OAuthRedirectBus
import com.qvk.app.navigation.AppRootViewModel
import com.qvk.app.navigation.QvkRoot
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var oauthRedirectBus: OAuthRedirectBus

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleDeepLink(intent)

        setContent {
            val rootViewModel: AppRootViewModel = hiltViewModel()
            val settings: QvkSettings by rootViewModel.settings.collectAsState()

            QvkTheme(
                themeMode = settings.themeMode,
                accentColor = settings.accentColor,
                useDynamicColor = settings.useDynamicColor,
                textScale = settings.textScale,
            ) {
                QvkRoot(rootViewModel)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    /** Routes the VK ID OAuth redirect (opened via the system browser, see OAuthRedirectBus) back
     * to whichever LoginViewModel is listening. Any other deep link is ignored. */
    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.toString().startsWith(Constants.VK_REDIRECT_URI)) {
            oauthRedirectBus.emit(data)
        }
    }
}
