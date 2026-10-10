const test = require('node:test');
const assert = require('node:assert');
const { artist, title, artists, titles, japanese } = require('../src/romaji.js');
const { artistQuality, titleQuality } = require('../src/matching.js');

test('reconnaît ce qui est écrit en japonais', () => {
    assert.ok(japanese('高橋洋子'));
    assert.ok(japanese('きただにひろし'));
    assert.ok(japanese('ウィーゴー！'));
    assert.ok(!japanese('Linked Horizon'));
    assert.ok(!japanese(''));
});

test('donne le nom d\'un artiste japonais en lettres romaines', () => {
    assert.strictEqual(artist('高橋洋子'), 'Yoko Takahashi');
    assert.strictEqual(artist('きただにひろし'), 'Hiroshi Kitadani');
    assert.strictEqual(artist('久石譲'), 'Joe Hisaishi');
    assert.strictEqual(artist('Linked Horizon'), '');
    assert.strictEqual(artist(''), '');
});

test('donne le titre d\'un générique japonais en lettres romaines', () => {
    assert.strictEqual(title('紅蓮の弓矢'), 'Guren no Yumiya');
    assert.ok(titles('残酷な天使のテーゼ').includes('A Cruel Angel\'s Thesis'));
    assert.strictEqual(title('Billie Jean'), '');
    assert.strictEqual(title(''), '');
});

test('la graphie lisible passe devant sans effacer la japonaise', () => {
    assert.deepStrictEqual(artists(['高橋洋子']), ['Yoko Takahashi', '高橋洋子']);
    assert.deepStrictEqual(artists(['Linked Horizon']), ['Linked Horizon']);
    assert.deepStrictEqual(artists(['YOASOBI', '高橋洋子']), ['YOASOBI', '高橋洋子']);
    assert.deepStrictEqual(artists(['架空のうたうグループ']), ['架空のうたうグループ']);
    assert.deepStrictEqual(artists([]), []);
    assert.deepStrictEqual(titles('紅蓮の弓矢'), ['Guren no Yumiya', '紅蓮の弓矢']);
    assert.deepStrictEqual(titles('Billie Jean'), ['Billie Jean']);
    assert.deepStrictEqual(titles('架空のうた'), ['架空のうた']);
});

test('les deux graphies de l\'artiste valent une bonne réponse', () => {
    const names = artists(['高橋洋子']);
    assert.strictEqual(artistQuality('Yoko Takahashi', names), 1);
    assert.strictEqual(artistQuality('高橋洋子', names), 1);
    assert.strictEqual(artistQuality('YOASOBI', names), 0);
});

test('les deux graphies du titre valent une bonne réponse', () => {
    const names = titles('紅蓮の弓矢');
    assert.strictEqual(titleQuality('guren no yumiya', names), 1);
    assert.strictEqual(titleQuality('紅蓮の弓矢', names), 1);
    assert.strictEqual(titleQuality('Billie Jean', names), 0);
    assert.strictEqual(titleQuality('a cruel angel\'s thesis', titles('残酷な天使のテーゼ')), 1);
});
