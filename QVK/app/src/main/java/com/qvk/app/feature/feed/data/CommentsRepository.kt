package com.qvk.app.feature.feed.data

import com.qvk.app.core.common.Resource
import com.qvk.app.core.model.Comment
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.dto.CommentDto
import com.qvk.app.core.network.mapper.buildProfiles
import com.qvk.app.core.network.mapper.toDomain
import com.qvk.app.core.network.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CommentsRepository @Inject constructor(private val api: VkApiService) {

    suspend fun getComments(ownerId: Long, postId: Long, offset: Int = 0): Resource<List<Comment>> =
        when (val result = safeApiCall { api.getComments(ownerId, postId, offset = offset) }) {
            is Resource.Success -> {
                val profiles = buildProfiles(result.data.profiles, result.data.groups)
                Resource.Success(result.data.items.map { it.toDomain(profiles.resolveName(it.from_id), profiles.resolveAvatar(it.from_id)) })
            }
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    suspend fun addComment(ownerId: Long, postId: Long, text: String): Resource<Long> =
        when (val result = safeApiCall { api.createComment(ownerId, postId, text) }) {
            is Resource.Success -> Resource.Success(result.data.post_id)
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    private fun CommentDto.toDomain(authorName: String, authorAvatar: String?): Comment = Comment(
        id = id,
        fromId = from_id,
        authorName = authorName,
        authorAvatar = authorAvatar,
        date = date,
        text = text,
        likesCount = likes?.count ?: 0,
        isLiked = likes?.user_likes == 1,
        attachments = attachments.map { it.toDomain() },
        replyToUserId = reply_to_user,
        threadCount = thread?.count ?: 0,
    )
}
