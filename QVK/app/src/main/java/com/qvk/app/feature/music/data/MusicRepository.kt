package com.qvk.app.feature.music.data

import com.qvk.app.core.model.Attachment
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.dto.AudioDto
import com.qvk.app.core.network.VkErrorCode
import com.qvk.app.core.network.safeApiCall
import com.qvk.app.core.common.Resource
import javax.inject.Inject
import javax.inject.Singleton

sealed class MusicResult {
    data class Available(val tracks: List<Attachment.Audio>) : MusicResult()
    /** The token has no `audio` scope — expected for ~all third-party apps, see VkApiService.getAudio. */
    data object Unavailable : MusicResult()
    data class Error(val message: String) : MusicResult()
}

@Singleton
class MusicRepository @Inject constructor(private val api: VkApiService) {

    suspend fun getMyTracks(): MusicResult = when (val result = safeApiCall { api.getAudio() }) {
        is Resource.Success -> MusicResult.Available(result.data.items.map { it.toAttachment() })
        is Resource.Error -> if (result.code == VkErrorCode.ACCESS_DENIED) MusicResult.Unavailable else MusicResult.Error(result.message)
        Resource.Loading -> MusicResult.Error("...")
    }

    suspend fun search(query: String): MusicResult = when (val result = safeApiCall { api.searchAudio(query) }) {
        is Resource.Success -> MusicResult.Available(result.data.items.map { it.toAttachment() })
        is Resource.Error -> if (result.code == VkErrorCode.ACCESS_DENIED) MusicResult.Unavailable else MusicResult.Error(result.message)
        Resource.Loading -> MusicResult.Error("...")
    }

    private fun AudioDto.toAttachment() = Attachment.Audio(
        ownerId = owner_id,
        audioId = id,
        artist = artist,
        title = title,
        durationSeconds = duration,
        directUrl = url,
        coverUrl = album?.thumb?.photo_300,
    )
}
