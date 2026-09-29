const config = require('./config.js');

const API = 'https://api.spotify.com/v1';
let cached = { token: null, expiresAt: 0 };

async function accessToken() {
    if (cached.token && Date.now() < cached.expiresAt) return cached.token;
    const { clientId, clientSecret, refreshToken } = config.spotify;
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Spotify non configuré : renseigne .env puis lance npm run auth');
    }
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Refresh token refusé (${response.status}) : ${data.error_description || data.error || '?'}`);
    cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return cached.token;
}

async function api(method, route, body) {
    const token = await accessToken();
    const response = await fetch(API + route, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    if (response.status === 204) return null;
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const reason = data && data.error ? data.error.reason || data.error.message : response.statusText;
        const error = new Error(`Spotify ${response.status} : ${reason}`);
        error.status = response.status;
        error.reason = data && data.error ? data.error.reason : null;
        throw error;
    }
    return data;
}

function parsePlaylistId(input) {
    const text = String(input || '').trim();
    const url = text.match(/playlist[/:]([A-Za-z0-9]{16,})/);
    if (url) return url[1];
    if (/^[A-Za-z0-9]{16,}$/.test(text)) return text;
    return null;
}

async function playlist(id) {
    const meta = await api('GET', `/playlists/${id}?fields=name,images,tracks.total`);
    const tracks = [];
    let route = `/playlists/${id}/tracks?limit=100&fields=next,items(is_local,track(uri,name,duration_ms,artists(name),album(images)))`;
    while (route) {
        const page = await api('GET', route);
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

function devices() {
    return api('GET', '/me/player/devices').then((data) => (data && data.devices) || []);
}

function transfer(deviceId) {
    return api('PUT', '/me/player', { device_ids: [deviceId], play: false });
}

function play(uri, positionMs, deviceId) {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return api('PUT', `/me/player/play${query}`, { uris: [uri], position_ms: positionMs });
}

function pause() {
    return api('PUT', '/me/player/pause').catch((error) => {
        if (error.status !== 403 && error.status !== 404) throw error;
    });
}

function player() {
    return api('GET', '/me/player');
}

async function ensurePlay(uri, positionMs) {
    try {
        await play(uri, positionMs);
        return;
    } catch (error) {
        if (error.status !== 404 && error.reason !== 'NO_ACTIVE_DEVICE') throw error;
    }
    const list = await devices();
    if (!list.length) throw new Error('Aucun appareil Spotify visible : lance une lecture depuis ton téléphone ou caste une fois sur la TV');
    const wanted = config.spotify.deviceName.toLowerCase();
    const target = list.find((device) => wanted && device.name.toLowerCase().includes(wanted))
        || list.find((device) => device.is_active)
        || list[0];
    await play(uri, positionMs, target.id);
}

async function confirmPlaying(uri, timeoutMs = 6000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const state = await player().catch(() => null);
        if (state && state.is_playing && state.item && state.item.uri === uri) return true;
        await new Promise((resolve) => setTimeout(resolve, 400));
    }
    return false;
}

module.exports = { accessToken, api, parsePlaylistId, playlist, devices, transfer, play, pause, player, ensurePlay, confirmPlaying };
