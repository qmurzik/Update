package com.qvk.app.core.common

/**
 * Wraps the outcome of a VK API call (or a Room/cache read) for consumption by ViewModels.
 * [code] carries the VK API error code (see https://dev.vk.com/reference/errors) when available,
 * so callers can react to specific cases (e.g. 5 = auth failure, 6 = rate limit, 15 = access denied).
 */
sealed class Resource<out T> {
    data class Success<T>(val data: T) : Resource<T>()
    data class Error(
        val message: String,
        val code: Int? = null,
        val throwable: Throwable? = null,
    ) : Resource<Nothing>()
    data object Loading : Resource<Nothing>()
}

inline fun <T> Resource<T>.onSuccess(action: (T) -> Unit): Resource<T> {
    if (this is Resource.Success) action(data)
    return this
}

inline fun <T> Resource<T>.onError(action: (String, Int?) -> Unit): Resource<T> {
    if (this is Resource.Error) action(message, code)
    return this
}
