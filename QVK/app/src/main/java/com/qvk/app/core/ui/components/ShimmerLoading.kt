package com.qvk.app.core.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp

@Composable
private fun shimmerBrush(): Brush {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translate by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(tween(1200, easing = LinearEasing), RepeatMode.Restart),
        label = "shimmer_translate",
    )
    val base = MaterialTheme.colorScheme.surfaceVariant
    val highlight = MaterialTheme.colorScheme.surface
    return Brush.linearGradient(
        colors = listOf(base, highlight, base),
        start = androidx.compose.ui.geometry.Offset(translate - 300f, 0f),
        end = androidx.compose.ui.geometry.Offset(translate, 300f),
    )
}

@Composable
fun ShimmerBox(modifier: Modifier = Modifier) {
    Column(modifier = modifier.background(shimmerBrush())) {}
}

/** A skeleton post card shown while the feed's first page loads. */
@Composable
fun PostCardSkeleton(modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth().padding(16.dp)) {
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            ShimmerBox(Modifier.size(44.dp).clip(CircleShape))
            Column(Modifier.padding(start = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ShimmerBox(Modifier.size(width = 120.dp, height = 12.dp).clip(RoundedCornerShape(4.dp)))
                ShimmerBox(Modifier.size(width = 80.dp, height = 10.dp).clip(RoundedCornerShape(4.dp)))
            }
        }
        ShimmerBox(
            Modifier
                .fillMaxWidth()
                .padding(top = 12.dp)
                .height(14.dp)
                .clip(RoundedCornerShape(4.dp)),
        )
        ShimmerBox(
            Modifier
                .fillMaxWidth()
                .padding(top = 6.dp)
                .height(160.dp)
                .clip(RoundedCornerShape(16.dp)),
        )
    }
}
