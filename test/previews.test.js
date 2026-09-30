const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.BLINDTEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'blindtest-previews-'));
fs.writeFileSync(path.join(process.env.BLINDTEST_DATA_DIR, 'previews.json'), JSON.stringify({ 'spotify:track:ancien': { source: 'deezer', id: 9, checkedAt: 1 } }));

const test = require('node:test');
const assert = require('node:assert');
const deezer = require('../src/deezer.js');
const { pick, score, query, resolve } = require('../src/previews.js');
const { parseLink } = require('../src/sources.js');

const stromae = { uri: 'spotify:track:s', name: 'Alors on danse', artists: ['Stromae'], durationMs: 205000 };
const candidates = [
    { id: 1, title: 'Alors on danse (Radio Edit)', artist: 'Stromae', durationMs: 208000, url: 'https://x/1.mp3' },
    { id: 2, title: 'Alors On Danse (feat. Stromae)', artist: 'Dubdogz', durationMs: 168000, url: 'https://x/2.mp3' },
    { id: 3, title: 'Alors On Danse', artist: 'Stromae', durationMs: 214000, url: 'https://x/3.mp3' },
    { id: 4, title: 'Alors on danse (Live)', artist: 'Stromae', durationMs: 205000, url: 'https://x/4.mp3' },
    { id: 5, title: 'Alors on danse', artist: 'Stromae', durationMs: 205000, url: '' }
];

test('la version studio du bon artiste est préférée aux edits, lives et reprises', () => {
    assert.strictEqual(pick(stromae, candidates).id, 3);
});

test('un remaster Spotify retrouve la version originale', () => {
    const queen = { uri: 'q', name: 'Bohemian Rhapsody - Remastered 2011', artists: ['Queen'], durationMs: 354000 };
    const list = [
        { id: 10, title: 'Bohemian Rhapsody (Live Aid)', artist: 'Queen', durationMs: 147000, url: 'https://x/10.mp3' },
        { id: 11, title: 'Bohemian Rhapsody', artist: 'Queen', durationMs: 355000, url: 'https://x/11.mp3' },
        { id: 12, title: 'Bohemian Rhapsody', artist: 'The Karaoke Crew', durationMs: 355000, url: 'https://x/12.mp3' }
    ];
    assert.strictEqual(pick(queen, list).id, 11);
});

test('sans le bon artiste ou sans extrait, rien n\'est retenu', () => {
    const track = { uri: 't', name: 'Roar', artists: ['Katy Perry'], durationMs: 224000 };
    assert.strictEqual(pick(track, [{ id: 1, title: 'Roar', artist: 'Someone Else', durationMs: 224000, url: 'https://x/1.mp3' }]), null);
    assert.strictEqual(pick(track, [{ id: 2, title: 'Roar', artist: 'Katy Perry', durationMs: 224000, url: '' }]), null);
    assert.ok(score(track, { id: 3, title: 'Roar', artist: 'Katy Perry', durationMs: 224000, url: 'https://x/3.mp3' }) >= 7);
});

test('la requête de recherche combine artiste et titre nettoyé', () => {
    assert.strictEqual(query({ name: 'Get Lucky (feat. Pharrell Williams) - Radio Edit', artists: ['Daft Punk', 'Pharrell Williams'] }), 'Daft Punk get lucky');
});

test('les liens de playlist Spotify et Deezer sont reconnus', () => {
    assert.deepStrictEqual(parseLink('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc'), { source: 'spotify', id: '37i9dQZF1DXcBWIGoYBM5M' });
    assert.deepStrictEqual(parseLink('https://open.spotify.com/intl-fr/playlist/37i9dQZF1DXcBWIGoYBM5M'), { source: 'spotify', id: '37i9dQZF1DXcBWIGoYBM5M' });
    assert.deepStrictEqual(parseLink('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'), { source: 'spotify', id: '37i9dQZF1DXcBWIGoYBM5M' });
    assert.deepStrictEqual(parseLink('https://www.deezer.com/fr/playlist/1743878062'), { source: 'deezer', id: '1743878062' });
    assert.deepStrictEqual(parseLink('https://deezer.com/playlist/1743878062?utm=x'), { source: 'deezer', id: '1743878062' });
    assert.strictEqual(parseLink('n importe quoi'), null);
});

test('la pochette du titre vient de l\'extrait trouvé quand la playlist n\'en donne pas', async () => {
    deezer.search = async () => [{ id: 7, title: 'Alors on danse', artist: 'Stromae', durationMs: 205000, url: 'https://x/7.mp3', image: 'https://x/cover7.jpg' }];
    deezer.track = async (id) => ({ url: `https://x/${id}.mp3`, image: `https://x/cover${id}.jpg` });
    const base = { name: 'Alors on danse', artists: ['Stromae'], durationMs: 205000, image: null };
    assert.deepStrictEqual(await resolve({ ...base, uri: 'spotify:track:cherche' }), { source: 'deezer', id: 7, image: 'https://x/cover7.jpg' });
    const embedded = await resolve({ ...base, uri: 'spotify:track:embed', match: { source: 'spotify', url: 'https://p.scdn.co/2.mp3' } });
    assert.deepStrictEqual(embedded, { source: 'spotify', url: 'https://p.scdn.co/2.mp3', image: 'https://x/cover7.jpg' });
    const ancien = await resolve({ ...base, uri: 'spotify:track:ancien' });
    assert.deepStrictEqual(ancien, { source: 'deezer', id: 9, url: undefined, image: 'https://x/cover9.jpg' });
});

test('un titre qui a déjà sa pochette ne déclenche aucune recherche', async () => {
    deezer.search = async () => { throw new Error('recherche inattendue'); };
    deezer.track = async () => { throw new Error('appel inattendu'); };
    const own = await resolve({ uri: 'spotify:track:album', name: 'Roar', artists: ['Katy Perry'], durationMs: 224000, image: 'https://album/3.jpg', match: { source: 'spotify', url: 'https://p.scdn.co/3.mp3' } });
    assert.deepStrictEqual(own, { source: 'spotify', url: 'https://p.scdn.co/3.mp3' });
});
