package com.qvk.app.feature.video.data

import com.qvk.app.core.common.Resource
import com.qvk.app.core.model.Attachment
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.dto.VideoDto
import com.qvk.app.core.network.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

/**
 * VK's algorithmic short-video discovery feed ("Клипы") runs on internal endpoints that were
 * never opened to third-party apps, so there is no public equivalent of an infinite swipe feed
 * of recommended clips. QVK instead surfaces the documented, always-available video.get/search
 * methods: your own uploaded videos and full-text search — real playback, just not a "For You" feed.
 */
@Singleton
class VideoRepository @Inject constructor(private val api: VkApiService) {

    suspend fun getMyVideos(): Resource<List<Attachment.Video>> =
        when (val r = safeApiCall { api.getVideos() }) {
            is Resource.Success -> Resource.Success(r.data.items.map { it.toAttachment() })
            is Resource.Error -> r
            Resource.Loading -> Resource.Loading
        }

    suspend fun search(query: String): Resource<List<Attachment.Video>> =
        when (val r = safeApiCall { api.searchVideos(query) }) {
            is Resource.Success -> Resource.Success(r.data.items.map { it.toAttachment() })
            is Resource.Error -> r
            Resource.Loading -> Resource.Loading
        }

    private fun VideoDto.toAttachment() = Attachment.Video(
        ownerId = owner_id,
        videoId = id,
        title = title,
        previewUrl = previewUrl,
        durationSeconds = duration,
        playerUrl = player,
        directUrl = files?.bestFor(preferredMaxHeight = 1080),
    )
}
