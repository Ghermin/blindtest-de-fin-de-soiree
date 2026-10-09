const matching = require('./matching.js');

const MAX_LENGTH = 42;
const MARKER_SOURCE = [
    '(?:original\\s+)?(?:motion\\s+picture\\s+|television\\s+|tv\\s+|series\\s+|animation\\s+|anime\\s+|video\\s+game\\s+|game\\s+)?sound\\s*tracks?',
    '(?:original|motion\\s+picture|film|movie|game)\\s+score',
    'o\\.s\\.t\\.?',
    '\\bost\\b',
    'musics?\\s+from\\s+(?:the\\s+)?(?:[\\w.]+\\s+)?(?:motion\\s+picture|film|movie|series|show|video\\s+game)',
    'themes?\\s+from',
    'bandes?[\\s-]originales?',
    'b\\.o\\.(?:f\\.?)?',
    'musiques?\\s+(?:originales?\\s+)?d[ue]\\s+(?:films?|jeux?|dessins?\\s+anim[ée]s?)'
].join('|');
const MARKER = new RegExp(MARKER_SOURCE, 'i');
const MARKERS = new RegExp(MARKER_SOURCE, 'gi');
const GENERIC = /^(?:various artists|artistes divers|compilation|soundtrack|ost|score|music|musique|musiques|songs|song|single|ep|album|deluxe|edition|bonus|anime|film|movie|serie|series|saison|season|vol|volume|the|le|la|les|a|an|opening|ending|op|ed|theme|themes|main theme|theme song|ending theme|opening theme|insert song|image song|character song|generique|vocal|instrumental|tv size|collection|best|original)$/;

const BLOCKED = /^(?:the )?first take$|^(?:the )?voice$|^from\b|^extrait|^tir[ée]e? d|^best of|^classical\b|^movies?\b|\bmovies?$|^live\b|^karaoke|^cover\b|^tribute|^orgel|^instrumental|^piano|^acoustic|^remix|^radio edit|^session|^unplugged|^medley|^mashup|^\d{2,}\s|^the very best|\b(?:remix|version|edit|mix|cover|instrumental|live|karaoke|session|take)$|\b(?:anthologie|greatest hits|gold edition|classics|compilation|titres|tracks)\b/i;

const FROM = /\bfrom\s+(?:the\s+)?(?:motion\s+picture|film|movie|tv\s+series|series|show|anime|video\s+game|game)?\s*["“«']?\s*([^"”»']+?)\s*["”»']?\s*$/i;
const FROM_FR = /\b(?:extrait|tir[ée]e?|issue?)\s+d[eu]\s*(?:la\s+s[ée]rie|l['’]anime|film)?\s*["“«']?\s*([^"”»']+?)\s*["”»']?\s*$/i;
const BO_FR = /^(?:bande[\s-]originale|b\.o\.|g[ée]n[ée]rique|musique)\s+(?:du\s+film|de\s+la\s+s[ée]rie|de\s+l['’]anime|du|de\s+la|des|de)\s+["“«']?\s*(.+?)\s*["”»']?$/i;
const OST_SUFFIX = /^(.+?)\s+(?:original\s+)?(?:sound\s*track|ost)\b/i;
const THEME = /^(.+?)\s+(?:opening|ending|insert\s+song|image\s+song|character\s+song|main\s+theme|theme\s+song|op|ed)\b/i;
const RULES = [FROM, FROM_FR, BO_FR, OST_SUFFIX, THEME];

let cache = null;

function clean(text) {
    return String(text || '')
        .replace(/\(\s*\)|\[\s*\]/g, ' ')
        .replace(/^(?:tv\s*アニメ|アニメ|劇場版|映画)\s*/i, '')
        .replace(/["“”«»『』「」【】]/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[\s\-–—:,.·]+/, '')
        .replace(/[\s\-–—:,.·]+$/, '')
        .trim();
}

const PUNCTUATION = /[\s!-/:-@[-`{-~\u00a1-\u00bf\u2000-\u206f\u3000-\u303f\uff01-\uff20\uff3b-\uff40\uff5b-\uff65]+/g;

function key(text) {
    const latin = matching.normalize(text);
    return latin || String(text || '').toLowerCase().replace(PUNCTUATION, '');
}

function simplify(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(PUNCTUATION, ' ')
        .trim();
}

function segments(text) {
    const found = [];
    const brackets = /[([]\s*([^)\]]+?)\s*[)\]]/g;
    let match = brackets.exec(text);
    while (match) {
        found.push(match[1]);
        match = brackets.exec(text);
    }
    for (const part of String(text || '').split(/\s+[-–—]\s+/).slice(1)) found.push(part.trim());
    return found.filter(Boolean);
}

function fromSegment(segment) {
    for (const rule of RULES) {
        const match = segment.match(rule);
        if (match) return clean(match[1]);
    }
    return '';
}

function fromTitle(name) {
    const found = [];
    for (const segment of segments(name)) {
        const bare = segment.replace(MARKERS, ' ').replace(/\s{2,}/g, ' ').trim();
        if (bare && bare !== segment) found.push(fromSegment(bare));
        found.push(fromSegment(segment));
    }
    return found.filter(Boolean);
}

function fromAlbum(album) {
    if (!album || !MARKER.test(album)) return '';
    let rest = String(album).replace(/\s*[([][^)\]]*[)\]]/g, (part) => (MARKER.test(part) ? ' ' : part));
    if (MARKER.test(rest)) rest = rest.replace(MARKERS, ' ');
    return clean(clean(rest).replace(/[\s,:-]+(?:collection|complete|anthology|best|vol\.?\s*\d+|volume\s*\d+)\s*$/i, ''));
}

function table() {
    if (!cache) {
        try {
            cache = require('./works.json');
        } catch (_missing) {
            cache = {};
        }
    }
    return cache;
}

function bareKey(name) {
    return key(String(name || '').replace(/\s*[([][^)\]]*[)\]]/g, ' ').replace(/\s*-[^-]*-\s*$/, ' '));
}

function fromTable(track) {
    const artists = (track.artists || []).map((artist) => key(artist)).filter(Boolean);
    for (const wanted of [...new Set([key(track.name), bareKey(track.name)])]) {
        const entries = wanted.length >= 2 ? table()[wanted] : null;
        if (!entries || !entries.length) continue;
        const found = entries.find(([performer]) => performer && artists.some((artist) => artist === performer || artist.includes(performer) || performer.includes(artist)));
        if (found) return found[1];
        const agreed = entries.every(([, value]) => value === entries[0][1]);
        if (agreed && wanted.length >= 6) return entries[0][1];
    }
    return '';
}

function accept(value, track) {
    if (!value || value.length < 2 || value.length > MAX_LENGTH || MARKER.test(value)) return '';
    const wanted = key(value);
    if (!wanted || wanted.length < 2 || GENERIC.test(wanted) || BLOCKED.test(value.trim())) return '';
    if (wanted === key(track.name)) return '';
    if ((track.artists || []).some((artist) => key(artist).includes(wanted))) return '';
    return value;
}

function work(track) {
    if (!track) return '';
    if (track.work) return track.work;
    const album = track.album || (track.match && track.match.album) || '';
    for (const candidate of [...fromTitle(track.name || ''), fromAlbum(album), fromTable(track)]) {
        const value = accept(candidate, track);
        if (value) return value;
    }
    return '';
}

function withWork(label, track) {
    const value = work(track);
    if (!value) return label;
    const key = simplify(value);
    if (!key || simplify(label).includes(key)) return label;
    return `${label} (${value})`;
}

module.exports = { work, withWork, key };
