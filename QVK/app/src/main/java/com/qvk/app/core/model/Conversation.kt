package com.qvk.app.core.model

data class Conversation(
    val peerId: Long,
    val type: String, // "user" | "chat" | "group"
    val title: String,
    val avatarUrl: String?,
    val lastMessageText: String,
    val lastMessageDate: Long,
    val lastMessageOut: Boolean,
    val unreadCount: Int,
)

data class ChatMessage(
    val id: Long,
    val peerId: Long,
    val fromId: Long,
    val authorName: String,
    val text: String,
    val attachments: List<Attachment>,
    val date: Long,
    val isOut: Boolean,
    val randomId: Long,
    val isPending: Boolean = false,
)
