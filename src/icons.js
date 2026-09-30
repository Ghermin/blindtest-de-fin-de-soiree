const fs = require('node:fs');
const path = require('node:path');

const sprite = fs.readFileSync(path.join(__dirname, '..', 'public', 'icons.svg'), 'utf8').trim();

function markup(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#i-${name}" xlink:href="#i-${name}"></use></svg>`;
}

function inject(html) {
    return html.replace('<!--ICONS-->', sprite);
}

module.exports = { markup, inject };
