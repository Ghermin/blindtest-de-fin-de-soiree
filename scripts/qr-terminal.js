const { encode } = require('../src/qr.js');

const text = process.argv[2];
if (!text) {
    console.error('Usage : node scripts/qr-terminal.js <texte>');
    process.exit(1);
}

const { size, modules } = encode(text);
const quiet = 2;
const light = '██';
const dark = '  ';
const border = light.repeat(size + quiet * 2);

for (let i = 0; i < quiet; i++) console.log(border);
for (const row of modules) {
    console.log(light.repeat(quiet) + row.map((module) => (module ? dark : light)).join('') + light.repeat(quiet));
}
for (let i = 0; i < quiet; i++) console.log(border);
