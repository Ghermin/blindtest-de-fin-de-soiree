package fr.blindtest.app

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

object AppUpdater {
    data class Release(val versionCode: Int, val versionName: String, val apkUrl: String)

    private const val RELEASE_URL = "https://api.github.com/repos/Ghermin/blindtest-de-fin-de-soiree/releases/tags/apk"

    fun currentVersion(context: Context): Pair<Int, String> {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        @Suppress("DEPRECATION")
        val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode.toInt() else info.versionCode
        return Pair(code, info.versionName ?: "?")
    }

    fun check(): Release? {
        val release = JSONObject(read(RELEASE_URL, "application/vnd.github+json"))
        val assets = release.optJSONArray("assets") ?: return null
        var apkUrl = ""
        var versionUrl = ""
        for (index in 0 until assets.length()) {
            val asset = assets.getJSONObject(index)
            when (asset.optString("name")) {
                "blindtest.apk" -> apkUrl = asset.optString("browser_download_url")
                "version.json" -> versionUrl = asset.optString("browser_download_url")
            }
        }
        if (apkUrl.isEmpty() || versionUrl.isEmpty()) return null
        val version = JSONObject(read(versionUrl, "application/json"))
        return Release(version.optInt("versionCode", 0), version.optString("versionName", "?"), apkUrl)
    }

    fun download(context: Context, release: Release, onProgress: (Int) -> Unit): File {
        val dir = File(context.cacheDir, "updates").apply { mkdirs() }
        val file = File(dir, "blindtest.apk")
        val connection = open(release.apkUrl, null)
        val total = connection.contentLength.toLong()
        connection.inputStream.use { input ->
            FileOutputStream(file).use { output ->
                val buffer = ByteArray(64 * 1024)
                var done = 0L
                var read = input.read(buffer)
                while (read >= 0) {
                    output.write(buffer, 0, read)
                    done += read
                    if (total > 0) onProgress((done * 100 / total).toInt())
                    read = input.read(buffer)
                }
            }
        }
        return file
    }

    fun install(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, context.packageName + ".files", file)
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    private fun read(url: String, accept: String): String {
        return open(url, accept).inputStream.bufferedReader().use { reader -> reader.readText() }
    }

    private fun open(url: String, accept: String?): HttpURLConnection {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 8000
        connection.readTimeout = 60000
        connection.instanceFollowRedirects = true
        connection.setRequestProperty("User-Agent", "blindtest-android")
        if (accept != null) connection.setRequestProperty("Accept", accept)
        if (connection.responseCode >= 400) throw IllegalStateException("HTTP ${connection.responseCode}")
        return connection
    }
}
