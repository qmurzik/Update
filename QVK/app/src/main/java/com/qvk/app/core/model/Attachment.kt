package com.qvk.app.core.model

import kotlinx.serialization.Serializable

/**
 * UI-facing attachment model, mapped from [com.qvk.app.core.network.dto.AttachmentDto].
 * Marked @Serializable (sealed subclasses get polymorphic (de)serialization for free from the
 * compiler plugin) purely so the feed's Room cache can round-trip a post's attachments losslessly
 * as JSON — see [com.qvk.app.feature.feed.data.toEntity].
 */
@Serializable
sealed class Attachment {
    @Serializable
    data class Photo(val url: String, val text: String? = null) : Attachment()

    @Serializable
    data class Video(
        val ownerId: Long,
        val videoId: Long,
        val title: String,
        val previewUrl: String?,
        val durationSeconds: Int,
        val playerUrl: String?,
        val directUrl: String?,
    ) : Attachment()

    /** [directUrl] is null unless the current session token still carries the `audio` scope. */
    @Serializable
    data class Audio(
        val ownerId: Long,
        val audioId: Long,
        val artist: String,
        val title: String,
        val durationSeconds: Int,
        val directUrl: String?,
        val coverUrl: String?,
    ) : Attachment()

    @Serializable
    data class Doc(val title: String, val url: String?, val ext: String, val sizeBytes: Long, val previewUrl: String?) : Attachment()

    @Serializable
    data class Link(val url: String, val title: String, val description: String?, val previewUrl: String?) : Attachment()

    @Serializable
    data class Sticker(val url: String?) : Attachment()

    @Serializable
    data class Poll(val question: String, val totalVotes: Int, val answers: List<PollAnswer>) : Attachment()

    @Serializable
    data class RepostedPost(val post: Post) : Attachment()

    @Serializable
    data class Unknown(val type: String) : Attachment()
}

@Serializable
data class PollAnswer(val text: String, val votes: Int, val ratio: Double)
