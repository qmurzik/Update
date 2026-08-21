package com.qvk.app.feature.auth.presentation

import androidx.lifecycle.ViewModel
import com.qvk.app.core.security.TokenManager
import com.qvk.app.core.security.VkAccount
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

@HiltViewModel
class AccountSwitcherViewModel @Inject constructor(
    private val tokenManager: TokenManager,
) : ViewModel() {
    val accounts: StateFlow<List<VkAccount>> = tokenManager.accounts
    val activeAccountId: StateFlow<Long?> = tokenManager.activeAccountId

    fun select(userId: Long) = tokenManager.setActiveAccount(userId)
    fun remove(userId: Long) = tokenManager.removeAccount(userId)
}
