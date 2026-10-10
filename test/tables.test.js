const test = require('node:test');
const assert = require('node:assert');
const { key } = require('../src/works.js');
const { japanese } = require('../src/romaji.js');
const works = require('../src/works.json');
const romaji = require('../src/romaji.json');

function unreachable(names) {
    return names.filter((name) => key(name) !== name);
}

test('toutes les clés de works.json sont atteignables par le jeu', () => {
    const broken = unreachable(Object.keys(works));
    assert.deepStrictEqual(broken, [], `${broken.length} clé(s) que key() ne produira jamais : régénère la table (npm run works)`);
});

test('toutes les clés de romaji.json sont atteignables par le jeu', () => {
    for (const part of ['artists', 'titles']) {
        const broken = unreachable(Object.keys(romaji[part]));
        assert.deepStrictEqual(broken, [], `romaji.${part} : ${broken.length} clé(s) inatteignable(s)`);
    }
});

test('les tables de romanisation vont bien du japonais vers les lettres romaines', () => {
    for (const part of ['artists', 'titles']) {
        for (const [name, value] of Object.entries(romaji[part])) {
            assert.ok(japanese(name), `romaji.${part} : la clé « ${name} » n'est pas japonaise`);
            const spellings = Array.isArray(value) ? value : [value];
            assert.ok(spellings.length, `romaji.${part} : « ${name} » ne renvoie rien`);
            for (const readable of spellings) {
                assert.ok(!japanese(readable), `romaji.${part} : « ${name} » renvoie « ${readable} », encore en japonais`);
            }
        }
    }
});

test('aucun texte n\'a été coupé en route', () => {
    const broken = [];
    for (const [name, entries] of Object.entries(works)) {
        if (name.includes('�')) broken.push(name);
        for (const [performer, value] of entries) {
            if (performer.includes('�') || value.includes('�')) broken.push(`${name} → ${value}`);
        }
    }
    for (const part of ['artists', 'titles']) {
        for (const [name, value] of Object.entries(romaji[part])) {
            const spellings = [name, ...(Array.isArray(value) ? value : [value])];
            if (spellings.some((text) => text.includes('�'))) broken.push(`${part} : ${name}`);
        }
    }
    assert.deepStrictEqual(broken.slice(0, 10), [], `${broken.length} entrée(s) corrompue(s) : lecture HTTP coupée au milieu d'un caractère`);
});

test('les tables gardent leur forme et leur volume', () => {
    assert.ok(Object.keys(works).length > 5000, 'works.json a fondu');
    assert.ok(Object.keys(romaji.artists).length > 5000, 'romaji.artists a fondu');
    assert.ok(Object.keys(romaji.titles).length > 500, 'romaji.titles a fondu');
    for (const [name, entries] of Object.entries(works)) {
        assert.ok(Array.isArray(entries) && entries.length, `${name} : entrée vide`);
        for (const entry of entries) {
            assert.strictEqual(entry.length, 2, `${name} : entrée mal formée`);
            assert.ok(entry[0], `${name} : entrée sans interprète`);
        }
    }
});
