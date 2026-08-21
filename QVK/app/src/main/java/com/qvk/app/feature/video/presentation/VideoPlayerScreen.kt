package com.qvk.app.feature.video.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

@Composable
fun VideoPlayerScreen(
    videoUrl: String?,
    title: String,
    onBack: () -> Unit,
) {
    val context = LocalContext.current

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (videoUrl.isNullOrBlank()) {
            Text(
                "Прямая ссылка на видео недоступна",
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.align(Alignment.Center),
            )
        } else {
            val player = remember { ExoPlayer.Builder(context).build().apply { setMediaItem(MediaItem.fromUri(videoUrl)); prepare(); playWhenReady = true } }
            DisposableEffect(Unit) { onDispose { player.release() } }

            AndroidView(
                factory = { PlayerView(it).apply { this.player = player; useController = true } },
                modifier = Modifier.fillMaxSize(),
            )
        }

        IconButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart)) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = Color.White)
        }
    }
}
