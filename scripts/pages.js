const fs = require('node:fs');
const path = require('node:path');
const qr = require('../src/qr.js');
const config = require('../src/config.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs');

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const stale of ['install.js']) fs.rmSync(path.join(OUT, stale), { force: true });
const template = fs.readFileSync(path.join(ROOT, 'public', 'install.html'), 'utf8');
const html = template
    .replace('{{QR}}', qr.svg(config.pagesUrl))
    .replace('{{URL}}', escapeHtml(config.pagesUrl))
    .replace('{{APK_URL}}', escapeHtml(config.apkUrl))
    .replace('{{BACK}}', escapeHtml(config.repo))
    .replace('{{BACK_LABEL}}', 'Voir le code sur GitHub');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const name of ['style.css', 'favicon.svg', 'shortcut-icon.png']) {
    fs.copyFileSync(path.join(ROOT, 'public', name), path.join(OUT, name));
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`docs/ généré pour ${config.pagesUrl}`);
