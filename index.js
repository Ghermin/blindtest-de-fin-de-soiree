const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./src/config.js');
const spotify = require('./src/spotify.js');
const { Game } = require('./src/game.js');

const ASSETS = {
    '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
    '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
    '/app.js': { file: 'app.js', type: 'application/javascript; charset=utf-8' },
    '/style.css': { file: 'style.css', type: 'text/css; charset=utf-8' },
    '/favicon.svg': { file: 'favicon.svg', type: 'image/svg+xml' },
    '/manifest.webmanifest': { file: 'manifest.webmanifest', type: 'application/manifest+json' }
};

const HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store'
};

const game = new Game();
const clients = new Set();

game.on('update', () => {
    const payload = `event: state\ndata: ${JSON.stringify(game.publicState())}\n\n`;
    for (const client of clients) client.write(payload);
});

function send(response, status, body) {
    response.writeHead(status, { ...HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
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

function checkPin(request) {
    if (!config.hostPin) return true;
    return request.headers['x-host-pin'] === config.hostPin;
}

async function handleApi(request, response, route) {
    const body = request.method === 'POST' ? await readJson(request) : {};

    if (route === '/api/join' && request.method === 'POST') {
        const player = game.join(body.name, body.token);
        return send(response, 200, { token: player.token, name: player.name, state: game.publicState() });
    }
    if (route === '/api/guess' && request.method === 'POST') {
        return send(response, 200, game.guess(body.token, body.text));
    }

    if (route.startsWith('/api/host/')) {
        if (!checkPin(request)) return send(response, 403, { error: 'Code hôte incorrect' });
        if (route === '/api/host/playlist' && request.method === 'POST') {
            const playlist = await game.setPlaylist(body.url);
            return send(response, 200, { playlist });
        }
        if (route === '/api/host/start' && request.method === 'POST') {
            game.start(body);
            return send(response, 200, { ok: true });
        }
        if (route === '/api/host/skip' && request.method === 'POST') {
            game.skip();
            return send(response, 200, { ok: true });
        }
        if (route === '/api/host/retry' && request.method === 'POST') {
            game.retry();
            return send(response, 200, { ok: true });
        }
        if (route === '/api/host/stop' && request.method === 'POST') {
            game.stop();
            return send(response, 200, { ok: true });
        }
        if (route === '/api/host/lobby' && request.method === 'POST') {
            game.backToLobby();
            return send(response, 200, { ok: true });
        }
        if (route === '/api/host/devices') {
            return send(response, 200, { devices: await spotify.devices() });
        }
        if (route === '/api/host/device' && request.method === 'POST') {
            await spotify.transfer(body.id);
            return send(response, 200, { ok: true });
        }
    }
    return send(response, 404, { error: 'Route inconnue' });
}

const server = http.createServer(async (request, response) => {
    const route = new URL(request.url, 'http://localhost').pathname;

    if (route === '/events') {
        response.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-store',
            Connection: 'keep-alive'
        });
        response.write(`event: state\ndata: ${JSON.stringify(game.publicState())}\n\n`);
        clients.add(response);
        const heartbeat = setInterval(() => response.write(':ping\n\n'), 25000);
        request.on('close', () => {
            clearInterval(heartbeat);
            clients.delete(response);
        });
        return;
    }

    if (route.startsWith('/api/')) {
        try {
            await handleApi(request, response, route);
        } catch (error) {
            send(response, 400, { error: error.message });
        }
        return;
    }

    const asset = ASSETS[route];
    if (!asset) {
        response.writeHead(404, HEADERS);
        return response.end('404');
    }
    try {
        const content = await fs.readFile(path.join(__dirname, 'public', asset.file));
        response.writeHead(200, { ...HEADERS, 'Content-Type': asset.type, 'Cache-Control': 'max-age=60' });
        response.end(content);
    } catch {
        response.writeHead(500, HEADERS);
        response.end('Erreur');
    }
});

server.listen(config.port, config.host, () => {
    console.log(`Blind test prêt : http://localhost:${config.port} (réseau : port ${config.port})`);
    if (!config.spotify.refreshToken) console.log('⚠ Spotify non connecté : renseigne .env puis lance npm run auth');
});
