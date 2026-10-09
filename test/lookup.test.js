const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.BLINDTEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'blindtest-lookup-'));

const test = require('node:test');
const assert = require('node:assert');
const deezer = require('../src/deezer.js');
const http = require('../src/http.js');
const { resolveWorks } = require('../src/previews.js');
const { work } = require('../src/works.js');

http.getJson = async () => ({ results: [] });

const CANDIDATES = {
    'Zabatron zoroastre': [
        { id: 1, title: 'Zoroastre', artist: 'Zabatron', album: 'Premier album' },
        { id: 2, title: 'Zoroastre - From THE FIRST TAKE', artist: 'Zabatron', album: 'Zoroastre - From THE FIRST TAKE' },
        { id: 3, title: 'Zoroastre (Orgel) [From Anime Kimetsu no Yaiba]', artist: 'TERAFRONT ORGEL', album: 'Orgel Collection' }
    ],
    'Musique De Film speed': [
        { id: 4, title: 'Speed', artist: 'Tokyo Crew', album: 'The Fast and the Furious: Tokyo Drift (Original Motion Picture Soundtrack)' }
    ],
    'Queen bohemian rhapsody': [
        { id: 5, title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera' }
    ]
};

test('la recherche déduit l\'œuvre d\'une reprise qui la cite', async () => {
    deezer.search = async (query) => CANDIDATES[query] || [];
    const tracks = [
        { uri: 'd:1', name: 'Zoroastre', artists: ['Zabatron'], album: 'Premier album' },
        { uri: 'd:2', name: 'Bohemian Rhapsody', artists: ['Queen'], album: 'A Night at the Opera' }
    ];
    const found = await resolveWorks(tracks);
    assert.strictEqual(found, 1);
    assert.strictEqual(work(tracks[0]), 'Kimetsu no Yaiba');
    assert.strictEqual(work(tracks[1]), '');
});

test('un titre connu de la table ne déclenche aucune recherche', async () => {
    let calls = 0;
    deezer.search = async () => {
        calls++;
        return [];
    };
    const tracks = [{ uri: 'd:7', name: 'Gurenge', artists: ['LiSA'], album: 'LEO-NiNE' }];
    await resolveWorks(tracks);
    assert.strictEqual(calls, 0);
    assert.strictEqual(work(tracks[0]), 'Demon Slayer: Kimetsu no Yaiba');
});

test('l\'album d\'un autre artiste ne sert pas de source', async () => {
    deezer.search = async (query) => CANDIDATES[query] || [];
    const tracks = [{ uri: 'd:3', name: 'Speed (Thème)', artists: ['Musique De Film'] }];
    await resolveWorks(tracks);
    assert.strictEqual(work(tracks[0]), '');
});

test('une recherche en échec ne casse pas la résolution', async () => {
    deezer.search = async () => {
        throw new Error('Deezer indisponible');
    };
    const tracks = [{ uri: 'd:4', name: 'Chanson introuvable', artists: ['Groupe inconnu'] }];
    assert.strictEqual(await resolveWorks(tracks), 0);
    assert.strictEqual(work(tracks[0]), '');
});

test('la recherche s\'arrête à la demande', async () => {
    let calls = 0;
    deezer.search = async () => {
        calls++;
        return [];
    };
    const tracks = [{ uri: 'd:5', name: 'Titre A', artists: ['X'] }, { uri: 'd:6', name: 'Titre B', artists: ['Y'] }];
    await resolveWorks(tracks, { cancelled: () => calls >= 1 });
    assert.strictEqual(calls, 1);
});

test('un « rien trouvé » d\'une version précédente est recherché à nouveau', async () => {
    const file = path.join(process.env.BLINDTEST_DATA_DIR, 'previews.json');
    const cache = JSON.parse(fs.readFileSync(file, 'utf8'));
    cache['d:8'] = { source: 'deezer', id: 9, work: '' };
    fs.writeFileSync(file, JSON.stringify(cache));
    delete require.cache[require.resolve('../src/previews.js')];
    const fresh = require('../src/previews.js');
    let calls = 0;
    deezer.search = async () => {
        calls++;
        return [{ id: 1, title: 'Zoroastre', artist: 'Cover Band', album: 'Kimetsu no Yaiba Original Soundtrack' }];
    };
    const tracks = [{ uri: 'd:8', name: 'Zoroastre', artists: ['Zabatron'] }];
    await fresh.resolveWorks(tracks);
    assert.strictEqual(calls, 1);
    assert.strictEqual(work(tracks[0]), '');
});
