package com.qvk.app.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class UserDto(
    val id: Long,
    val first_name: String = "",
    val last_name: String = "",
    val photo_50: String? = null,
    val photo_100: String? = null,
    val photo_200: String? = null,
    val photo_max_orig: String? = null,
    val online: Int = 0,
    val is_closed: Boolean = false,
    val can_access_closed: Boolean = true,
    val status: String? = null,
    val sex: Int? = null,
    val bdate: String? = null,
    val city: NameDto? = null,
    val home_town: String? = null,
    val followers_count: Int? = null,
    val counters: UserCountersDto? = null,
    val screen_name: String? = null,
    val verified: Int = 0,
    val deactivated: String? = null,
)

@Serializable
data class UserCountersDto(
    val friends: Int? = null,
    val followers: Int? = null,
    val photos: Int? = null,
    val videos: Int? = null,
    val subscriptions: Int? = null,
    val groups: Int? = null,
)

@Serializable
data class NameDto(
    val id: Int? = null,
    val title: String = "",
)

@Serializable
data class GroupDto(
    val id: Long,
    val name: String = "",
    val screen_name: String? = null,
    val is_closed: Int = 0,
    val type: String? = null,
    val photo_50: String? = null,
    val photo_100: String? = null,
    val photo_200: String? = null,
    val members_count: Int? = null,
    val description: String? = null,
    val is_member: Int? = null,
    val is_admin: Int? = null,
    val verified: Int = 0,
)

/** Merges users.get + groups.getById results so posts/comments can resolve owner_id regardless of sign. */
data class Profiles(
    val users: Map<Long, UserDto>,
    val groups: Map<Long, GroupDto>,
) {
    fun resolveName(ownerId: Long): String = if (ownerId < 0) {
        groups[-ownerId]?.name ?: "Сообщество"
    } else {
        users[ownerId]?.let { "${it.first_name} ${it.last_name}".trim() } ?: "Пользователь"
    }

    fun resolveAvatar(ownerId: Long): String? = if (ownerId < 0) {
        groups[-ownerId]?.photo_200
    } else {
        users[ownerId]?.photo_200
    }
}
