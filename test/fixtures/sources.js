const NAME = 'Playlist de test';
const TRACKS = [
    { uri: 'fixture:1', name: 'Billie Jean', artists: ['Michael Jackson'] },
    { uri: 'fixture:2', name: 'Alors on danse', artists: ['Stromae'] },
    { uri: 'fixture:3', name: 'Bohemian Rhapsody', artists: ['Queen'] },
    { uri: 'fixture:4', name: 'Purple Rain', artists: ['Prince'] },
    { uri: 'fixture:5', name: 'Sweet Dreams', artists: ['Eurythmics'] },
    { uri: 'fixture:6', name: 'Smells Like Teen Spirit', artists: ['Nirvana'] }
].map((track) => ({ ...track, image: null, durationMs: 240000 }));

async function loadPlaylist(input) {
    if (!String(input || '').startsWith('fixture:')) throw new Error('Lien de playlist invalide : colle un lien Spotify ou Deezer');
    return { id: 'fixture', source: 'deezer', name: NAME, image: null, tracks: TRACKS.map((track) => ({ ...track })) };
}

async function resolveAll(tracks, options = {}) {
    for (const track of tracks) {
        if (options.cancelled && options.cancelled()) return;
        track.match = { source: 'fixture', id: track.uri };
        if (options.onProgress) options.onProgress(track, track.match);
    }
}

async function freshUrl(match) {
    return `https://fixture.invalid/${encodeURIComponent(match.id)}.mp3`;
}

function byUrl(url) {
    const match = String(url || '').match(/fixture\.invalid\/(.+)\.mp3$/);
    if (!match) return null;
    const uri = decodeURIComponent(match[1]);
    return TRACKS.find((track) => track.uri === uri) || null;
}

function keyword(track) {
    return track.name.split(' ').reduce((best, word) => (word.length > best.length ? word : best), '');
}

module.exports = { NAME, TRACKS, loadPlaylist, resolveAll, freshUrl, byUrl, keyword };
