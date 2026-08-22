package com.qvk.app.feature.auth.data

import kotlinx.serialization.Serializable

/** Response body of POST https://id.vk.com/oauth2/auth (VK ID's authorization-code exchange). */
@Serializable
data class VkIdTokenResponse(
    val access_token: String? = null,
    val refresh_token: String? = null,
    val id_token: String? = null,
    val expires_in: Long? = null,
    val user_id: Long? = null,
    val error: String? = null,
    val error_description: String? = null,
)
