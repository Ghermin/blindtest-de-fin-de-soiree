package fr.blindtest.app

import android.app.Activity
import android.content.res.Configuration
import androidx.core.view.WindowInsetsControllerCompat

object Theming {
    fun isNight(activity: Activity): Boolean =
        (activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    fun apply(activity: Activity) {
        val light = !isNight(activity)
        val controller = WindowInsetsControllerCompat(activity.window, activity.window.decorView)
        controller.isAppearanceLightStatusBars = light
        controller.isAppearanceLightNavigationBars = light
    }
}
