package com.qvk.app.feature.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.qvk.app.MainActivity
import com.qvk.app.R
import com.qvk.app.core.database.dao.DialogDao
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Home-screen widget showing the unread-messages count from the local cache (no network call —
 * it reflects whatever the app last synced, refreshed on the OS's own `updatePeriodMillis`
 * cadence, on app open, and on every widget tap).
 */
@AndroidEntryPoint
class UnreadWidgetProvider : AppWidgetProvider() {

    @Inject lateinit var dialogDao: DialogDao

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { id -> updateWidget(context, appWidgetManager, id) }
    }

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_unread)

        val openAppIntent = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.widget_count, openAppIntent)
        appWidgetManager.updateAppWidget(appWidgetId, views)

        CoroutineScope(Dispatchers.IO).launch {
            val count = runCatching { dialogDao.getTotalUnreadOnce() }.getOrNull() ?: 0
            views.setTextViewText(R.id.widget_count, count.toString())
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
