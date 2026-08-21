package com.qvk.app.feature.feed.presentation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import com.qvk.app.core.common.formatRelativeTime
import com.qvk.app.core.model.Comment
import com.qvk.app.core.ui.components.EmptyState
import com.qvk.app.core.ui.components.ErrorState
import com.qvk.app.core.ui.components.QvkAvatar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostDetailScreen(
    onBack: () -> Unit,
    viewModel: PostDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    var draft by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Комментарии") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null) } },
            )
        },
        bottomBar = {
            Row(
                modifier = Modifier.fillMaxWidth().padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Комментировать...") },
                )
                IconButton(
                    onClick = { viewModel.sendComment(draft); draft = "" },
                    enabled = draft.isNotBlank() && !state.isSending,
                ) {
                    Icon(Icons.Filled.Send, contentDescription = "Отправить")
                }
            }
        },
    ) { padding ->
        when {
            state.isLoading -> Column(Modifier.fillMaxSize().padding(padding), horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(Modifier.padding(top = 48.dp))
            }
            state.error != null && state.comments.isEmpty() -> ErrorState(state.error!!, Modifier.padding(padding), onRetry = viewModel::load)
            state.comments.isEmpty() -> EmptyState("Комментариев пока нет", modifier = Modifier.padding(padding))
            else -> LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(state.comments, key = { it.id }) { comment -> CommentRow(comment) }
            }
        }
    }
}

@Composable
private fun CommentRow(comment: Comment) {
    Row(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
        QvkAvatar(comment.authorAvatar, comment.authorName, size = 36.dp)
        Column(Modifier.padding(start = 10.dp)) {
            Row {
                Text(comment.authorName, style = MaterialTheme.typography.titleSmall)
                Text(
                    "  ${formatRelativeTime(comment.date)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(comment.text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 2.dp))
        }
    }
}
