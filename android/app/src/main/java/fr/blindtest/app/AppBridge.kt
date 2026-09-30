package fr.blindtest.app

import android.content.Intent
import android.content.res.Configuration
import android.webkit.JavascriptInterface

class AppBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun version(): String = AppUpdater.currentVersion(activity).second

    @JavascriptInterface
    fun tvUrl(): String = "${NodeService.lanUrl()}/r/${Settings.ROOM}/tv"

    @JavascriptInterface
    fun theme(): String {
        val night = activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        return if (night == Configuration.UI_MODE_NIGHT_YES) "dark" else "light"
    }

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
