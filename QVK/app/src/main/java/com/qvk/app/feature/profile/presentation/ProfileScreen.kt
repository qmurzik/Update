package com.qvk.app.feature.profile.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.qvk.app.core.model.Post
import com.qvk.app.core.model.UserProfile
import com.qvk.app.core.ui.components.EmptyState
import com.qvk.app.core.ui.components.PostCard
import com.qvk.app.core.ui.components.QvkAvatar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onOpenSettings: () -> Unit,
    onOpenPost: (Post) -> Unit,
    onOpenUser: (Long) -> Unit,
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val wall by viewModel.wall.collectAsState()
    var tab by remember { mutableIntStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.profile?.fullName ?: "Профиль") },
                actions = {
                    if (viewModel.isOwnProfile) {
                        IconButton(onClick = onOpenSettings) { Icon(Icons.Filled.Settings, contentDescription = null) }
                    }
                },
            )
        },
    ) { padding ->
        if (state.isLoading && state.profile == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Scaffold
        }

        Column(Modifier.fillMaxSize().padding(padding)) {
            state.profile?.let { ProfileHeader(it) }

            TabRow(selectedTabIndex = tab) {
                listOf("Стена", "Друзья", "Фото").forEachIndexed { i, title ->
                    Tab(selected = tab == i, onClick = { tab = i }, text = { Text(title) })
                }
            }

            when (tab) {
                0 -> WallTab(wall, viewModel, onOpenPost, onOpenUser)
                1 -> FriendsTab(state.friends, onOpenUser)
                else -> PhotosTab(state.photos)
            }
        }
    }
}

@Composable
private fun ProfileHeader(profile: UserProfile) {
    Column(Modifier.fillMaxWidth()) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(90.dp)
                .background(Brush.horizontalGradient(listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.tertiary))),
        )
        Row(Modifier.padding(horizontal = 16.dp).offset(y = (-32).dp), verticalAlignment = Alignment.Bottom) {
            QvkAvatar(profile.avatarUrl, profile.fullName, size = 76.dp, isOnline = profile.isOnline)
        }
        Column(Modifier.padding(horizontal = 16.dp).offset(y = (-20).dp)) {
            Text(profile.fullName, style = MaterialTheme.typography.headlineSmall)
            if (!profile.status.isNullOrBlank()) {
                Text(profile.status, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                StatItem(profile.friendsCount ?: 0, "друзей")
                StatItem(profile.followersCount ?: 0, "подписчиков")
                StatItem(profile.photosCount ?: 0, "фото")
            }
        }
    }
}

@Composable
private fun StatItem(count: Int, label: String) {
    Column {
        Text(count.toString(), style = MaterialTheme.typography.titleMedium)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun WallTab(wall: List<Post>, viewModel: ProfileViewModel, onOpenPost: (Post) -> Unit, onOpenUser: (Long) -> Unit) {
    if (wall.isEmpty()) {
        EmptyState("На стене пока пусто")
        return
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(wall, key = { it.uid }) { post ->
            PostCard(
                post = post,
                modifier = Modifier.padding(horizontal = 12.dp),
                onLike = { viewModel.toggleLike(post) },
                onComment = { onOpenPost(post) },
                onOpenAuthor = { onOpenUser(if (post.fromId != 0L) post.fromId else post.ownerId) },
            )
        }
        item {
            androidx.compose.runtime.LaunchedEffect(Unit) { viewModel.loadMoreWall() }
        }
    }
}

@Composable
private fun FriendsTab(friends: List<UserProfile>, onOpenUser: (Long) -> Unit) {
    if (friends.isEmpty()) {
        EmptyState("Друзей пока нет")
        return
    }
    LazyColumn(Modifier.fillMaxSize()) {
        items(friends, key = { it.id }) { friend ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp)
                    .clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp)),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                QvkAvatar(friend.avatarUrl, friend.fullName, size = 48.dp, isOnline = friend.isOnline)
                Text(friend.fullName, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(start = 12.dp))
            }
        }
    }
}

@Composable
private fun PhotosTab(photos: List<String>) {
    if (photos.isEmpty()) {
        EmptyState("Фотографий пока нет")
        return
    }
    LazyVerticalGrid(columns = GridCells.Fixed(3), modifier = Modifier.fillMaxSize()) {
        items(photos) { url ->
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.aspectRatio(1f).padding(1.dp),
            )
        }
    }
}
