package com.qvk.app.feature.notifications.data

import com.qvk.app.core.common.Resource
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.dto.NotificationItemDto
import com.qvk.app.core.network.mapper.buildProfiles
import com.qvk.app.core.network.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

enum class NotificationType { LIKE, COMMENT, REPLY, MENTION, FOLLOW, OTHER }

data class AppNotification(
    val type: NotificationType,
    val actorName: String,
    val actorAvatar: String?,
    val text: String,
    val date: Long,
)

@Singleton
class NotificationsRepository @Inject constructor(private val api: VkApiService) {

    suspend fun getNotifications(): Resource<List<AppNotification>> =
        when (val result = safeApiCall { api.getNotifications() }) {
            is Resource.Success -> {
                val profiles = buildProfiles(result.data.profiles, result.data.groups)
                Resource.Success(result.data.items.mapNotNull { it.toDomain(profiles) })
            }
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    private fun NotificationItemDto.toDomain(profiles: com.qvk.app.core.network.dto.Profiles): AppNotification? {
        val actorId = feedback?.from_id ?: parent?.from_id ?: return null
        val type = when (type) {
            "like", "like_comment", "like_photo", "like_video" -> NotificationType.LIKE
            "comment_post", "comment_photo", "comment_video" -> NotificationType.COMMENT
            "reply_comment", "reply_comment_photo" -> NotificationType.REPLY
            "wall_publish" -> NotificationType.MENTION
            "follow" -> NotificationType.FOLLOW
            else -> NotificationType.OTHER
        }
        val text = when (type) {
            NotificationType.LIKE -> "оценил(а) вашу запись"
            NotificationType.COMMENT -> "прокомментировал(а): ${feedback?.text.orEmpty()}"
            NotificationType.REPLY -> "ответил(а): ${feedback?.text.orEmpty()}"
            NotificationType.FOLLOW -> "подписался(-ась) на вас"
            else -> "новое уведомление"
        }
        return AppNotification(
            type = type,
            actorName = profiles.resolveName(actorId),
            actorAvatar = profiles.resolveAvatar(actorId),
            text = text,
            date = date,
        )
    }
}
