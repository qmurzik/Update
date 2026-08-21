package com.qvk.app.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "dialogs")
data class DialogEntity(
    @PrimaryKey val peerId: Long,
    val type: String,
    val title: String,
    val avatarUrl: String?,
    val lastMessageText: String,
    val lastMessageDate: Long,
    val lastMessageOut: Boolean,
    val unreadCount: Int,
    val cachedAt: Long,
)

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey val messageId: Long,
    val peerId: Long,
    val fromId: Long,
    val text: String,
    val attachmentsJson: String,
    val date: Long,
    val out: Boolean,
    val randomId: Long,
    val pending: Boolean = false,
)
