package com.qvk.app.feature.feed.data

import com.qvk.app.core.database.Converters
import com.qvk.app.core.database.entity.PostEntity
import com.qvk.app.core.model.Attachment
import com.qvk.app.core.model.Post
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString

/**
 * Bridges [Post] (UI-facing) and [PostEntity] (Room cache row) for a given cache [bucket]
 * ("home_feed" or "wall_<ownerId>"). Attachments (and one level of repost nesting) round-trip
 * losslessly through kotlinx.serialization's sealed-class polymorphism.
 */
fun Post.toEntity(bucket: String, order: Int): PostEntity = PostEntity(
    uid = "$bucket:$ownerId:$postId",
    bucket = bucket,
    ownerId = ownerId,
    postId = postId,
    fromId = fromId,
    date = date,
    text = text,
    attachmentsJson = Converters.json.encodeToString(attachments),
    likesCount = likesCount,
    userLikes = isLiked,
    commentsCount = commentsCount,
    repostsCount = repostsCount,
    viewsCount = viewsCount,
    isAd = isAd,
    authorName = authorName,
    authorAvatar = authorAvatar,
    repostOfJson = repostOf?.let { Converters.json.encodeToString(it) },
    feedOrder = order,
    cachedAt = System.currentTimeMillis(),
)

fun PostEntity.toDomain(): Post = Post(
    ownerId = ownerId,
    postId = postId,
    fromId = fromId,
    authorName = authorName,
    authorAvatar = authorAvatar,
    date = date,
    text = text,
    attachments = decodeAttachments(attachmentsJson),
    likesCount = likesCount,
    isLiked = userLikes,
    commentsCount = commentsCount,
    repostsCount = repostsCount,
    viewsCount = viewsCount,
    isAd = isAd,
    repostOf = repostOfJson?.let { runCatching { Converters.json.decodeFromString<Post>(it) }.getOrNull() },
)

private fun decodeAttachments(json: String): List<Attachment> =
    runCatching { Converters.json.decodeFromString<List<Attachment>>(json) }.getOrDefault(emptyList())
