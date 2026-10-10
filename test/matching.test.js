const test = require('node:test');
const assert = require('node:assert');
const { normalize, matchesTitle, matchesArtist, distance, titleQuality, artistQuality } = require('../src/matching.js');

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

test('titre et artiste tapés dans la même réponse sont séparés', () => {
    const { splitGuess } = require('../src/matching.js');
    assert.deepStrictEqual(splitGuess('runaway bon jovi', 'Runaway', ['Bon Jovi']), { title: 'runaway', artist: 'bon jovi' });
    assert.deepStrictEqual(splitGuess('Bon Jovi - Runaway', 'Runaway', ['Bon Jovi']), { title: 'runaway', artist: 'bon jovi' });
    assert.deepStrictEqual(splitGuess('alors on danse stromae', 'Alors on danse', ['Stromae']), { title: 'alors on danse', artist: 'stromae' });
    assert.strictEqual(splitGuess('runaway', 'Runaway', ['Bon Jovi']), null);
    assert.strictEqual(splitGuess('runaway bon jovi live', 'Runaway', ['Bon Jovi']), null);
});

test('la précision distingue réponse exacte, faute de frappe et mot-clé', () => {
    assert.strictEqual(titleQuality('Billie Jean', 'Billie Jean'), 1);
    assert.strictEqual(titleQuality('billie jean', 'Billie Jean (Remastered)'), 1);
    assert.strictEqual(titleQuality('bilie jean', 'Billie Jean'), 0.9);
    assert.strictEqual(titleQuality('jean billie', 'Billie Jean'), 0.9);
    assert.strictEqual(titleQuality('billie', 'Billie Jean'), 0.7);
    assert.strictEqual(titleQuality('thriller', 'Billie Jean'), 0);
    assert.strictEqual(titleQuality('', 'Billie Jean'), 0);
    assert.strictEqual(artistQuality('Michael Jackson', ['Michael Jackson']), 1);
    assert.strictEqual(artistQuality('jackson', ['Michael Jackson']), 0.7);
    assert.strictEqual(artistQuality('daft punk', ['Stromae', 'Daft Punk']), 1);
    assert.strictEqual(artistQuality('prince', ['Michael Jackson']), 0);
});

test('normalize garde le japonais au lieu de le vider', () => {
    assert.strictEqual(normalize('残酷な天使のテーゼ'), '残酷な天使のテーゼ');
    assert.strictEqual(normalize('紅蓮の弓矢'), '紅蓮の弓矢');
    assert.strictEqual(normalize('ウィーゴー！'), 'ウィーゴー');
    assert.strictEqual(normalize('アイ・ウィル・サバイブ'), 'アイ ウィル サバイブ');
    assert.strictEqual(normalize('カワキヲアメク (feat. 美波)'), 'カワキヲアメク');
    assert.strictEqual(normalize('ＡＢＣ１２３'), 'abc123');
    assert.strictEqual(normalize('ｱﾆﾒ'), 'アニメ');
});

test('un générique japonais se devine et se score', () => {
    assert.ok(matchesTitle('残酷な天使のテーゼ', '残酷な天使のテーゼ'));
    assert.ok(matchesTitle('ウィーゴー!', 'ウィーゴー！'));
    assert.ok(matchesArtist('高橋洋子', ['高橋洋子']));
    assert.strictEqual(titleQuality('残酷な天使のテーゼ', '残酷な天使のテーゼ'), 1);
    assert.strictEqual(artistQuality('やなぎなぎ', ['やなぎなぎ']), 1);
});

test('un titre accepte plusieurs graphies', () => {
    const spellings = ['A Cruel Angel\'s Thesis', '残酷な天使のテーゼ'];
    assert.strictEqual(titleQuality('a cruel angel\'s thesis', spellings), 1);
    assert.strictEqual(titleQuality('残酷な天使のテーゼ', spellings), 1);
    assert.strictEqual(titleQuality('a cruel angels thesis', spellings), 0.9);
    assert.strictEqual(titleQuality('cruel angel', spellings), 0.7);
    assert.strictEqual(titleQuality('thriller', spellings), 0);
    assert.ok(matchesTitle('残酷な天使のテーゼ', spellings));
    const { splitGuess } = require('../src/matching.js');
    assert.deepStrictEqual(splitGuess('guren no yumiya linked horizon', ['Guren no Yumiya', '紅蓮の弓矢'], ['Linked Horizon']), { title: 'guren no yumiya', artist: 'linked horizon' });
});

test('le japonais ne crée pas de faux positifs', () => {
    assert.ok(!matchesTitle('怪物', '残酷な天使のテーゼ'));
    assert.ok(!matchesTitle('紅蓮の弓矢', '紅蓮の座標'));
    assert.ok(!matchesArtist('YOASOBI', ['高橋洋子']));
    assert.strictEqual(titleQuality('天使', '残酷な天使のテーゼ'), 0);
});
