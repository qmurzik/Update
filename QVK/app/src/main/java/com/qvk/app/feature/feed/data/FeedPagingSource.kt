package com.qvk.app.feature.feed.data

import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.qvk.app.core.database.dao.PostDao
import com.qvk.app.core.model.Post
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.mapper.buildProfiles
import com.qvk.app.core.network.mapper.toDomain

const val FEED_CACHE_BUCKET = "home_feed"

/**
 * Cursor-based paging over newsfeed.get's `next_from` token. On the very first page (key == null,
 * i.e. a fresh load or pull-to-refresh) the result is also mirrored into Room so the next cold
 * start can paint instantly before the network responds — see [FeedRepository.observeCachedFeed].
 */
class FeedPagingSource(
    private val api: VkApiService,
    private val postDao: PostDao,
) : PagingSource<String, Post>() {

    override suspend fun load(params: LoadParams<String>): LoadResult<String, Post> = try {
        val envelope = api.getNewsfeed(count = params.loadSize.coerceIn(10, 50), startFrom = params.key)
        val error = envelope.error
        val data = envelope.response
        when {
            error != null -> LoadResult.Error(Exception(error.error_msg))
            data == null -> LoadResult.Error(IllegalStateException("VK вернул пустой ответ"))
            else -> {
                val profiles = buildProfiles(data.profiles, data.groups)
                val posts = data.items.filter { it.type == "post" }.map { it.toDomain(profiles) }

                if (params.key == null) {
                    postDao.clearBucket(FEED_CACHE_BUCKET)
                    postDao.insertAll(posts.mapIndexed { index, post -> post.toEntity(FEED_CACHE_BUCKET, index) })
                }

                LoadResult.Page(
                    data = posts,
                    prevKey = null,
                    nextKey = data.next_from?.takeIf { posts.isNotEmpty() },
                )
            }
        }
    } catch (e: Exception) {
        LoadResult.Error(e)
    }

    override fun getRefreshKey(state: PagingState<String, Post>): String? = null
}
