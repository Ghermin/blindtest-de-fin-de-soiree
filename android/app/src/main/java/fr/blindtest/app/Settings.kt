package fr.blindtest.app

import android.content.Context
import kotlin.random.Random

class Settings(context: Context) {
    private val prefs = context.getSharedPreferences("blindtest", Context.MODE_PRIVATE)

    init {
        if (prefs.contains("spotifyClientId") || prefs.contains("spotifyClientSecret")) prefs.edit().remove("spotifyClientId").remove("spotifyClientSecret").apply()
    }

    var configured: Boolean
        get() = prefs.getBoolean("configured", false)
        set(value) = prefs.edit().putBoolean("configured", value).apply()

    var hostPin: String
        get() = prefs.getString("hostPin", "") ?: ""
        set(value) = prefs.edit().putString("hostPin", value).apply()

    var lastCommit: String
        get() = prefs.getString("lastCommit", "") ?: ""
        set(value) = prefs.edit().putString("lastCommit", value).apply()

    var bundledStamp: Long
        get() = prefs.getLong("bundledStamp", 0)
        set(value) = prefs.edit().putLong("bundledStamp", value).apply()

    var batteryAsked: Boolean
        get() = prefs.getBoolean("batteryAsked", false)
        set(value) = prefs.edit().putBoolean("batteryAsked", value).apply()

    fun pinOrRandom(): String {
        if (hostPin.isBlank()) hostPin = (1000 + Random.nextInt(9000)).toString()
        return hostPin
    }

    companion object {
        const val PORT = 3000
        const val ROOM = "MAISON"
    }
}
