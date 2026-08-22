package com.qvk.app.feature.auth.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.common.Constants
import com.qvk.app.core.common.Resource
import com.qvk.app.feature.auth.data.AuthRepository
import com.qvk.app.feature.auth.data.OAuthRedirectParser
import com.qvk.app.feature.auth.data.OAuthResult
import com.qvk.app.feature.auth.data.PkceParams
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class LoginUiState {
    data object ShowingWebView : LoginUiState()
    data object Authenticating : LoginUiState()
    data object Success : LoginUiState()
    data class Error(val message: String) : LoginUiState()
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    val clientIdConfigured: Boolean = Constants.VK_CLIENT_ID != "0" && Constants.VK_CLIENT_ID.isNotBlank()

    private var pkce: PkceParams = OAuthRedirectParser.generatePkce()
    val authorizeUrl: String get() = OAuthRedirectParser.buildAuthorizeUrl(pkce)

    private val _state = MutableStateFlow<LoginUiState>(LoginUiState.ShowingWebView)
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun isRedirect(url: String): Boolean = OAuthRedirectParser.isRedirect(url)

    fun onRedirect(url: String) {
        if (_state.value == LoginUiState.Authenticating) return
        when (val parsed = OAuthRedirectParser.parseRedirect(url, pkce.state)) {
            is OAuthResult.Failure -> _state.value = LoginUiState.Error(parsed.reason)
            is OAuthResult.Success -> {
                _state.value = LoginUiState.Authenticating
                val codeVerifier = pkce.codeVerifier
                viewModelScope.launch {
                    when (val result = authRepository.completeLogin(parsed, codeVerifier)) {
                        is Resource.Success -> _state.value = LoginUiState.Success
                        is Resource.Error -> _state.value = LoginUiState.Error(result.message)
                        Resource.Loading -> Unit
                    }
                }
            }
        }
    }

    fun retry() {
        pkce = OAuthRedirectParser.generatePkce()
        _state.value = LoginUiState.ShowingWebView
    }
}
