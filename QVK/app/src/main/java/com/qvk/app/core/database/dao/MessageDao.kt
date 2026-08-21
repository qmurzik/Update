package com.qvk.app.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.qvk.app.core.database.entity.DialogEntity
import com.qvk.app.core.database.entity.MessageEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface DialogDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(dialogs: List<DialogEntity>)

    @Query("SELECT * FROM dialogs ORDER BY lastMessageDate DESC")
    fun observeAll(): Flow<List<DialogEntity>>

    @Query("UPDATE dialogs SET unreadCount = 0 WHERE peerId = :peerId")
    suspend fun markRead(peerId: Long)

    @Query("SELECT SUM(unreadCount) FROM dialogs")
    fun observeTotalUnread(): Flow<Int?>

    /** One-shot read for contexts outside a Compose/ViewModel Flow collector — e.g. the home screen widget. */
    @Query("SELECT SUM(unreadCount) FROM dialogs")
    suspend fun getTotalUnreadOnce(): Int?

    @Query("DELETE FROM dialogs")
    suspend fun clearAll()
}

@Dao
interface MessageDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(messages: List<MessageEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(message: MessageEntity)

    @Query("SELECT * FROM messages WHERE peerId = :peerId ORDER BY date ASC")
    fun observeHistory(peerId: Long): Flow<List<MessageEntity>>

    @Query("DELETE FROM messages WHERE messageId = :localId")
    suspend fun deleteById(localId: Long)

    @Query("DELETE FROM messages")
    suspend fun clearAll()
}
