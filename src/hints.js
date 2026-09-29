const { normalize } = require('./matching.js');

function pattern(text, revealFirst) {
    const cleaned = normalize(text);
    let shown = false;
    return cleaned.split('').map((char) => {
        if (char === ' ') return ' ';
        if (revealFirst && !shown) {
            shown = true;
            return char.toUpperCase();
        }
        return '_';
    }).join('');
}

function hints(track, mode, stage) {
    if (!track || !stage) return null;
    const revealFirst = stage >= 2;
    const result = {};
    if (mode !== 'artist') result.title = pattern(track.name, revealFirst);
    if (mode !== 'title' && track.artists && track.artists.length) result.artist = pattern(track.artists[0], revealFirst);
    return result;
}

module.exports = { pattern, hints };
