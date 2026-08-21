package com.qvk.app.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.qvk.app.core.database.entity.GroupEntity
import com.qvk.app.core.database.entity.UserEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface UserDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(users: List<UserEntity>)

    @Query("SELECT * FROM users WHERE userId = :userId")
    fun observeUser(userId: Long): Flow<UserEntity?>

    @Query("SELECT * FROM users WHERE userId = :userId")
    suspend fun getUser(userId: Long): UserEntity?

    @Query("SELECT * FROM users WHERE firstName LIKE '%' || :query || '%' OR lastName LIKE '%' || :query || '%' LIMIT 50")
    suspend fun searchCached(query: String): List<UserEntity>

    @Query("DELETE FROM users")
    suspend fun clearAll()
}

@Dao
interface GroupDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(groups: List<GroupEntity>)

    @Query("SELECT * FROM groups WHERE groupId = :groupId")
    fun observeGroup(groupId: Long): Flow<GroupEntity?>

    @Query("SELECT * FROM groups WHERE isMember = 1 ORDER BY name ASC")
    fun observeMyGroups(): Flow<List<GroupEntity>>

    @Query("DELETE FROM groups")
    suspend fun clearAll()
}
