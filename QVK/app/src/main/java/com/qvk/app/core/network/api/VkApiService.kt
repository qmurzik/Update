package com.qvk.app.core.network.api

import com.qvk.app.core.network.dto.*
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Field
import retrofit2.http.Query

/**
 * Thin 1:1 mapping over the official VK API (https://dev.vk.com/method/*). [com.qvk.app.core.network.VkAuthInterceptor]
 * appends `access_token`, `v` and `lang` to every request, so only method-specific params live here.
 * Reads use GET, mutations use POST — both are accepted by VK, POST just avoids stuffing long
 * message/attachment strings into a query string.
 */
interface VkApiService {

    // ---- account / users ----

    @GET("method/account.getProfileInfo")
    suspend fun getProfileInfo(): VkEnvelope<AccountProfileInfoDto>

    @GET("method/users.get")
    suspend fun getUsers(
        @Query("user_ids") userIds: String? = null, // null = the token owner ("me")
        @Query("fields") fields: String = DEFAULT_USER_FIELDS,
    ): VkEnvelope<List<UserDto>>

    @GET("method/users.search")
    suspend fun searchUsers(
        @Query("q") query: String,
        @Query("count") count: Int = 20,
        @Query("offset") offset: Int = 0,
        @Query("fields") fields: String = DEFAULT_USER_FIELDS,
    ): VkEnvelope<VkListResponse<UserDto>>

    @GET("method/friends.get")
    suspend fun getFriends(
        @Query("user_id") userId: Long? = null,
        @Query("count") count: Int = 100,
        @Query("offset") offset: Int = 0,
        @Query("order") order: String = "hints",
        @Query("fields") fields: String = DEFAULT_USER_FIELDS,
    ): VkEnvelope<VkListResponse<UserDto>>

    @GET("method/friends.getRequests")
    suspend fun getFriendRequests(
        @Query("count") count: Int = 50,
        @Query("extended") extended: Int = 1,
    ): VkEnvelope<VkListResponse<Long>>

    // ---- wall / feed ----

    @GET("method/newsfeed.get")
    suspend fun getNewsfeed(
        @Query("filters") filters: String = "post",
        @Query("count") count: Int = 20,
        @Query("start_from") startFrom: String? = null,
        @Query("start_time") startTime: Long? = null,
    ): VkEnvelope<NewsfeedResponseDto>

    @GET("method/newsfeed.search")
    suspend fun searchNewsfeed(
        @Query("q") query: String,
        @Query("count") count: Int = 20,
        @Query("start_from") startFrom: String? = null,
        @Query("extended") extended: Int = 1,
    ): VkEnvelope<NewsfeedResponseDto>

    @GET("method/wall.get")
    suspend fun getWall(
        @Query("owner_id") ownerId: Long,
        @Query("offset") offset: Int = 0,
        @Query("count") count: Int = 20,
        @Query("filter") filter: String = "owner",
        @Query("extended") extended: Int = 1,
        @Query("fields") fields: String = DEFAULT_USER_FIELDS,
    ): VkEnvelope<WallGetResponseDto>

    @FormUrlEncoded
    @POST("method/wall.post")
    suspend fun createPost(
        @Field("owner_id") ownerId: Long,
        @Field("message") message: String,
        @Field("attachments") attachments: String? = null,
    ): VkEnvelope<PostIdDto>

    @FormUrlEncoded
    @POST("method/wall.repost")
    suspend fun repost(
        @Field("object") objectId: String,
        @Field("message") message: String = "",
    ): VkEnvelope<RepostResultDto>

    @FormUrlEncoded
    @POST("method/wall.reportPost")
    suspend fun reportPost(
        @Field("owner_id") ownerId: Long,
        @Field("post_id") postId: Long,
        @Field("reason") reason: Int,
    ): VkEnvelope<Int>

    @FormUrlEncoded
    @POST("method/fave.addPost")
    suspend fun savePost(
        @Field("owner_id") ownerId: Long,
        @Field("id") postId: Long,
    ): VkEnvelope<Int>

    @FormUrlEncoded
    @POST("method/fave.removePost")
    suspend fun unsavePost(
        @Field("owner_id") ownerId: Long,
        @Field("id") postId: Long,
    ): VkEnvelope<Int>

    @FormUrlEncoded
    @POST("method/newsfeed.ignoreItem")
    suspend fun hideFeedSource(
        @Field("type") type: String = "wall",
        @Field("owner_id") ownerId: Long,
        @Field("item_id") itemId: Long,
    ): VkEnvelope<Int>

    @GET("method/wall.getComments")
    suspend fun getComments(
        @Query("owner_id") ownerId: Long,
        @Query("post_id") postId: Long,
        @Query("count") count: Int = 20,
        @Query("offset") offset: Int = 0,
        @Query("extended") extended: Int = 1,
        @Query("sort") sort: String = "asc",
    ): VkEnvelope<CommentsResponseDto>

    @FormUrlEncoded
    @POST("method/wall.createComment")
    suspend fun createComment(
        @Field("owner_id") ownerId: Long,
        @Field("post_id") postId: Long,
        @Field("message") message: String,
        @Field("reply_to_comment") replyToComment: Long? = null,
    ): VkEnvelope<PostIdDto>

    // ---- likes ----

    @FormUrlEncoded
    @POST("method/likes.add")
    suspend fun addLike(
        @Field("type") type: String,
        @Field("owner_id") ownerId: Long,
        @Field("item_id") itemId: Long,
    ): VkEnvelope<LikesCountDto>

    @FormUrlEncoded
    @POST("method/likes.delete")
    suspend fun deleteLike(
        @Field("type") type: String,
        @Field("owner_id") ownerId: Long,
        @Field("item_id") itemId: Long,
    ): VkEnvelope<LikesCountDto>

    // ---- groups ----

    @GET("method/groups.get")
    suspend fun getMyGroups(
        @Query("extended") extended: Int = 1,
        @Query("fields") fields: String = DEFAULT_GROUP_FIELDS,
        @Query("count") count: Int = 100,
        @Query("offset") offset: Int = 0,
    ): VkEnvelope<VkListResponse<GroupDto>>

    @GET("method/groups.getById")
    suspend fun getGroupsById(
        @Query("group_ids") groupIds: String,
        @Query("fields") fields: String = DEFAULT_GROUP_FIELDS,
    ): VkEnvelope<List<GroupDto>>

    @GET("method/groups.search")
    suspend fun searchGroups(
        @Query("q") query: String,
        @Query("count") count: Int = 20,
        @Query("offset") offset: Int = 0,
    ): VkEnvelope<VkListResponse<GroupDto>>

    @FormUrlEncoded
    @POST("method/groups.join")
    suspend fun joinGroup(@Field("group_id") groupId: Long): VkEnvelope<Int>

    @FormUrlEncoded
    @POST("method/groups.leave")
    suspend fun leaveGroup(@Field("group_id") groupId: Long): VkEnvelope<Int>

    // ---- messages ----

    @GET("method/messages.getConversations")
    suspend fun getConversations(
        @Query("offset") offset: Int = 0,
        @Query("count") count: Int = 20,
        @Query("extended") extended: Int = 1,
        @Query("fields") fields: String = DEFAULT_USER_FIELDS,
    ): VkEnvelope<ConversationsResponseDto>

    @GET("method/messages.getHistory")
    suspend fun getMessageHistory(
        @Query("peer_id") peerId: Long,
        @Query("count") count: Int = 30,
        @Query("offset") offset: Int = 0,
        @Query("extended") extended: Int = 1,
        @Query("fields") fields: String = DEFAULT_USER_FIELDS,
    ): VkEnvelope<MessageHistoryResponseDto>

    @FormUrlEncoded
    @POST("method/messages.send")
    suspend fun sendMessage(
        @Field("peer_id") peerId: Long,
        @Field("message") message: String,
        @Field("random_id") randomId: Long,
        @Field("attachment") attachment: String? = null,
        @Field("reply_to") replyTo: Long? = null,
    ): VkEnvelope<Long>

    @FormUrlEncoded
    @POST("method/messages.markAsRead")
    suspend fun markAsRead(@Field("peer_id") peerId: Long): VkEnvelope<Int>

    @GET("method/messages.getLongPollServer")
    suspend fun getLongPollServer(
        @Query("need_pts") needPts: Int = 1,
        @Query("lp_version") lpVersion: Int = 3,
    ): VkEnvelope<LongPollServerDto>

    // ---- groups admin wall ----

    @GET("method/groups.getTokenPermissions")
    suspend fun getTokenPermissions(): VkEnvelope<TokenPermissionsDto>

    // ---- video ----

    @GET("method/video.get")
    suspend fun getVideos(
        @Query("owner_id") ownerId: Long? = null,
        @Query("count") count: Int = 20,
        @Query("offset") offset: Int = 0,
        @Query("extended") extended: Int = 1,
    ): VkEnvelope<VkListResponse<VideoDto>>

    @GET("method/video.search")
    suspend fun searchVideos(
        @Query("q") query: String,
        @Query("count") count: Int = 20,
        @Query("offset") offset: Int = 0,
    ): VkEnvelope<VkListResponse<VideoDto>>

    // ---- photos ----

    @GET("method/photos.getAll")
    suspend fun getAllPhotos(
        @Query("owner_id") ownerId: Long,
        @Query("count") count: Int = 30,
        @Query("offset") offset: Int = 0,
        @Query("extended") extended: Int = 0,
    ): VkEnvelope<VkListResponse<PhotoDto>>

    // ---- notifications ----

    @GET("method/notifications.get")
    suspend fun getNotifications(
        @Query("count") count: Int = 30,
        @Query("start_from") startFrom: String? = null,
    ): VkEnvelope<NotificationsResponseDto>

    // ---- audio ----
    // Defined for architectural completeness, but VK stopped granting the `audio` scope to new
    // third-party apps in 2021 — calling this without it returns error 15 (access denied) for
    // virtually every QVK install. See feature/music/data/MusicRepository for how this is
    // surfaced to the UI as a clear "unavailable" state instead of a generic error.
    @GET("method/audio.get")
    suspend fun getAudio(
        @Query("owner_id") ownerId: Long? = null,
        @Query("count") count: Int = 50,
    ): VkEnvelope<VkListResponse<AudioDto>>

    @GET("method/audio.search")
    suspend fun searchAudio(
        @Query("q") query: String,
        @Query("count") count: Int = 30,
    ): VkEnvelope<VkListResponse<AudioDto>>
}

const val DEFAULT_USER_FIELDS =
    "photo_50,photo_100,photo_200,photo_max_orig,online,status,city,followers_count,counters,screen_name,verified"
const val DEFAULT_GROUP_FIELDS =
    "description,members_count,is_member,is_admin,verified"
