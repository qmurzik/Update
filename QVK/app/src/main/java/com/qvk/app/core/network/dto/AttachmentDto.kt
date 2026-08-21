package com.qvk.app.core.network.dto

import kotlinx.serialization.Serializable

/**
 * VK represents every attachment as {"type": "photo", "photo": {...}} — only the field matching
 * [type] is populated. Modeling it as a flat sparse object (instead of a polymorphic serializer)
 * mirrors the wire format exactly and keeps parsing trivial.
 */
@Serializable
data class AttachmentDto(
    val type: String,
    val photo: PhotoDto? = null,
    val video: VideoDto? = null,
    val audio: AudioDto? = null,
    val doc: DocDto? = null,
    val link: LinkDto? = null,
    val sticker: StickerDto? = null,
    val wall: WallPostDto? = null,
    val poll: PollDto? = null,
)

@Serializable
data class PhotoDto(
    val id: Long = 0,
    val owner_id: Long = 0,
    val album_id: Int? = null,
    val text: String? = null,
    val date: Long = 0,
    val sizes: List<PhotoSizeDto> = emptyList(),
) {
    /** Largest available rendition — VK returns sizes unordered, letter-typed from "s" to "w". */
    val bestUrl: String? get() = sizes.maxByOrNull { it.width * it.height }?.url
}

@Serializable
data class PhotoSizeDto(
    val type: String,
    val url: String,
    val width: Int = 0,
    val height: Int = 0,
)

@Serializable
data class VideoDto(
    val id: Long = 0,
    val owner_id: Long = 0,
    val title: String = "",
    val description: String = "",
    val duration: Int = 0,
    val image: List<PhotoSizeDto> = emptyList(),
    val player: String? = null,
    val views: Int = 0,
    val date: Long = 0,
    val platform: String? = null,
    val files: VideoFilesDto? = null,
) {
    val previewUrl: String? get() = image.maxByOrNull { it.width * it.height }?.url
}

@Serializable
data class VideoFilesDto(
    val mp4_240: String? = null,
    val mp4_360: String? = null,
    val mp4_480: String? = null,
    val mp4_720: String? = null,
    val mp4_1080: String? = null,
    val hls: String? = null,
) {
    fun bestFor(preferredMaxHeight: Int): String? = listOfNotNull(
        1080 to mp4_1080, 720 to mp4_720, 480 to mp4_480, 360 to mp4_360, 240 to mp4_240,
    ).filter { it.second != null }
        .sortedByDescending { it.first }
        .firstOrNull { it.first <= preferredMaxHeight }?.second
        ?: hls ?: mp4_360 ?: mp4_480 ?: mp4_240
}

/**
 * VK stopped issuing the `audio` scope to newly registered third-party apps in 2021; audio.get
 * now returns error 15 ("access denied") for virtually all non-partner clients. This DTO stays
 * for wire compatibility (e.g. audio attachments still appear as metadata on posts/messages) —
 * see [com.qvk.app.feature.music] for how the app degrades gracefully.
 */
@Serializable
data class AudioDto(
    val id: Long = 0,
    val owner_id: Long = 0,
    val artist: String = "",
    val title: String = "",
    val duration: Int = 0,
    val url: String? = null,
    val album: AudioAlbumDto? = null,
)

@Serializable
data class AudioAlbumDto(
    val id: Long = 0,
    val thumb: AudioThumbDto? = null,
)

@Serializable
data class AudioThumbDto(
    val photo_300: String? = null,
)

@Serializable
data class DocDto(
    val id: Long = 0,
    val owner_id: Long = 0,
    val title: String = "",
    val size: Long = 0,
    val ext: String = "",
    val url: String? = null,
    val type: Int = 0,
    val preview: DocPreviewDto? = null,
)

@Serializable
data class DocPreviewDto(
    val photo: DocPreviewPhotoDto? = null,
)

@Serializable
data class DocPreviewPhotoDto(
    val sizes: List<PhotoSizeDto> = emptyList(),
)

@Serializable
data class LinkDto(
    val url: String = "",
    val title: String = "",
    val caption: String? = null,
    val description: String? = null,
    val photo: PhotoDto? = null,
)

@Serializable
data class StickerDto(
    val sticker_id: Int = 0,
    val product_id: Int = 0,
    val images: List<PhotoSizeDto> = emptyList(),
) {
    val bestUrl: String? get() = images.maxByOrNull { it.width * it.height }?.url
}

@Serializable
data class PollDto(
    val id: Long = 0,
    val question: String = "",
    val votes: Int = 0,
    val answers: List<PollAnswerDto> = emptyList(),
)

@Serializable
data class PollAnswerDto(
    val id: Long = 0,
    val text: String = "",
    val votes: Int = 0,
    val rate: Double = 0.0,
)
