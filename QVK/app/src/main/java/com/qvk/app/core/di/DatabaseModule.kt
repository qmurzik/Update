package com.qvk.app.core.di

import android.content.Context
import androidx.room.Room
import com.qvk.app.core.common.Constants
import com.qvk.app.core.database.AppDatabase
import com.qvk.app.core.database.dao.DialogDao
import com.qvk.app.core.database.dao.GroupDao
import com.qvk.app.core.database.dao.MessageDao
import com.qvk.app.core.database.dao.PostDao
import com.qvk.app.core.database.dao.UserDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, Constants.DATABASE_NAME)
            .fallbackToDestructiveMigration(dropAllTables = true)
            .build()

    @Provides
    fun providePostDao(db: AppDatabase): PostDao = db.postDao()

    @Provides
    fun provideUserDao(db: AppDatabase): UserDao = db.userDao()

    @Provides
    fun provideGroupDao(db: AppDatabase): GroupDao = db.groupDao()

    @Provides
    fun provideDialogDao(db: AppDatabase): DialogDao = db.dialogDao()

    @Provides
    fun provideMessageDao(db: AppDatabase): MessageDao = db.messageDao()
}
