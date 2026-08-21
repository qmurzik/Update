package com.qvk.app.feature.search.data

import com.qvk.app.core.common.Resource
import com.qvk.app.core.model.Community
import com.qvk.app.core.model.Post
import com.qvk.app.core.model.UserProfile
import com.qvk.app.core.network.api.VkApiService
import com.qvk.app.core.network.mapper.buildProfiles
import com.qvk.app.core.network.mapper.toDomain
import com.qvk.app.core.network.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SearchRepository @Inject constructor(private val api: VkApiService) {

    suspend fun searchPeople(query: String): Resource<List<UserProfile>> =
        when (val r = safeApiCall { api.searchUsers(query) }) {
            is Resource.Success -> Resource.Success(r.data.items.map { it.toDomain() })
            is Resource.Error -> r
            Resource.Loading -> Resource.Loading
        }

    suspend fun searchCommunities(query: String): Resource<List<Community>> =
        when (val r = safeApiCall { api.searchGroups(query) }) {
            is Resource.Success -> Resource.Success(r.data.items.map { it.toDomain() })
            is Resource.Error -> r
            Resource.Loading -> Resource.Loading
        }

    suspend fun searchPosts(query: String): Resource<List<Post>> =
        when (val r = safeApiCall { api.searchNewsfeed(query) }) {
            is Resource.Success -> {
                val profiles = buildProfiles(r.data.profiles, r.data.groups)
                Resource.Success(r.data.items.filter { it.type == "post" }.map { it.toDomain(profiles) })
            }
            is Resource.Error -> r
            Resource.Loading -> Resource.Loading
        }
}
