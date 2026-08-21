package com.qvk.app.core.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.InsertDriveFile
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.qvk.app.core.common.formatCompactCount
import com.qvk.app.core.common.formatRelativeTime
import com.qvk.app.core.model.Attachment
import com.qvk.app.core.model.Post

@Composable
fun PostCard(
    post: Post,
    modifier: Modifier = Modifier,
    onLike: () -> Unit = {},
    onComment: () -> Unit = {},
    onRepost: () -> Unit = {},
    onSave: () -> Unit = {},
    onHide: () -> Unit = {},
    onReport: () -> Unit = {},
    onOpenAuthor: () -> Unit = {},
    onOpenVideo: (Attachment.Video) -> Unit = {},
    onOpenLink: (String) -> Unit = {},
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(Modifier.padding(vertical = 12.dp)) {
            PostHeader(post, onOpenAuthor, onSave, onHide, onReport)

            if (post.text.isNotBlank()) {
                Text(
                    text = post.text,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    maxLines = 12,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            AttachmentsSection(post.attachments, onOpenVideo, onOpenLink)

            post.repostOf?.let { nested ->
                Card(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Text(nested.authorName, style = MaterialTheme.typography.titleSmall)
                        if (nested.text.isNotBlank()) {
                            Text(nested.text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                        }
                        AttachmentsSection(nested.attachments, onOpenVideo, onOpenLink)
                    }
                }
            }

            PostActionBar(post, onLike, onComment, onRepost)
        }
    }
}

@Composable
private fun PostHeader(post: Post, onOpenAuthor: () -> Unit, onSave: () -> Unit, onHide: () -> Unit, onReport: () -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).clickable(onClick = onOpenAuthor),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        QvkAvatar(post.authorAvatar, post.authorName, size = 44.dp)
        Column(Modifier.padding(start = 10.dp).weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(post.authorName, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (post.isAd) {
                    Text(
                        " · Реклама",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
            Text(formatRelativeTime(post.date), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Box {
            IconButton(onClick = { menuOpen = true }) {
                Icon(Icons.Outlined.MoreVert, contentDescription = null)
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                DropdownMenuItem(text = { Text("Сохранить") }, onClick = { menuOpen = false; onSave() })
                DropdownMenuItem(text = { Text("Скрыть источник") }, onClick = { menuOpen = false; onHide() })
                DropdownMenuItem(text = { Text("Пожаловаться") }, onClick = { menuOpen = false; onReport() })
            }
        }
    }
}

@Composable
private fun AttachmentsSection(
    attachments: List<Attachment>,
    onOpenVideo: (Attachment.Video) -> Unit,
    onOpenLink: (String) -> Unit,
) {
    val photos = attachments.filterIsInstance<Attachment.Photo>()
    if (photos.isNotEmpty()) {
        PhotoGrid(photos)
    }
    attachments.filterIsInstance<Attachment.Video>().forEach { video ->
        VideoAttachmentPreview(video, onClick = { onOpenVideo(video) })
    }
    attachments.filterIsInstance<Attachment.Doc>().forEach { doc ->
        DocAttachmentRow(doc)
    }
    attachments.filterIsInstance<Attachment.Link>().forEach { link ->
        LinkAttachmentCard(link, onClick = { onOpenLink(link.url) })
    }
    attachments.filterIsInstance<Attachment.Poll>().forEach { poll ->
        PollAttachmentCard(poll)
    }
}

@Composable
private fun PhotoGrid(photos: List<Attachment.Photo>) {
    when (photos.size) {
        1 -> AsyncImage(
            model = photos[0].url,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp)
                .clip(RoundedCornerShape(16.dp))
                .aspectRatio(16f / 11f),
        )
        else -> Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            photos.take(3).forEach { photo ->
                AsyncImage(
                    model = photo.url,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(12.dp)),
                )
            }
        }
    }
}

@Composable
private fun VideoAttachmentPreview(video: Attachment.Video, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .aspectRatio(16f / 9f)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.Black)
            .clickable(onClick = onClick),
    ) {
        if (video.previewUrl != null) {
            AsyncImage(model = video.previewUrl, contentDescription = video.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth())
        }
        Box(
            modifier = Modifier.size(56.dp).align(Alignment.Center).clip(RoundedCornerShape(50)).background(Color.Black.copy(alpha = 0.5f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.PlayArrow, contentDescription = "Воспроизвести", tint = Color.White)
        }
        Text(
            text = formatDuration(video.durationSeconds),
            color = Color.White,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(8.dp)
                .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(6.dp))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

@Composable
private fun DocAttachmentRow(doc: Attachment.Doc) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.InsertDriveFile, contentDescription = null)
        Column(Modifier.padding(start = 10.dp)) {
            Text(doc.title, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${doc.ext.uppercase()} · ${formatFileSize(doc.sizeBytes)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun LinkAttachmentCard(link: Attachment.Link, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            .clickable(onClick = onClick),
    ) {
        if (link.previewUrl != null) {
            AsyncImage(
                model = link.previewUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().aspectRatio(2f),
            )
        }
        Column(Modifier.padding(12.dp)) {
            Text(link.title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(link.url, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun PollAttachmentCard(poll: Attachment.Poll) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            .padding(12.dp),
    ) {
        Text(poll.question, style = MaterialTheme.typography.titleSmall)
        poll.answers.forEach { answer ->
            Column(Modifier.padding(top = 8.dp)) {
                Row {
                    Text(answer.text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    Text("${(answer.ratio).let { "%.0f".format(it) }}%", style = MaterialTheme.typography.bodySmall)
                }
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp)
                        .height(6.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.outlineVariant),
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth(fraction = (answer.ratio.toFloat() / 100f).coerceIn(0f, 1f))
                            .height(6.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(MaterialTheme.colorScheme.primary),
                    )
                }
            }
        }
        Text("${poll.totalVotes} голосов", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun PostActionBar(post: Post, onLike: () -> Unit, onComment: () -> Unit, onRepost: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        ActionChip(
            icon = if (post.isLiked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
            tint = if (post.isLiked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
            label = formatCompactCount(post.likesCount),
            onClick = onLike,
        )
        ActionChip(Icons.Outlined.ChatBubbleOutline, MaterialTheme.colorScheme.onSurfaceVariant, formatCompactCount(post.commentsCount), onComment)
        ActionChip(Icons.Outlined.Repeat, MaterialTheme.colorScheme.onSurfaceVariant, formatCompactCount(post.repostsCount), onRepost)
        ActionChip(Icons.Outlined.Visibility, MaterialTheme.colorScheme.onSurfaceVariant, formatCompactCount(post.viewsCount), null)
    }
}

@Composable
private fun ActionChip(icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, label: String, onClick: (() -> Unit)?) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
        Text(label, style = MaterialTheme.typography.labelMedium, color = tint, modifier = Modifier.padding(start = 6.dp))
    }
}

private fun formatDuration(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return "%d:%02d".format(m, s)
}

private fun formatFileSize(bytes: Long): String = when {
    bytes < 1024 -> "$bytes Б"
    bytes < 1024 * 1024 -> "${bytes / 1024} КБ"
    else -> "%.1f МБ".format(bytes / (1024.0 * 1024.0))
}
