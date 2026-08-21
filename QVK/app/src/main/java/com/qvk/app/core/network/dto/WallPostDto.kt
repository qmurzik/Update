package com.qvk.app.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class WallPostDto(
    val id: Long = 0,
    val owner_id: Long = 0,
    val from_id: Long = 0,
    val date: Long = 0,
    val text: String = "",
    val attachments: List<AttachmentDto> = emptyList(),
    val comments: CountInfoDto? = null,
    val likes: LikesInfoDto? = null,
    val reposts: CountInfoDto? = null,
    val views: ViewsInfoDto? = null,
    val copy_history: List<WallPostDto> = emptyList(),
    /** true when VK itself marks the post as a paid/sponsored placement. */
    val marked_as_ads: Int = 0,
    val is_pinned: Int? = null,
    val post_type: String = "post",
)

@Serializable
data class CountInfoDto(
    val count: Int = 0,
    val can_post: Int? = null,
)

@Serializable
data class LikesInfoDto(
    val count: Int = 0,
    val user_likes: Int = 0,
    val can_like: Int = 1,
)

@Serializable
data class ViewsInfoDto(
    val count: Int = 0,
)

@Serializable
data class CommentDto(
    val id: Long = 0,
    val from_id: Long = 0,
    val date: Long = 0,
    val text: String = "",
    val likes: LikesInfoDto? = null,
    val attachments: List<AttachmentDto> = emptyList(),
    val reply_to_user: Long? = null,
    val thread: CommentThreadDto? = null,
)

@Serializable
data class CommentThreadDto(
    val count: Int = 0,
)
