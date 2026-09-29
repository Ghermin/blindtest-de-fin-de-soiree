const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../src/embed.js');

function page(entity) {
    const json = JSON.stringify({ props: { pageProps: { state: { data: { entity } } } } }).replace(/</g, '\\u003c');
    return `<html><body><script id="__NEXT_DATA__" type="application/json">${json}</script></body></html>`;
}

test('la page embed donne le nom, la pochette et les titres jouables avec leur extrait Spotify', () => {
    const html = page({
        type: 'playlist',
        name: 'Soirée <80>',
        coverArt: { sources: [{ url: 'https://i.scdn.co/image/cover' }] },
        trackList: [
            { uri: 'spotify:track:a', title: 'La Isla Bonita', subtitle: 'Madonna', duration: 242733, isPlayable: true, audioPreview: { url: 'https://p.scdn.co/mp3-preview/a' } },
            { uri: 'spotify:track:b', title: 'Duo', subtitle: 'SwuM, Casiio', duration: 138000, isPlayable: true, audioPreview: null },
            { uri: 'spotify:track:c', title: 'Trop court', subtitle: 'X', duration: 30000, isPlayable: true, audioPreview: { url: 'https://p.scdn.co/mp3-preview/c' } },
            { uri: 'spotify:track:d', title: 'Retiré', subtitle: 'Y', duration: 200000, isPlayable: false, audioPreview: null },
            { uri: 'spotify:episode:e', title: 'Podcast', subtitle: 'Z', duration: 200000, isPlayable: true, audioPreview: null }
        ]
    });
    const data = parse(html);
    assert.strictEqual(data.name, 'Soirée <80>');
    assert.strictEqual(data.image, 'https://i.scdn.co/image/cover');
    assert.deepStrictEqual(data.tracks.map((track) => track.uri), ['spotify:track:a', 'spotify:track:b']);
    assert.deepStrictEqual(data.tracks[0].match, { source: 'spotify', url: 'https://p.scdn.co/mp3-preview/a' });
    assert.deepStrictEqual(data.tracks[1].artists, ['SwuM', 'Casiio']);
    assert.strictEqual(data.tracks[1].match, null);
    assert.strictEqual(data.partial, false);
});

test('100 titres = liste tronquée par Spotify', () => {
    const trackList = Array.from({ length: 100 }, (_, index) => ({ uri: `spotify:track:${index}`, title: `T${index}`, subtitle: 'A', duration: 200000, isPlayable: true, audioPreview: { url: `https://p.scdn.co/${index}` } }));
    assert.strictEqual(parse(page({ type: 'playlist', name: 'Longue', trackList })).partial, true);
});

test('page 404, autre entité ou sans données = null', () => {
    assert.strictEqual(parse('<html><body>rien</body></html>'), null);
    assert.strictEqual(parse('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"status":404}}}</script>'), null);
    assert.strictEqual(parse(page({ type: 'album', name: 'X', trackList: [] })), null);
});
