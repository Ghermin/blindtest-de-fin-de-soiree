const matching = require('./matching.js');

const JAPANESE = /[ぁ-ゖァ-ヺ一-鿿]/;

let cache = null;

function table() {
    if (!cache) {
        let loaded;
        try {
            loaded = require('./romaji.json');
        } catch (_missing) {
            loaded = {};
        }
        cache = { artists: loaded.artists || {}, titles: loaded.titles || {} };
    }
    return cache;
}

function japanese(text) {
    return JAPANESE.test(String(text || ''));
}

function latin(kind, name) {
    if (!japanese(name)) return [];
    const found = table()[kind][matching.normalize(name)];
    const list = Array.isArray(found) ? found : [found];
    return list.filter((value) => value && !japanese(value));
}

function artist(name) {
    return latin('artists', name)[0] || '';
}

function title(name) {
    return latin('titles', name)[0] || '';
}

function artists(list) {
    const names = (list || []).filter(Boolean);
    if (!names.length || names.some((name) => !japanese(name))) return names;
    const found = [];
    for (const name of names) {
        const readable = artist(name);
        if (readable && !found.includes(readable)) found.push(readable);
    }
    return found.length ? [...found, ...names] : names;
}

function titles(name) {
    return [...latin('titles', name), name];
}

module.exports = { artist, title, artists, titles, japanese };
