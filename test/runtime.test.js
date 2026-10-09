const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');
const FOLDERS = ['src', 'scripts', 'public'];

function sources() {
    const files = [];
    for (const folder of FOLDERS) {
        const dir = path.join(ROOT, folder);
        for (const name of fs.readdirSync(dir)) {
            if (name.endsWith('.js')) files.push(path.join(folder, name));
        }
    }
    files.push('index.js');
    return files;
}

test('le code évite les échappements Unicode refusés par le Node embarqué', () => {
    const guilty = sources().filter((file) => /\\p\{/.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));
    assert.deepStrictEqual(guilty, [], `\\p{…} n'est pas compilé par nodejs-mobile (ICU partielle) : ${guilty.join(', ')}`);
});

test('le code serveur se charge sur le Node de l\'appli', () => {
    for (const file of sources().filter((name) => name.startsWith('src') || name === 'index.js')) {
        if (file === 'index.js') continue;
        assert.doesNotThrow(() => require(path.join(ROOT, file)), `${file} ne se charge pas`);
    }
});
