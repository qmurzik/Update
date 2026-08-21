package com.qvk.app.feature.messages.data

import com.qvk.app.core.common.Resource
import com.qvk.app.core.database.dao.DialogDao
import com.qvk.app.core.database.dao.MessageDao
import com.qvk.app.core.database.entity.MessageEntity
import com.qvk.app.core.model.ChatMessage
import com.qvk.app.core.model.Conversation
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.mapper.buildProfiles
import com.qvk.app.core.network.safeApiCall
import com.qvk.app.core.security.TokenManager
import com.qvk.app.feature.messages.data.longpoll.LongPollClient
import com.qvk.app.feature.messages.data.longpoll.LongPollEvent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.random.Random

@Singleton
class MessagesRepository @Inject constructor(
    private val api: VkApiService,
    private val dialogDao: DialogDao,
    private val messageDao: MessageDao,
    private val tokenManager: TokenManager,
    val longPoll: LongPollClient,
) {
    /** Cache of userId -> display name, filled from whichever endpoint last returned `profiles`. */
    private val nameCache = MutableStateFlow<Map<Long, String>>(emptyMap())

    fun observeConversations(): Flow<List<Conversation>> = dialogDao.observeAll().map { it.map { e -> e.toDomain() } }
    fun observeTotalUnread(): Flow<Int> = dialogDao.observeTotalUnread().map { it ?: 0 }

    fun observeHistory(peerId: Long): Flow<List<ChatMessage>> =
        combine(messageDao.observeHistory(peerId), nameCache) { rows, names ->
            rows.map { it.toDomain(nameFor(it.fromId, names)) }
        }

    suspend fun refreshConversations(): Resource<Unit> =
        when (val result = safeApiCall { api.getConversations() }) {
            is Resource.Success -> {
                val profiles = buildProfiles(result.data.profiles, result.data.groups)
                cacheNames(profiles)
                dialogDao.upsertAll(result.data.items.map { it.toEntity(profiles) })
                Resource.Success(Unit)
            }
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    suspend fun refreshHistory(peerId: Long): Resource<Unit> =
        when (val result = safeApiCall { api.getMessageHistory(peerId) }) {
            is Resource.Success -> {
                cacheNames(buildProfiles(result.data.profiles, result.data.groups))
                messageDao.upsertAll(result.data.items.map { it.toEntity() })
                Resource.Success(Unit)
            }
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    private fun cacheNames(profiles: com.qvk.app.core.network.dto.Profiles) {
        nameCache.update { cache ->
            cache + profiles.users.mapValues { (_, u) -> "${u.first_name} ${u.last_name}".trim() } +
                profiles.groups.mapKeys { (id, _) -> -id }.mapValues { (_, g) -> g.name }
        }
    }

    private fun nameFor(userId: Long, names: Map<Long, String>): String = when {
        userId == tokenManager.activeAccount?.userId -> "Вы"
        else -> names[userId] ?: "id$userId"
    }

    /** Inserts an optimistic local echo immediately, then swaps it for the server's confirmed id. */
    suspend fun sendMessage(peerId: Long, text: String): Resource<Unit> {
        val randomId = Random.nextLong()
        val me = tokenManager.activeAccount
        val localId = -randomId // negative ids never collide with real server message ids
        messageDao.upsert(
            MessageEntity(
                messageId = localId,
                peerId = peerId,
                fromId = me?.userId ?: 0L,
                text = text,
                attachmentsJson = "[]",
                date = System.currentTimeMillis() / 1000,
                out = true,
                randomId = randomId,
                pending = true,
            ),
        )
        return when (val result = safeApiCall { api.sendMessage(peerId, text, randomId) }) {
            is Resource.Success -> {
                messageDao.deleteById(localId)
                refreshHistory(peerId)
                Resource.Success(Unit)
            }
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }
    }

    suspend fun markRead(peerId: Long) {
        dialogDao.markRead(peerId)
        safeApiCall { api.markAsRead(peerId) }
    }

    fun longPollEvents(): Flow<LongPollEvent> = longPoll.events()
}
