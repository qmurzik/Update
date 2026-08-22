package com.qvk.app.feature.messages.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Badge
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.R
import com.qvk.app.core.common.formatRelativeTime
import com.qvk.app.core.model.Conversation
import com.qvk.app.core.ui.components.EmptyState
import com.qvk.app.core.ui.components.ErrorState
import com.qvk.app.core.ui.components.QvkAvatar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessagesScreen(
    onOpenChat: (Conversation) -> Unit,
    viewModel: MessagesViewModel = hiltViewModel(),
) {
    val conversations by viewModel.conversations.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val error by viewModel.error.collectAsState()

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.nav_messages)) }) }) { padding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            if (conversations.isEmpty() && error != null && !isRefreshing) {
                ErrorState(error!!, onRetry = viewModel::refresh)
            } else if (conversations.isEmpty() && !isRefreshing) {
                EmptyState("Сообщений пока нет")
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    items(conversations, key = { it.peerId }) { conversation ->
                        ConversationRow(conversation, onClick = { onOpenChat(conversation) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ConversationRow(conversation: Conversation, onClick: () -> Unit) {
    ListItem(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        leadingContent = { QvkAvatar(conversation.avatarUrl, conversation.title, size = 52.dp) },
        headlineContent = { Text(conversation.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        supportingContent = {
            Text(
                (if (conversation.lastMessageOut) "Вы: " else "") + conversation.lastMessageText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
        trailingContent = {
            androidx.compose.foundation.layout.Column(horizontalAlignment = androidx.compose.ui.Alignment.End) {
                Text(
                    formatRelativeTime(conversation.lastMessageDate),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (conversation.unreadCount > 0) {
                    Badge { Text(conversation.unreadCount.coerceAtMost(99).toString()) }
                }
            }
        },
    )
}
