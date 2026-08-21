package com.qvk.app.core.model

data class UserProfile(
    val id: Long,
    val firstName: String,
    val lastName: String,
    val avatarUrl: String?,
    val isOnline: Boolean,
    val status: String?,
    val screenName: String?,
    val city: String?,
    val friendsCount: Int?,
    val followersCount: Int?,
    val photosCount: Int?,
    val isClosed: Boolean,
    val isVerified: Boolean,
) {
    val fullName: String get() = "$firstName $lastName".trim()
}

data class Community(
    val id: Long,
    val name: String,
    val avatarUrl: String?,
    val membersCount: Int?,
    val isMember: Boolean,
    val isAdmin: Boolean,
    val description: String?,
    val isVerified: Boolean,
    val isClosed: Boolean,
) {
    /** Negative owner_id convention VK uses for community-authored content (posts, wall, etc). */
    val asOwnerId: Long get() = -id
}
