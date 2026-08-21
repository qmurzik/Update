package com.qvk.app.feature.messages.data

import com.qvk.app.core.database.Converters
import com.qvk.app.core.database.entity.DialogEntity
import com.qvk.app.core.database.entity.MessageEntity
import com.qvk.app.core.model.Attachment
import com.qvk.app.core.model.ChatMessage
import com.qvk.app.core.model.Conversation
import com.qvk.app.core.network.dto.AttachmentDto
import com.qvk.app.core.network.dto.ConversationItemDto
import com.qvk.app.core.network.dto.MessageDto
import com.qvk.app.core.network.dto.Profiles
import com.qvk.app.core.network.mapper.toDomain
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString

fun ConversationItemDto.toEntity(profiles: Profiles): DialogEntity {
    val peer = conversation.peer
    val isChat = peer.type == "chat"
    val title = when {
        isChat -> conversation.chat_settings?.title ?: "Беседа"
        else -> profiles.resolveName(peer.id)
    }
    val avatar = when {
        isChat -> conversation.chat_settings?.photo?.photo_200 ?: conversation.chat_settings?.photo?.photo_100
        else -> profiles.resolveAvatar(peer.id)
    }
    return DialogEntity(
        peerId = peer.id,
        type = peer.type,
        title = title,
        avatarUrl = avatar,
        lastMessageText = last_message?.text.orEmpty(),
        lastMessageDate = last_message?.date ?: 0,
        lastMessageOut = last_message?.out == 1,
        unreadCount = conversation.unread_count,
        cachedAt = System.currentTimeMillis(),
    )
}

fun DialogEntity.toDomain(): Conversation = Conversation(
    peerId = peerId,
    type = type,
    title = title,
    avatarUrl = avatarUrl,
    lastMessageText = lastMessageText,
    lastMessageDate = lastMessageDate,
    lastMessageOut = lastMessageOut,
    unreadCount = unreadCount,
)

fun MessageDto.toEntity(): MessageEntity = MessageEntity(
    messageId = id,
    peerId = peer_id,
    fromId = from_id,
    text = text,
    attachmentsJson = Converters.json.encodeToString(attachments.map { it.toDomain() }),
    date = date,
    out = out == 1,
    randomId = random_id,
    pending = false,
)

fun MessageEntity.toDomain(authorName: String): ChatMessage = ChatMessage(
    id = messageId,
    peerId = peerId,
    fromId = fromId,
    authorName = authorName,
    text = text,
    attachments = runCatching { Converters.json.decodeFromString<List<Attachment>>(attachmentsJson) }.getOrDefault(emptyList()),
    date = date,
    isOut = out,
    randomId = randomId,
    isPending = pending,
)
