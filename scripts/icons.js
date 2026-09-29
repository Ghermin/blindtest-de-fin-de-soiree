const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT = path.join(__dirname, '..', 'public');
const FILES = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };
const BG = [18, 8, 31];
const DISC = [17, 17, 17];
const RING = [40, 40, 40];
const PINK = [255, 61, 139];
const TEAL = [53, 224, 200];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buffer) {
    let c = 0xffffffff;
    for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

function mix(a, b, t) {
    return a.map((channel, i) => channel + (b[i] - channel) * t);
}

function coverage(distance, radius, scale) {
    return Math.min(1, Math.max(0, (radius - distance) * scale + 0.5));
}

function pixel(x, y, size) {
    const scale = size / 100;
    const u = x / scale;
    const v = y / scale;
    const r = Math.hypot(u - 50, v - 50);
    let color = BG;
    color = mix(color, DISC, coverage(r, 48, scale));
    for (const radius of [40, 32, 24]) {
        color = mix(color, RING, coverage(r, radius + 1, scale) - coverage(r, radius - 1, scale));
    }
    const t = Math.min(1, Math.max(0, (u + v - 70) / 60));
    color = mix(color, mix(PINK, TEAL, t), coverage(r, 15, scale));
    color = mix(color, BG, coverage(r, 4, scale));
    return color.map(Math.round);
}

function png(size) {
    const stride = size * 4 + 1;
    const raw = Buffer.alloc(stride * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const [r, g, b] = pixel(x + 0.5, y + 0.5, size);
            raw.set([r, g, b, 255], y * stride + 1 + x * 4);
        }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header.set([8, 6, 0, 0, 0], 8);
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

for (const [name, size] of Object.entries(FILES)) {
    const file = path.join(OUT, name);
    fs.writeFileSync(file, png(size));
    console.log(`${name} (${size}px, ${fs.statSync(file).size} octets)`);
}
