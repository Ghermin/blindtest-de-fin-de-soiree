const config = require('./config.js');

const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com';
const SCOPES = 'user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative';

function parsePlaylistId(input) {
    const text = String(input || '').trim();
    const url = text.match(/playlist[/:]([A-Za-z0-9]{16,})/);
    if (url) return url[1];
    if (/^[A-Za-z0-9]{16,}$/.test(text)) return text;
    return null;
}

function basicAuth() {
    return 'Basic ' + Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
}

function configured() {
    return Boolean(config.spotify.clientId && config.spotify.clientSecret);
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

async function tokenRequest(params) {
    const response = await fetch(`${ACCOUNTS}/api/token`, {
        method: 'POST',
        headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(`Spotify a refusé (${response.status}) : ${data.error_description || data.error || '?'}`);
        error.status = response.status;
        throw error;
    }
    return data;
}

function exchangeCode(code, redirectUri) {
    return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
}

function createClient(options = {}) {
    const state = {
        refreshToken: options.refreshToken || '',
        accessToken: '',
        expiresAt: 0,
        deviceName: options.deviceName || '',
        deviceId: options.deviceId || '',
        account: options.account || null
    };

    async function accessToken() {
        if (state.accessToken && Date.now() < state.expiresAt) return state.accessToken;
        if (!configured()) throw new Error('Spotify non configuré : renseigne SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET dans .env');
        if (!state.refreshToken) throw new Error('Spotify non connecté : l\'hôte doit connecter son compte depuis le panneau hôte');
        const data = await tokenRequest({ grant_type: 'refresh_token', refresh_token: state.refreshToken });
        state.accessToken = data.access_token;
        state.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
        if (data.refresh_token) state.refreshToken = data.refresh_token;
        return state.accessToken;
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

    async function playlist(id) {
        const meta = await api('GET', `/playlists/${id}?fields=name,images,tracks.total`);
        const tracks = [];
        let route = `/playlists/${id}/tracks?limit=100&market=from_token&fields=next,items(is_local,track(uri,name,duration_ms,is_playable,artists(name),album(images)))`;
        while (route) {
            const page = await api('GET', route);
            for (const item of page.items || []) {
                const track = item.track;
                if (!track || item.is_local || track.is_playable === false || !track.uri || !track.uri.startsWith('spotify:track:')) continue;
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
        const result = [];
        let route = '/me/playlists?limit=50';
        while (route && result.length < 200) {
            const page = await api('GET', route);
            for (const item of page.items || []) {
                if (!item || !item.id) continue;
                result.push({ id: item.id, name: item.name, total: item.tracks ? item.tracks.total : 0, owner: item.owner ? item.owner.display_name : '' });
            }
            route = page.next ? page.next.replace(API, '') : null;
        }
        return result;
    }

    function devices() {
        return api('GET', '/me/player/devices').then((data) => (data && data.devices) || []);
    }

    function transfer(deviceId) {
        state.deviceId = deviceId;
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

    async function preferredDevice() {
        if (state.deviceId) return state.deviceId;
        if (!state.deviceName) return '';
        const wanted = state.deviceName.toLowerCase();
        const found = (await devices()).find((device) => device.name.toLowerCase().includes(wanted));
        return found ? found.id : '';
    }

    async function ensurePlay(uri, positionMs) {
        const preferred = await preferredDevice().catch(() => '');
        try {
            await play(uri, positionMs, preferred);
            return;
        } catch (error) {
            if (error.status !== 404 && error.reason !== 'NO_ACTIVE_DEVICE') throw error;
        }
        state.deviceId = '';
        const list = await devices();
        if (!list.length) throw new Error('Aucun appareil Spotify visible : lance une lecture depuis ton téléphone ou caste une fois sur la TV');
        const target = list.find((device) => device.is_active) || list[0];
        await play(uri, positionMs, target.id);
    }

    async function confirmPlaying(uri, timeoutMs = 6000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const current = await player().catch(() => null);
            if (current && current.is_playing && current.item && current.item.uri === uri) return true;
            await new Promise((resolve) => setTimeout(resolve, 400));
        }
        return false;
    }

    function connected() {
        return Boolean(state.refreshToken);
    }

    async function adopt(tokens) {
        state.refreshToken = tokens.refresh_token || state.refreshToken;
        state.accessToken = tokens.access_token || '';
        state.expiresAt = tokens.expires_in ? Date.now() + (tokens.expires_in - 60) * 1000 : 0;
        const me = await api('GET', '/me').catch(() => null);
        state.account = me ? { id: me.id, name: me.display_name || me.id, premium: me.product === 'premium' } : null;
        return state.account;
    }

    function status() {
        return { connected: connected(), account: state.account, deviceName: state.deviceName, deviceId: state.deviceId };
    }

    function toJSON() {
        return { refreshToken: state.refreshToken, deviceName: state.deviceName, deviceId: state.deviceId, account: state.account };
    }

    return { accessToken, api, playlist, myPlaylists, devices, transfer, play, pause, player, ensurePlay, confirmPlaying, connected, adopt, status, toJSON };
}

module.exports = { SCOPES, parsePlaylistId, configured, authorizeUrl, exchangeCode, createClient };
