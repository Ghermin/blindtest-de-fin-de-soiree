package fr.blindtest.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlin.system.exitProcess

class SetupActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)
        Theming.apply(this)
        val settings = Settings(this)
        val pin = findViewById<EditText>(R.id.pin)
        val clientId = findViewById<EditText>(R.id.spotify_id)
        val clientSecret = findViewById<EditText>(R.id.spotify_secret)
        val save = findViewById<Button>(R.id.save)
        val cancel = findViewById<Button>(R.id.cancel)
        val dashboard = findViewById<Button>(R.id.spotify_dashboard)
        val redirect = findViewById<TextView>(R.id.spotify_redirect)
        val dashboardUrl = getString(R.string.spotify_dashboard_url)
        dashboard.setOnClickListener {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(dashboardUrl)))
            } catch (ignored: Exception) {
                Toast.makeText(this, getString(R.string.spotify_dashboard_failed, dashboardUrl), Toast.LENGTH_LONG).show()
            }
        }
        redirect.text = getString(R.string.spotify_redirect, Settings.SPOTIFY_REDIRECT_URI)
        redirect.setOnClickListener {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("redirect", Settings.SPOTIFY_REDIRECT_URI))
            Toast.makeText(this, R.string.spotify_redirect_copied, Toast.LENGTH_SHORT).show()
        }
        pin.setText(settings.pinOrRandom())
        clientId.setText(settings.spotifyClientId)
        clientSecret.setText(settings.spotifyClientSecret)
        cancel.visibility = if (settings.configured) View.VISIBLE else View.GONE
        if (settings.configured) {
            findViewById<TextView>(R.id.setup_title).setText(R.string.settings_title)
            save.setText(R.string.save_settings)
        }
        cancel.setOnClickListener { finish() }
        save.setOnClickListener {
            val code = pin.text.toString().trim()
            if (code.length < 4 || code.length > 8 || !code.all { it.isDigit() }) {
                pin.error = getString(R.string.pin_error)
                return@setOnClickListener
            }
            val changed = settings.configured && (code != settings.hostPin
                || clientId.text.toString().trim() != settings.spotifyClientId
                || clientSecret.text.toString().trim() != settings.spotifyClientSecret)
            settings.hostPin = code
            settings.spotifyClientId = clientId.text.toString().trim()
            settings.spotifyClientSecret = clientSecret.text.toString().trim()
            settings.configured = true
            if (changed && NodeRuntime.started) {
                Toast.makeText(this, R.string.restart_needed, Toast.LENGTH_LONG).show()
                startService(Intent(this, NodeService::class.java).setAction(NodeService.ACTION_STOP))
                finishAffinity()
                window.decorView.postDelayed({ exitProcess(0) }, 800)
                return@setOnClickListener
            }
            startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP))
            finish()
        }
    }
}
