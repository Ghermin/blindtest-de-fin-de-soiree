const test = require('node:test');
const assert = require('node:assert');
const jsQR = require('jsqr');
const { encode, svg } = require('../src/qr.js');

function decode(text) {
    const { size, modules } = encode(text);
    const scale = 4;
    const quiet = 4;
    const width = (size + quiet * 2) * scale;
    const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (!modules[y][x]) continue;
            for (let dy = 0; dy < scale; dy++) {
                for (let dx = 0; dx < scale; dx++) {
                    const offset = (((y + quiet) * scale + dy) * width + (x + quiet) * scale + dx) * 4;
                    pixels[offset] = 0;
                    pixels[offset + 1] = 0;
                    pixels[offset + 2] = 0;
                }
            }
        }
    }
    const result = jsQR(pixels, width, width);
    return result ? result.data : null;
}

test('le QR code se décode avec un lecteur indépendant', () => {
    for (const text of ['A', 'http://192.168.1.42:3000', 'http://blindtest.local:3000/', 'https://blindtest.example.org/salle/2?code=ABCD', 'x'.repeat(106)]) {
        assert.strictEqual(decode(text), text);
    }
});

test('la version grandit avec le texte et refuse au-delà de la 5', () => {
    assert.strictEqual(encode('A').version, 1);
    assert.strictEqual(encode('http://192.168.1.42:3000').version, 2);
    assert.strictEqual(encode('x'.repeat(106)).version, 5);
    assert.throws(() => encode('x'.repeat(107)), /trop long/);
});

test('le SVG a une zone de silence de 4 modules', () => {
    const out = svg('http://192.168.1.42:3000');
    assert.ok(out.startsWith('<svg'));
    assert.ok(out.includes('viewBox="0 0 33 33"'));
});
