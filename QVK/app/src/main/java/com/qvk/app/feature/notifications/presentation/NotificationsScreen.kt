package com.qvk.app.feature.notifications.presentation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.core.common.formatRelativeTime
import com.qvk.app.core.ui.components.EmptyState
import com.qvk.app.core.ui.components.ErrorState
import com.qvk.app.core.ui.components.QvkAvatar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    onBack: () -> Unit,
    viewModel: NotificationsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Уведомления") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null) } },
            )
        },
    ) { padding ->
        when {
            state.isLoading -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            state.error != null -> ErrorState(state.error!!, Modifier.padding(padding), onRetry = viewModel::load)
            state.items.isEmpty() -> EmptyState("Пока нет уведомлений", modifier = Modifier.padding(padding))
            else -> LazyColumn(Modifier.fillMaxSize().padding(padding)) {
                items(state.items) { notification ->
                    ListItem(
                        modifier = Modifier.fillMaxWidth(),
                        leadingContent = { QvkAvatar(notification.actorAvatar, notification.actorName, size = 44.dp) },
                        headlineContent = { Text("${notification.actorName} ${notification.text}") },
                        supportingContent = {
                            Text(formatRelativeTime(notification.date), color = MaterialTheme.colorScheme.onSurfaceVariant)
                        },
                    )
                }
            }
        }
    }
}
