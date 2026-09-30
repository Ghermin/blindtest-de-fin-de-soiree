package fr.blindtest.app

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import kotlin.system.exitProcess

class MainActivity : AppCompatActivity() {
    private lateinit var settings: Settings
    private lateinit var webView: WebView
    private lateinit var loading: View
    private lateinit var loadingText: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var loaded = false
    private val poller = object : Runnable {
        override fun run() {
            if (NodeService.ready) {
                if (!loaded) {
                    loaded = true
                    loading.visibility = View.GONE
                    webView.loadUrl(roomUrl())
                }
                return
            }
            loadingText.text = NodeService.status.ifEmpty { getString(R.string.status_starting) }
            handler.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = Settings(this)
        if (!settings.configured) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }
        setContentView(R.layout.activity_main)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        webView = findViewById(R.id.web)
        loading = findViewById(R.id.loading)
        loadingText = findViewById(R.id.loading_text)
        findViewById<View>(R.id.menu).setOnClickListener { showMenu() }
        configureWebView()
        startServer()
        askBatteryOnce()
        handler.post(poller)
        checkForUpdate(false)
    }

    fun checkForUpdate(manual: Boolean) {
        Thread {
            val current = AppUpdater.currentVersion(this)
            val release = try {
                AppUpdater.check()
            } catch (ignored: Exception) {
                null
            }
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                when {
                    release != null && release.versionCode > current.first -> proposeUpdate(release)
                    manual && release == null -> Toast.makeText(this, R.string.update_check_failed, Toast.LENGTH_LONG).show()
                    manual -> Toast.makeText(this, getString(R.string.update_none, current.second), Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun proposeUpdate(release: AppUpdater.Release) {
        AlertDialog.Builder(this)
            .setTitle(R.string.update_title)
            .setMessage(getString(R.string.update_message, release.versionName, AppUpdater.currentVersion(this).second))
            .setPositiveButton(R.string.update_install) { _, _ -> downloadAndInstall(release) }
            .setNegativeButton(R.string.update_later, null)
            .show()
    }

    private fun downloadAndInstall(release: AppUpdater.Release) {
        val progress = AlertDialog.Builder(this)
            .setMessage(getString(R.string.update_downloading, 0))
            .setCancelable(false)
            .create()
        progress.show()
        Thread {
            try {
                val file = AppUpdater.download(this, release) { percent ->
                    runOnUiThread { progress.setMessage(getString(R.string.update_downloading, percent)) }
                }
                runOnUiThread {
                    progress.dismiss()
                    AppUpdater.install(this, file)
                }
            } catch (error: Exception) {
                runOnUiThread {
                    progress.dismiss()
                    Toast.makeText(this, getString(R.string.update_failed, error.message ?: ""), Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun startServer() {
        val intent = Intent(this, NodeService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
    }

    private fun roomUrl(): String = "http://127.0.0.1:${Settings.PORT}/r/${Settings.ROOM}#host=${settings.pinOrRandom()}"

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val host = request.url.host ?: return false
                if (host == "127.0.0.1" || host == "localhost") return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    true
                } catch (ignored: Exception) {
                    false
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!request.isForMainFrame) return
                loaded = false
                loading.visibility = View.VISIBLE
                loadingText.text = getString(R.string.status_reconnecting)
                handler.removeCallbacks(poller)
                handler.postDelayed(poller, 1500)
            }
        }
        webView.addJavascriptInterface(AppBridge(this), "BlindTestApp")
        webView.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }

            override fun onJsPrompt(view: WebView, url: String, message: String, defaultValue: String?, result: JsPromptResult): Boolean {
                val input = EditText(this@MainActivity)
                input.setText(defaultValue ?: "")
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setView(input)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm(input.text.toString()) }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }
        }
    }

    private fun showMenu() {
        val items = arrayOf(
            "📺  " + getString(R.string.menu_tv),
            "🔄  " + getString(R.string.menu_reload),
            "⚙️  " + getString(R.string.menu_settings),
            "⬆️  " + getString(R.string.menu_update),
            "⏹  " + getString(R.string.menu_quit)
        )
        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.app_name)
            .setItems(items) { _, index ->
                when (index) {
                    0 -> showTvAddress()
                    1 -> webView.reload()
                    2 -> startActivity(Intent(this, SetupActivity::class.java))
                    3 -> checkForUpdate(true)
                    4 -> quit()
                }
            }
            .create()
        dialog.window?.let { window ->
            window.setGravity(Gravity.BOTTOM)
            window.setBackgroundDrawableResource(R.drawable.bg_sheet)
            window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        dialog.show()
    }

    private fun showTvAddress() {
        val base = NodeService.lanUrl()
        val message = getString(R.string.tv_message, base)
        AlertDialog.Builder(this)
            .setTitle(R.string.menu_tv)
            .setMessage(message)
            .setPositiveButton(R.string.copy) { _, _ ->
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Blind Test", "$base/r/${Settings.ROOM}/tv"))
                Toast.makeText(this, R.string.copied, Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton(android.R.string.ok, null)
            .show()
    }

    fun quit() {
        startService(Intent(this, NodeService::class.java).setAction(NodeService.ACTION_STOP))
        finishAffinity()
        handler.postDelayed({ exitProcess(0) }, 300)
    }

    private fun askBatteryOnce() {
        if (settings.batteryAsked || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        settings.batteryAsked = true
        val power = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (power.isIgnoringBatteryOptimizations(packageName)) return
        try {
            startActivity(Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        } catch (ignored: Exception) {
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else moveTaskToBack(true)
    }

    override fun onDestroy() {
        handler.removeCallbacks(poller)
        super.onDestroy()
    }
}
