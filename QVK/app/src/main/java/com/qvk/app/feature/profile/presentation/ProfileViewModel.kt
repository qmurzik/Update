package com.qvk.app.feature.profile.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.common.Resource
import com.qvk.app.core.database.dao.PostDao
import com.qvk.app.core.model.Post
import com.qvk.app.core.model.UserProfile
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

data class ProfileUiState(
    val profile: UserProfile? = null,
    val friends: List<UserProfile> = emptyList(),
    val photos: List<String> = emptyList(),
    val isLoading: Boolean = true,
    val isLoadingMoreWall: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val repository: ProfileRepository,
    private val feedRepository: FeedRepository,
    private val postDao: PostDao,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val routeArg: String = checkNotNull(savedStateHandle["userId"])
    val userId: Long = repository.resolveUserId(routeArg)
    val isOwnProfile: Boolean = repository.isOwnProfile(userId)

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    val wall: StateFlow<List<Post>> = repository.observeWall(userId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init { load() }

    fun load() = viewModelScope.launch {
        _state.value = _state.value.copy(isLoading = true, error = null)

        val profileResult = repository.getProfile(userId)
        val friendsResult = repository.getFriends(userId)
        val photosResult = repository.getPhotos(userId)
        repository.refreshWall(userId)

        _state.value = _state.value.copy(
            isLoading = false,
            profile = (profileResult as? Resource.Success)?.data,
            friends = (friendsResult as? Resource.Success)?.data.orEmpty(),
            photos = (photosResult as? Resource.Success)?.data.orEmpty(),
            error = (profileResult as? Resource.Error)?.message,
        )
    }

    fun toggleLike(post: Post) = viewModelScope.launch {
        val result = feedRepository.toggleLike(post)
        if (result is Resource.Success) {
            val (count, liked) = result.data
            postDao.updateLikeState("wall_$userId:${post.ownerId}:${post.postId}", count, liked)
        }
    }

    fun loadMoreWall() = viewModelScope.launch {
        if (_state.value.isLoadingMoreWall) return@launch
        _state.value = _state.value.copy(isLoadingMoreWall = true)
        repository.loadMoreWall(userId, wall.value.size)
        _state.value = _state.value.copy(isLoadingMoreWall = false)
    }
}
