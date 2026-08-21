package com.qvk.app.core.network

import com.qvk.app.core.common.Resource
import com.qvk.app.core.network.dto.VkEnvelope
import kotlinx.serialization.SerializationException
import retrofit2.HttpException
import timber.log.Timber
import java.io.IOException

/** VK API error codes worth special-casing — see https://dev.vk.com/reference/errors */
object VkErrorCode {
    const val AUTH_FAILED = 5
    const val TOO_MANY_REQUESTS = 6
    const val ACCESS_DENIED = 15
    const val CAPTCHA_NEEDED = 14
}

/**
 * Runs a VK API call, unwraps its {"response"/"error"} envelope, and converts any transport or
 * parsing failure into a [Resource.Error] so no ViewModel ever has to catch an exception itself.
 */
suspend fun <T> safeApiCall(call: suspend () -> VkEnvelope<T>): Resource<T> = try {
    val envelope = call()
    when {
        envelope.error != null -> Resource.Error(envelope.error.error_msg, envelope.error.error_code)
        envelope.response != null -> Resource.Success(envelope.response)
        else -> Resource.Error("VK вернул пустой ответ")
    }
} catch (e: HttpException) {
    Timber.e(e, "VK API HTTP error")
    Resource.Error(e.message ?: "Ошибка сети (HTTP ${e.code()})", e.code(), e)
} catch (e: IOException) {
    Timber.e(e, "VK API network error")
    Resource.Error("Нет подключения к сети", null, e)
} catch (e: SerializationException) {
    Timber.e(e, "VK API parse error")
    Resource.Error("Не удалось разобрать ответ VK", null, e)
}
