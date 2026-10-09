const test = require('node:test');
const assert = require('node:assert');
const { work, withWork } = require('../src/works.js');

test('trouve l\'œuvre citée dans le titre', () => {
    assert.strictEqual(work({ name: 'Unravel (From "Tokyo Ghoul")', artists: ['TK'] }), 'Tokyo Ghoul');
    assert.strictEqual(work({ name: 'My Heart Will Go On (Love Theme from "Titanic")', artists: ['Céline Dion'] }), 'Titanic');
    assert.strictEqual(work({ name: 'Blue Bird (Naruto Shippuden Opening 3)', artists: ['Ikimono-gakari'] }), 'Naruto Shippuden');
    assert.strictEqual(work({ name: 'Gurenge - From "Demon Slayer"', artists: ['LiSA'] }), 'Demon Slayer');
    assert.strictEqual(work({ name: 'Cuban Pete (From \'The Mask\')', artists: ['Jim Carrey'] }), 'The Mask');
    assert.strictEqual(work({ name: 'Mad Max I (Tiré Du Film "Mad Max")', artists: ['Musique De Film'] }), 'Mad Max');
});

test('ignore le suffixe « Soundtrack » resté dans la parenthèse', () => {
    assert.strictEqual(work({ name: '(I\'ve Had) The Time Of My Life (From "Dirty Dancing" Soundtrack)', artists: ['Bill Medley'] }), 'Dirty Dancing');
    assert.strictEqual(work({ name: 'Somewhere in My Memory (From "Home Alone" Soundtrack)', artists: ['John Williams'] }), 'Home Alone');
    assert.strictEqual(work({ name: 'Cléopâtre (From the Original Motion Picture Soundtrack "Astérix et Obélix Mission Cléopâtre")', artists: ['Philippe Chany'] }), 'Astérix et Obélix Mission Cléopâtre');
});

test('trouve l\'œuvre dans le nom de l\'album', () => {
    assert.strictEqual(work({ name: 'Gurenge', artists: ['LiSA'], album: 'Demon Slayer: Kimetsu no Yaiba Original Soundtrack' }), 'Demon Slayer: Kimetsu no Yaiba');
    assert.strictEqual(work({ name: 'Let It Go', artists: ['Idina Menzel'], album: 'Frozen (Original Motion Picture Soundtrack)' }), 'Frozen');
    assert.strictEqual(work({ name: 'Cornfield Chase', artists: ['Hans Zimmer'], album: 'Interstellar (Original Motion Picture Soundtrack)' }), 'Interstellar');
    assert.strictEqual(work({ name: 'Main Title', artists: ['Ramin Djawadi'], album: 'Game of Thrones: Season 8 (Music from the HBO Series)' }), 'Game of Thrones: Season 8');
    assert.strictEqual(work({ name: 'Je voudrais déjà être roi', artists: ['Les Choristes'], album: 'Le Roi Lion (Bande originale française du film)' }), 'Le Roi Lion');
    assert.strictEqual(work({ name: 'GLASSY SKY', artists: ['Yutaka Yamada'], album: 'TVアニメ『東京喰種』ORIGINAL SOUNDTRACK' }), '東京喰種');
});

test('lit aussi l\'album trouvé en cherchant l\'extrait', () => {
    assert.strictEqual(work({ name: 'Zero', artists: ['Hans Zimmer'], match: { source: 'deezer', id: 1, album: 'Dune: Part Two (Original Motion Picture Soundtrack)' } }), 'Dune: Part Two');
});

test('l\'œuvre trouvée par recherche prime sur les métadonnées', () => {
    assert.strictEqual(work({ name: 'Gurenge', artists: ['LiSA'], album: 'LEO-NiNE', work: 'Kimetsu no Yaiba' }), 'Kimetsu no Yaiba');
});

test('ne voit pas d\'œuvre dans un album ordinaire', () => {
    assert.strictEqual(work({ name: 'Billie Jean', artists: ['Michael Jackson'], album: 'Thriller' }), '');
    assert.strictEqual(work({ name: 'Ready or Not', artists: ['Fugees'], album: 'The Score' }), '');
    assert.strictEqual(work({ name: 'Bohemian Rhapsody (Remastered 2011)', artists: ['Queen'], album: 'A Night at the Opera' }), '');
    assert.strictEqual(work({ name: 'Alors on danse (Radio Edit)', artists: ['Stromae'] }), '');
    assert.strictEqual(work({ name: 'Thriller', artists: ['Michael Jackson'], album: 'Thriller (Original Soundtrack)' }), '');
    assert.strictEqual(work(null), '');
});

test('écarte les faux positifs : émissions, compilations, nom du groupe', () => {
    assert.strictEqual(work({ name: 'Zoroastre - From THE FIRST TAKE', artists: ['Zabatron'] }), '');
    assert.strictEqual(work({ name: 'Zoroastre (ZB from Les Zabatrons)', artists: ['ZB from Les Zabatrons'] }), '');
    assert.strictEqual(work({ name: 'E.T. (Thème)', artists: ['Musique De Film'], album: 'Musiques de films : 40 titres d\'anthologie' }), '');
    assert.strictEqual(work({ name: 'Top Gun (Anthem)', artists: ['Best Movie Soundtracks'], album: 'The Very Best of the Movie : Gold Edition' }), '');
    assert.strictEqual(work({ name: 'Avatar (The Theme)', artists: ['The Piano Guys'], album: 'Classical Movie Soundtracks' }), '');
    assert.strictEqual(work({ name: 'My Neighbor Totoro - Ending Theme Song', artists: ['Azumi Inoue'], album: 'My Neighbor Totoro Soundtrack Collection' }), '');
});

test('ajoute l\'œuvre au libellé, sauf si elle y est déjà', () => {
    const lisa = { name: 'Gurenge', artists: ['LiSA'], album: 'Demon Slayer Original Soundtrack' };
    assert.strictEqual(withWork('Gurenge — LiSA', lisa), 'Gurenge — LiSA (Demon Slayer)');
    const tk = { name: 'Unravel (From "Tokyo Ghoul")', artists: ['TK'] };
    assert.strictEqual(withWork('Unravel (From "Tokyo Ghoul") — TK', tk), 'Unravel (From "Tokyo Ghoul") — TK');
    assert.strictEqual(withWork('TK', tk), 'TK (Tokyo Ghoul)');
    assert.strictEqual(withWork('Billie Jean — Michael Jackson', { name: 'Billie Jean', artists: ['Michael Jackson'] }), 'Billie Jean — Michael Jackson');
});

test('la table embarquée reconnaît les génériques connus', () => {
    assert.strictEqual(work({ name: 'Gurenge', artists: ['LiSA'], album: 'LEO-NiNE' }), 'Demon Slayer: Kimetsu no Yaiba');
    assert.strictEqual(work({ name: 'Magia', artists: ['Kalafina'], album: 'Magia' }), 'Puella Magi Madoka Magica');
    assert.strictEqual(work({ name: 'Gurenge - From THE FIRST TAKE', artists: ['LiSA'] }), 'Demon Slayer: Kimetsu no Yaiba');
    assert.strictEqual(work({ name: 'Billie Jean', artists: ['Michael Jackson'], album: 'Thriller' }), '');
    assert.strictEqual(work({ name: 'Gurenge', artists: ['Un Groupe Inconnu'] }), '');
    assert.strictEqual(work({ name: 'Unravel', artists: ['TK from Ling tosite sigure'], album: 'Unravel' }), 'Tokyo Ghoul');
    assert.strictEqual(work({ name: 'Gurenge -TV version-', artists: ['LiSA'] }), 'Demon Slayer: Kimetsu no Yaiba');
    assert.match(work({ name: 'Blue Bird', artists: ['Ikimonogakari'], album: 'My song Your song' }), /Naruto/);
    assert.strictEqual(work({ name: 'Ghostbusters (Theme from "Ghostbusters")', artists: ["80's Greatest Hits"] }), '');
});

test('un titre courant ne reçoit pas l\'œuvre d\'un homonyme', () => {
    assert.strictEqual(work({ name: 'Soleil', artists: ['GIMS'], album: 'Soleil' }), '');
    assert.strictEqual(work({ name: 'San Francisco', artists: ['Sound Of Legend'], album: 'San Francisco' }), '');
    assert.strictEqual(work({ name: 'Believe', artists: ['Cher'], album: 'Believe' }), '');
});

test('les noms de compilations ne passent pas pour des œuvres', () => {
    assert.strictEqual(work({ name: 'Jurassic Park (Thème)', artists: ['Musique De Film'], album: "Films d'action - La bande originale du cinéma des années 80 et 90" }), '');
    assert.strictEqual(work({ name: 'Speed (Thème)', artists: ['Musique De Film'], album: 'Films à suspense - La bande originale du cinéma' }), '');
    assert.doesNotMatch(work({ name: 'Men In Black (From "Men In Black" Soundtrack)', artists: ['Will Smith'], album: 'Men In Black The Album' }), /from/i);
});
