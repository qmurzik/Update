package com.qvk.app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.qvk.app.core.model.Attachment
import com.qvk.app.core.model.Community
import com.qvk.app.core.model.Conversation
import com.qvk.app.core.model.Post
import com.qvk.app.feature.auth.presentation.AccountSwitcherScreen
import com.qvk.app.feature.auth.presentation.LoginScreen
import com.qvk.app.feature.communities.presentation.CommunitiesScreen
import com.qvk.app.feature.communities.presentation.CommunityDetailScreen
import com.qvk.app.feature.feed.presentation.FeedScreen
import com.qvk.app.feature.feed.presentation.PostDetailScreen
import com.qvk.app.feature.messages.presentation.ChatScreen
import com.qvk.app.feature.messages.presentation.MessagesScreen
import com.qvk.app.feature.notifications.presentation.NotificationsScreen
import com.qvk.app.feature.profile.presentation.ProfileScreen
import com.qvk.app.feature.search.presentation.SearchScreen
import com.qvk.app.feature.settings.presentation.SettingsScreen
import com.qvk.app.feature.video.presentation.VideoPlayerScreen
import com.qvk.app.feature.video.presentation.VideoScreen

@Composable
fun QvkRoot(rootViewModel: AppRootViewModel = hiltViewModel()) {
    val isLoggedIn by rootViewModel.isLoggedIn.collectAsState()
    val settings by rootViewModel.settings.collectAsState()
    val unreadMessages by rootViewModel.unreadMessages.collectAsState()

    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val currentTopLevel = TopLevelDest.entries.find { it.dest.route == currentRoute }

    Scaffold(
        bottomBar = {
            if (currentTopLevel != null) {
                QvkBottomBar(currentTopLevel, unreadMessages) { target ->
                    val route = if (target == TopLevelDest.PROFILE) Dest.Profile.of() else target.dest.route
                    navController.navigate(route) {
                        popUpTo(Dest.Feed.route) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            NavHost(navController = navController, startDestination = Dest.Splash.route) {

                composable(Dest.Splash.route) {
                    LaunchedEffect(isLoggedIn) {
                        when (isLoggedIn) {
                            null -> Unit
                            true -> navController.navigate(Dest.Feed.route) { popUpTo(Dest.Splash.route) { inclusive = true } }
                            false -> navController.navigate(Dest.Login.route) { popUpTo(Dest.Splash.route) { inclusive = true } }
                        }
                    }
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }

                composable(Dest.Login.route) {
                    LoginScreen(onLoggedIn = {
                        navController.navigate(Dest.Feed.route) { popUpTo(Dest.Login.route) { inclusive = true } }
                    })
                }

                composable(Dest.Feed.route) {
                    FeedScreen(
                        onOpenPost = { post -> navController.navigate(Dest.PostDetail.of(post.ownerId, post.postId)) },
                        onOpenAuthor = { userId -> navController.navigate(Dest.Profile.of(userId.toString())) },
                        onOpenVideo = { video -> navController.navigate(Dest.VideoPlayer.of(video.directUrl, video.title)) },
                        onOpenSearch = { navController.navigate(Dest.Search.route) },
                        onOpenNotifications = { navController.navigate(Dest.Notifications.route) },
                    )
                }

                composable(
                    Dest.PostDetail.route,
                    arguments = listOf(navArgument("ownerId") { type = NavType.LongType }, navArgument("postId") { type = NavType.LongType }),
                ) {
                    PostDetailScreen(onBack = { navController.popBackStack() })
                }

                composable(
                    Dest.Profile.route,
                    arguments = listOf(navArgument("userId") { type = NavType.StringType }),
                ) {
                    ProfileScreen(
                        onOpenSettings = { navController.navigate(Dest.Settings.route) },
                        onOpenPost = { post: Post -> navController.navigate(Dest.PostDetail.of(post.ownerId, post.postId)) },
                        onOpenUser = { userId -> navController.navigate(Dest.Profile.of(userId.toString())) },
                    )
                }

                composable(Dest.Messages.route) {
                    MessagesScreen(onOpenChat = { conversation: Conversation ->
                        navController.navigate(Dest.Chat.of(conversation.peerId, conversation.title))
                    })
                }

                composable(
                    Dest.Chat.route,
                    arguments = listOf(navArgument("peerId") { type = NavType.LongType }, navArgument("title") { type = NavType.StringType }),
                ) {
                    ChatScreen(onBack = { navController.popBackStack() })
                }

                composable(Dest.Communities.route) {
                    CommunitiesScreen(onOpenCommunity = { community: Community -> navController.navigate(Dest.CommunityDetail.of(community.id)) })
                }

                composable(
                    Dest.CommunityDetail.route,
                    arguments = listOf(navArgument("groupId") { type = NavType.LongType }),
                ) {
                    CommunityDetailScreen(onBack = { navController.popBackStack() })
                }

                composable(Dest.Search.route) {
                    SearchScreen(
                        onBack = { navController.popBackStack() },
                        onOpenUser = { userId -> navController.navigate(Dest.Profile.of(userId.toString())) },
                        onOpenCommunity = { community -> navController.navigate(Dest.CommunityDetail.of(community.id)) },
                    )
                }

                composable(Dest.Notifications.route) {
                    NotificationsScreen(onBack = { navController.popBackStack() })
                }

                composable(Dest.Music.route) {
                    com.qvk.app.feature.music.presentation.MusicScreen()
                }

                composable(Dest.Video.route) {
                    VideoScreen(onOpenVideo = { video: Attachment.Video -> navController.navigate(Dest.VideoPlayer.of(video.directUrl, video.title)) })
                }

                composable(
                    Dest.VideoPlayer.route,
                    arguments = listOf(
                        navArgument("url") { type = NavType.StringType; nullable = false; defaultValue = "" },
                        navArgument("title") { type = NavType.StringType; defaultValue = "" },
                    ),
                ) { entry ->
                    val url = entry.arguments?.getString("url")
                    val title = entry.arguments?.getString("title").orEmpty()
                    VideoPlayerScreen(videoUrl = url?.ifBlank { null }, title = title, onBack = { navController.popBackStack() })
                }

                composable(Dest.Settings.route) {
                    SettingsScreen(
                        onBack = { navController.popBackStack() },
                        onOpenAccounts = { navController.navigate(Dest.AccountSwitcher.route) },
                        onLoggedOut = {
                            navController.navigate(Dest.Login.route) { popUpTo(0) { inclusive = true } }
                        },
                    )
                }

                composable(Dest.AccountSwitcher.route) {
                    AccountSwitcherScreen(
                        onAddAccount = { navController.navigate(Dest.Login.route) },
                        onDone = { navController.popBackStack() },
                    )
                }
            }
        }
    }
}
