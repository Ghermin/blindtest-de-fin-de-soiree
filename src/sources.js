const spotify = require('./spotify.js');
const deezer = require('./deezer.js');
const embed = require('./embed.js');

function parseLink(input) {
    const text = String(input || '').trim();
    const spotifyLink = text.match(/(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?playlist\/|spotify:playlist:)([A-Za-z0-9]{16,})/);
    if (spotifyLink) return { source: 'spotify', id: spotifyLink[1] };
    const deezerLink = text.match(/deezer\.com\/(?:[a-z]{2}\/)?playlist\/(\d+)/);
    if (deezerLink) return { source: 'deezer', id: deezerLink[1] };
    const deezerShort = text.match(/^deezer:playlist:(\d+)$/);
    if (deezerShort) return { source: 'deezer', id: deezerShort[1] };
    if (/^[A-Za-z0-9]{16,}$/.test(text)) return { source: 'spotify', id: text };
    if (/^\d{4,}$/.test(text)) return { source: 'deezer', id: text };
    return null;
}

async function loadPlaylist(input) {
    const link = parseLink(input);
    if (!link) throw new Error('Lien de playlist invalide : colle un lien Spotify (open.spotify.com/playlist/…) ou Deezer (deezer.com/…/playlist/…)');
    if (link.source === 'deezer') {
        const data = await deezer.playlist(link.id);
        return { ...data, id: link.id, source: 'deezer' };
    }
    let data;
    try {
        data = await spotify.playlist(link.id);
    } catch (_official) {
        data = await embed.playlist(link.id);
    }
    return { ...data, id: link.id, source: 'spotify' };
}

module.exports = { parseLink, loadPlaylist };
