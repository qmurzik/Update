package com.qvk.app.core.network.mapper

import com.qvk.app.core.model.Attachment
import com.qvk.app.core.model.Community
import com.qvk.app.core.model.PollAnswer
import com.qvk.app.core.model.Post
import com.qvk.app.core.model.UserProfile
import com.qvk.app.core.network.dto.AttachmentDto
import com.qvk.app.core.network.dto.GroupDto
import com.qvk.app.core.network.dto.NewsfeedItemDto
import com.qvk.app.core.network.dto.Profiles
import com.qvk.app.core.network.dto.UserDto
import com.qvk.app.core.network.dto.WallPostDto

fun AttachmentDto.toDomain(): Attachment = when (type) {
    "photo" -> photo?.bestUrl?.let { Attachment.Photo(it, photo.text) } ?: Attachment.Unknown(type)
    "video" -> video?.let {
        Attachment.Video(
            ownerId = it.owner_id,
            videoId = it.id,
            title = it.title,
            previewUrl = it.previewUrl,
            durationSeconds = it.duration,
            playerUrl = it.player,
            directUrl = it.files?.bestFor(preferredMaxHeight = 720),
        )
    } ?: Attachment.Unknown(type)
    "audio" -> audio?.let {
        Attachment.Audio(
            ownerId = it.owner_id,
            audioId = it.id,
            artist = it.artist,
            title = it.title,
            durationSeconds = it.duration,
            directUrl = it.url, // will be null for virtually all third-party tokens, see MusicRepository
            coverUrl = it.album?.thumb?.photo_300,
        )
    } ?: Attachment.Unknown(type)
    "doc" -> doc?.let {
        Attachment.Doc(
            title = it.title,
            url = it.url,
            ext = it.ext,
            sizeBytes = it.size,
            previewUrl = it.preview?.photo?.sizes?.maxByOrNull { s -> s.width * s.height }?.url,
        )
    } ?: Attachment.Unknown(type)
    "link" -> link?.let {
        Attachment.Link(url = it.url, title = it.title, description = it.description, previewUrl = it.photo?.bestUrl)
    } ?: Attachment.Unknown(type)
    "sticker" -> Attachment.Sticker(sticker?.bestUrl)
    "poll" -> poll?.let {
        Attachment.Poll(
            question = it.question,
            totalVotes = it.votes,
            answers = it.answers.map { a -> PollAnswer(a.text, a.votes, a.rate) },
        )
    } ?: Attachment.Unknown(type)
    "wall" -> wall?.let { Attachment.RepostedPost(it.toDomain(Profiles(emptyMap(), emptyMap()))) } ?: Attachment.Unknown(type)
    else -> Attachment.Unknown(type)
}

fun WallPostDto.toDomain(profiles: Profiles): Post {
    val repost = copy_history.firstOrNull()?.toDomain(profiles)
    return Post(
        ownerId = owner_id,
        postId = id,
        fromId = from_id,
        authorName = profiles.resolveName(from_id.takeIf { it != 0L } ?: owner_id),
        authorAvatar = profiles.resolveAvatar(from_id.takeIf { it != 0L } ?: owner_id),
        date = date,
        text = text,
        attachments = attachments.map { it.toDomain() },
        likesCount = likes?.count ?: 0,
        isLiked = likes?.user_likes == 1,
        commentsCount = comments?.count ?: 0,
        repostsCount = reposts?.count ?: 0,
        viewsCount = views?.count ?: 0,
        isAd = marked_as_ads == 1,
        repostOf = repost,
    )
}

fun NewsfeedItemDto.toDomain(profiles: Profiles): Post {
    val repost = copy_history.firstOrNull()?.toDomain(profiles)
    return Post(
        ownerId = source_id,
        postId = post_id,
        fromId = source_id,
        authorName = profiles.resolveName(source_id),
        authorAvatar = profiles.resolveAvatar(source_id),
        date = date,
        text = text,
        attachments = attachments.map { it.toDomain() },
        likesCount = likes?.count ?: 0,
        isLiked = likes?.user_likes == 1,
        commentsCount = comments?.count ?: 0,
        repostsCount = reposts?.count ?: 0,
        viewsCount = views?.count ?: 0,
        isAd = marked_as_ads == 1,
        repostOf = repost,
    )
}

fun UserDto.toDomain(): UserProfile = UserProfile(
    id = id,
    firstName = first_name,
    lastName = last_name,
    avatarUrl = photo_max_orig ?: photo_200 ?: photo_100 ?: photo_50,
    isOnline = online == 1,
    status = status,
    screenName = screen_name,
    city = city?.title,
    friendsCount = counters?.friends,
    followersCount = followers_count ?: counters?.followers,
    photosCount = counters?.photos,
    isClosed = is_closed,
    isVerified = verified == 1,
)

fun GroupDto.toDomain(): Community = Community(
    id = id,
    name = name,
    avatarUrl = photo_200 ?: photo_100 ?: photo_50,
    membersCount = members_count,
    isMember = is_member == 1,
    isAdmin = is_admin == 1,
    description = description,
    isVerified = verified == 1,
    isClosed = is_closed == 1,
)

fun buildProfiles(users: List<UserDto>, groups: List<GroupDto>): Profiles =
    Profiles(users.associateBy { it.id }, groups.associateBy { it.id })
