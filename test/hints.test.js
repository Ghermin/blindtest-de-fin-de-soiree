const test = require('node:test');
const assert = require('node:assert');
const { pattern, hints } = require('../src/hints.js');

const track = { name: 'Bohemian Rhapsody - Remastered 2011', artists: ['Queen', 'Freddie Mercury'] };

test('le motif donne le nombre de lettres par mot', () => {
    assert.strictEqual(pattern('Bohemian Rhapsody - Remastered 2011', false), '________ ________');
    assert.strictEqual(pattern("L'Aventurier", false), '_ __________');
    assert.strictEqual(pattern('Désenchantée', false), '____________');
});

test('le motif révèle la première lettre en majuscule', () => {
    assert.strictEqual(pattern('Bohemian Rhapsody', true), 'B_______ ________');
    assert.strictEqual(pattern('alors on danse', true), 'A____ __ _____');
});

test('les indices suivent le mode et le palier', () => {
    assert.strictEqual(hints(track, 'both', 0), null);
    assert.strictEqual(hints(null, 'both', 1), null);
    assert.deepStrictEqual(hints(track, 'both', 1), { title: '________ ________', artist: '_____' });
    assert.deepStrictEqual(hints(track, 'title', 2), { title: 'B_______ ________' });
    assert.deepStrictEqual(hints(track, 'artist', 2), { artist: 'Q____' });
});
