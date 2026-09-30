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

function coverage(guess, target) {
    const guessWords = words(guess);
    const targetWords = words(target);
    if (!guessWords.length || !targetWords.length) return null;
    const used = new Set();
    let covered = 0;
    let longest = 0;
    for (const word of guessWords) {
        const index = targetWords.findIndex((candidate, i) => !used.has(i) && close(word, candidate));
        if (index === -1) return null;
        used.add(index);
        covered += targetWords[index].length;
        longest = Math.max(longest, targetWords[index].length);
    }
    const total = targetWords.reduce((sum, word) => sum + word.length, 0);
    const maxLength = Math.max(...targetWords.map((word) => word.length));
    return { ratio: covered / total, single: guessWords.length === 1, longest, maxLength, complete: used.size === targetWords.length };
}

function matchesWords(guess, target) {
    const found = coverage(guess, target);
    if (!found) return false;
    if (found.ratio >= 0.5) return true;
    return found.single && found.longest >= 5 && found.longest === found.maxLength;
}

function quality(guess, target) {
    const guesses = candidates(guess);
    const targets = candidates(target);
    if (!guesses[0] || !targets[0]) return 0;
    if (guesses.some((g) => targets.includes(g))) return 1;
    if (guesses.some((g) => targets.some((t) => close(g, t)))) return 0.9;
    const found = coverage(guess, target);
    if (found && found.complete) return 0.9;
    return matchesWords(guess, target) ? 0.7 : 0;
}

function titleQuality(guess, title) {
    return quality(guess, title);
}

function artistQuality(guess, artists) {
    return Math.max(0, ...(artists || []).map((artist) => quality(guess, artist)));
}

function matchesTitle(guess, title) {
    return titleQuality(guess, title) > 0;
}

function matchesArtist(guess, artists) {
    return artistQuality(guess, artists) > 0;
}

function splitGuess(guess, title, artists) {
    const guessWords = words(String(guess || '').replace(/\s+-\s+/g, ' '));
    const titleWords = words(title);
    const artistWords = (artists || []).flatMap((artist) => words(artist));
    const forTitle = [];
    const forArtist = [];
    for (const word of guessWords) {
        if (titleWords.some((candidate) => close(word, candidate))) forTitle.push(word);
        else if (artistWords.some((candidate) => close(word, candidate))) forArtist.push(word);
        else return null;
    }
    if (!forTitle.length || !forArtist.length) return null;
    return { title: forTitle.join(' '), artist: forArtist.join(' ') };
}

function distance(guess, target) {
    const a = normalize(guess);
    const b = normalize(target);
    if (!a || !b) return 1;
    return levenshtein(a, b) / Math.max(a.length, b.length);
}

module.exports = { normalize, levenshtein, close, matchesTitle, matchesArtist, matchesWords, titleQuality, artistQuality, splitGuess, distance };
