package com.qvk.app.feature.communities.data

import com.qvk.app.core.common.Resource
import com.qvk.app.core.database.dao.GroupDao
import com.qvk.app.core.database.entity.GroupEntity
import com.qvk.app.core.model.Community
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.mapper.toDomain
import com.qvk.app.core.network.safeApiCall
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CommunitiesRepository @Inject constructor(
    private val api: VkApiService,
    private val groupDao: GroupDao,
) {
    fun observeMyGroups(): Flow<List<Community>> = groupDao.observeMyGroups().map { rows -> rows.map { it.toDomain() } }

    suspend fun refreshMyGroups(): Resource<Unit> =
        when (val result = safeApiCall { api.getMyGroups() }) {
            is Resource.Success -> {
                groupDao.upsertAll(result.data.items.map { it.toDomain().toEntity() })
                Resource.Success(Unit)
            }
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    suspend fun search(query: String): Resource<List<Community>> =
        when (val result = safeApiCall { api.searchGroups(query) }) {
            is Resource.Success -> Resource.Success(result.data.items.map { it.toDomain() })
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    suspend fun getGroup(groupId: Long): Resource<Community> =
        when (val result = safeApiCall { api.getGroupsById(groupId.toString()) }) {
            is Resource.Success -> result.data.firstOrNull()?.let { Resource.Success(it.toDomain()) }
                ?: Resource.Error("Сообщество не найдено")
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    suspend fun join(groupId: Long): Resource<Unit> = toUnit(safeApiCall { api.joinGroup(groupId) })
    suspend fun leave(groupId: Long): Resource<Unit> = toUnit(safeApiCall { api.leaveGroup(groupId) })

    private fun GroupEntity.toDomain(): Community = Community(
        id = groupId,
        name = name,
        avatarUrl = avatarUrl,
        membersCount = membersCount,
        isMember = isMember,
        isAdmin = isAdmin,
        description = description,
        isVerified = false,
        isClosed = false,
    )

    private fun Community.toEntity(): GroupEntity = GroupEntity(
        groupId = id,
        name = name,
        avatarUrl = avatarUrl,
        membersCount = membersCount,
        isMember = isMember,
        isAdmin = isAdmin,
        description = description,
        cachedAt = System.currentTimeMillis(),
    )

    private fun <T> toUnit(resource: Resource<T>): Resource<Unit> = when (resource) {
        is Resource.Success -> Resource.Success(Unit)
        is Resource.Error -> resource
        Resource.Loading -> Resource.Loading
    }
}
