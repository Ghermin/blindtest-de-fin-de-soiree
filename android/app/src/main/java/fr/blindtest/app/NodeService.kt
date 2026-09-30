package fr.blindtest.app

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.URL
import kotlin.system.exitProcess

class NodeService : Service() {
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForeground(true)
            stopSelf()
            exitProcess(0)
        }
        startForeground(NOTIFICATION_ID, notification(getString(R.string.notification_starting)))
        acquireLocks()
        if (!NodeRuntime.started) {
            NodeRuntime.started = true
            val thread = Thread(null, { runNode() }, "blindtest-node", 16L shl 20)
            thread.start()
        }
        return START_STICKY
    }

    private fun runNode() {
        val settings = Settings(this)
        try {
            status = getString(R.string.status_preparing)
            Updater.ensureProject(this, settings)
            Updater.tryUpdate(this, settings) { message -> status = message }
        } catch (error: Exception) {
            Log.w(TAG, "Préparation du projet : ${error.message}")
        }
        val project = Updater.projectDir(this)
        val env = linkedMapOf(
            "HOME" to filesDir.absolutePath,
            "TMPDIR" to cacheDir.absolutePath,
            "BLINDTEST_PORT" to Settings.PORT.toString(),
            "BLINDTEST_HOST" to "0.0.0.0",
            "BLINDTEST_HOME_ROOM" to Settings.ROOM,
            "BLINDTEST_HOST_PIN" to settings.pinOrRandom(),
            "BLINDTEST_DATA_DIR" to Updater.dataDir(this).absolutePath,
            "SPOTIFY_CLIENT_ID" to settings.spotifyClientId,
            "SPOTIFY_CLIENT_SECRET" to settings.spotifyClientSecret
        )
        status = getString(R.string.status_starting)
        Thread { waitForServer() }.start()
        val code = NodeRuntime.startNode(
            arrayOf("node", "${project.absolutePath}/index.js"),
            env.keys.toTypedArray(),
            env.values.toTypedArray()
        )
        Log.w(TAG, "Node s'est arrêté avec le code $code")
        status = getString(R.string.status_stopped)
        stopForeground(true)
        stopSelf()
    }

    private fun waitForServer() {
        for (attempt in 0 until 120) {
            try {
                val connection = URL("http://127.0.0.1:${Settings.PORT}/api/health").openConnection() as HttpURLConnection
                connection.connectTimeout = 1000
                connection.readTimeout = 1000
                if (connection.responseCode == 200) {
                    ready = true
                    status = getString(R.string.status_ready)
                    val manager = getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager
                    manager.notify(NOTIFICATION_ID, notification(getString(R.string.notification_running, lanUrl())))
                    return
                }
            } catch (ignored: Exception) {
            }
            Thread.sleep(500)
        }
    }

    private fun acquireLocks() {
        if (wakeLock == null) {
            val power = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "blindtest:server").apply { acquire() }
        }
        if (wifiLock == null) {
            val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) WifiManager.WIFI_MODE_FULL_LOW_LATENCY else WifiManager.WIFI_MODE_FULL_HIGH_PERF
            wifiLock = wifi.createWifiLock(mode, "blindtest:wifi").apply { acquire() }
        }
    }

    private fun notification(text: String): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, NodeService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, BlindTestApp.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_note)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(0, getString(R.string.action_stop), stop)
            .build()
    }

    override fun onDestroy() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wifiLock?.let { if (it.isHeld) it.release() }
        super.onDestroy()
    }

    companion object {
        private const val TAG = "BlindTestService"
        const val ACTION_STOP = "fr.blindtest.app.STOP"
        const val NOTIFICATION_ID = 1

        @Volatile
        var status: String = ""

        @Volatile
        var ready: Boolean = false

        fun lanUrl(): String {
            return try {
                val interfaces = NetworkInterface.getNetworkInterfaces().toList()
                val preferred = interfaces.filter { it.isUp && !it.isLoopback }
                    .sortedBy { iface -> if (iface.name.startsWith("ap") || iface.name.startsWith("swlan") || iface.name.startsWith("wlan")) 0 else 1 }
                for (iface in preferred) {
                    for (address in iface.inetAddresses) {
                        if (address is Inet4Address && !address.isLoopbackAddress) return "http://${address.hostAddress}:${Settings.PORT}"
                    }
                }
                "http://localhost:${Settings.PORT}"
            } catch (ignored: Exception) {
                "http://localhost:${Settings.PORT}"
            }
        }
    }
}
