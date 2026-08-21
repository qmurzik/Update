package com.qvk.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PlayCircle
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import com.qvk.app.R

data class BottomNavItem(
    val dest: TopLevelDest,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val labelRes: Int,
)

val bottomNavItems = listOf(
    BottomNavItem(TopLevelDest.FEED, Icons.Filled.Home, Icons.Outlined.Home, R.string.nav_feed),
    BottomNavItem(TopLevelDest.MESSAGES, Icons.Filled.Mail, Icons.Outlined.Mail, R.string.nav_messages),
    BottomNavItem(TopLevelDest.VIDEO, Icons.Filled.PlayCircle, Icons.Outlined.PlayCircle, R.string.nav_video),
    BottomNavItem(TopLevelDest.COMMUNITIES, Icons.Filled.Groups, Icons.Outlined.Groups, R.string.nav_communities),
    BottomNavItem(TopLevelDest.PROFILE, Icons.Filled.Person, Icons.Outlined.Person, R.string.nav_profile),
)

@Composable
fun QvkBottomBar(
    currentTopLevel: TopLevelDest?,
    unreadMessages: Int,
    onSelect: (TopLevelDest) -> Unit,
) {
    NavigationBar {
        bottomNavItems.forEach { item ->
            val selected = item.dest == currentTopLevel
            NavigationBarItem(
                selected = selected,
                onClick = { onSelect(item.dest) },
                icon = {
                    val icon = if (selected) item.selectedIcon else item.unselectedIcon
                    if (item.dest == TopLevelDest.MESSAGES && unreadMessages > 0) {
                        BadgedBox(badge = { Badge { androidx.compose.material3.Text(unreadMessages.coerceAtMost(99).toString()) } }) {
                            Icon(icon, contentDescription = null)
                        }
                    } else {
                        Icon(icon, contentDescription = null)
                    }
                },
                label = { androidx.compose.material3.Text(androidx.compose.ui.res.stringResource(item.labelRes)) },
            )
        }
    }
}
