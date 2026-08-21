package com.qvk.app.core.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Scales every text style by the user's Settings > text size preference. */
fun buildTypography(scale: Float): Typography {
    fun style(size: Int, weight: FontWeight, lineHeight: Int, letterSpacing: Double = 0.0): TextStyle = TextStyle(
        fontWeight = weight,
        fontSize = (size * scale).sp,
        lineHeight = (lineHeight * scale).sp,
        letterSpacing = letterSpacing.sp,
    )

    return Typography(
        displayLarge = style(57, FontWeight.Normal, 64),
        displayMedium = style(45, FontWeight.Normal, 52),
        displaySmall = style(36, FontWeight.Normal, 44),
        headlineLarge = style(32, FontWeight.SemiBold, 40),
        headlineMedium = style(28, FontWeight.SemiBold, 36),
        headlineSmall = style(24, FontWeight.SemiBold, 32),
        titleLarge = style(22, FontWeight.SemiBold, 28),
        titleMedium = style(16, FontWeight.Medium, 24, 0.15),
        titleSmall = style(14, FontWeight.Medium, 20, 0.1),
        bodyLarge = style(16, FontWeight.Normal, 24, 0.5),
        bodyMedium = style(14, FontWeight.Normal, 20, 0.25),
        bodySmall = style(12, FontWeight.Normal, 16, 0.4),
        labelLarge = style(14, FontWeight.Medium, 20, 0.1),
        labelMedium = style(12, FontWeight.Medium, 16, 0.5),
        labelSmall = style(11, FontWeight.Medium, 16, 0.5),
    )
}
