const fs = require('node:fs');
const path = require('node:path');
const qr = require('../src/qr.js');
const install = require('../src/install.js');
const config = require('../src/config.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs');

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

fs.mkdirSync(OUT, { recursive: true });
const template = fs.readFileSync(path.join(ROOT, 'public', 'install.html'), 'utf8');
const html = template
    .replace('{{QR}}', qr.svg(config.pagesUrl))
    .replace('{{URL}}', escapeHtml(config.pagesUrl))
    .replace('{{COMMAND}}', escapeHtml(install.command()))
    .replace('{{TOKEN_NOTE}}', 'Le code du jeu est public : rien à saisir d’autre, et les mises à jour se font toutes seules à chaque lancement.')
    .replace('{{BACK}}', escapeHtml(config.repo))
    .replace('{{BACK_LABEL}}', 'Voir le code sur GitHub');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const name of ['style.css', 'install.js', 'favicon.svg', 'shortcut-icon.png']) {
    fs.copyFileSync(path.join(ROOT, 'public', name), path.join(OUT, name));
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`docs/ généré pour ${config.pagesUrl}`);
