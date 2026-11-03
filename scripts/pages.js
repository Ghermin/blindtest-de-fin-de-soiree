const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/config.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs');
const SITE = path.join(ROOT, 'site');

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

// La page GitHub a son propre gabarit (site/), aux couleurs du Bored Dev Playground ;
// public/install.html reste la page servie par l'appli.
fs.mkdirSync(OUT, { recursive: true });
for (const stale of ['install.js', 'style.css']) fs.rmSync(path.join(OUT, stale), { force: true });
const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8')
    .replaceAll('{{APK_URL}}', escapeHtml(config.apkUrl))
    .replaceAll('{{REPO}}', escapeHtml(config.repo));
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.copyFileSync(path.join(SITE, 'playground.css'), path.join(OUT, 'playground.css'));
for (const name of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'shortcut-icon.png']) {
    fs.copyFileSync(path.join(ROOT, 'public', name), path.join(OUT, name));
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`docs/ généré pour ${config.pagesUrl}`);
