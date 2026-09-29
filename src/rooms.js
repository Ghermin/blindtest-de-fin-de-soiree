const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomInt } = require('node:crypto');
const config = require('./config.js');
const { Game } = require('./game.js');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 50;
const IDLE_MS = 6 * 3600 * 1000;
const rooms = new Map();
let saveTimer = null;

function file() {
    return path.join(config.dataDir, 'rooms.json');
}

function token(length) {
    const bytes = randomBytes(length);
    let out = '';
    for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
    return out;
}

function freeCode() {
    let code = token(4);
    while (rooms.has(code)) code = token(4);
    return code;
}

function pin() {
    return String(randomInt(100000, 1000000));
}

function create(options = {}) {
    if (rooms.size >= MAX_ROOMS) throw new Error('Trop de salles ouvertes, réessaie plus tard');
    const code = (options.code || freeCode()).toUpperCase();
    if (rooms.has(code)) throw new Error('Cette salle existe déjà');
    const room = {
        code,
        hostKey: options.hostKey || token(8),
        home: false,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        clients: new Set()
    };
    room.game = new Game({ code });
    room.game.on('update', () => {
        room.lastActivity = Date.now();
        scheduleSave();
    });
    rooms.set(code, room);
    scheduleSave();
    return room;
}

function get(code) {
    return rooms.get(String(code || '').toUpperCase()) || null;
}

function all() {
    return [...rooms.values()];
}

function busy() {
    return all().some((room) => !['lobby', 'podium'].includes(room.game.phase));
}

function ensureHome() {
    if (!config.homeRoom) return null;
    let room = get(config.homeRoom);
    if (!room) {
        room = create({ code: config.homeRoom, hostKey: config.hostPin || pin() });
    } else if (config.hostPin) {
        room.hostKey = config.hostPin;
    }
    room.home = true;
    scheduleSave();
    return room;
}

function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1000);
    if (saveTimer.unref) saveTimer.unref();
}

function save() {
    clearTimeout(saveTimer);
    try {
        fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
        const data = all().map((room) => ({
            code: room.code,
            hostKey: room.hostKey,
            home: room.home,
            createdAt: room.createdAt,
            lastActivity: room.lastActivity,
            game: room.game.toJSON()
        }));
        const target = file();
        fs.writeFileSync(`${target}.tmp`, JSON.stringify(data), { mode: 0o600 });
        fs.renameSync(`${target}.tmp`, target);
    } catch (error) {
        console.log(`Sauvegarde des salles impossible : ${error.message}`);
    }
}

function load() {
    if (!fs.existsSync(file())) return 0;
    let entries = [];
    try {
        entries = JSON.parse(fs.readFileSync(file(), 'utf8'));
    } catch (error) {
        console.log(`Lecture des salles impossible : ${error.message}`);
        return 0;
    }
    for (const entry of entries) {
        if (!entry || !entry.code || rooms.has(entry.code)) continue;
        if (!entry.home && Date.now() - (entry.lastActivity || 0) > IDLE_MS) continue;
        const room = create({ code: entry.code, hostKey: entry.hostKey });
        room.home = Boolean(entry.home);
        room.createdAt = entry.createdAt || room.createdAt;
        room.lastActivity = entry.lastActivity || room.lastActivity;
        room.game.restore(entry.game);
    }
    return rooms.size;
}

function cleanup() {
    for (const room of all()) {
        if (room.home || room.clients.size) continue;
        if (Date.now() - room.lastActivity > IDLE_MS) {
            room.game.stop();
            rooms.delete(room.code);
        }
    }
    scheduleSave();
}

const sweeper = setInterval(cleanup, 10 * 60 * 1000);
if (sweeper.unref) sweeper.unref();

module.exports = { create, get, all, busy, ensureHome, load, save, cleanup, IDLE_MS };
