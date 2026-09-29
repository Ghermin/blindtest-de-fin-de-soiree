const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.BLINDTEST_DATA_DIR = path.join(os.tmpdir(), `blindtest-test-${process.pid}`);

const roomsPath = require.resolve('../src/rooms.js');

function freshRooms() {
    delete require.cache[roomsPath];
    return require(roomsPath);
}

test('création, sauvegarde et rechargement des salles', () => {
    const rooms = freshRooms();
    const room = rooms.create();
    assert.match(room.code, /^[A-HJ-NP-Z2-9]{4}$/);
    assert.strictEqual(room.hostKey.length, 8);
    assert.strictEqual(rooms.get(room.code.toLowerCase()), room);
    room.game.log = () => {};
    const tom = room.game.join('Tom');
    room.game.players.get(tom.token).score = 1200;
    rooms.save();

    const saved = JSON.parse(fs.readFileSync(path.join(process.env.BLINDTEST_DATA_DIR, 'rooms.json'), 'utf8'));
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].code, room.code);
    assert.strictEqual(saved[0].game.players[0].score, 1200);

    const reloaded = freshRooms();
    assert.strictEqual(reloaded.load(), 1);
    const restored = reloaded.get(room.code);
    assert.strictEqual(restored.hostKey, room.hostKey);
    assert.strictEqual(restored.game.players.get(tom.token).score, 1200);
    assert.strictEqual(reloaded.busy(), false);
});

test('une salle sans activité depuis longtemps n\'est pas rechargée', () => {
    const rooms = freshRooms();
    const room = rooms.create();
    room.lastActivity = Date.now() - rooms.IDLE_MS - 1000;
    rooms.save();
    const reloaded = freshRooms();
    assert.strictEqual(reloaded.load(), 0);
    fs.rmSync(process.env.BLINDTEST_DATA_DIR, { recursive: true, force: true });
});
