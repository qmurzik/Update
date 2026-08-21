package com.qvk.app.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class NewsfeedResponseDto(
    val items: List<NewsfeedItemDto> = emptyList(),
    val profiles: List<UserDto> = emptyList(),
    val groups: List<GroupDto> = emptyList(),
    val next_from: String? = null,
)

/**
 * newsfeed.get returns a looser shape than wall.get (source_id/post_id instead of owner_id/id) —
 * kept as its own DTO and normalized into the shared `Post` domain model by the feed mapper.
 */
@Serializable
data class NewsfeedItemDto(
    val type: String = "post",
    val source_id: Long = 0,
    val post_id: Long = 0,
    val post_type: String = "post",
    val date: Long = 0,
    val text: String = "",
    val attachments: List<AttachmentDto> = emptyList(),
    val comments: CountInfoDto? = null,
    val likes: LikesInfoDto? = null,
    val reposts: CountInfoDto? = null,
    val views: ViewsInfoDto? = null,
    val copy_history: List<WallPostDto> = emptyList(),
    val marked_as_ads: Int = 0,
)

@Serializable
data class NotificationsResponseDto(
    val count: Int = 0,
    val items: List<NotificationItemDto> = emptyList(),
    val profiles: List<UserDto> = emptyList(),
    val groups: List<GroupDto> = emptyList(),
)

@Serializable
data class NotificationItemDto(
    val type: String = "",
    val date: Long = 0,
    val parent: NotificationParentDto? = null,
    val feedback: NotificationFeedbackDto? = null,
)

@Serializable
data class NotificationParentDto(
    val id: Long = 0,
    val owner_id: Long = 0,
    val from_id: Long? = null,
    val text: String? = null,
)

@Serializable
data class NotificationFeedbackDto(
    val id: Long = 0,
    val from_id: Long = 0,
    val text: String? = null,
)
