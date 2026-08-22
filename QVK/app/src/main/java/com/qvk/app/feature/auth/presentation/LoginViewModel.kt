package com.qvk.app.feature.auth.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.common.Constants
import com.qvk.app.core.common.Resource
import com.qvk.app.feature.auth.data.AuthRepository
import com.qvk.app.feature.auth.data.OAuthRedirectBus
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
    data object Idle : LoginUiState()
    data object Authenticating : LoginUiState()
    data object Success : LoginUiState()
    data class Error(val message: String) : LoginUiState()
}

/**
 * VK ID's login page detects and refuses to complete inside an embedded WebView (a standard
 * anti-phishing measure — same policy Google enforces for its own OAuth). So this opens the
 * system browser instead and waits for [OAuthRedirectBus] to deliver the redirect, which
 * MainActivity captures from the resulting deep-link intent — see its KDoc for the full path.
 *
 * PKCE params live in [SavedStateHandle] (not a plain field) because the OS can kill the app
 * process while the browser is in the foreground; without that, a process death mid-login would
 * regenerate a different `state`/`code_verifier` and the redirect would fail the state check.
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val redirectBus: OAuthRedirectBus,
    private val savedStateHandle: SavedStateHandle,
) : ViewModel() {

    val clientIdConfigured: Boolean = Constants.VK_CLIENT_ID != "0" && Constants.VK_CLIENT_ID.isNotBlank()

    private var pkce: PkceParams
        get() {
            val verifier = savedStateHandle.get<String>(KEY_VERIFIER)
            val challenge = savedStateHandle.get<String>(KEY_CHALLENGE)
            val state = savedStateHandle.get<String>(KEY_STATE)
            return if (verifier != null && challenge != null && state != null) {
                PkceParams(verifier, challenge, state)
            } else {
                OAuthRedirectParser.generatePkce().also { persistPkce(it) }
            }
        }
        set(value) = persistPkce(value)

    private fun persistPkce(value: PkceParams) {
        savedStateHandle[KEY_VERIFIER] = value.codeVerifier
        savedStateHandle[KEY_CHALLENGE] = value.codeChallenge
        savedStateHandle[KEY_STATE] = value.state
    }

    private val _state = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            redirectBus.redirects.collect { uri -> onRedirect(uri.toString()) }
        }
    }

    /** Generates fresh PKCE params and returns the URL the caller should open in a browser. */
    fun startLogin(): String {
        pkce = OAuthRedirectParser.generatePkce()
        _state.value = LoginUiState.Authenticating
        return OAuthRedirectParser.buildAuthorizeUrl(pkce)
    }

    private fun onRedirect(url: String) {
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
        _state.value = LoginUiState.Idle
    }

    private companion object {
        const val KEY_VERIFIER = "pkce_verifier"
        const val KEY_CHALLENGE = "pkce_challenge"
        const val KEY_STATE = "pkce_state"
    }
}
