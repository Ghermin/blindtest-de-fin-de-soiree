const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.js');
const http = require('./http.js');
const deezer = require('./deezer.js');
const matching = require('./matching.js');

const ITUNES_SPACING_MS = 3500;
const FLAGS = /\b(live|remix|karaoke|instrumental|cover|acoustic|acoustique|version|edit|mix|demo|reprise)\b/i;
let cache = null;
let saveTimer = null;
let lastItunes = 0;

function cacheFile() {
    return path.join(config.dataDir, 'previews.json');
}

function loadCache() {
    if (cache) return cache;
    try {
        cache = JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
    } catch {
        cache = {};
    }
    return cache;
}

function remember(uri, match) {
    loadCache()[uri] = { ...match, checkedAt: Date.now() };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
            fs.writeFileSync(cacheFile(), JSON.stringify(cache), { mode: 0o600 });
        } catch (error) {
            console.log(`Cache des extraits non sauvegardé : ${error.message}`);
        }
    }, 1000);
    if (saveTimer.unref) saveTimer.unref();
}

function score(track, candidate) {
    const title = matching.normalize(track.name);
    const candidateTitle = matching.normalize(candidate.title);
    if (!title || !candidateTitle) return -1;
    let total = 0;
    if (title === candidateTitle) total += 3;
    else if (matching.close(title, candidateTitle)) total += 2;
    else return -1;
    const artists = track.artists.map((artist) => matching.normalize(artist)).filter(Boolean);
    const candidateArtist = matching.normalize(candidate.artist);
    const artistOk = artists.some((artist) => artist === candidateArtist
        || matching.close(artist, candidateArtist)
        || (artist.length >= 4 && candidateArtist.includes(artist))
        || (candidateArtist.length >= 4 && artist.includes(candidateArtist)));
    if (!artistOk) return -1;
    total += 2;
    const diff = Math.abs((candidate.durationMs || 0) - (track.durationMs || 0)) / 1000;
    if (track.durationMs && candidate.durationMs) {
        if (diff <= 3) total += 2;
        else if (diff <= 10) total += 1;
        else if (diff > 40) total -= 2;
    }
    if (FLAGS.test(candidate.title) && !FLAGS.test(track.name)) total -= 3;
    if (!candidate.url) total -= 10;
    return total;
}

function pick(track, candidates) {
    let best = null;
    let bestScore = 4;
    for (const candidate of candidates) {
        const value = score(track, candidate);
        if (value > bestScore) {
            best = candidate;
            bestScore = value;
        }
    }
    return best;
}

function query(track) {
    const artist = track.artists[0] || '';
    return `${artist} ${matching.normalize(track.name)}`.trim();
}

async function itunesSearch(track) {
    const wait = lastItunes + ITUNES_SPACING_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastItunes = Date.now();
    const params = new URLSearchParams({ term: query(track), media: 'music', entity: 'song', limit: '10', country: config.country });
    const data = await http.getJson(`https://itunes.apple.com/search?${params}`);
    return (data.results || []).map((item) => ({
        id: item.trackId,
        title: item.trackName || '',
        artist: item.artistName || '',
        durationMs: item.trackTimeMillis || 0,
        url: item.previewUrl || '',
        image: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : null
    }));
}

async function cover(track, match) {
    if (match.source === 'deezer' && match.id) return (await deezer.track(match.id)).image;
    const found = pick(track, await deezer.search(query(track)));
    return found ? found.image : null;
}

async function withCover(track, match) {
    if (track.image || match.image) return match;
    const cached = loadCache()[track.uri];
    if (cached && cached.image) return { ...match, image: cached.image };
    const image = await cover(track, match).catch(() => null);
    if (!image) return match;
    remember(track.uri, cached && cached.source ? { ...cached, image } : { image });
    return { ...match, image };
}

async function resolve(track) {
    if (track.match) return withCover(track, track.match);
    const cached = loadCache()[track.uri];
    if (cached && cached.source) return withCover(track, { source: cached.source, id: cached.id, url: cached.url, image: cached.image || null });
    const fromDeezer = pick(track, await deezer.search(query(track)).catch(() => []));
    if (fromDeezer) {
        const match = { source: 'deezer', id: fromDeezer.id, image: fromDeezer.image || null };
        remember(track.uri, match);
        return match;
    }
    const fromItunes = pick(track, await itunesSearch(track).catch(() => []));
    if (fromItunes) {
        const match = { source: 'itunes', id: fromItunes.id, url: fromItunes.url, image: fromItunes.image || null };
        remember(track.uri, match);
        return match;
    }
    return null;
}

async function resolveAll(tracks, options = {}) {
    const cancelled = options.cancelled || (() => false);
    for (const track of tracks) {
        if (cancelled()) return;
        const match = await resolve(track).catch(() => null);
        if (cancelled()) return;
        track.match = match;
        if (options.onProgress) options.onProgress(track, match);
    }
}

async function freshUrl(match) {
    if (!match) throw new Error('Aucun extrait pour ce titre');
    if (match.source === 'deezer') return deezer.preview(match.id);
    if (match.url) return match.url;
    throw new Error('Extrait introuvable');
}

module.exports = { score, pick, query, resolve, resolveAll, freshUrl };
