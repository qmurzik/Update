package com.qvk.app.core.model

import kotlinx.serialization.Serializable

@Serializable
data class Post(
    val ownerId: Long,
    val postId: Long,
    val fromId: Long,
    val authorName: String,
    val authorAvatar: String?,
    val date: Long,
    val text: String,
    val attachments: List<Attachment>,
    val likesCount: Int,
    val isLiked: Boolean,
    val commentsCount: Int,
    val repostsCount: Int,
    val viewsCount: Int,
    val isAd: Boolean,
    val repostOf: Post?,
) {
    val uid: String get() = "$ownerId:$postId"
}

data class Comment(
    val id: Long,
    val fromId: Long,
    val authorName: String,
    val authorAvatar: String?,
    val date: Long,
    val text: String,
    val likesCount: Int,
    val isLiked: Boolean,
    val attachments: List<Attachment>,
    val replyToUserId: Long?,
    val threadCount: Int,
)
