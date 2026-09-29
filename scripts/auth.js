const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { randomBytes } = require('node:crypto');
const config = require('../src/config.js');
const spotify = require('../src/spotify.js');

const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const ENV_FILE = path.join(__dirname, '..', '.env');
const manual = process.argv.includes('--manual');
const write = process.argv.includes('--write');

const { clientId, clientSecret } = config.spotify;
if (!clientId || !clientSecret) {
    console.error('Renseigne SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET dans .env d\'abord.');
    console.error('→ https://developer.spotify.com/dashboard : crée une app avec le redirect URI ' + REDIRECT);
    process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authorizeUrl = spotify.authorizeUrl(REDIRECT, state);

function saveToken(token) {
    if (!write) {
        console.log('\nAjoute cette ligne dans ton .env :\n');
        console.log(`SPOTIFY_REFRESH_TOKEN=${token}\n`);
        return;
    }
    const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/) : [];
    const index = lines.findIndex((line) => line.startsWith('SPOTIFY_REFRESH_TOKEN='));
    if (index === -1) lines.push(`SPOTIFY_REFRESH_TOKEN=${token}`);
    else lines[index] = `SPOTIFY_REFRESH_TOKEN=${token}`;
    fs.writeFileSync(ENV_FILE, lines.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
    console.log(`\n✅ Compte Spotify connecté, jeton enregistré dans ${ENV_FILE}`);
}

async function exchange(code, expectedState, receivedState) {
    if (receivedState !== expectedState) throw new Error('le paramètre state ne correspond pas : recommence depuis le début');
    if (!code) throw new Error('aucun code dans cette adresse');
    const data = await spotify.exchangeCode(code, REDIRECT);
    if (!data.refresh_token) throw new Error('Spotify n\'a pas renvoyé de refresh token');
    return data.refresh_token;
}

function parseCallback(text) {
    const trimmed = String(text || '').trim();
    const start = trimmed.indexOf('http');
    if (start === -1) throw new Error('ce n\'est pas une adresse : colle toute la ligne qui commence par http://127.0.0.1:8888/callback');
    const url = new URL(trimmed.slice(start));
    if (url.searchParams.get('error')) throw new Error(`Spotify a refusé : ${url.searchParams.get('error')}`);
    return { code: url.searchParams.get('code'), state: url.searchParams.get('state') };
}

async function runManual() {
    console.log('\n1) Ouvre cette adresse dans le navigateur de ton téléphone ou de ton PC :\n');
    console.log(authorizeUrl + '\n');
    console.log('2) Connecte-toi si besoin, clique « Accepter ».');
    console.log('3) Le navigateur affiche alors une page d\'erreur « site inaccessible » : c\'est normal.');
    console.log('   Copie l\'adresse COMPLÈTE de cette page (elle commence par http://127.0.0.1:8888/callback?code=...)\n');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (question) => new Promise((resolve) => rl.question(question, resolve));
    for (let attempt = 1; attempt <= 3; attempt++) {
        const answer = await ask('Colle-la ici puis Entrée : ');
        try {
            const { code, state: received } = parseCallback(answer);
            const token = await exchange(code, state, received);
            rl.close();
            saveToken(token);
            return;
        } catch (error) {
            console.log(`❌ ${error.message}`);
        }
    }
    rl.close();
    console.error('Trois échecs : relance le script.');
    process.exit(1);
}

function runServer() {
    const server = http.createServer(async (request, response) => {
        const url = new URL(request.url, REDIRECT);
        if (url.pathname !== '/callback') {
            response.writeHead(404);
            return response.end();
        }
        try {
            const token = await exchange(url.searchParams.get('code'), state, url.searchParams.get('state'));
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end('<h1>✅ Connecté !</h1><p>Retourne dans le terminal, tu peux fermer cet onglet.</p>');
            saveToken(token);
        } catch (error) {
            response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Échec : ' + error.message);
            console.error('Échec de l\'échange :', error.message);
        }
        server.close();
    });
    server.listen(PORT, '127.0.0.1', () => {
        console.log('Ouvre cette URL dans votre navigateur (sur CETTE machine) :\n');
        console.log(authorizeUrl + '\n');
        console.log('Astuce : sans navigateur sur cette machine, relance avec  node scripts/auth.js --manual');
    });
}

if (manual) {
    runManual();
} else {
    runServer();
}
