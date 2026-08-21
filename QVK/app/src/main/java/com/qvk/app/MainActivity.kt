package com.qvk.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.core.datastore.QvkSettings
import com.qvk.app.core.ui.theme.QvkTheme
import com.qvk.app.navigation.AppRootViewModel
import com.qvk.app.navigation.QvkRoot
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

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
}
