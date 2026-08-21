package com.qvk.app.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class ConversationsResponseDto(
    val count: Int = 0,
    val items: List<ConversationItemDto> = emptyList(),
    val profiles: List<UserDto> = emptyList(),
    val groups: List<GroupDto> = emptyList(),
)

@Serializable
data class ConversationItemDto(
    val conversation: ConversationDto,
    val last_message: MessageDto? = null,
)

@Serializable
data class ConversationDto(
    val peer: PeerDto,
    val in_read: Long = 0,
    val out_read: Long = 0,
    val unread_count: Int = 0,
    val chat_settings: ChatSettingsDto? = null,
)

@Serializable
data class PeerDto(
    val id: Long,
    val type: String = "user",
    val local_id: Long = 0,
)

@Serializable
data class ChatSettingsDto(
    val title: String = "",
    val members_count: Int = 0,
    val photo: ChatPhotoDto? = null,
)

@Serializable
data class ChatPhotoDto(
    val photo_100: String? = null,
    val photo_200: String? = null,
)

@Serializable
data class MessageDto(
    val id: Long = 0,
    val date: Long = 0,
    val peer_id: Long = 0,
    val from_id: Long = 0,
    val text: String = "",
    val attachments: List<AttachmentDto> = emptyList(),
    val random_id: Long = 0,
    val out: Int = 0,
)

@Serializable
data class MessageHistoryResponseDto(
    val count: Int = 0,
    val items: List<MessageDto> = emptyList(),
    val profiles: List<UserDto> = emptyList(),
    val groups: List<GroupDto> = emptyList(),
)

/** longpoll.getServer — used to open the realtime connection for message/typing updates. */
@Serializable
data class LongPollServerDto(
    val key: String,
    val server: String,
    val ts: Long,
)
