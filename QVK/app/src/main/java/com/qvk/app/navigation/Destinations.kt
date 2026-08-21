package com.qvk.app.navigation

/** Every navigable route in QVK. Args are encoded directly in the route string (Nav Compose style). */
sealed class Dest(val route: String) {
    data object Splash : Dest("splash")
    data object Login : Dest("login")

    data object Feed : Dest("feed")
    data object PostDetail : Dest("post/{ownerId}/{postId}") {
        fun of(ownerId: Long, postId: Long) = "post/$ownerId/$postId"
    }

    data object Profile : Dest("profile/{userId}") {
        const val ME = "me"
        fun of(userId: String = ME) = "profile/$userId"
    }

    data object Messages : Dest("messages")
    data object Chat : Dest("chat/{peerId}/{title}") {
        fun of(peerId: Long, title: String) = "chat/$peerId/${android.net.Uri.encode(title)}"
    }

    data object Communities : Dest("communities")
    data object CommunityDetail : Dest("community/{groupId}") {
        fun of(groupId: Long) = "community/$groupId"
    }

    data object Search : Dest("search")
    data object Notifications : Dest("notifications")
    data object Music : Dest("music")
    data object Video : Dest("video")
    data object VideoPlayer : Dest("video_player?url={url}&title={title}") {
        fun of(url: String?, title: String) =
            "video_player?url=${android.net.Uri.encode(url ?: "")}&title=${android.net.Uri.encode(title)}"
    }
    data object Settings : Dest("settings")
    data object AccountSwitcher : Dest("accounts")
}

/** The five primary destinations shown in QVK's bottom navigation bar. */
enum class TopLevelDest(val dest: Dest) {
    FEED(Dest.Feed),
    MESSAGES(Dest.Messages),
    VIDEO(Dest.Video),
    COMMUNITIES(Dest.Communities),
    PROFILE(Dest.Profile),
}
