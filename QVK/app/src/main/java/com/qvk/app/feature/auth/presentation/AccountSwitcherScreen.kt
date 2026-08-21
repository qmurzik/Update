package com.qvk.app.feature.auth.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Logout
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.R
import com.qvk.app.core.ui.components.QvkAvatar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountSwitcherScreen(
    onAddAccount: () -> Unit,
    onDone: () -> Unit,
    viewModel: AccountSwitcherViewModel = hiltViewModel(),
) {
    val accounts by viewModel.accounts.collectAsState()
    val activeId by viewModel.activeAccountId.collectAsState()

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.settings_accounts)) }) }) { padding ->
        LazyColumn(modifier = Modifier.padding(padding)) {
            items(accounts, key = { it.userId }) { account ->
                ListItem(
                    modifier = Modifier.clickable { viewModel.select(account.userId); onDone() },
                    leadingContent = { QvkAvatar(account.avatarUrl, account.firstName, size = 44.dp) },
                    headlineContent = { Text("${account.firstName} ${account.lastName}") },
                    supportingContent = { Text("id${account.userId}") },
                    trailingContent = {
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            if (account.userId == activeId) {
                                Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            }
                            IconButton(onClick = { viewModel.remove(account.userId) }) {
                                Icon(Icons.Filled.Logout, contentDescription = stringResource(R.string.settings_logout))
                            }
                        }
                    },
                )
            }
            item {
                ListItem(
                    modifier = Modifier.clickable(onClick = onAddAccount),
                    leadingContent = { Icon(Icons.Filled.Add, contentDescription = null) },
                    headlineContent = { Text(stringResource(R.string.login_add_account)) },
                )
            }
        }
    }
}
