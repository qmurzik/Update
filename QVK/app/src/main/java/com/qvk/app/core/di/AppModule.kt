package com.qvk.app.core.di

import com.qvk.app.core.common.DefaultDispatchersProvider
import com.qvk.app.core.common.DispatchersProvider
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class AppModule {

    @Binds
    @Singleton
    abstract fun bindDispatchersProvider(impl: DefaultDispatchersProvider): DispatchersProvider
}
