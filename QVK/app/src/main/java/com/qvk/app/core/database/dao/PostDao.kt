package com.qvk.app.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.qvk.app.core.database.entity.PostEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PostDao {

    @Query("SELECT * FROM posts WHERE bucket = :bucket ORDER BY feedOrder ASC")
    fun observeBucket(bucket: String): Flow<List<PostEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(posts: List<PostEntity>)

    @Query("DELETE FROM posts WHERE bucket = :bucket")
    suspend fun clearBucket(bucket: String)

    @Query("DELETE FROM posts WHERE bucket = :bucket AND uid NOT IN (:keepUids)")
    suspend fun pruneBucket(bucket: String, keepUids: List<String>)

    @Query("UPDATE posts SET likesCount = :count, userLikes = :liked WHERE uid = :uid")
    suspend fun updateLikeState(uid: String, count: Int, liked: Boolean)

    @Query("DELETE FROM posts WHERE ownerId = :ownerId AND postId = :postId")
    suspend fun deleteByIdAnyBucket(ownerId: Long, postId: Long)

    @Query("DELETE FROM posts WHERE cachedAt < :olderThan")
    suspend fun clearOlderThan(olderThan: Long)

    @Query("DELETE FROM posts")
    suspend fun clearAll()
}
