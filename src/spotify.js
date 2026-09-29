const config = require('./config.js');
const http = require('./http.js');

const API = 'https://api.spotify.com/v1';
let cached = { token: '', expiresAt: 0 };

function configured() {
    return Boolean(config.spotify.clientId && config.spotify.clientSecret);
}

async function token() {
    if (cached.token && Date.now() < cached.expiresAt) return cached.token;
    if (!configured()) {
        throw new Error('Playlists Spotify indisponibles : renseigne SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET dans .env, ou colle un lien de playlist Deezer');
    }
    const response = await http.request('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    if (response.status !== 200 || !response.json || !response.json.access_token) {
        const detail = response.json && (response.json.error_description || response.json.error);
        throw new Error(`Spotify refuse les identifiants de l'app (${response.status}${detail ? ` : ${detail}` : ''})`);
    }
    cached = { token: response.json.access_token, expiresAt: Date.now() + (response.json.expires_in - 60) * 1000 };
    return cached.token;
}

async function api(route) {
    const response = await http.request(API + route, { headers: { Authorization: `Bearer ${await token()}` } });
    if (response.status >= 400) {
        const reason = response.json && response.json.error ? response.json.error.message : `HTTP ${response.status}`;
        const error = new Error(`Spotify ${response.status} : ${reason}`);
        error.status = response.status;
        throw error;
    }
    return response.json;
}

async function playlist(id) {
    const meta = await api(`/playlists/${id}?fields=name,images,tracks.total`);
    const tracks = [];
    let route = `/playlists/${id}/tracks?limit=100&fields=next,items(is_local,track(uri,name,duration_ms,artists(name),album(images)))`;
    while (route) {
        const page = await api(route);
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

module.exports = { configured, playlist };
