package com.qvk.app.feature.search.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.core.model.Community
import com.qvk.app.core.model.Post
import com.qvk.app.core.model.UserProfile
import com.qvk.app.core.ui.components.EmptyState
import com.qvk.app.core.ui.components.PostCard
import com.qvk.app.core.ui.components.QvkAvatar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    onBack: () -> Unit,
    onOpenUser: (Long) -> Unit,
    onOpenCommunity: (Community) -> Unit,
    viewModel: SearchViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    TextField(
                        value = state.query,
                        onValueChange = viewModel::onQueryChange,
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Люди, группы, записи...") },
                        singleLine = true,
                    )
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null) } },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = state.tab.ordinal) {
                Tab(selected = state.tab == SearchTab.PEOPLE, onClick = { viewModel.onTabChange(SearchTab.PEOPLE) }, text = { Text("Люди") })
                Tab(selected = state.tab == SearchTab.COMMUNITIES, onClick = { viewModel.onTabChange(SearchTab.COMMUNITIES) }, text = { Text("Группы") })
                Tab(selected = state.tab == SearchTab.POSTS, onClick = { viewModel.onTabChange(SearchTab.POSTS) }, text = { Text("Записи") })
            }

            if (state.query.isBlank()) {
                EmptyState("Начните вводить запрос")
                return@Scaffold
            }

            when (state.tab) {
                SearchTab.PEOPLE -> PeopleResults(state.people, onOpenUser)
                SearchTab.COMMUNITIES -> CommunityResults(state.communities, onOpenCommunity)
                SearchTab.POSTS -> PostResults(state.posts)
            }
        }
    }
}

@Composable
private fun PeopleResults(people: List<UserProfile>, onOpen: (Long) -> Unit) {
    if (people.isEmpty()) { EmptyState("Никого не найдено"); return }
    LazyColumn(Modifier.fillMaxSize()) {
        items(people, key = { it.id }) { user ->
            ListItem(
                modifier = Modifier.fillMaxWidth().clickable { onOpen(user.id) },
                leadingContent = { QvkAvatar(user.avatarUrl, user.fullName, size = 44.dp, isOnline = user.isOnline) },
                headlineContent = { Text(user.fullName) },
            )
        }
    }
}

@Composable
private fun CommunityResults(communities: List<Community>, onOpen: (Community) -> Unit) {
    if (communities.isEmpty()) { EmptyState("Ничего не найдено"); return }
    LazyColumn(Modifier.fillMaxSize()) {
        items(communities, key = { it.id }) { community ->
            ListItem(
                modifier = Modifier.fillMaxWidth().clickable { onOpen(community) },
                leadingContent = { QvkAvatar(community.avatarUrl, community.name, size = 44.dp) },
                headlineContent = { Text(community.name) },
            )
        }
    }
}

@Composable
private fun PostResults(posts: List<Post>) {
    if (posts.isEmpty()) { EmptyState("Ничего не найдено"); return }
    LazyColumn(Modifier.fillMaxSize()) {
        items(posts, key = { it.uid }) { post -> PostCard(post = post, modifier = Modifier.padding(12.dp)) }
    }
}
