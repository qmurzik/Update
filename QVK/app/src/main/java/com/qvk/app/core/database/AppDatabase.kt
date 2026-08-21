package com.qvk.app.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.qvk.app.core.database.dao.DialogDao
import com.qvk.app.core.database.dao.GroupDao
import com.qvk.app.core.database.dao.MessageDao
import com.qvk.app.core.database.dao.PostDao
import com.qvk.app.core.database.dao.UserDao
import com.qvk.app.core.database.entity.DialogEntity
import com.qvk.app.core.database.entity.GroupEntity
import com.qvk.app.core.database.entity.MessageEntity
import com.qvk.app.core.database.entity.PostEntity
import com.qvk.app.core.database.entity.UserEntity

@Database(
    entities = [
        PostEntity::class,
        UserEntity::class,
        GroupEntity::class,
        DialogEntity::class,
        MessageEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun postDao(): PostDao
    abstract fun userDao(): UserDao
    abstract fun groupDao(): GroupDao
    abstract fun dialogDao(): DialogDao
    abstract fun messageDao(): MessageDao
}
