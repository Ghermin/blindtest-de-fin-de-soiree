const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.js');
const http = require('./http.js');

const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com';
const SCOPES = 'playlist-read-private playlist-read-collaborative';
let app = { token: '', expiresAt: 0 };
let user;

function configured() {
    return Boolean(config.spotify.clientId && config.spotify.clientSecret);
}

function userFile() {
    return path.join(config.dataDir, 'spotify-user.json');
}

function loadUser() {
    if (user === undefined) {
        try {
            user = JSON.parse(fs.readFileSync(userFile(), 'utf8'));
        } catch {
            user = null;
        }
    }
    return user;
}

function saveUser(data) {
    user = data;
    try {
        fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
        fs.writeFileSync(userFile(), JSON.stringify(data), { mode: 0o600 });
    } catch (error) {
        console.log(`Compte Spotify non sauvegardé : ${error.message}`);
    }
}

function forgetUser() {
    user = null;
    fs.rm(userFile(), { force: true }, () => null);
}

async function tokenRequest(params) {
    if (!configured()) {
        throw new Error('Playlists Spotify indisponibles : renseigne SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET, ou colle un lien de playlist Deezer');
    }
    const response = await http.request(`${ACCOUNTS}/api/token`, {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
    });
    if (response.status !== 200 || !response.json || !response.json.access_token) {
        const detail = response.json && (response.json.error_description || response.json.error);
        const error = new Error(`Spotify refuse (${response.status}${detail ? ` : ${detail}` : ''})`);
        error.status = response.status;
        throw error;
    }
    return response.json;
}

async function appToken() {
    if (app.token && Date.now() < app.expiresAt) return app.token;
    const data = await tokenRequest({ grant_type: 'client_credentials' });
    app = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return app.token;
}

async function userToken() {
    const data = loadUser();
    if (!data || !data.refreshToken) return '';
    if (data.accessToken && Date.now() < data.expiresAt) return data.accessToken;
    const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: data.refreshToken });
    data.accessToken = fresh.access_token;
    data.expiresAt = Date.now() + (fresh.expires_in - 60) * 1000;
    if (fresh.refresh_token) data.refreshToken = fresh.refresh_token;
    saveUser(data);
    return data.accessToken;
}

async function api(route, asUser) {
    const token = asUser ? await userToken() : await appToken();
    const response = await http.request(API + route, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status >= 400) {
        const reason = response.json && response.json.error ? response.json.error.message : `HTTP ${response.status}`;
        const error = new Error(`Spotify ${response.status} : ${reason}`);
        error.status = response.status;
        throw error;
    }
    return response.json;
}

function authorizeUrl(redirectUri, state) {
    return `${ACCOUNTS}/authorize?` + new URLSearchParams({
        response_type: 'code',
        client_id: config.spotify.clientId,
        scope: SCOPES,
        redirect_uri: redirectUri,
        state
    });
}

async function connect(code, redirectUri) {
    const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    const data = { refreshToken: tokens.refresh_token, accessToken: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 60) * 1000, account: null };
    user = data;
    const me = await api('/me', true).catch(() => null);
    data.account = me ? { id: me.id, name: me.display_name || me.id } : null;
    saveUser(data);
    return data.account;
}

function status() {
    const data = loadUser();
    return { configured: configured(), connected: Boolean(data && data.refreshToken), account: data ? data.account : null };
}

const OWN_ONLY = 'Spotify refuse les titres de cette playlist : une app en mode développement ne lit que les playlists que tu possèdes. Dans Spotify, ouvre la playlist → ⋮ → Ajouter à une playlist → Nouvelle playlist, puis charge cette copie. Ou utilise une playlist Deezer.';

async function playlist(id) {
    const asUser = Boolean(loadUser());
    const meta = await api(`/playlists/${id}?fields=name,images,tracks.total`, asUser);
    const tracks = [];
    let route = `/playlists/${id}/tracks?limit=100&fields=next,items(is_local,track(uri,name,duration_ms,artists(name),album(images)))`;
    while (route) {
        let page;
        try {
            page = await api(route, asUser);
        } catch (error) {
            if (error.status === 403) throw new Error(OWN_ONLY);
            throw error;
        }
        for (const item of page.items || []) {
            const track = item.track;
            if (!track || item.is_local || !track.uri || !track.uri.startsWith('spotify:track:')) continue;
            if (!track.duration_ms || track.duration_ms < 45000) continue;
            tracks.push({
                uri: track.uri,
                name: track.name,
                artists: (track.artists || []).map((artist) => artist.name).filter(Boolean),
                image: track.album && track.album.images && track.album.images[0] ? track.album.images[0].url : null,
                durationMs: track.duration_ms
            });
        }
        route = page.next ? page.next.replace(API, '') : null;
    }
    return {
        name: meta.name,
        image: meta.images && meta.images[0] ? meta.images[0].url : null,
        tracks
    };
}

async function myPlaylists() {
    const data = loadUser();
    if (!data) throw new Error('Connecte ton compte Spotify d\'abord');
    const me = data.account ? data.account.id : '';
    const result = [];
    let route = '/me/playlists?limit=50';
    while (route && result.length < 200) {
        const page = await api(route, true);
        for (const item of page.items || []) {
            if (!item || !item.id) continue;
            result.push({ id: item.id, name: item.name, total: item.tracks ? item.tracks.total : 0, mine: Boolean(item.owner && item.owner.id === me) });
        }
        route = page.next ? page.next.replace(API, '') : null;
    }
    return result.sort((a, b) => Number(b.mine) - Number(a.mine));
}

module.exports = { configured, playlist, myPlaylists, authorizeUrl, connect, forgetUser, status };
