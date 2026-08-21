# QVK release ProGuard/R8 rules

# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.qvk.app.**$$serializer { *; }
-keepclassmembers class com.qvk.app.** { *** Companion; }
-keepclasseswithmembers class com.qvk.app.** { kotlinx.serialization.KSerializer serializer(...); }

# Retrofit / OkHttp
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-keepattributes Signature, Exceptions
-keepclasseswithmembers class * { @retrofit2.http.* <methods>; }

# Room
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# Hilt / Dagger
-dontwarn com.google.errorprone.annotations.**

# Media3
-dontwarn com.google.android.exoplayer2.**

# Keep our data/domain models (deserialized by reflection-free kotlinx.serialization,
# but keep names for crash reports)
-keepnames class com.qvk.app.core.network.model.** { *; }
-keepnames class com.qvk.app.**.domain.model.** { *; }
