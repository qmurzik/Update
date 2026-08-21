package com.qvk.app.feature.feed.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import androidx.paging.filter
import androidx.paging.map
import com.qvk.app.core.common.Resource
import com.qvk.app.core.datastore.SettingsDataStore
import com.qvk.app.core.model.Post
import com.qvk.app.feature.feed.data.FeedRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class FeedViewModel @Inject constructor(
    private val repository: FeedRepository,
    settingsDataStore: SettingsDataStore,
) : ViewModel() {

    private val patches = MutableStateFlow<Map<String, Post>>(emptyMap())

    val cachedFeed = repository.observeCachedFeed()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val pagedFeed: Flow<PagingData<Post>> = repository.pagedFeed()
        .cachedIn(viewModelScope)
        .combine(patches) { pagingData, patchMap -> pagingData.map { post -> patchMap[post.uid] ?: post } }
        .combine(settingsDataStore.settings) { pagingData, settings ->
            if (settings.hideAds) pagingData.filter { !it.isAd } else pagingData
        }

    private val _actionError = MutableSharedFlow<String>()
    val actionError = _actionError.asSharedFlow()

    fun toggleLike(post: Post) = viewModelScope.launch {
        when (val result = repository.toggleLike(post)) {
            is Resource.Success -> {
                val (count, liked) = result.data
                patches.update { it + (post.uid to post.copy(likesCount = count, isLiked = liked)) }
            }
            is Resource.Error -> _actionError.emit(result.message)
            Resource.Loading -> Unit
        }
    }

    fun setSaved(post: Post, saved: Boolean) = viewModelScope.launch {
        (repository.setSaved(post, saved) as? Resource.Error)?.let { _actionError.emit(it.message) }
    }

    fun hideSource(post: Post) = viewModelScope.launch {
        (repository.hideSource(post) as? Resource.Error)?.let { _actionError.emit(it.message) }
    }

    fun report(post: Post, reason: Int) = viewModelScope.launch {
        (repository.reportPost(post, reason) as? Resource.Error)?.let { _actionError.emit(it.message) }
    }

    fun repost(post: Post, comment: String) = viewModelScope.launch {
        (repository.repost(post, comment) as? Resource.Error)?.let { _actionError.emit(it.message) }
    }
}
