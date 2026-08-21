package com.qvk.app.core.database

import kotlinx.serialization.json.Json

/**
 * Room can't persist nested objects, so attachment/repost payloads are pre-serialized to JSON
 * text by the entity mappers before insert, and re-parsed on read. This shared [Json] instance
 * (rather than a Room @TypeConverter) is what the mappers use on both sides of that boundary.
 */
object Converters {
    val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
}
