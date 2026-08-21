package com.qvk.app.feature.settings.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.item
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.R
import com.qvk.app.core.datastore.AccentColor
import com.qvk.app.core.datastore.MediaQuality
import com.qvk.app.core.datastore.ThemeMode
import com.qvk.app.core.ui.theme.palette

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onOpenAccounts: () -> Unit,
    onLoggedOut: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val settings by viewModel.settings.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Настройки") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null) } },
            )
        },
    ) { padding ->
        LazyColumn(Modifier.fillMaxWidth().padding(padding)) {
            item { SectionTitle(stringResource(R.string.settings_theme)) }
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ThemeMode.entries.forEach { mode ->
                        FilterChip(
                            selected = settings.themeMode == mode,
                            onClick = { viewModel.setThemeMode(mode) },
                            label = { Text(themeModeLabel(mode)) },
                        )
                    }
                }
            }

            item { SectionTitle(stringResource(R.string.settings_accent)) }
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AccentColor.entries.forEach { accent ->
                        val color = accent.palette().primary
                        Row(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(color)
                                .clickable { viewModel.setAccentColor(accent) },
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (settings.accentColor == accent) {
                                Icon(Icons.Filled.Check, contentDescription = null, tint = androidx.compose.ui.graphics.Color.White)
                            }
                        }
                    }
                }
            }
            item {
                SwitchRow(stringResource(R.string.settings_dynamic_color), settings.useDynamicColor, viewModel::setUseDynamicColor)
            }

            item { SectionTitle(stringResource(R.string.settings_text_size)) }
            item {
                Slider(
                    value = settings.textScale,
                    onValueChange = viewModel::setTextScale,
                    valueRange = 0.85f..1.3f,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                )
            }

            item { SectionTitle(stringResource(R.string.settings_image_quality)) }
            item { QualityRow(settings.imageQuality, viewModel::setImageQuality) }
            item { SectionTitle(stringResource(R.string.settings_video_quality)) }
            item { QualityRow(settings.videoQuality, viewModel::setVideoQuality) }

            item { SwitchRow(stringResource(R.string.settings_traffic_saver), settings.trafficSaverEnabled, viewModel::setTrafficSaver) }
            item { SwitchRow("Автовоспроизведение видео", settings.autoplayVideos, viewModel::setAutoplayVideos) }
            item { SwitchRow("Скрывать рекламные записи", settings.hideAds, viewModel::setHideAds) }

            item { SectionTitle(stringResource(R.string.settings_privacy)) }
            item { SwitchRow("Показывать статус \"в сети\"", settings.privacyShowOnlineStatus, viewModel::setPrivacyOnline) }

            item { SectionTitle(stringResource(R.string.settings_notifications)) }
            item { SwitchRow("Лайки", settings.notifyLikes, viewModel::setNotifyLikes) }
            item { SwitchRow("Комментарии", settings.notifyComments, viewModel::setNotifyComments) }
            item { SwitchRow("Сообщения", settings.notifyMessages, viewModel::setNotifyMessages) }

            item { SectionTitle(stringResource(R.string.settings_cache)) }
            item {
                Button(onClick = viewModel::clearCache, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                    Text(stringResource(R.string.settings_clear_cache))
                }
            }

            item { SectionTitle(stringResource(R.string.settings_accounts)) }
            item {
                ListItem(
                    modifier = Modifier.clickable(onClick = onOpenAccounts),
                    headlineContent = { Text(stringResource(R.string.settings_accounts)) },
                )
            }
            item {
                ListItem(
                    modifier = Modifier.clickable {
                        viewModel.logout()
                        onLoggedOut()
                    },
                    headlineContent = { Text(stringResource(R.string.settings_logout), color = MaterialTheme.colorScheme.error) },
                )
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 8.dp),
    )
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    ListItem(
        headlineContent = { Text(label) },
        trailingContent = { Switch(checked = checked, onCheckedChange = onCheckedChange) },
    )
}

@Composable
private fun QualityRow(current: MediaQuality, onSelect: (MediaQuality) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MediaQuality.entries.forEach { quality ->
            FilterChip(selected = current == quality, onClick = { onSelect(quality) }, label = { Text(qualityLabel(quality)) })
        }
    }
}

private fun themeModeLabel(mode: ThemeMode) = when (mode) {
    ThemeMode.SYSTEM -> "Системная"
    ThemeMode.LIGHT -> "Светлая"
    ThemeMode.DARK -> "Тёмная"
    ThemeMode.AMOLED -> "AMOLED"
}

private fun qualityLabel(quality: MediaQuality) = when (quality) {
    MediaQuality.LOW -> "Низкое"
    MediaQuality.MEDIUM -> "Среднее"
    MediaQuality.HIGH -> "Высокое"
    MediaQuality.ORIGINAL -> "Оригинал"
}
