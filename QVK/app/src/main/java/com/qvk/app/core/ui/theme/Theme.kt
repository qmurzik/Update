package com.qvk.app.core.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.qvk.app.core.datastore.AccentColor
import com.qvk.app.core.datastore.ThemeMode

@Composable
fun QvkTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    accentColor: AccentColor = AccentColor.BLUE,
    useDynamicColor: Boolean = true,
    textScale: Float = 1.0f,
    content: @Composable () -> Unit,
) {
    val systemDark = isSystemInDarkTheme()
    val isDark = when (themeMode) {
        ThemeMode.SYSTEM -> systemDark
        ThemeMode.LIGHT -> false
        ThemeMode.DARK, ThemeMode.AMOLED -> true
    }
    val context = LocalContext.current
    val dynamicAvailable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    val colorScheme = when {
        useDynamicColor && dynamicAvailable && isDark ->
            dynamicDarkColorScheme(context).let { if (themeMode == ThemeMode.AMOLED) it.copy(background = AmoledBlack, surface = AmoledBlack) else it }
        useDynamicColor && dynamicAvailable && !isDark -> dynamicLightColorScheme(context)
        isDark -> {
            val p = accentColor.palette()
            val base = darkColorScheme(
                primary = p.primary,
                onPrimary = p.onPrimary,
                primaryContainer = p.primaryContainer,
                onPrimaryContainer = p.onPrimaryContainer,
                secondary = p.secondary,
                tertiary = p.tertiary,
            )
            if (themeMode == ThemeMode.AMOLED) base.copy(background = AmoledBlack, surface = AmoledBlack) else base
        }
        else -> {
            val p = accentColor.palette()
            lightColorScheme(
                primary = p.primary,
                onPrimary = p.onPrimary,
                primaryContainer = p.primaryContainer,
                onPrimaryContainer = p.onPrimaryContainer,
                secondary = p.secondary,
                tertiary = p.tertiary,
            )
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = buildTypography(textScale),
        content = content,
    )
}
