package com.qvk.app.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Caches both the home newsfeed and any wall's posts in one table, distinguished by [bucket]
 * ("home_feed" or "wall_<ownerId>") so pull-to-refresh can show cached content instantly while
 * a fresh network page loads underneath it.
 */
@Entity(tableName = "posts")
data class PostEntity(
    @PrimaryKey val uid: String, // "$bucket:$ownerId:$postId"
    val bucket: String,
    val ownerId: Long,
    val postId: Long,
    val fromId: Long,
    val date: Long,
    val text: String,
    val attachmentsJson: String,
    val likesCount: Int,
    val userLikes: Boolean,
    val commentsCount: Int,
    val repostsCount: Int,
    val viewsCount: Int,
    val isAd: Boolean,
    val authorName: String,
    val authorAvatar: String?,
    val repostOfJson: String?, // serialized nested Post for reposts, null otherwise
    val feedOrder: Int,
    val cachedAt: Long,
)
