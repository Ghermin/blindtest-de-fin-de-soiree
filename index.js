const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const config = require('./src/config.js');
const spotify = require('./src/spotify.js');
const rooms = require('./src/rooms.js');
const qr = require('./src/qr.js');
const ratelimit = require('./src/ratelimit.js');

const PUBLIC = path.join(__dirname, 'public');
const ASSETS = {
    '/app.js': 'application/javascript; charset=utf-8',
    '/tv.js': 'application/javascript; charset=utf-8',
    '/style.css': 'text/css; charset=utf-8',
    '/tv.css': 'text/css; charset=utf-8',
    '/favicon.svg': 'image/svg+xml',
    '/manifest.webmanifest': 'application/manifest+json',
    '/apple-touch-icon.png': 'image/png',
    '/icon-192.png': 'image/png',
    '/icon-512.png': 'image/png'
};

const HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' https://www.gstatic.com; style-src 'self'; img-src 'self' data: https://i.scdn.co https://mosaic.scdn.co https://image-cdn-ak.spotifycdn.com https://image-cdn-fa.spotifycdn.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'Cache-Control': 'no-store'
};

const CAST_HEADERS = Object.fromEntries(Object.entries(HEADERS).filter(([name]) => name !== 'Content-Security-Policy'));

function lanUrl() {
    const entries = Object.values(os.networkInterfaces()).flat();
    const external = entries.find((entry) => (entry.family === 'IPv4' || entry.family === 4) && !entry.internal);
    return `http://${external ? external.address : 'localhost'}:${config.port}`;
}

function baseUrl() {
    return config.publicUrl || lanUrl();
}

function joinUrl(room) {
    return `${baseUrl()}/r/${room.code}`;
}

function snapshot(room) {
    return { ...room.game.publicState(), joinUrl: joinUrl(room), home: room.home };
}

function broadcast(room) {
    const payload = `event: state\ndata: ${JSON.stringify(snapshot(room))}\n\n`;
    for (const client of room.clients) client.write(payload);
}

function attach(room) {
    if (room.attached) return room;
    room.attached = true;
    room.game.on('update', () => broadcast(room));
    return room;
}

function clientIp(request) {
    if (config.trustProxy) {
        const cloudflare = request.headers['cf-connecting-ip'];
        if (cloudflare) return String(cloudflare);
        const forwarded = request.headers['x-forwarded-for'];
        if (forwarded) return String(forwarded).split(',')[0].trim();
    }
    return request.socket.remoteAddress || '';
}

function redirectUri(request) {
    if (config.publicUrl) return `${config.publicUrl}/auth/spotify/callback`;
    const host = String(request.headers.host || '');
    if (host.startsWith('127.0.0.1')) return `http://${host}/auth/spotify/callback`;
    return '';
}

function safeEqual(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
}

function send(response, status, body) {
    response.writeHead(status, { ...HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
}

function plain(response, status, text) {
    response.writeHead(status, { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(text);
}

function redirect(response, location) {
    response.writeHead(302, { ...HEADERS, Location: location });
    response.end();
}

async function serveFile(response, name, type, cache) {
    try {
        const content = await fs.readFile(path.join(PUBLIC, name));
        response.writeHead(200, { ...HEADERS, 'Content-Type': type, 'Cache-Control': cache || 'no-store' });
        response.end(content);
    } catch {
        plain(response, 500, 'Erreur');
    }
}

function readJson(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.on('data', (chunk) => {
            body += chunk;
            if (body.length > 10000) {
                reject(new Error('Requête trop grosse'));
                request.destroy();
            }
        });
        request.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new Error('JSON invalide'));
            }
        });
        request.on('error', reject);
    });
}

async function presets() {
    try {
        const list = JSON.parse(await fs.readFile(path.join(config.dataDir, 'presets.json'), 'utf8'));
        return Array.isArray(list) ? list.filter((preset) => preset && preset.name && preset.url).slice(0, 30) : [];
    } catch {
        return [];
    }
}

async function handleHost(request, response, room, action, body) {
    const game = room.game;
    const post = request.method === 'POST';
    if (action === '/host/status') {
        return send(response, 200, { key: room.hostKey, spotify: room.spotify.status(), auth: spotify.configured() && Boolean(redirectUri(request)) });
    }
    if (action === '/host/playlist' && post) return send(response, 200, { playlist: await game.setPlaylist(body.url) });
    if (action === '/host/playlists') return send(response, 200, { playlists: await room.spotify.myPlaylists() });
    if (action === '/host/start' && post) {
        game.start(body);
        return send(response, 200, { ok: true });
    }
    if (action === '/host/skip' && post) {
        game.skip();
        return send(response, 200, { ok: true });
    }
    if (action === '/host/retry' && post) {
        game.retry();
        return send(response, 200, { ok: true });
    }
    if (action === '/host/stop' && post) {
        game.stop();
        return send(response, 200, { ok: true });
    }
    if (action === '/host/lobby' && post) {
        game.backToLobby();
        return send(response, 200, { ok: true });
    }
    if (action === '/host/devices') return send(response, 200, { devices: await room.spotify.devices() });
    if (action === '/host/device' && post) {
        await room.spotify.transfer(body.id);
        return send(response, 200, { ok: true });
    }
    return send(response, 404, { error: 'Route inconnue' });
}

async function handleApi(request, response, url) {
    const route = url.pathname;
    const ip = clientIp(request);
    const post = request.method === 'POST';
    const body = post ? await readJson(request) : {};

    if (route === '/api/health') return send(response, 200, { ok: true, rooms: rooms.all().length, busy: rooms.busy() });
    if (route === '/api/info') {
        const home = rooms.get(config.homeRoom);
        return send(response, 200, { home: home ? home.code : null, publicUrl: baseUrl(), cast: config.castAppId });
    }
    if (route === '/api/presets') return send(response, 200, { presets: await presets() });
    if (route === '/api/rooms' && post) {
        if (!ratelimit.allow(`rooms:${ip}`, 5, 3600000)) return send(response, 429, { error: 'Trop de salles créées, réessaie plus tard' });
        const room = attach(rooms.create());
        console.log(`[${room.code}] Salle créée`);
        return send(response, 200, { code: room.code, hostKey: room.hostKey, url: joinUrl(room) });
    }

    const match = route.match(/^\/api\/r\/([A-Za-z0-9]{3,12})(\/.*)?$/);
    if (!match) return send(response, 404, { error: 'Route inconnue' });
    const room = rooms.get(match[1]);
    if (!room) return send(response, 404, { error: 'Salle introuvable' });
    const action = match[2] || '';
    const game = room.game;

    if (action === '') {
        return send(response, 200, { code: room.code, phase: game.phase, players: game.players.size, spotify: room.spotify.connected(), home: room.home });
    }
    if (action === '/join' && post) {
        if (!ratelimit.allow(`join:${ip}`, 30, 60000)) return send(response, 429, { error: 'Doucement sur les connexions' });
        const player = game.join(body.name, body.token, body.team);
        return send(response, 200, { token: player.token, name: player.name, team: player.team, state: snapshot(room) });
    }
    if (action === '/guess' && post) {
        if (!ratelimit.allow(`guess:${ip}`, 240, 60000)) return send(response, 429, { error: 'Trop de réponses' });
        return send(response, 200, game.guess(body.token, body.text));
    }
    if (action === '/leave' && post) {
        game.leave(body.token);
        return send(response, 200, { ok: true });
    }
    if (action.startsWith('/host/')) {
        if (!ratelimit.allow(`host:${ip}`, 120, 60000)) return send(response, 429, { error: 'Trop de requêtes' });
        if (!safeEqual(request.headers['x-host-key'] || '', room.hostKey)) return send(response, 403, { error: 'Clé hôte incorrecte' });
        return handleHost(request, response, room, action, body);
    }
    return send(response, 404, { error: 'Route inconnue' });
}

async function handleAuth(request, response, url) {
    if (url.pathname === '/auth/spotify') {
        const room = rooms.get(url.searchParams.get('room'));
        if (!room || !safeEqual(url.searchParams.get('key') || '', room.hostKey)) return plain(response, 403, 'Salle ou clé hôte incorrecte');
        const target = redirectUri(request);
        if (!spotify.configured() || !target) return plain(response, 400, 'Connexion Spotify indisponible : renseigne BLINDTEST_PUBLIC_URL et les identifiants Spotify dans .env');
        if (!ratelimit.allow(`auth:${clientIp(request)}`, 10, 600000)) return plain(response, 429, 'Trop de tentatives, réessaie dans quelques minutes');
        const state = randomBytes(16).toString('hex');
        room.pendingAuth = { state, expiresAt: Date.now() + 600000, redirect: target };
        return redirect(response, spotify.authorizeUrl(target, state));
    }
    if (url.pathname === '/auth/spotify/callback') {
        const state = url.searchParams.get('state');
        const room = rooms.all().find((entry) => entry.pendingAuth && entry.pendingAuth.state === state && entry.pendingAuth.expiresAt > Date.now());
        if (!room) return plain(response, 400, 'Connexion expirée ou invalide, recommence depuis le panneau hôte');
        const pending = room.pendingAuth;
        room.pendingAuth = null;
        if (url.searchParams.get('error')) return plain(response, 400, `Spotify a refusé : ${url.searchParams.get('error')}`);
        try {
            const tokens = await spotify.exchangeCode(url.searchParams.get('code'), pending.redirect);
            const account = await room.spotify.adopt(tokens);
            console.log(`[${room.code}] Spotify connecté : ${account ? account.name : '?'}`);
            room.game.changed();
            return redirect(response, `/r/${room.code}#host=${room.hostKey}`);
        } catch (error) {
            return plain(response, 400, `Échec de la connexion Spotify : ${error.message}`);
        }
    }
    return plain(response, 404, '404');
}

function handleEvents(request, response, url) {
    const room = rooms.get(url.searchParams.get('room'));
    if (!room) return send(response, 404, { error: 'Salle introuvable' });
    if (room.clients.size >= 150) return send(response, 503, { error: 'Salle saturée' });
    const token = url.searchParams.get('token') || '';
    response.writeHead(200, { ...HEADERS, 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
    response.write(`event: state\ndata: ${JSON.stringify(snapshot(room))}\n\n`);
    room.clients.add(response);
    room.lastActivity = Date.now();
    if (token) room.game.connect(token);
    const heartbeat = setInterval(() => response.write('event: ping\ndata: 1\n\n'), 25000);
    request.on('close', () => {
        clearInterval(heartbeat);
        room.clients.delete(response);
        if (token) room.game.disconnect(token);
    });
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const route = url.pathname;

    if (route === '/events') return handleEvents(request, response, url);
    if (route.startsWith('/api/')) {
        try {
            await handleApi(request, response, url);
        } catch (error) {
            send(response, error.status === 429 ? 429 : 400, { error: error.message });
        }
        return;
    }
    if (route.startsWith('/auth/')) {
        try {
            await handleAuth(request, response, url);
        } catch (error) {
            plain(response, 500, `Erreur : ${error.message}`);
        }
        return;
    }
    if (route === '/' || route === '/index.html') return serveFile(response, 'index.html', 'text/html; charset=utf-8');
    if (route === '/cast') {
        try {
            const content = await fs.readFile(path.join(PUBLIC, 'tv.html'));
            response.writeHead(200, { ...CAST_HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
            return response.end(content);
        } catch {
            return plain(response, 500, 'Erreur');
        }
    }
    const page = route.match(/^\/r\/([A-Za-z0-9]{3,12})(\/tv|\/qr\.svg)?$/);
    if (page) {
        if (page[2] === '/qr.svg') {
            const room = rooms.get(page[1]);
            if (!room) return plain(response, 404, '404');
            response.writeHead(200, { ...HEADERS, 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=60' });
            return response.end(qr.svg(joinUrl(room)));
        }
        return serveFile(response, page[2] === '/tv' ? 'tv.html' : 'index.html', 'text/html; charset=utf-8');
    }
    if (ASSETS[route]) return serveFile(response, route.slice(1), ASSETS[route], 'max-age=60');
    return plain(response, 404, '404');
});

function shutdown(signal) {
    console.log(`${signal} reçu, arrêt du blind test`);
    rooms.save();
    const pauses = [];
    for (const room of rooms.all()) {
        for (const client of room.clients) client.end();
        if (!['lobby', 'podium'].includes(room.game.phase)) pauses.push(room.spotify.pause().catch(() => {}));
    }
    server.close();
    Promise.race([Promise.allSettled(pauses), new Promise((resolve) => setTimeout(resolve, 2000))])
        .finally(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

const restored = rooms.load();
for (const room of rooms.all()) attach(room);
const home = rooms.ensureHome();
if (home) attach(home);

server.listen(config.port, config.host, () => {
    console.log(`Blind test prêt : ${baseUrl()} (LAN : ${lanUrl()}, local : http://localhost:${config.port})`);
    if (restored) console.log(`${restored} salle(s) restaurée(s) depuis ${config.dataDir}`);
    if (home) console.log(`Salle de la maison : ${joinUrl(home)} — clé hôte : ${home.hostKey}`);
    else console.log('Pas de salle maison (SPOTIFY_REFRESH_TOKEN absent) : les hôtes connectent Spotify depuis leur navigateur');
    if (!spotify.configured()) console.log('⚠ SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET manquants dans .env');
    if (!config.publicUrl) console.log('ℹ BLINDTEST_PUBLIC_URL absent : pas de connexion Spotify par navigateur hors 127.0.0.1');
});
