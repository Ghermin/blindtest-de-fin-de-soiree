const http = require('./http.js');

const API = 'https://api.deezer.com';
const SPACING_MS = 130;
let lastCall = 0;

async function paced() {
    const wait = lastCall + SPACING_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCall = Date.now();
}

async function call(route, retry = true) {
    await paced();
    const data = await http.getJson(API + route);
    if (data && data.error) {
        if (data.error.code === 4 && retry) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return call(route, false);
        }
        const error = new Error(`Deezer : ${data.error.message || data.error.type}`);
        error.code = data.error.code;
        throw error;
    }
    return data;
}

function normalizeTrack(track) {
    return {
        uri: `deezer:track:${track.id}`,
        name: track.title,
        artists: track.artist ? [track.artist.name] : [],
        image: track.album ? track.album.cover_medium || track.album.cover || null : null,
        durationMs: (track.duration || 0) * 1000,
        match: { source: 'deezer', id: track.id }
    };
}

async function playlist(id) {
    const meta = await call(`/playlist/${id}`);
    const tracks = [];
    let route = `/playlist/${id}/tracks?limit=100&index=0`;
    while (route) {
        const page = await call(route);
        for (const track of page.data || []) {
            if (!track || !track.id || track.readable === false) continue;
            if (!track.duration || track.duration < 45) continue;
            tracks.push(normalizeTrack(track));
        }
        route = page.next ? page.next.replace(API, '') : null;
    }
    return { name: meta.title, image: meta.picture_medium || meta.picture || null, tracks };
}

async function search(query) {
    const data = await call(`/search?q=${encodeURIComponent(query)}&limit=10`);
    return (data.data || []).map((track) => ({
        id: track.id,
        title: track.title || '',
        artist: track.artist ? track.artist.name : '',
        durationMs: (track.duration || 0) * 1000,
        url: track.preview || ''
    }));
}

async function preview(id) {
    const track = await call(`/track/${id}`);
    if (!track || !track.preview) throw new Error(`Deezer : pas d'extrait pour la piste ${id}`);
    return track.preview;
}

async function searchPlaylists(query) {
    const text = String(query || '').trim().slice(0, 80);
    if (!text) return [];
    const data = await call(`/search/playlist?q=${encodeURIComponent(text)}&limit=10`);
    return (data.data || []).filter((item) => item && item.id && item.public !== false).map((item) => ({
        id: String(item.id),
        source: 'deezer',
        name: item.title || '',
        owner: item.user ? item.user.name : '',
        total: item.nb_tracks || 0,
        image: item.picture_medium || null
    }));
}

module.exports = { playlist, search, searchPlaylists, preview };
