package com.qvk.app.feature.feed.presentation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import androidx.paging.compose.collectAsLazyPagingItems
import androidx.paging.compose.itemKey
import com.qvk.app.R
import com.qvk.app.core.model.Attachment
import com.qvk.app.core.model.Post
import com.qvk.app.core.ui.components.EmptyState
import com.qvk.app.core.ui.components.ErrorState
import com.qvk.app.core.ui.components.PostCard
import com.qvk.app.core.ui.components.PostCardSkeleton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Search

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    onOpenPost: (Post) -> Unit,
    onOpenAuthor: (Long) -> Unit,
    onOpenVideo: (Attachment.Video) -> Unit,
    onOpenSearch: () -> Unit,
    onOpenNotifications: () -> Unit,
    viewModel: FeedViewModel = hiltViewModel(),
) {
    val items = viewModel.pagedFeed.collectAsLazyPagingItems()
    val cached by viewModel.cachedFeed.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.actionError.collect { snackbarHostState.showSnackbar(it) }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(stringResource(R.string.app_name)) },
                navigationIcon = {
                    IconButton(onClick = onOpenSearch) { Icon(Icons.Outlined.Search, contentDescription = null) }
                },
                actions = {
                    IconButton(onClick = onOpenNotifications) { Icon(Icons.Outlined.Notifications, contentDescription = null) }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        val isFirstLoad = items.loadState.refresh is LoadState.Loading && items.itemCount == 0

        PullToRefreshBox(
            isRefreshing = items.loadState.refresh is LoadState.Loading && items.itemCount > 0,
            onRefresh = { items.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when {
                isFirstLoad && cached.isNotEmpty() -> FeedList(cached, viewModel, onOpenPost, onOpenAuthor, onOpenVideo)
                isFirstLoad -> LazyColumn { items(6) { PostCardSkeleton() } }
                items.loadState.refresh is LoadState.Error && items.itemCount == 0 ->
                    ErrorState("Не удалось загрузить ленту", onRetry = { items.retry() })
                items.itemCount == 0 -> EmptyState(title = "Лента пуста", subtitle = "Подпишитесь на друзей и сообщества")
                else -> FeedPagingList(items, viewModel, onOpenPost, onOpenAuthor, onOpenVideo)
            }
        }
    }
}

@Composable
private fun FeedList(
    posts: List<Post>,
    viewModel: FeedViewModel,
    onOpenPost: (Post) -> Unit,
    onOpenAuthor: (Long) -> Unit,
    onOpenVideo: (Attachment.Video) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp),
    ) {
        items(posts, key = { it.uid }) { post ->
            PostCard(
                post = post,
                modifier = Modifier.padding(horizontal = 12.dp),
                onLike = { viewModel.toggleLike(post) },
                onComment = { onOpenPost(post) },
                onRepost = { viewModel.repost(post, "") },
                onSave = { viewModel.setSaved(post, true) },
                onHide = { viewModel.hideSource(post) },
                onReport = { viewModel.report(post, 0) },
                onOpenAuthor = { onOpenAuthor(if (post.fromId != 0L) post.fromId else post.ownerId) },
                onOpenVideo = onOpenVideo,
            )
        }
    }
}

@Composable
private fun FeedPagingList(
    items: LazyPagingItems<Post>,
    viewModel: FeedViewModel,
    onOpenPost: (Post) -> Unit,
    onOpenAuthor: (Long) -> Unit,
    onOpenVideo: (Attachment.Video) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp),
    ) {
        items(items.itemCount, key = items.itemKey { it.uid }) { index ->
            val post = items[index] ?: return@items
            PostCard(
                post = post,
                modifier = Modifier.padding(horizontal = 12.dp),
                onLike = { viewModel.toggleLike(post) },
                onComment = { onOpenPost(post) },
                onRepost = { viewModel.repost(post, "") },
                onSave = { viewModel.setSaved(post, true) },
                onHide = { viewModel.hideSource(post) },
                onReport = { viewModel.report(post, 0) },
                onOpenAuthor = { onOpenAuthor(if (post.fromId != 0L) post.fromId else post.ownerId) },
                onOpenVideo = onOpenVideo,
            )
        }
        item {
            AnimatedVisibility(visible = items.loadState.append is LoadState.Loading) {
                PostCardSkeleton()
            }
        }
    }
}
