const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { key } = require('../src/works.js');

const AGENT = 'blindtest-de-fin-de-soiree/1.0 (https://github.com/Ghermin/blindtest-de-fin-de-soiree)';
const TARGET = path.join(__dirname, '..', 'src', 'works.json');
const WIKIDATA = 'https://query.wikidata.org/sparql';
const THEMES = 'https://api.animethemes.moe/anime?include=animethemes.song.artists&fields[anime]=name&page[size]=100';
const MIN_SITELINKS = 5;
const MAX_WORK_LENGTH = 42;
const MAX_ENTRIES = 4;
const MAX_PAGES = 200;

const QUERY = `
SELECT ?songLabel ?workLabel ?links
       (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases)
       (GROUP_CONCAT(DISTINCT ?performerLabel; separator="|") AS ?performers) WHERE {
  ?work wdt:P942 ?song .
  ?work wikibase:sitelinks ?links .
  FILTER(?links >= ${MIN_SITELINKS})
  OPTIONAL { ?song skos:altLabel ?alias FILTER(LANG(?alias) IN ("fr","en","ja")) }
  OPTIONAL { ?song wdt:P175 ?performer . ?performer rdfs:label ?performerLabel FILTER(LANG(?performerLabel) IN ("fr","en","ja")) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en,ja". }
}
GROUP BY ?songLabel ?workLabel ?links`;

function get(url, accept) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: { 'User-Agent': AGENT, Accept: accept } }, (response) => {
            let body = '';
            response.on('data', (chunk) => {
                body += chunk;
            });
            response.on('end', () => {
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

function clean(name) {
    const cleaned = key(name);
    return cleaned.length >= 2 && !/^q\d+$/.test(cleaned) ? cleaned : '';
}

function bare(name) {
    return clean(String(name || '').replace(/\s*[([][^)\]]*[)\]]/g, ' ').replace(/\s*-[^-]*-\s*$/, ' '));
}

async function fromWikidata() {
    const rows = await get(`${WIKIDATA}?format=json&query=${encodeURIComponent(QUERY)}`, 'application/sparql-results+json');
    const entries = [];
    for (const row of rows.results.bindings) {
        const work = row.workLabel ? row.workLabel.value.trim() : '';
        if (!work || work.length > MAX_WORK_LENGTH || /^Q\d+$/.test(work)) continue;
        const links = Number(row.links ? row.links.value : 0) || 0;
        const aliases = row.aliases && row.aliases.value ? row.aliases.value.split('|') : [];
        const performers = row.performers && row.performers.value ? row.performers.value.split('|') : [];
        const titles = [row.songLabel ? row.songLabel.value : '', ...aliases];
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
            const work = String(anime.name || '').trim();
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
    for (const [slot, found] of best) {
        const cut = slot.indexOf('\u0000');
        const title = slot.slice(0, cut);
        const list = table[title] || (table[title] = []);
        if (list.length < MAX_ENTRIES) list.push([slot.slice(cut + 1), found.work]);
    }
    for (const [title, list] of Object.entries(table)) {
        const named = list.filter((entry) => entry[0]);
        if (named.length) table[title] = named;
    }
    return table;
}

async function main() {
    console.log('Construction de la table des génériques…');
    const wikidata = await fromWikidata();
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

main().catch((error) => {
    console.error(`Génération impossible : ${error.message}`);
    process.exitCode = 1;
});
