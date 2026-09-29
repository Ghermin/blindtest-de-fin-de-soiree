const http = require('node:http');
const { randomBytes } = require('node:crypto');
const config = require('../src/config.js');

const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative';

const { clientId, clientSecret } = config.spotify;
if (!clientId || !clientSecret) {
    console.error('Renseigne SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET dans .env d\'abord.');
    console.error('→ https://developer.spotify.com/dashboard : crée une app avec le redirect URI ' + REDIRECT);
    process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authorizeUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: REDIRECT,
    state
});

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, REDIRECT);
    if (url.pathname !== '/callback') {
        response.writeHead(404);
        return response.end();
    }
    if (url.searchParams.get('state') !== state || !url.searchParams.get('code')) {
        response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        return response.end('Erreur : state ou code manquant, relance le script.');
    }
    try {
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: url.searchParams.get('code'),
                redirect_uri: REDIRECT
            })
        });
        const data = await tokenResponse.json();
        if (!tokenResponse.ok) throw new Error(data.error_description || data.error);
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<h1>✅ Connecté !</h1><p>Retourne dans le terminal, tu peux fermer cet onglet.</p>');
        console.log('\nAjoute cette ligne dans ton .env :\n');
        console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n`);
    } catch (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Échec : ' + error.message);
        console.error('Échec de l\'échange :', error.message);
    }
    server.close();
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('Ouvre cette URL dans ton navigateur (sur CETTE machine) :\n');
    console.log(authorizeUrl + '\n');
    console.log('Astuce Raspberry : lance d\'abord  ssh -L 8888:127.0.0.1:8888 pi@raspberrypi.local  puis ouvre l\'URL sur ton PC.');
});
