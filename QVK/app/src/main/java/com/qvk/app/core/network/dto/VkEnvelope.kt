package com.qvk.app.core.network.dto

import kotlinx.serialization.Serializable

/**
 * Every VK API method returns HTTP 200 with either {"response": ...} or {"error": {...}} —
 * VK does not use HTTP status codes to signal API-level failures, so both fields are nullable
 * and [com.qvk.app.core.network.safeApiCall] branches on which one is present.
 */
@Serializable
data class VkEnvelope<T>(
    val response: T? = null,
    val error: VkErrorDto? = null,
)

@Serializable
data class VkErrorDto(
    val error_code: Int = 0,
    val error_msg: String = "Unknown VK API error",
    val request_params: List<VkErrorParamDto>? = null,
)

@Serializable
data class VkErrorParamDto(
    val key: String,
    val value: String,
)

/** Generic "list with total count" shape used by wall.get, friends.get, groups.get, etc. */
@Serializable
data class VkListResponse<T>(
    val count: Int = 0,
    val items: List<T> = emptyList(),
)
