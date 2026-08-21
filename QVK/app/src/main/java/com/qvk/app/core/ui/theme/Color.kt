package com.qvk.app.core.ui.theme

import androidx.compose.ui.graphics.Color
import com.qvk.app.core.datastore.AccentColor

data class AccentPalette(
    val primary: Color,
    val onPrimary: Color,
    val primaryContainer: Color,
    val onPrimaryContainer: Color,
    val secondary: Color,
    val tertiary: Color,
)

private val BluePalette = AccentPalette(
    primary = Color(0xFF4C7CFF),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCE6FF),
    onPrimaryContainer = Color(0xFF001A50),
    secondary = Color(0xFF5B6B8C),
    tertiary = Color(0xFF7A5289),
)

private val VioletPalette = AccentPalette(
    primary = Color(0xFF8A5CF6),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFEADDFF),
    onPrimaryContainer = Color(0xFF29024D),
    secondary = Color(0xFF6C5A79),
    tertiary = Color(0xFF80526A),
)

private val EmeraldPalette = AccentPalette(
    primary = Color(0xFF12B886),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFB6F2DB),
    onPrimaryContainer = Color(0xFF002013),
    secondary = Color(0xFF4B6358),
    tertiary = Color(0xFF3E6373),
)

private val RosePalette = AccentPalette(
    primary = Color(0xFFF5457A),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFD9E1),
    onPrimaryContainer = Color(0xFF3E0018),
    secondary = Color(0xFF77565D),
    tertiary = Color(0xFF7A5735),
)

private val AmberPalette = AccentPalette(
    primary = Color(0xFFF5A623),
    onPrimary = Color(0xFF3E2700),
    primaryContainer = Color(0xFFFFDDB0),
    onPrimaryContainer = Color(0xFF2A1700),
    secondary = Color(0xFF6F5B40),
    tertiary = Color(0xFF4F6544),
)

fun AccentColor.palette(): AccentPalette = when (this) {
    AccentColor.BLUE -> BluePalette
    AccentColor.VIOLET -> VioletPalette
    AccentColor.EMERALD -> EmeraldPalette
    AccentColor.ROSE -> RosePalette
    AccentColor.AMBER -> AmberPalette
}

val AmoledBlack = Color(0xFF000000)
