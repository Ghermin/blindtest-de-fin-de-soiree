const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../src/game.js');

const TRACKS = [
    { uri: 'spotify:track:1', name: 'Bohemian Rhapsody - Remastered 2011', artists: ['Queen'], image: null, durationMs: 354000 },
    { uri: 'spotify:track:2', name: 'Billie Jean', artists: ['Michael Jackson'], image: null, durationMs: 294000 },
    { uri: 'spotify:track:3', name: 'Alors on danse', artists: ['Stromae'], image: null, durationMs: 206000 }
];

function fakeSources(overrides = {}) {
    return {
        loadPlaylist: async () => ({ id: 'p1', source: 'spotify', name: 'Test', image: null, tracks: TRACKS.map((track) => ({ ...track })) }),
        resolveAll: async (tracks, options) => {
            for (const track of tracks) {
                track.match = { source: 'test', id: track.uri };
                options.onProgress(track, track.match);
            }
        },
        freshUrl: async (match) => `https://extraits.test/${encodeURIComponent(match.id)}.mp3`,
        ...overrides
    };
}

function make(overrides) {
    const game = new Game({ sources: fakeSources(overrides), code: 'TEST', timings: { countdownMs: 20, revealMs: 30, guessMs: 300 } });
    game.log = () => {};
    return game;
}

function until(check, timeoutMs) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const poll = () => {
            if (check()) return resolve();
            if (Date.now() - started > timeoutMs) return reject(new Error('délai dépassé'));
            return setTimeout(poll, 10);
        };
        poll();
    });
}

test('les pseudos en doublon sont suffixés', () => {
    const game = make();
    assert.strictEqual(game.join('Tom').name, 'Tom');
    assert.strictEqual(game.join('tom').name, 'tom 2');
    assert.strictEqual(game.join('Tom').name, 'Tom 3');
    const lea = game.join('Léa');
    assert.strictEqual(game.join('Léa', lea.token).name, 'Léa');
    assert.strictEqual(game.join('Tom', lea.token).name, 'Tom 4');
});

test('les équipes sont agrégées dans l\'état public', () => {
    const game = make();
    const tom = game.join('Tom', undefined, 'Rouges');
    const lea = game.join('Léa', undefined, 'Rouges');
    game.join('Nico', undefined, 'Bleus');
    game.players.get(tom.token).score = 500;
    game.players.get(lea.token).score = 300;
    const { teams, players } = game.publicState();
    assert.deepStrictEqual(teams, [{ name: 'Rouges', score: 800, members: 2 }, { name: 'Bleus', score: 0, members: 1 }]);
    assert.strictEqual(players[0].team, 'Rouges');
});

test('la dernière réponse n\'est exposée qu\'à la révélation', () => {
    const game = make();
    const tom = game.join('Tom');
    game.track = TRACKS[0];
    game.phase = 'guess';
    game.guessStartedAt = Date.now();
    assert.strictEqual(game.guess(tom.token, 'céline dion').accepted, true);
    assert.strictEqual(game.publicState().players[0].lastGuess, undefined);
    game.phase = 'reveal';
    assert.strictEqual(game.publicState().players[0].lastGuess, 'céline dion');
});

test('les joueurs déconnectés ne bloquent pas la fin de manche', () => {
    const game = make();
    const tom = game.join('Tom');
    game.join('Léa');
    game.connect(tom.token);
    game.track = TRACKS[1];
    game.phase = 'guess';
    game.guessStartedAt = Date.now();
    game.settings.mode = 'title';
    assert.ok(!game.everyoneDone());
    assert.ok(game.guess(tom.token, 'billie jean').title);
    assert.ok(game.everyoneDone());
    assert.strictEqual(game.publicState().players.find((entry) => entry.name === 'Léa').online, false);
    game.stop();
});

test('les paliers d\'indices : moitié puis 10 dernières secondes', () => {
    const game = make();
    game.settings.guessMs = 30000;
    assert.deepStrictEqual(game.hintDelays(), [[15000, 1], [20000, 2]]);
    game.settings.guessMs = 20000;
    assert.deepStrictEqual(game.hintDelays(), [[10000, 1], [10000, 2]]);
});

test('les indices apparaissent pendant la manche et disparaissent après', async () => {
    const game = make();
    game.join('Tom');
    game.track = TRACKS[0];
    game.settings = { ...game.settings, guessMs: 100, mode: 'both', hints: true };
    game.phase = 'guess';
    game.scheduleHints();
    assert.strictEqual(game.publicState().hint, null);
    await new Promise((resolve) => setTimeout(resolve, 90));
    assert.deepStrictEqual(game.publicState().hint, { title: 'B_______ ________', artist: 'Q____' });
    game.clearHints();
    assert.strictEqual(game.publicState().hint, null);
});

test('le chargement d\'une playlist annonce la progression des extraits', async () => {
    const game = make();
    const playlist = await game.setPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    assert.strictEqual(playlist.total, 3);
    await until(() => game.playlist.ready, 1000);
    assert.strictEqual(game.playlist.resolved, 3);
    assert.strictEqual(game.playlist.missing, 0);
});

test('lancer avant la fin de la recherche donne un message clair', async () => {
    const game = make({ resolveAll: () => new Promise(() => {}) });
    game.join('Tom');
    await game.setPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    assert.throws(() => game.start({ rounds: 2 }), /Recherche des extraits en cours/);
});

test('une partie complète : décompte, extrait, manches, podium, sans répéter les titres', async () => {
    const game = make();
    const tom = game.join('Tom');
    const lea = game.join('Léa');
    game.connect(tom.token);
    game.connect(lea.token);
    await game.setPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    await until(() => game.playlist.ready, 1000);
    game.start({ rounds: 2, mode: 'title' });
    await until(() => game.phase === 'countdown', 1000);
    const countdown = game.publicState();
    assert.ok(countdown.audio.url.startsWith('https://extraits.test/'));
    assert.strictEqual(countdown.audio.startedAt, 0);
    await until(() => game.phase === 'guess', 2000);
    assert.ok(game.publicState().audio.startedAt > 0);
    assert.strictEqual(game.guess(lea.token, 'céline dion').title, false);
    const found = game.guess(tom.token, game.track.name);
    assert.ok(found.title);
    assert.ok(found.gained >= 500);
    await until(() => game.phase === 'podium', 4000);
    assert.strictEqual(game.played.size, 2);
    const state = game.publicState();
    assert.strictEqual(state.audio, null);
    assert.strictEqual(state.players[0].name, 'Tom');
    assert.strictEqual(state.stats.fastest.name, 'Tom');
    assert.strictEqual(state.stats.firsts.count, 1);
    assert.strictEqual(state.stats.wildest.name, 'Léa');

    const remaining = TRACKS.find((track) => !game.played.has(track.uri));
    game.start({ rounds: 1, mode: 'title' });
    assert.strictEqual(game.queue[0].uri, remaining.uri);
    game.stop();
});

test('un extrait indisponible au moment de jouer est écarté', async () => {
    const game = make({
        freshUrl: async (match) => {
            if (match.id === 'spotify:track:2') throw new Error('plus de preview');
            return `https://extraits.test/${encodeURIComponent(match.id)}.mp3`;
        }
    });
    const tom = game.join('Tom');
    game.connect(tom.token);
    await game.setPlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    await until(() => game.playlist.ready, 1000);
    game.start({ rounds: 3, mode: 'title' });
    await until(() => game.phase === 'podium', 6000);
    assert.strictEqual(game.queue.length, 2);
    assert.ok(game.queue.every((track) => track.uri !== 'spotify:track:2'));
    game.stop();
});

test('la sauvegarde conserve joueurs, scores, extraits et remet une partie interrompue au lobby', () => {
    const game = make();
    const tom = game.join('Tom', undefined, 'Rouges');
    game.players.get(tom.token).score = 1200;
    game.allTracks = TRACKS.map((track) => ({ ...track, match: { source: 'test', id: track.uri } }));
    game.playlist = { id: 'p1', source: 'spotify', name: 'Test', image: null, total: 3, resolved: 3, missing: 0, ready: true };
    game.played.add(TRACKS[0].uri);
    game.phase = 'guess';
    const restored = make();
    restored.restore(JSON.parse(JSON.stringify(game)));
    assert.strictEqual(restored.phase, 'lobby');
    assert.match(restored.notice, /interrompue/);
    const entry = restored.players.get(tom.token);
    assert.strictEqual(entry.score, 1200);
    assert.strictEqual(entry.team, 'Rouges');
    assert.strictEqual(entry.connections, 0);
    assert.ok(restored.played.has(TRACKS[0].uri));
    assert.strictEqual(restored.playable().length, 3);
    assert.strictEqual(restored.playlist.ready, true);
});
