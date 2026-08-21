package com.qvk.app.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val userId: Long,
    val firstName: String,
    val lastName: String,
    val avatarUrl: String?,
    val online: Boolean,
    val status: String?,
    val screenName: String?,
    val friendsCount: Int?,
    val followersCount: Int?,
    val isClosed: Boolean,
    val cachedAt: Long,
)

@Entity(tableName = "groups")
data class GroupEntity(
    @PrimaryKey val groupId: Long,
    val name: String,
    val avatarUrl: String?,
    val membersCount: Int?,
    val isMember: Boolean,
    val isAdmin: Boolean,
    val description: String?,
    val cachedAt: Long,
)
