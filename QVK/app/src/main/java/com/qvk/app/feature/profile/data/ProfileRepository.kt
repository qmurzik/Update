package com.qvk.app.feature.profile.data

import com.qvk.app.core.common.Resource
import com.qvk.app.core.database.dao.PostDao
import com.qvk.app.core.model.Community
import com.qvk.app.core.model.Post
import com.qvk.app.core.model.UserProfile
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.mapper.buildProfiles
import com.qvk.app.core.network.mapper.toDomain
import com.qvk.app.core.network.safeApiCall
import com.qvk.app.core.security.TokenManager
import com.qvk.app.feature.feed.data.toDomain
import com.qvk.app.feature.feed.data.toEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProfileRepository @Inject constructor(
    private val api: VkApiService,
    private val tokenManager: TokenManager,
    private val postDao: PostDao,
) {
    fun resolveUserId(routeArg: String): Long =
        if (routeArg == "me") tokenManager.activeAccount?.userId ?: 0L else routeArg.toLongOrNull() ?: 0L

    val isOwnProfile: (Long) -> Boolean get() = { it == tokenManager.activeAccount?.userId }

    suspend fun getProfile(userId: Long): Resource<UserProfile> =
        when (val result = safeApiCall { api.getUsers(userId.toString()) }) {
            is Resource.Success -> result.data.firstOrNull()?.let { Resource.Success(it.toDomain()) }
                ?: Resource.Error("Пользователь не найден")
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    suspend fun getFriends(userId: Long): Resource<List<UserProfile>> =
        when (val result = safeApiCall { api.getFriends(userId) }) {
            is Resource.Success -> Resource.Success(result.data.items.map { it.toDomain() })
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    suspend fun getPhotos(userId: Long): Resource<List<String>> =
        when (val result = safeApiCall { api.getAllPhotos(userId) }) {
            is Resource.Success -> Resource.Success(result.data.items.mapNotNull { it.bestUrl })
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    suspend fun getMyCommunities(): Resource<List<Community>> =
        when (val result = safeApiCall { api.getMyGroups() }) {
            is Resource.Success -> Resource.Success(result.data.items.map { it.toDomain() })
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    fun observeWall(ownerId: Long): Flow<List<Post>> =
        postDao.observeBucket(bucketFor(ownerId)).map { rows -> rows.map { it.toDomain() } }

    suspend fun refreshWall(ownerId: Long): Resource<Int> = loadWallPage(ownerId, offset = 0, replace = true)

    suspend fun loadMoreWall(ownerId: Long, currentSize: Int): Resource<Int> =
        loadWallPage(ownerId, offset = currentSize, replace = false)

    private suspend fun loadWallPage(ownerId: Long, offset: Int, replace: Boolean): Resource<Int> =
        when (val result = safeApiCall { api.getWall(ownerId, offset = offset) }) {
            is Resource.Success -> {
                val profiles = buildProfiles(result.data.profiles, result.data.groups)
                val posts = result.data.items.map { it.toDomain(profiles) }
                val bucket = bucketFor(ownerId)
                if (replace) postDao.clearBucket(bucket)
                postDao.insertAll(posts.mapIndexed { i, p -> p.toEntity(bucket, offset + i) })
                Resource.Success(posts.size)
            }
            is Resource.Error -> result
            Resource.Loading -> Resource.Loading
        }

    private fun bucketFor(ownerId: Long) = "wall_$ownerId"
}
