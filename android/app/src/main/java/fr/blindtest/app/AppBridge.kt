package fr.blindtest.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.webkit.JavascriptInterface

class AppBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun version(): String = AppUpdater.currentVersion(activity).second

    @JavascriptInterface
    fun tvUrl(): String = "${NodeService.lanUrl()}/r/${Settings.ROOM}/tv"

    @JavascriptInterface
    fun theme(): String = if (Theming.isNight(activity)) "dark" else "light"

    @JavascriptInterface
    fun copy(text: String): Boolean {
        activity.runOnUiThread {
            val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("Blind Test", text))
        }
        return true
    }

    @JavascriptInterface
    fun checkUpdate() {
        activity.runOnUiThread { activity.checkForUpdate(true) }
    }

    @JavascriptInterface
    fun quit() {
        activity.runOnUiThread { activity.quit() }
    }
}
