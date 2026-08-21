package com.qvk.app.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class AccountProfileInfoDto(
    val id: Long = 0,
    val first_name: String = "",
    val last_name: String = "",
    val screen_name: String? = null,
    val phone: String? = null,
)

@Serializable
data class WallGetResponseDto(
    val count: Int = 0,
    val items: List<WallPostDto> = emptyList(),
    val profiles: List<UserDto> = emptyList(),
    val groups: List<GroupDto> = emptyList(),
)

@Serializable
data class CommentsResponseDto(
    val count: Int = 0,
    val items: List<CommentDto> = emptyList(),
    val profiles: List<UserDto> = emptyList(),
    val groups: List<GroupDto> = emptyList(),
)

@Serializable
data class PostIdDto(
    val post_id: Long = 0,
    val comment_id: Long = 0,
)

@Serializable
data class RepostResultDto(
    val success: Int = 0,
    val post_id: Long = 0,
    val reposts_count: Int = 0,
    val likes_count: Int = 0,
)

@Serializable
data class LikesCountDto(
    val likes: Int = 0,
)

/**
 * groups.getTokenPermissions reveals which scopes the current access_token actually carries —
 * QVK calls it once after login so Settings can show real capability toggles instead of guessing.
 */
@Serializable
data class TokenPermissionsDto(
    val mask: Long = 0,
    val permissions: List<TokenPermissionDto> = emptyList(),
)

@Serializable
data class TokenPermissionDto(
    val setting: Long = 0,
    val name: String = "",
)
