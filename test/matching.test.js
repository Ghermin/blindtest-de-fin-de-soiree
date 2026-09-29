const test = require('node:test');
const assert = require('node:assert');
const { normalize, matchesTitle, matchesArtist, distance } = require('../src/matching.js');

test('normalize enlève accents, casse et suffixes', () => {
    assert.strictEqual(normalize('Désenchantée'), 'desenchantee');
    assert.strictEqual(normalize('Song 2 - Remastered 2011'), 'song 2');
    assert.strictEqual(normalize('Get Lucky (feat. Pharrell Williams)'), 'get lucky');
    assert.strictEqual(normalize('Papaoutai feat. Angèle'), 'papaoutai');
});

test('le titre matche malgré accents et article', () => {
    assert.ok(matchesTitle('l aventurier', "L'Aventurier"));
    assert.ok(matchesTitle('aventurier', "L'Aventurier"));
    assert.ok(matchesTitle('desenchantee', 'Désenchantée'));
});

test('le titre tolère une petite faute', () => {
    assert.ok(matchesTitle('bohemian rapsody', 'Bohemian Rhapsody'));
    assert.ok(matchesTitle('alors on dance', 'Alors on danse'));
});

test('le titre refuse un mauvais guess', () => {
    assert.ok(!matchesTitle('thriller', 'Billie Jean'));
    assert.ok(!matchesTitle('', 'Billie Jean'));
    assert.ok(!matchesTitle('b', 'Billie Jean'));
});

test('les titres courts exigent l\'exactitude', () => {
    assert.ok(matchesTitle('roar', 'Roar'));
    assert.ok(!matchesTitle('roas', 'Roa'));
});

test('un seul artiste suffit', () => {
    assert.ok(matchesArtist('daft punk', ['Daft Punk', 'Pharrell Williams']));
    assert.ok(matchesArtist('pharrell williams', ['Daft Punk', 'Pharrell Williams']));
    assert.ok(!matchesArtist('stromae', ['Daft Punk', 'Pharrell Williams']));
});

test('artiste tolérant aux fautes', () => {
    assert.ok(matchesArtist('beyonce', ['Beyoncé']));
    assert.ok(matchesArtist('the weekend', ['The Weeknd']));
    assert.ok(matchesArtist('weeknd', ['The Weeknd']));
});

test('un mot significatif suffit', () => {
    assert.ok(matchesTitle('billie', 'Billie Jean'));
    assert.ok(matchesTitle('danse', 'Alors on danse'));
    assert.ok(matchesTitle('bohemian', 'Bohemian Rhapsody'));
    assert.ok(matchesTitle('rhapsody bohemian', 'Bohemian Rhapsody'));
    assert.ok(matchesTitle('story', 'Love Story'));
    assert.ok(matchesArtist('daft', ['Daft Punk']));
    assert.ok(matchesArtist('jackson', ['Michael Jackson']));
});

test('un mot court ou secondaire ne suffit pas', () => {
    assert.ok(!matchesTitle('jean', 'Billie Jean'));
    assert.ok(!matchesTitle('love', 'Love Story'));
    assert.ok(!matchesTitle('on', 'Alors on danse'));
    assert.ok(!matchesTitle('the', 'Hit the Road Jack'));
    assert.ok(!matchesTitle('queen', 'Dancing Queen'));
    assert.ok(!matchesTitle('billie thriller', 'Billie Jean'));
});

test('la distance normalisée sert à trouver la réponse la plus hors sujet', () => {
    assert.strictEqual(distance('Billie Jean', 'billie jean'), 0);
    assert.ok(distance('céline dion', 'Bohemian Rhapsody') > 0.7);
    assert.ok(distance('bohemian rapsody', 'Bohemian Rhapsody') < 0.1);
});
