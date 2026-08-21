package com.qvk.app.feature.communities.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.common.Resource
import com.qvk.app.core.database.dao.PostDao
import com.qvk.app.core.model.Community
import com.qvk.app.core.model.Post
import com.qvk.app.feature.communities.data.CommunitiesRepository
import com.qvk.app.feature.feed.data.FeedRepository
import com.qvk.app.feature.profile.data.ProfileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CommunityDetailUiState(
    val community: Community? = null,
    val isLoading: Boolean = true,
)

@HiltViewModel
class CommunityDetailViewModel @Inject constructor(
    private val communitiesRepository: CommunitiesRepository,
    private val profileRepository: ProfileRepository,
    private val feedRepository: FeedRepository,
    private val postDao: PostDao,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    val groupId: Long = checkNotNull(savedStateHandle["groupId"])
    private val ownerId: Long = -groupId

    private val _state = MutableStateFlow(CommunityDetailUiState())
    val state: StateFlow<CommunityDetailUiState> = _state.asStateFlow()

    val wall: StateFlow<List<Post>> = profileRepository.observeWall(ownerId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init { load() }

    fun load() = viewModelScope.launch {
        _state.value = _state.value.copy(isLoading = true)
        val result = communitiesRepository.getGroup(groupId)
        _state.value = _state.value.copy(isLoading = false, community = (result as? Resource.Success)?.data)
        profileRepository.refreshWall(ownerId)
    }

    fun toggleMembership() = viewModelScope.launch {
        val community = _state.value.community ?: return@launch
        if (community.isMember) communitiesRepository.leave(groupId) else communitiesRepository.join(groupId)
        load()
    }

    fun toggleLike(post: Post) = viewModelScope.launch {
        val result = feedRepository.toggleLike(post)
        if (result is Resource.Success) {
            val (count, liked) = result.data
            postDao.updateLikeState("wall_$ownerId:${post.ownerId}:${post.postId}", count, liked)
        }
    }

    fun publishPost(text: String) = viewModelScope.launch {
        if (text.isBlank()) return@launch
        feedRepository.createPost(ownerId, text)
        profileRepository.refreshWall(ownerId)
    }
}
