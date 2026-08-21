package com.qvk.app.core.media

import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import dagger.hilt.android.AndroidEntryPoint

/**
 * Real Media3 background-playback service (foreground, mediaPlayback type — see the manifest).
 * It plays whatever [androidx.media3.common.MediaItem] QVK's player queue hands it, e.g. a video
 * attachment's direct URL, or — if the current token happens to carry the `audio` scope, see
 * [com.qvk.app.feature.music.data.MusicRepository] — a track's direct URL. There is nothing
 * VK-specific here: this is a standard Media3 session so lock-screen controls, Bluetooth/headset
 * buttons, and Android Auto all work out of the box.
 */
@AndroidEntryPoint
class MusicPlaybackService : MediaSessionService() {

    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(androidx.media3.common.AudioAttributes.DEFAULT, /* handleAudioFocus = */ true)
            setHandleAudioBecomingNoisy(true)
        }
        mediaSession = MediaSession.Builder(this, player).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onTaskRemoved(rootIntent: android.content.Intent?) {
        val player = mediaSession?.player ?: return
        if (!player.playWhenReady || player.mediaItemCount == 0) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
