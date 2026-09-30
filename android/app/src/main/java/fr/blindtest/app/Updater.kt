package fr.blindtest.app

import android.content.Context
import android.content.res.AssetManager
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream

object Updater {
    private const val TAG = "BlindTestUpdater"
    private const val REPO = "Ghermin/blindtest-de-fin-de-soiree"
    private const val BRANCH = "main"
    private const val ZIP_URL = "https://codeload.github.com/$REPO/zip/refs/heads/$BRANCH"
    private const val COMMIT_URL = "https://api.github.com/repos/$REPO/commits/$BRANCH"
    private val SKIPPED = listOf("android/", ".github/", "docs/", "test/")

    fun projectDir(context: Context): File = File(context.filesDir, "project")

    fun dataDir(context: Context): File = File(context.filesDir, "data").apply { mkdirs() }

    fun ensureProject(context: Context, settings: Settings) {
        val dir = projectDir(context)
        val stamp = packageStamp(context)
        if (dir.exists() && File(dir, "index.js").exists() && settings.bundledStamp == stamp) return
        Log.i(TAG, "Copie du projet embarqué dans ${dir.absolutePath}")
        dir.deleteRecursively()
        copyAssetFolder(context.assets, "nodejs-project", dir)
        settings.bundledStamp = stamp
        settings.lastCommit = ""
    }

    fun tryUpdate(context: Context, settings: Settings, status: (String) -> Unit): Boolean {
        return try {
            status("Recherche de mise à jour…")
            val sha = latestCommit()
            if (sha.isEmpty()) return false
            if (sha == settings.lastCommit && File(projectDir(context), "index.js").exists()) {
                Log.i(TAG, "Déjà à jour ($sha)")
                return false
            }
            status("Mise à jour du jeu…")
            val fresh = File(context.cacheDir, "project-update")
            fresh.deleteRecursively()
            fresh.mkdirs()
            downloadAndExtract(fresh)
            if (!File(fresh, "index.js").exists()) throw IllegalStateException("archive sans index.js")
            val dir = projectDir(context)
            val old = File(context.cacheDir, "project-old")
            old.deleteRecursively()
            if (dir.exists() && !dir.renameTo(old)) dir.deleteRecursively()
            if (!fresh.renameTo(dir)) {
                fresh.copyRecursively(dir, overwrite = true)
                fresh.deleteRecursively()
            }
            old.deleteRecursively()
            settings.lastCommit = sha
            Log.i(TAG, "Mise à jour appliquée (${sha.take(7)})")
            true
        } catch (error: Exception) {
            Log.w(TAG, "Pas de mise à jour : ${error.message}")
            false
        }
    }

    private fun latestCommit(): String {
        val connection = open(COMMIT_URL, "application/vnd.github+json")
        connection.inputStream.bufferedReader().use { reader ->
            val body = reader.readText()
            val match = Regex("\"sha\"\\s*:\\s*\"([0-9a-f]{40})\"").find(body)
            return match?.groupValues?.get(1) ?: ""
        }
    }

    private fun downloadAndExtract(target: File) {
        val connection = open(ZIP_URL)
        ZipInputStream(connection.inputStream.buffered()).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                val name = entry.name
                val relative = name.substringAfter('/', "")
                val skip = relative.isEmpty() || SKIPPED.any { relative.startsWith(it) } || relative.contains("..")
                if (!skip) {
                    val file = File(target, relative)
                    if (entry.isDirectory) {
                        file.mkdirs()
                    } else {
                        file.parentFile?.mkdirs()
                        FileOutputStream(file).use { out -> zip.copyTo(out) }
                    }
                }
                zip.closeEntry()
                entry = zip.nextEntry
            }
        }
    }

    private fun open(url: String, accept: String? = null): HttpURLConnection {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 8000
        connection.readTimeout = 30000
        connection.instanceFollowRedirects = true
        connection.setRequestProperty("User-Agent", "blindtest-android")
        if (accept != null) connection.setRequestProperty("Accept", accept)
        if (connection.responseCode >= 400) throw IllegalStateException("HTTP ${connection.responseCode} sur $url")
        return connection
    }

    private fun packageStamp(context: Context): Long {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).lastUpdateTime
        } catch (error: Exception) {
            1L
        }
    }

    private fun copyAssetFolder(assets: AssetManager, from: String, to: File) {
        val children = assets.list(from) ?: emptyArray()
        if (children.isEmpty()) {
            to.parentFile?.mkdirs()
            assets.open(from).use { input -> FileOutputStream(to).use { output -> input.copyTo(output) } }
            return
        }
        to.mkdirs()
        for (child in children) copyAssetFolder(assets, "$from/$child", File(to, child))
    }
}
