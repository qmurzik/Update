package com.qvk.app.feature.messages.data.longpoll

import com.qvk.app.core.common.Constants
import com.qvk.app.core.di.LongPollClient as LongPollClientQualifier
import com.qvk.app.core.network.api.VkApiService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/** One incoming realtime signal from VK's Long Poll server — see [LongPollClient] for scope. */
sealed class LongPollEvent {
    data class NewOrEditedMessage(val peerId: Long) : LongPollEvent()
    data object ConversationsChanged : LongPollEvent()
}

/**
 * Wraps VK's messages Long Poll protocol (https://dev.vk.com/api/user-long-poll/getting-started).
 * QVK intentionally does NOT hand-decode every field of the compact update arrays (their shape
 * shifts subtly between lp_version and the `mode` bitmask, and getting a byte wrong there just
 * silently drops messages). Instead it decodes only the update *code* — 4 for message updates,
 * everything else folds into a generic "conversations changed" signal — and lets the repository
 * re-fetch the affected conversation/history from the regular API, which is always authoritative.
 * This trades a little bandwidth for a client that can't desync from VK's wire format.
 */
@Singleton
class LongPollClient @Inject constructor(
    private val api: VkApiService,
    @LongPollClientQualifier private val httpClient: OkHttpClient,
) {
    private val json = Json { ignoreUnknownKeys = true }

    /** Suspends for the lifetime of collection, emitting one event per server push. Cancel-safe. */
    fun events(): Flow<LongPollEvent> = flow {
        var key: String
        var server: String
        var ts: Long

        val serverInfo = api.getLongPollServer(needPts = 1, lpVersion = 3).response
            ?: run { Timber.w("LongPoll: could not obtain server, aborting"); return@flow }
        key = serverInfo.key
        server = serverInfo.server
        ts = serverInfo.ts

        while (true) {
            val url = "https://$server?act=a_check&key=$key&ts=$ts&wait=${Constants.LONG_POLL_WAIT_SECONDS}&mode=2&version=3"
            val request = Request.Builder().url(url).build()

            val body = runCatching {
                httpClient.newCall(request).execute().use { it.body?.string() }
            }.getOrNull() ?: continue

            val root = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull() ?: continue

            // failed: {"failed": 1|2|3} means our key/ts expired — re-fetch a fresh server and retry.
            root["failed"]?.let {
                val fresh = api.getLongPollServer(needPts = 1, lpVersion = 3).response
                if (fresh == null) return@flow
                key = fresh.key; server = fresh.server; ts = fresh.ts
                continue
            }

            ts = root["ts"]?.jsonPrimitive?.content?.toLongOrNull() ?: ts
            val updates = root["updates"]?.jsonArray ?: JsonArray(emptyList())

            var conversationsChanged = false
            for (update in updates) {
                val arr = update.jsonArray
                when (arr.getOrNull(0)?.jsonPrimitive?.content?.toIntOrNull()) {
                    4 -> {
                        val peerId = arr.getOrNull(3)?.jsonPrimitive?.content?.toLongOrNull()
                        if (peerId != null) emit(LongPollEvent.NewOrEditedMessage(peerId)) else conversationsChanged = true
                    }
                    else -> conversationsChanged = true
                }
            }
            if (conversationsChanged) emit(LongPollEvent.ConversationsChanged)
        }
    }.flowOn(Dispatchers.IO)
}
