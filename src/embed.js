const http = require('./http.js');

const PAGE = 'https://open.spotify.com/embed/playlist/';
const MAX_TRACKS = 100;

function parse(html) {
    const found = String(html || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!found) return null;
    let data;
    try {
        data = JSON.parse(found[1]);
    } catch {
        return null;
    }
    const props = data && data.props && data.props.pageProps;
    const entity = props && props.state && props.state.data && props.state.data.entity;
    if (!entity || entity.type !== 'playlist' || !Array.isArray(entity.trackList)) return null;
    const tracks = [];
    for (const item of entity.trackList) {
        if (!item || !item.uri || !item.uri.startsWith('spotify:track:') || item.isPlayable === false) continue;
        if (!item.duration || item.duration < 45000) continue;
        const preview = item.audioPreview && item.audioPreview.url ? item.audioPreview.url : '';
        tracks.push({
            uri: item.uri,
            name: item.title || '',
            artists: String(item.subtitle || '').split(', ').map((artist) => artist.trim()).filter(Boolean),
            image: null,
            durationMs: item.duration,
            match: preview ? { source: 'spotify', url: preview } : null
        });
    }
    const sources = entity.coverArt && Array.isArray(entity.coverArt.sources) ? entity.coverArt.sources : [];
    return {
        name: entity.name || entity.title || 'Playlist Spotify',
        image: sources[0] && sources[0].url ? sources[0].url : null,
        tracks,
        partial: entity.trackList.length >= MAX_TRACKS
    };
}

async function playlist(id) {
    const response = await http.request(PAGE + encodeURIComponent(id), { headers: { Accept: 'text/html' } });
    const data = response.status === 200 ? parse(response.text) : null;
    if (!data) throw new Error('Playlist Spotify introuvable ou privée : vérifie le lien, ou utilise une playlist Deezer');
    return data;
}

module.exports = { parse, playlist };
