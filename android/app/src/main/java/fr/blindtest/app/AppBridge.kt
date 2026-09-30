package fr.blindtest.app

import android.content.Intent
import android.webkit.JavascriptInterface

class AppBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun version(): String = AppUpdater.currentVersion(activity).second

    @JavascriptInterface
    fun tvUrl(): String = "${NodeService.lanUrl()}/r/${Settings.ROOM}/tv"

    @JavascriptInterface
    fun checkUpdate() {
        activity.runOnUiThread { activity.checkForUpdate(true) }
    }

    @JavascriptInterface
    fun openSettings() {
        activity.runOnUiThread { activity.startActivity(Intent(activity, SetupActivity::class.java)) }
    }

    @JavascriptInterface
    fun quit() {
        activity.runOnUiThread { activity.quit() }
    }
}
