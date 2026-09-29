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

function words(text) {
    return stripArticle(normalize(text)).split(' ').filter(Boolean);
}

function matchesWords(guess, target) {
    const guessWords = words(guess);
    const targetWords = words(target);
    if (!guessWords.length || !targetWords.length) return false;
    const used = new Set();
    let covered = 0;
    let longest = 0;
    for (const word of guessWords) {
        const index = targetWords.findIndex((candidate, i) => !used.has(i) && close(word, candidate));
        if (index === -1) return false;
        used.add(index);
        covered += targetWords[index].length;
        longest = Math.max(longest, targetWords[index].length);
    }
    const total = targetWords.reduce((sum, word) => sum + word.length, 0);
    const maxLength = Math.max(...targetWords.map((word) => word.length));
    if (covered / total >= 0.5) return true;
    return guessWords.length === 1 && longest >= 5 && longest === maxLength;
}

function matchesOne(guess, target) {
    const guesses = candidates(guess);
    const targets = candidates(target);
    return guesses.some((g) => targets.some((t) => close(g, t))) || matchesWords(guess, target);
}

function matchesTitle(guess, title) {
    return matchesOne(guess, title);
}

function matchesArtist(guess, artists) {
    return (artists || []).some((artist) => matchesOne(guess, artist));
}

function distance(guess, target) {
    const a = normalize(guess);
    const b = normalize(target);
    if (!a || !b) return 1;
    return levenshtein(a, b) / Math.max(a.length, b.length);
}

module.exports = { normalize, levenshtein, matchesTitle, matchesArtist, matchesWords, distance };
