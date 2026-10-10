const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { key, shorten } = require('../src/works.js');

const AGENT = 'blindtest-de-fin-de-soiree/1.0 (https://github.com/Ghermin/blindtest-de-fin-de-soiree)';
const TARGET = path.join(__dirname, '..', 'src', 'works.json');
const ROMAJI_TARGET = path.join(__dirname, '..', 'src', 'romaji.json');
const JAPANESE = /[ぁ-ゖァ-ヺ一-鿿]/;
const WIKIDATA = 'https://query.wikidata.org/sparql';
const THEMES = 'https://api.animethemes.moe/anime?include=animethemes.song.artists&fields[anime]=name&page[size]=100';
const MIN_SITELINKS = 2;
const MAX_WORK_LENGTH = 42;
const MAX_ENTRIES = 12;
const MAX_PAGES = 200;

const QUERY = `
SELECT ?songLabel ?workLabel ?links
       (GROUP_CONCAT(DISTINCT ?japanese; separator="|") AS ?japaneses)
       (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases)
       (GROUP_CONCAT(DISTINCT ?performerLabel; separator="|") AS ?performers) WHERE {
  ?work wdt:P942 ?song .
  ?work wikibase:sitelinks ?links .
  FILTER(?links >= ${MIN_SITELINKS})
  OPTIONAL { ?song rdfs:label ?japanese FILTER(LANG(?japanese) = "ja") }
  OPTIONAL { ?song skos:altLabel ?alias FILTER(LANG(?alias) IN ("fr","en","ja")) }
  OPTIONAL { ?song wdt:P175 ?performer . ?performer rdfs:label ?performerLabel FILTER(LANG(?performerLabel) IN ("fr","en","ja")) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en,ja". }
}
GROUP BY ?songLabel ?workLabel ?links`;

const SONGS = ['wd:Q7366', 'wd:Q134556', 'wd:Q105543609'].map((type) => `
SELECT ?ja ?en WHERE {
  ?song wdt:P31 ${type} ; wdt:P407 wd:Q5287 ; rdfs:label ?ja , ?en .
  FILTER(LANG(?ja) = "ja") FILTER(LANG(?en) = "en")
}`);

const PERFORMERS = ['wd:Q177220', 'wd:Q639669', 'wd:Q488205', 'wd:Q2405480', 'wd:Q36834'].map((job) => `
SELECT ?ja ?en WHERE {
  ?artist wdt:P106 ${job} ; wdt:P27 wd:Q17 ; rdfs:label ?ja , ?en .
  FILTER(LANG(?ja) = "ja") FILTER(LANG(?en) = "en")
}`);

const BANDS = [`
SELECT ?ja ?en WHERE {
  ?artist wdt:P31 wd:Q215380 ; wdt:P495 wd:Q17 ; rdfs:label ?ja , ?en .
  FILTER(LANG(?ja) = "ja") FILTER(LANG(?en) = "en")
}`];

function once(url, accept) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: { 'User-Agent': AGENT, Accept: accept } }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => {
                chunks.push(chunk);
            });
            response.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode} : ${body.slice(0, 160)}`));
                try {
                    return resolve(JSON.parse(body));
                } catch (_error) {
                    return reject(new Error(`réponse illisible : ${body.slice(0, 160)}`));
                }
            });
        });
        request.setTimeout(180000, () => request.destroy(new Error('pas de réponse')));
        request.on('error', reject);
    });
}

async function get(url, accept, attempts = 4) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await once(url, accept);
        } catch (error) {
            if (attempt >= attempts) throw error;
            const wait = 15 * attempt;
            console.log(`   Wikidata essoufflé, nouvelle tentative dans ${wait} s`);
            await new Promise((resolve) => setTimeout(resolve, wait * 1000));
        }
    }
}

function clean(name) {
    let cleaned = key(name);
    for (let pass = 0; pass < 3; pass++) {
        const again = key(cleaned);
        if (again === cleaned) break;
        cleaned = again;
    }
    return cleaned.length >= 2 && !/^q\d+$/.test(cleaned) ? cleaned : '';
}

function bare(name) {
    return clean(String(name || '').replace(/\s*[([][^)\]]*[)\]]/g, ' ').replace(/\s*-[^-]*-\s*$/, ' '));
}

const MAX_SPELLINGS = 3;

function latinKey(japanese, latin) {
    const readable = String(latin || '').trim();
    if (!readable || JAPANESE.test(readable) || /^Q\d+$/.test(readable)) return null;
    const wanted = clean(japanese);
    if (wanted.length < 2 || !JAPANESE.test(wanted)) return null;
    return { wanted, readable };
}

function rememberName(map, japanese, latin) {
    const found = latinKey(japanese, latin);
    if (found && !map[found.wanted]) map[found.wanted] = found.readable;
}

function rememberTitle(map, japanese, latin) {
    const found = latinKey(japanese, latin);
    if (!found) return;
    const list = map[found.wanted] || (map[found.wanted] = []);
    if (list.length >= MAX_SPELLINGS || list.some((value) => clean(value) === clean(found.readable))) return;
    list.push(found.readable);
}

async function fromWikidata(latinTitles) {
    const rows = await get(`${WIKIDATA}?format=json&query=${encodeURIComponent(QUERY)}`, 'application/sparql-results+json');
    const entries = [];
    for (const row of rows.results.bindings) {
        const japaneses = row.japaneses && row.japaneses.value ? row.japaneses.value.split('|') : [];
        const songLabel = row.songLabel ? row.songLabel.value : '';
        for (const japanese of japaneses) rememberTitle(latinTitles, japanese, songLabel);
        const work = shorten(row.workLabel ? row.workLabel.value : '');
        if (!work || work.length > MAX_WORK_LENGTH || /^Q\d+$/.test(work)) continue;
        const links = Number(row.links ? row.links.value : 0) || 0;
        const aliases = row.aliases && row.aliases.value ? row.aliases.value.split('|') : [];
        const performers = row.performers && row.performers.value ? row.performers.value.split('|') : [];
        const titles = [row.songLabel ? row.songLabel.value : '', ...japaneses, ...aliases];
        for (const title of titles) {
            for (const name of [clean(title), bare(title)]) {
                if (!name) continue;
                if (!performers.length) entries.push({ title: name, performer: '', work, weight: links });
                for (const performer of performers) entries.push({ title: name, performer: clean(performer), work, weight: links });
            }
        }
    }
    console.log(`Wikidata : ${rows.results.bindings.length} génériques`);
    return entries;
}

async function fromAnimeThemes() {
    const entries = [];
    let url = THEMES;
    let pages = 0;
    let themes = 0;
    while (url && pages < MAX_PAGES) {
        const page = await get(url, 'application/json');
        pages++;
        for (const anime of page.anime || []) {
            const work = shorten(anime.name);
            if (!work || work.length > MAX_WORK_LENGTH) continue;
            for (const theme of anime.animethemes || []) {
                const song = theme.song || {};
                const title = String(song.title || '').trim();
                if (!title) continue;
                themes++;
                const performers = (song.artists || []).map((artist) => clean(artist.name)).filter(Boolean);
                for (const name of [...new Set([clean(title), bare(title)])]) {
                    if (!name) continue;
                    if (!performers.length) entries.push({ title: name, performer: '', work, weight: 1 });
                    for (const performer of performers) entries.push({ title: name, performer, work, weight: 1 });
                }
            }
        }
        url = page.links && page.links.next ? page.links.next : '';
        if (pages % 10 === 0) console.log(`   animethemes : ${pages} pages, ${themes} génériques…`);
    }
    console.log(`animethemes.moe : ${themes} génériques en ${pages} pages`);
    return entries;
}

async function fromLabels(queries, table, remember) {
    for (const query of queries) {
        const rows = await get(`${WIKIDATA}?format=json&query=${encodeURIComponent(query)}`, 'application/sparql-results+json')
            .catch((error) => {
                console.log(`   une requête de graphies a échoué (${error.message.slice(0, 80)}), on garde le reste`);
                return null;
            });
        if (!rows) continue;
        for (const row of rows.results.bindings) {
            remember(table, row.ja ? row.ja.value : '', row.en ? row.en.value : '');
        }
    }
    return table;
}

function merge(groups) {
    const best = new Map();
    for (const entries of groups) {
        for (const entry of entries) {
            const slot = `${entry.title}\u0000${entry.performer}`;
            const current = best.get(slot);
            if (!current || entry.weight > current.weight || (entry.weight === current.weight && entry.work.length < current.work.length)) {
                best.set(slot, entry);
            }
        }
    }
    const table = {};
    const named = (slot) => (slot.endsWith('\u0000') ? 0 : 1);
    const ordered = [...best.entries()].sort((a, b) => named(b[0]) - named(a[0]));
    for (const [slot, found] of ordered) {
        const cut = slot.indexOf('\u0000');
        const title = slot.slice(0, cut);
        const list = table[title] || (table[title] = []);
        if (list.length < MAX_ENTRIES) list.push([slot.slice(cut + 1), found.work]);
    }
    for (const [title, list] of Object.entries(table)) {
        const withArtist = list.filter((entry) => entry[0]);
        if (withArtist.length) table[title] = withArtist;
        else delete table[title];
    }
    return table;
}

function existingRomaji() {
    try {
        const loaded = JSON.parse(fs.readFileSync(ROMAJI_TARGET, 'utf8'));
        return { artists: loaded.artists || {}, titles: loaded.titles || {} };
    } catch (_missing) {
        return { artists: {}, titles: {} };
    }
}

async function main() {
    const onlyRomaji = process.argv.includes('--romaji');
    const latinTitles = existingRomaji().titles;
    const knownArtists = existingRomaji().artists;
    const before = { artists: Object.keys(knownArtists).length, titles: Object.keys(latinTitles).length };

    if (!onlyRomaji) {
        console.log('Construction de la table des génériques…');
        const wikidata = await fromWikidata(latinTitles);
        const anime = await fromAnimeThemes().catch((error) => {
            console.log(`animethemes.moe indisponible (${error.message}), table Wikidata seule`);
            return [];
        });
        const table = merge([wikidata, anime]);
        const sorted = Object.fromEntries(Object.keys(table).sort().map((title) => [title, table[title]]));
        fs.writeFileSync(TARGET, `${JSON.stringify(sorted)}\n`);
        const size = Math.round(fs.statSync(TARGET).size / 1024);
        console.log(`${Object.keys(sorted).length} titres écrits dans src/works.json (${size} Ko)`);
    }

    console.log('Graphies en lettres romaines…');
    const romaji = {
        artists: await fromLabels([...PERFORMERS, ...BANDS], knownArtists, rememberName),
        titles: await fromLabels(SONGS, latinTitles, rememberTitle)
    };
    if (Object.keys(romaji.artists).length < before.artists || Object.keys(romaji.titles).length < before.titles) {
        console.log('Moins de graphies qu\'avant, src/romaji.json laissé tel quel');
        return;
    }
    const ordered = (map) => Object.fromEntries(Object.keys(map).sort().map((name) => [name, map[name]]));
    fs.writeFileSync(ROMAJI_TARGET, `${JSON.stringify({ artists: ordered(romaji.artists), titles: ordered(romaji.titles) })}\n`);
    const romajiSize = Math.round(fs.statSync(ROMAJI_TARGET).size / 1024);
    console.log(`${Object.keys(romaji.artists).length} artistes et ${Object.keys(romaji.titles).length} titres en lettres romaines dans src/romaji.json (${romajiSize} Ko)`);
}

main().catch((error) => {
    console.error(`Génération impossible : ${error.message}`);
    process.exitCode = 1;
});
