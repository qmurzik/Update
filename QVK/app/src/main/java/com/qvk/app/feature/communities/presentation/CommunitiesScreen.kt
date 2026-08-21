package com.qvk.app.feature.communities.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.R
import com.qvk.app.core.model.Community
import com.qvk.app.core.ui.components.EmptyState
import com.qvk.app.core.ui.components.QvkAvatar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommunitiesScreen(
    onOpenCommunity: (Community) -> Unit,
    viewModel: CommunitiesViewModel = hiltViewModel(),
) {
    val query by viewModel.query.collectAsState()
    val myGroups by viewModel.myGroups.collectAsState()
    val results by viewModel.searchResults.collectAsState()

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.nav_communities)) }) }) { padding ->
        androidx.compose.foundation.layout.Column(Modifier.fillMaxSize().padding(padding)) {
            TextField(
                value = query,
                onValueChange = viewModel::onQueryChange,
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                placeholder = { Text("Поиск сообществ") },
                singleLine = true,
            )

            val shown = if (query.isBlank()) myGroups else results
            if (shown.isEmpty()) {
                EmptyState(if (query.isBlank()) "Вы пока не подписаны на сообщества" else "Ничего не найдено")
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    items(shown, key = { it.id }) { community ->
                        CommunityRow(community, onClick = { onOpenCommunity(community) }, onToggle = { viewModel.toggleMembership(community) })
                    }
                }
            }
        }
    }
}

@Composable
private fun CommunityRow(community: Community, onClick: () -> Unit, onToggle: () -> Unit) {
    ListItem(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        leadingContent = { QvkAvatar(community.avatarUrl, community.name, size = 48.dp) },
        headlineContent = { Text(community.name) },
        supportingContent = { Text("${community.membersCount ?: 0} участников", color = MaterialTheme.colorScheme.onSurfaceVariant) },
        trailingContent = {
            if (community.isMember) {
                OutlinedButton(onClick = onToggle) { Text("Вы подписаны") }
            } else {
                Button(onClick = onToggle) { Text("Вступить") }
            }
        },
    )
}
