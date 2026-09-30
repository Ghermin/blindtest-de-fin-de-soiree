const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fixture = require('./fixtures/sources.js');

const ROOT = path.join(__dirname, '..');
const PORT = 3900 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const PIN = '4321';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blindtest-e2e-'));
let server = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const host = (key) => ({ 'X-Host-Key': key });

function request(method, route, body, headers) {
    return new Promise((resolve, reject) => {
        const data = body === undefined ? null : JSON.stringify(body);
        const req = http.request(`${BASE}${route}`, {
            method,
            headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(headers || {}) }
        }, (res) => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { text += chunk; });
            res.on('end', () => {
                let json;
                try {
                    json = JSON.parse(text);
                } catch (_notJson) {
                    json = null;
                }
                resolve({ status: res.statusCode, headers: res.headers, text, json });
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function waitFor(check, timeoutMs, what) {
    const started = Date.now();
    for (;;) {
        const value = await check();
        if (value) return value;
        if (Date.now() - started > timeoutMs) throw new Error(`délai dépassé : ${what}`);
        await sleep(40);
    }
}

function listen(room, token) {
    const client = { states: [], events: [], latest: null, closed: false };
    client.req = http.get(`${BASE}/events?room=${room}&token=${encodeURIComponent(token || '')}`, (res) => {
        let buffer = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            buffer += chunk;
            let index;
            while ((index = buffer.indexOf('\n\n')) >= 0) {
                const block = buffer.slice(0, index);
                buffer = buffer.slice(index + 2);
                const type = (block.match(/^event: (\w+)/m) || [])[1];
                const data = (block.match(/^data: (.*)/m) || [])[1];
                client.events.push(type);
                if (type === 'state') {
                    client.latest = JSON.parse(data);
                    client.states.push(client.latest);
                }
            }
        });
        res.on('end', () => { client.closed = true; });
    });
    client.req.on('error', () => { client.closed = true; });
    client.close = () => client.req.destroy();
    return client;
}

async function startServer() {
    server = spawn(process.execPath, ['index.js'], {
        cwd: ROOT,
        env: {
            ...process.env,
            BLINDTEST_PORT: String(PORT),
            BLINDTEST_HOST: '127.0.0.1',
            BLINDTEST_HOST_PIN: PIN,
            BLINDTEST_DATA_DIR: dataDir,
            BLINDTEST_SOURCES: path.join(__dirname, 'fixtures', 'sources.js'),
            BLINDTEST_TIMINGS: JSON.stringify({ countdownMs: 200, revealMs: 300, guessMs: 6000 }),
            BLINDTEST_PUBLIC_URL: '',
            SPOTIFY_CLIENT_ID: '',
            SPOTIFY_CLIENT_SECRET: ''
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = '';
    server.stdout.on('data', (chunk) => { log += chunk; });
    server.stderr.on('data', (chunk) => { log += chunk; });
    server.logs = () => log;
    await waitFor(() => request('GET', '/api/health').then((res) => res.status === 200).catch(() => false), 10000, 'démarrage du serveur');
}

function stopServer() {
    if (!server || server.exitCode !== null) return Promise.resolve();
    return new Promise((resolve) => {
        server.once('exit', resolve);
        server.kill();
    });
}

test('parcours complet via l\'API et les flux SSE', async (t) => {
    await startServer();
    const clients = [];
    try {
        assert.strictEqual((await request('GET', '/api/info')).json.home, 'MAISON');
        const created = (await request('POST', '/api/rooms', {})).json;
        assert.match(created.code, /^[A-Z2-9]{4}$/);
        assert.strictEqual(created.hostKey.length, 8);
        const room = created.code;
        const api = `/api/r/${room}`;
        const key = host(created.hostKey);
        let tom;
        let tom2;
        let lea;
        let nico;

        await t.test('clé hôte', async () => {
            assert.strictEqual((await request('POST', `${api}/host/options`, { rounds: 5 }, host('mauvaise'))).status, 403);
            assert.strictEqual((await request('GET', `${api}/host/status`, undefined, key)).json.key, created.hostKey);
            assert.strictEqual((await request('GET', '/api/r/ZZZZ')).status, 404);
        });

        await t.test('inscriptions, équipes, exclusion', async () => {
            assert.strictEqual((await request('POST', `${api}/join`, { name: '  ' })).status, 400);
            tom = (await request('POST', `${api}/join`, { name: 'Tom' })).json;
            tom2 = (await request('POST', `${api}/join`, { name: 'tom' })).json;
            assert.strictEqual(tom2.name, 'tom 2');
            const teams = (await request('POST', `${api}/host/teams`, { action: 'add', name: 'Rouges' }, key)).json.teams;
            assert.deepStrictEqual(teams.map((team) => team.name), ['Rouges']);
            lea = (await request('POST', `${api}/join`, { name: 'Léa', team: 'rouges' })).json;
            assert.strictEqual(lea.team, 'Rouges');
            nico = (await request('POST', `${api}/join`, { name: 'Nico', team: 'Bleus' })).json;
            assert.deepStrictEqual(nico.state.teams.map((team) => `${team.name}:${team.members}`).sort(), ['Bleus:1', 'Rouges:1']);
            const renamed = (await request('POST', `${api}/host/teams`, { action: 'rename', name: 'Bleus', to: 'Verts' }, key)).json.teams;
            assert.ok(renamed.some((team) => team.name === 'Verts'));
            const nicoId = nico.state.players.find((player) => player.name === 'Nico').id;
            const assigned = (await request('POST', `${api}/host/teams`, { action: 'assign', id: nicoId, team: 'Rouges' }, key)).json.teams;
            assert.strictEqual(assigned.find((team) => team.name === 'Rouges').members, 2);
            const tom2Id = nico.state.players.find((player) => player.name === 'tom 2').id;
            assert.strictEqual((await request('POST', `${api}/host/kick`, { id: tom2Id }, key)).status, 200);
            assert.strictEqual((await request('POST', `${api}/host/kick`, { id: tom2Id }, key)).status, 400);
            assert.strictEqual((await request('POST', `${api}/guess`, { token: tom2.token, text: 'x' })).status, 400);
        });

        await t.test('playlist et recherche', async () => {
            assert.strictEqual((await request('POST', `${api}/host/playlist`, { url: 'nimporte quoi' }, key)).status, 400);
            assert.strictEqual((await request('POST', `${api}/host/start`, {}, key)).status, 400);
            const loaded = await request('POST', `${api}/host/playlist`, { url: 'fixture:party' }, key);
            assert.strictEqual(loaded.status, 200);
            assert.strictEqual(loaded.json.playlist.name, fixture.NAME);
            const watcher = listen(room);
            clients.push(watcher);
            await waitFor(() => watcher.latest && watcher.latest.playlist && watcher.latest.playlist.ready, 3000, 'extraits prêts');
            assert.strictEqual(watcher.latest.playlist.resolved, fixture.TRACKS.length);
            const search = await request('POST', `${api}/host/search`, { q: 'années 80' }, key);
            assert.strictEqual(search.status, 200);
            assert.ok(Array.isArray(search.json.playlists));
            if (search.json.playlists.length) {
                assert.ok(search.json.playlists.every((entry) => entry.id && entry.name && ['spotify', 'deezer'].includes(entry.source)));
            } else {
                t.diagnostic('recherche Deezer vide (pas de réseau ?)');
            }
        });

        await t.test('partie au clavier : fausses, partielles, exactes, indices, pause, passer, arrêt', async () => {
            const options = (await request('POST', `${api}/host/options`, { rounds: 5, guessSeconds: 15, mode: 'both', answers: 'text', hints: true, play: 'solo' }, key)).json.options;
            assert.deepStrictEqual([options.rounds, options.answers, options.mode], [5, 'text', 'both']);
            assert.strictEqual((await request('POST', `${api}/host/options`, { rounds: 3 }, key)).json.options.rounds, 5);
            const tomClient = listen(room, tom.token);
            const leaClient = listen(room, lea.token);
            const nicoClient = listen(room, nico.token);
            clients.push(tomClient, leaClient, nicoClient);
            await waitFor(() => tomClient.latest && leaClient.latest && nicoClient.latest, 2000, 'flux joueurs');
            assert.strictEqual((await request('POST', `${api}/host/start`, {}, key)).status, 200);
            await waitFor(() => tomClient.latest.phase === 'guess', 4000, 'manche 1');
            let state = tomClient.latest;
            assert.strictEqual(state.round, 1);
            assert.strictEqual(state.rounds, 5);
            const track = fixture.byUrl(state.audio.url);
            assert.ok(track, `extrait reconnu : ${state.audio.url}`);
            const wrong = (await request('POST', `${api}/guess`, { token: tom.token, text: 'chanson inconnue' })).json;
            assert.deepStrictEqual([wrong.accepted, wrong.title, wrong.artist, wrong.gained], [true, false, false, 0]);
            assert.strictEqual((await request('POST', `${api}/guess`, { token: tom.token, text: track.name })).json.reason, 'throttle');
            await sleep(550);
            const rough = (await request('POST', `${api}/guess`, { token: tom.token, text: fixture.keyword(track) })).json;
            assert.ok(rough.title && rough.approx && rough.gained > 0, JSON.stringify(rough));
            const exact = (await request('POST', `${api}/guess`, { token: lea.token, text: track.name })).json;
            assert.ok(exact.title && !exact.approx && exact.gained >= 300, JSON.stringify(exact));
            const both = (await request('POST', `${api}/guess`, { token: nico.token, text: `${track.name} ${track.artists[0]}` })).json;
            assert.ok(both.title && both.artist && both.gained > exact.gained, JSON.stringify(both));
            await sleep(550);
            const upgrade = (await request('POST', `${api}/guess`, { token: tom.token, text: track.name })).json;
            assert.ok(upgrade.title && !upgrade.approx && upgrade.gained > 0 && upgrade.gained < 200, JSON.stringify(upgrade));
            await sleep(550);
            const artist = (await request('POST', `${api}/guess`, { token: tom.token, text: track.artists[0] })).json;
            assert.ok(artist.artist && artist.gained >= 200, JSON.stringify(artist));
            const leaArtist = (await request('POST', `${api}/guess`, { token: lea.token, text: track.artists[0] })).json;
            assert.ok(leaArtist.artist, JSON.stringify(leaArtist));
            await waitFor(() => tomClient.latest.phase === 'reveal', 4000, 'révélation');
            state = tomClient.latest;
            assert.strictEqual(state.track.name, track.name);
            const tomState = state.players.find((player) => player.name === 'Tom');
            assert.strictEqual(tomState.lastGuess, track.artists[0]);
            assert.deepStrictEqual(tomState.found, { title: true, artist: true });
            assert.ok(state.players.every((player) => player.score > 0));
            assert.strictEqual(tomState.score, rough.gained + upgrade.gained + artist.gained);

            await waitFor(() => tomClient.latest.phase === 'guess' && tomClient.latest.round === 2, 5000, 'manche 2');
            assert.strictEqual((await request('POST', `${api}/guess`, { token: tom.token, text: 'chanson inconnue' })).json.accepted, true);
            assert.strictEqual((await request('POST', `${api}/host/pause`, {}, key)).status, 200);
            await waitFor(() => tomClient.latest.paused === true, 2000, 'pause');
            await sleep(550);
            assert.strictEqual((await request('POST', `${api}/guess`, { token: tom.token, text: 'x' })).json.reason, 'paused');
            assert.strictEqual((await request('POST', `${api}/host/resume`, {}, key)).status, 200);
            await waitFor(() => tomClient.latest.paused === false, 2000, 'reprise');
            await waitFor(() => tomClient.latest.hint, 6000, 'indice');
            assert.ok(tomClient.latest.hint.title || tomClient.latest.hint.artist);
            assert.strictEqual((await request('POST', `${api}/host/skip`, {}, key)).status, 200);
            await waitFor(() => tomClient.latest.phase === 'reveal' && tomClient.latest.round === 2, 3000, 'passer');
            await waitFor(() => tomClient.latest.phase === 'guess' && tomClient.latest.round === 3, 5000, 'manche 3');
            assert.strictEqual((await request('POST', `${api}/host/stop`, {}, key)).status, 200);
            await waitFor(() => tomClient.latest.phase === 'podium', 3000, 'podium');
            const podium = tomClient.latest;
            assert.ok(podium.stats.fastest && podium.stats.firsts);
            assert.strictEqual(podium.stats.wildest.name, 'Tom');
            assert.strictEqual(podium.stats.wildest.guess, 'chanson inconnue');
            assert.strictEqual(podium.audio, null);
        });

        await t.test('partie en QCM : une réponse par joueur, une seule bonne', async () => {
            await request('POST', `${api}/host/options`, { answers: 'choices', mode: 'title', rounds: 5 }, key);
            const zoe = (await request('POST', `${api}/join`, { name: 'Zoé' })).json;
            const zoeClient = listen(room, zoe.token);
            clients.push(zoeClient);
            await waitFor(() => zoeClient.latest, 2000, 'flux Zoé');
            assert.strictEqual((await request('POST', `${api}/host/start`, {}, key)).status, 200);
            await waitFor(() => zoeClient.latest.phase === 'guess' && zoeClient.latest.choices, 5000, 'QCM');
            const choices = zoeClient.latest.choices;
            assert.strictEqual(choices.length, 4);
            assert.strictEqual(zoeClient.latest.hint, null);
            const players = [tom, lea, nico, zoe];
            const results = [];
            for (let index = 0; index < 4; index++) {
                results.push((await request('POST', `${api}/guess`, { token: players[index].token, text: choices[index].id })).json);
            }
            assert.ok(results.every((result) => result.accepted));
            assert.strictEqual(results.filter((result) => result.correct).length, 1);
            await sleep(550);
            assert.strictEqual((await request('POST', `${api}/guess`, { token: tom.token, text: choices[0].id })).json.reason, 'answered');
            await waitFor(() => zoeClient.latest.phase === 'reveal', 4000, 'révélation QCM');
            const winner = results.findIndex((result) => result.correct);
            assert.strictEqual(zoeClient.latest.correctChoice, choices[winner].id);
            assert.strictEqual(zoeClient.latest.track.name, choices[winner].label);
            assert.strictEqual((await request('POST', `${api}/host/lobby`, {}, key)).status, 200);
            await waitFor(() => zoeClient.latest.phase === 'lobby', 2000, 'retour au lobby');
        });

        await t.test('exclusion en direct, remise à zéro, départ, vidage', async () => {
            const zoeClient = clients[clients.length - 1];
            const zoeId = zoeClient.latest.players.find((player) => player.name === 'Zoé').id;
            assert.strictEqual((await request('POST', `${api}/host/kick`, { id: zoeId }, key)).status, 200);
            await waitFor(() => zoeClient.events.includes('kicked') && zoeClient.closed, 3000, 'événement kicked');
            const watcher = listen(room);
            clients.push(watcher);
            await waitFor(() => watcher.latest, 2000, 'flux');
            assert.ok(watcher.latest.players.some((player) => player.score > 0));
            assert.strictEqual((await request('POST', `${api}/host/reset`, {}, key)).status, 200);
            await waitFor(() => watcher.latest.players.every((player) => player.score === 0), 2000, 'remise à zéro');
            assert.strictEqual(watcher.latest.phase, 'lobby');
            assert.strictEqual((await request('POST', `${api}/leave`, { token: nico.token })).status, 200);
            await waitFor(() => !watcher.latest.players.some((player) => player.name === 'Nico'), 2000, 'départ');
            assert.strictEqual((await request('POST', `${api}/host/clear`, {}, key)).status, 200);
            await waitFor(() => watcher.latest.players.length === 0, 2000, 'salle vide');
            assert.ok(watcher.latest.teams.some((team) => team.name === 'Rouges'));
        });

        await t.test('les salles survivent à un redémarrage', async () => {
            const sam = (await request('POST', `${api}/join`, { name: 'Sam', team: 'Rouges' })).json;
            assert.strictEqual(sam.team, 'Rouges');
            await sleep(1500);
            for (const client of clients) client.close();
            await stopServer();
            await startServer();
            assert.strictEqual((await request('GET', api)).json.players, 1);
            const watcher = listen(room);
            clients.push(watcher);
            await waitFor(() => watcher.latest, 2000, 'flux après redémarrage');
            assert.strictEqual(watcher.latest.players[0].name, 'Sam');
            assert.ok(watcher.latest.teams.some((team) => team.name === 'Rouges'));
            assert.strictEqual(watcher.latest.playlist.name, fixture.NAME);
            assert.strictEqual((await request('POST', `${api}/host/options`, { rounds: 10 }, key)).json.options.rounds, 10);
        });

        await t.test('pages et fichiers servis', async () => {
            for (const route of ['/', `/r/${room}`, `/r/${room}/tv`, '/install']) {
                const page = await request('GET', route);
                assert.strictEqual(page.status, 200, route);
                assert.ok(page.text.includes('<symbol id="i-play"'), route);
                assert.ok(!page.text.includes('<!--ICONS-->'), route);
            }
            assert.ok((await request('GET', '/install')).text.includes('join-card'));
            assert.strictEqual((await request('GET', `/r/${room}/qr.svg`)).headers['content-type'], 'image/svg+xml');
            for (const asset of ['/ui.js', '/app.js', '/tv.js', '/style.css', '/tv.css', '/favicon.svg']) {
                assert.strictEqual((await request('GET', asset)).status, 200, asset);
            }
            assert.strictEqual((await request('GET', '/nope')).status, 404);
        });
    } finally {
        for (const client of clients) client.close();
        await stopServer();
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});
