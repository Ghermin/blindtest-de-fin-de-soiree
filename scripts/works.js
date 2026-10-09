const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { key } = require('../src/works.js');

const ENDPOINT = 'https://query.wikidata.org/sparql';
const AGENT = 'blindtest-de-fin-de-soiree/1.0 (https://github.com/Ghermin/blindtest-de-fin-de-soiree)';
const TARGET = path.join(__dirname, '..', 'src', 'works.json');
const MIN_SITELINKS = 5;
const MAX_WORK_LENGTH = 42;
const MAX_ENTRIES = 4;

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

function ask(query) {
    return new Promise((resolve, reject) => {
        const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
        const request = https.get(url, { headers: { 'User-Agent': AGENT, Accept: 'application/sparql-results+json' } }, (response) => {
            let body = '';
            response.on('data', (chunk) => {
                body += chunk;
            });
            response.on('end', () => {
                if (response.statusCode !== 200) return reject(new Error(`Wikidata HTTP ${response.statusCode} : ${body.slice(0, 200)}`));
                try {
                    return resolve(JSON.parse(body).results.bindings);
                } catch (_error) {
                    return reject(new Error(`réponse illisible : ${body.slice(0, 200)}`));
                }
            });
        });
        request.setTimeout(180000, () => request.destroy(new Error('Wikidata ne répond pas')));
        request.on('error', reject);
    });
}

function names(row, field, separated) {
    const raw = [];
    if (row[field] && row[field].value) raw.push(...(separated ? row[field].value.split('|') : [row[field].value]));
    return raw.map((name) => key(name)).filter((name) => name.length >= 2 && !/^q\d+$/.test(name));
}

function titles(row) {
    return [...new Set([...names(row, 'songLabel', false), ...names(row, 'aliases', true)])];
}

function performers(row) {
    const found = [...new Set(names(row, 'performers', true))];
    return found.length ? found : [''];
}

function better(current, fresh) {
    if (!current) return fresh;
    if (fresh.links > current.links) return fresh;
    if (fresh.links === current.links && fresh.work.length < current.work.length) return fresh;
    return current;
}

function build(rows) {
    const best = new Map();
    for (const row of rows) {
        const work = row.workLabel ? row.workLabel.value.trim() : '';
        if (!work || work.length > MAX_WORK_LENGTH || /^Q\d+$/.test(work)) continue;
        const links = Number(row.links ? row.links.value : 0) || 0;
        for (const title of titles(row)) {
            for (const performer of performers(row)) {
                const slot = `${title}\u0000${performer}`;
                best.set(slot, better(best.get(slot), { work, links }));
            }
        }
    }
    const table = {};
    let kept = 0;
    for (const [slot, found] of best) {
        const cut = slot.indexOf('\u0000');
        const title = slot.slice(0, cut);
        const performer = slot.slice(cut + 1);
        const entries = table[title] || (table[title] = []);
        if (entries.length >= MAX_ENTRIES) continue;
        entries.push([performer, found.work]);
        kept++;
    }
    for (const [title, entries] of Object.entries(table)) {
        const named = entries.filter((entry) => entry[0]);
        if (named.length) table[title] = named;
    }
    return { table, kept };
}

async function main() {
    console.log('Interrogation de Wikidata (musiques de générique)…');
    const rows = await ask(QUERY);
    console.log(`${rows.length} relations reçues`);
    const { table, kept } = build(rows);
    const sorted = Object.fromEntries(Object.keys(table).sort().map((title) => [title, table[title]]));
    fs.writeFileSync(TARGET, `${JSON.stringify(sorted)}\n`);
    const size = Math.round(fs.statSync(TARGET).size / 1024);
    console.log(`${Object.keys(sorted).length} titres, ${kept} associations, ${size} Ko écrits dans src/works.json`);
}

main().catch((error) => {
    console.error(`Génération impossible : ${error.message}`);
    process.exitCode = 1;
});
