const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const icons = require('../src/icons.js');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const sprite = read('public/icons.svg');
const available = new Set([...sprite.matchAll(/<symbol id="i-([a-z0-9-]+)"/g)].map((match) => match[1]));

function literals(source) {
    return [...source.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]);
}

function pictos(text) {
    return [...text].filter((char) => {
        const code = char.codePointAt(0);
        return (code >= 0x2190 && code <= 0x21ff) || (code >= 0x2300 && code <= 0x23ff) || (code >= 0x25a0 && code <= 0x25ff)
            || (code >= 0x2600 && code <= 0x27bf) || (code >= 0x2b00 && code <= 0x2bff) || (code >= 0x1f000 && code <= 0x1faff);
    });
}

test('le sprite remplace le marqueur des pages', () => {
    const html = icons.inject('<body><!--ICONS--><p>x</p></body>');
    assert.ok(html.includes('<symbol id="i-play"'));
    assert.ok(!html.includes('<!--ICONS-->'));
    assert.match(icons.markup('play'), /<use href="#i-play" xlink:href="#i-play">/);
});

test('les icônes des pages existent dans le sprite', () => {
    for (const file of ['public/index.html', 'public/tv.html', 'public/install.html']) {
        const html = read(file);
        assert.ok(html.includes('<!--ICONS-->'), `${file} sans marqueur`);
        for (const [, name] of html.matchAll(/href="#i-([a-z0-9-]+)"/g)) assert.ok(available.has(name), `${file} : ${name}`);
    }
});

test('les icônes demandées par les scripts existent dans le sprite', () => {
    for (const file of ['public/ui.js', 'public/app.js', 'public/tv.js', 'index.js', 'scripts/pages.js']) {
        const source = read(file);
        const wanted = [];
        for (const [, first] of source.matchAll(/\bicon\(([^(),]*)[,)]/g)) wanted.push(...literals(first));
        for (const [, name] of source.matchAll(/\blabel\([^,]+, ([^,]+),/g)) wanted.push(...literals(name));
        for (const [, name] of source.matchAll(/icon: '([a-z0-9-]+)'/g)) wanted.push(name);
        for (const [, name] of source.matchAll(/markup\('([a-z0-9-]+)'\)/g)) wanted.push(name);
        assert.ok(wanted.length > 0, `${file} : aucune icône trouvée`);
        for (const name of wanted) assert.ok(available.has(name), `${file} : ${name}`);
    }
});

test('plus aucun émoji dans le front', () => {
    for (const file of ['public/index.html', 'public/tv.html', 'public/install.html', 'public/ui.js', 'public/app.js', 'public/tv.js']) {
        assert.deepStrictEqual(pictos(read(file)), [], file);
    }
});
