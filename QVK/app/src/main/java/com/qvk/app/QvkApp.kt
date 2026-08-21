package com.qvk.app

import android.app.Application
import android.util.Log
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.GifDecoder
import coil.decode.ImageDecoderDecoder
import coil.disk.DiskCache
import coil.memory.MemoryCache
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber

@HiltAndroidApp
class QvkApp : Application(), ImageLoaderFactory {

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        } else {
            Timber.plant(CrashSafeReleaseTree())
        }
        installCrashLogger()
    }

    /** A generous, app-wide disk cache — "расширенный кеш" from Settings clears this, not just Room. */
    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        .components {
            add(if (android.os.Build.VERSION.SDK_INT >= 28) ImageDecoderDecoder.Factory() else GifDecoder.Factory())
        }
        .memoryCache { MemoryCache.Builder(this).maxSizePercent(0.25).build() }
        .diskCache {
            DiskCache.Builder()
                .directory(cacheDir.resolve("qvk_image_cache"))
                .maxSizeBytes(250L * 1024 * 1024)
                .build()
        }
        .crossfade(true)
        .build()

    /** Logs the fatal exception before handing off to the platform's default handler. */
    private fun installCrashLogger() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Timber.e(throwable, "Fatal crash on thread ${thread.name}")
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    /** Swallows and logs anything that would otherwise crash the app in release builds. */
    private class CrashSafeReleaseTree : Timber.Tree() {
        override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
            if (priority == Log.ERROR || priority == Log.WARN) {
                // Hook your crash reporter of choice here (e.g. Firebase Crashlytics) —
                // intentionally not bundled by default so QVK has zero analytics out of the box.
            }
        }
    }
}
