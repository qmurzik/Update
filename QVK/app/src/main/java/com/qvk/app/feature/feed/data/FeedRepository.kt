package com.qvk.app.feature.feed.data

import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import com.qvk.app.core.common.Constants
import com.qvk.app.core.common.Resource
import com.qvk.app.core.database.dao.PostDao
import com.qvk.app.core.model.Post
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.safeApiCall
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FeedRepository @Inject constructor(
    private val api: VkApiService,
    private val postDao: PostDao,
) {
    fun pagedFeed(): Flow<PagingData<Post>> = Pager(
        config = PagingConfig(pageSize = Constants.DEFAULT_PAGE_SIZE, enablePlaceholders = false, initialLoadSize = Constants.DEFAULT_PAGE_SIZE),
        pagingSourceFactory = { FeedPagingSource(api, postDao) },
    ).flow

    /** Instant cold-start paint from the last successful first page — see [FeedPagingSource]. */
    fun observeCachedFeed(): Flow<List<Post>> = postDao.observeBucket(FEED_CACHE_BUCKET).map { rows -> rows.map { it.toDomain() } }

    suspend fun toggleLike(post: Post): Resource<Pair<Int, Boolean>> = if (post.isLiked) {
        when (val r = safeApiCall { api.deleteLike("post", post.ownerId, post.postId) }) {
            is Resource.Success -> Resource.Success(r.data.likes to false)
            is Resource.Error -> r
            Resource.Loading -> Resource.Loading
        }
    } else {
        when (val r = safeApiCall { api.addLike("post", post.ownerId, post.postId) }) {
            is Resource.Success -> Resource.Success(r.data.likes to true)
            is Resource.Error -> r
            Resource.Loading -> Resource.Loading
        }
    }

    suspend fun hideSource(post: Post): Resource<Unit> =
        toUnit(safeApiCall { api.hideFeedSource(ownerId = post.ownerId, itemId = post.postId) })

    /** reason codes per wall.reportPost: 0 spam, 1 child abuse, 2 extremism, 3 violence, 4 drugs, 5 adult, 6 insult. */
    suspend fun reportPost(post: Post, reason: Int): Resource<Unit> =
        toUnit(safeApiCall { api.reportPost(post.ownerId, post.postId, reason) })

    suspend fun repost(post: Post, comment: String): Resource<Unit> =
        toUnit(safeApiCall { api.repost("wall${post.ownerId}_${post.postId}", comment) })

    suspend fun createPost(ownerId: Long, message: String): Resource<Unit> =
        toUnit(safeApiCall { api.createPost(ownerId, message) })

    suspend fun setSaved(post: Post, saved: Boolean): Resource<Unit> = toUnit(
        safeApiCall { if (saved) api.savePost(post.ownerId, post.postId) else api.unsavePost(post.ownerId, post.postId) },
    )

    private fun <T> toUnit(resource: Resource<T>): Resource<Unit> = when (resource) {
        is Resource.Success -> Resource.Success(Unit)
        is Resource.Error -> resource
        Resource.Loading -> Resource.Loading
    }
}
