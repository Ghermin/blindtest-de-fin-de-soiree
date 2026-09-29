const ARTICLES = /^(the|le|la|les|l|un|une|des|a|an|el|los|las|il|i)\s+/;

function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s*[([].*?[)\]]/g, '')
        .replace(/\s+-\s+.*$/, '')
        .replace(/\s+(feat|ft|featuring|avec|with)\.?\s+.*$/, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function stripArticle(text) {
    return text.replace(ARTICLES, '');
}

function levenshtein(a, b) {
    if (a === b) return 0;
    const rows = a.length + 1;
    const cols = b.length + 1;
    let previous = Array.from({ length: cols }, (_, i) => i);
    for (let i = 1; i < rows; i++) {
        const current = [i];
        for (let j = 1; j < cols; j++) {
            const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
        }
        previous = current;
    }
    return previous[cols - 1];
}

function close(guess, target) {
    if (!guess || !target) return false;
    if (guess === target) return true;
    if (target.length < 4) return false;
    const tolerance = 1 + Math.floor(target.length / 8);
    return levenshtein(guess, target) <= tolerance;
}

function candidates(text) {
    const base = normalize(text);
    const bare = stripArticle(base);
    return base === bare ? [base] : [base, bare];
}

function matchesOne(guess, target) {
    const guesses = candidates(guess);
    const targets = candidates(target);
    return guesses.some((g) => targets.some((t) => close(g, t)));
}

function matchesTitle(guess, title) {
    return matchesOne(guess, title);
}

function matchesArtist(guess, artists) {
    return (artists || []).some((artist) => matchesOne(guess, artist));
}

module.exports = { normalize, levenshtein, matchesTitle, matchesArtist };
