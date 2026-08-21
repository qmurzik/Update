package com.qvk.app.feature.communities.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.core.ui.components.QvkAvatar
import com.qvk.app.core.ui.components.PostCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommunityDetailScreen(
    onBack: () -> Unit,
    viewModel: CommunityDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val wall by viewModel.wall.collectAsState()
    var draft by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.community?.name ?: "Сообщество") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null) } },
            )
        },
    ) { padding ->
        if (state.isLoading && state.community == null) {
            Column(Modifier.fillMaxSize().padding(padding), horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(Modifier.padding(top = 48.dp))
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                state.community?.let { community ->
                    Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            QvkAvatar(community.avatarUrl, community.name, size = 64.dp)
                            Column(Modifier.padding(start = 12.dp)) {
                                Text(community.name, style = MaterialTheme.typography.titleLarge)
                                Text(
                                    "${community.membersCount ?: 0} участников",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        if (!community.description.isNullOrBlank()) {
                            Text(community.description, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
                        }
                        if (community.isMember) {
                            OutlinedButton(onClick = viewModel::toggleMembership, modifier = Modifier.padding(top = 12.dp)) { Text("Вы подписаны") }
                        } else {
                            Button(onClick = viewModel::toggleMembership, modifier = Modifier.padding(top = 12.dp)) { Text("Вступить") }
                        }

                        if (community.isAdmin) {
                            Row(Modifier.fillMaxWidth().padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                                OutlinedTextField(
                                    value = draft,
                                    onValueChange = { draft = it },
                                    modifier = Modifier.weight(1f),
                                    placeholder = { Text("Написать от имени сообщества...") },
                                )
                                Button(onClick = { viewModel.publishPost(draft); draft = "" }, modifier = Modifier.padding(start = 8.dp)) {
                                    Text("ОК")
                                }
                            }
                        }
                    }
                }
            }
            items(wall, key = { it.uid }) { post ->
                PostCard(
                    post = post,
                    modifier = Modifier.padding(horizontal = 12.dp),
                    onLike = { viewModel.toggleLike(post) },
                )
            }
        }
    }
}
