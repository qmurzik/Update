package com.qvk.app.feature.auth.presentation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.R

@Composable
fun LoginScreen(
    onLoggedIn: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(state) {
        if (state is LoginUiState.Success) onLoggedIn()
    }

    fun launchLogin() {
        val url = viewModel.startLogin()
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    Scaffold { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            when {
                !viewModel.clientIdConfigured -> MissingClientIdNotice()
                state is LoginUiState.Authenticating -> {
                    CircularProgressIndicator()
                    Text(
                        "Ждём возврата из браузера...",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = 16.dp),
                    )
                }
                else -> {
                    val errorMessage = (state as? LoginUiState.Error)?.message
                    Text(stringResource(R.string.login_title), style = MaterialTheme.typography.headlineSmall)
                    if (errorMessage != null) {
                        Text(
                            errorMessage,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    } else {
                        Text(
                            stringResource(R.string.login_subtitle),
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                    Button(onClick = ::launchLogin, modifier = Modifier.padding(top = 24.dp)) {
                        Text(if (errorMessage != null) "Повторить" else stringResource(R.string.login_button))
                    }
                }
            }
        }
    }
}

@Composable
private fun MissingClientIdNotice() {
    Text(stringResource(R.string.login_title), style = MaterialTheme.typography.headlineSmall)
    Text(
        stringResource(R.string.login_no_client_id),
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier.padding(top = 12.dp),
    )
}
