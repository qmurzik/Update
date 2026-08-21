package com.qvk.app.feature.search.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.common.Resource
import com.qvk.app.core.model.Community
import com.qvk.app.core.model.Post
import com.qvk.app.core.model.UserProfile
import com.qvk.app.feature.search.data.SearchRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class SearchTab { PEOPLE, COMMUNITIES, POSTS }

data class SearchUiState(
    val query: String = "",
    val tab: SearchTab = SearchTab.PEOPLE,
    val isLoading: Boolean = false,
    val people: List<UserProfile> = emptyList(),
    val communities: List<Community> = emptyList(),
    val posts: List<Post> = emptyList(),
)

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val repository: SearchRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    private var searchJob: Job? = null

    fun onQueryChange(query: String) {
        _state.value = _state.value.copy(query = query)
        runSearchDebounced()
    }

    fun onTabChange(tab: SearchTab) {
        _state.value = _state.value.copy(tab = tab)
        runSearchDebounced(immediate = true)
    }

    private fun runSearchDebounced(immediate: Boolean = false) {
        val query = _state.value.query
        searchJob?.cancel()
        if (query.isBlank()) {
            _state.value = _state.value.copy(people = emptyList(), communities = emptyList(), posts = emptyList())
            return
        }
        searchJob = viewModelScope.launch {
            if (!immediate) delay(350)
            _state.value = _state.value.copy(isLoading = true)
            when (_state.value.tab) {
                SearchTab.PEOPLE -> (repository.searchPeople(query) as? Resource.Success)?.let {
                    _state.value = _state.value.copy(people = it.data)
                }
                SearchTab.COMMUNITIES -> (repository.searchCommunities(query) as? Resource.Success)?.let {
                    _state.value = _state.value.copy(communities = it.data)
                }
                SearchTab.POSTS -> (repository.searchPosts(query) as? Resource.Success)?.let {
                    _state.value = _state.value.copy(posts = it.data)
                }
            }
            _state.value = _state.value.copy(isLoading = false)
        }
    }
}
