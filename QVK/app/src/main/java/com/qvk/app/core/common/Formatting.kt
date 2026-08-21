package com.qvk.app.core.common

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/** Formats a VK unix-seconds timestamp as a short relative string ("5 мин", "вчера", "12 мар"). */
fun formatRelativeTime(unixSeconds: Long): String {
    val now = System.currentTimeMillis() / 1000
    val diff = (now - unixSeconds).coerceAtLeast(0)
    return when {
        diff < 60 -> "только что"
        diff < 3600 -> "${TimeUnit.SECONDS.toMinutes(diff)} мин"
        diff < 86_400 -> "${TimeUnit.SECONDS.toHours(diff)} ч"
        diff < 172_800 -> "вчера"
        diff < 7 * 86_400 -> "${TimeUnit.SECONDS.toDays(diff)} дн"
        else -> SimpleDateFormat("d MMM", Locale("ru")).format(Date(unixSeconds * 1000))
    }
}

/** Formats a like/comment/view count as "1,2K" / "3.4M" for compact display on post cards. */
fun formatCompactCount(count: Int): String = when {
    count < 1000 -> count.toString()
    count < 1_000_000 -> String.format(Locale.getDefault(), "%.1fK", count / 1000.0).replace(".0K", "K")
    else -> String.format(Locale.getDefault(), "%.1fM", count / 1_000_000.0).replace(".0M", "M")
}
