package com.qvk.app.feature.communities.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.common.Resource
import com.qvk.app.core.model.Community
import com.qvk.app.feature.communities.data.CommunitiesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CommunitiesViewModel @Inject constructor(
    private val repository: CommunitiesRepository,
) : ViewModel() {

    val myGroups: StateFlow<List<Community>> = repository.observeMyGroups()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    private val _searchResults = MutableStateFlow<List<Community>>(emptyList())
    val searchResults: StateFlow<List<Community>> = _searchResults.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    init { refresh() }

    fun refresh() = viewModelScope.launch { repository.refreshMyGroups() }

    fun onQueryChange(value: String) {
        _query.value = value
        if (value.isBlank()) {
            _searchResults.value = emptyList()
            return
        }
        viewModelScope.launch {
            _isSearching.value = true
            when (val result = repository.search(value)) {
                is Resource.Success -> _searchResults.value = result.data
                else -> Unit
            }
            _isSearching.value = false
        }
    }

    fun toggleMembership(community: Community) = viewModelScope.launch {
        if (community.isMember) repository.leave(community.id) else repository.join(community.id)
        refresh()
        if (query.value.isNotBlank()) onQueryChange(query.value)
    }
}
