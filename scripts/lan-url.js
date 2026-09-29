const os = require('node:os');
const config = require('../src/config.js');

const candidates = [];
for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
        if ((entry.family === 'IPv4' || entry.family === 4) && !entry.internal) {
            candidates.push({ name, address: entry.address });
        }
    }
}

const hotspot = candidates.find((entry) => /^(ap|swlan|wlan1|rndis|usb)/.test(entry.name) || entry.address.startsWith('192.168.43.'));
const chosen = hotspot || candidates[0];

if (process.argv.includes('--all')) {
    for (const entry of candidates) console.log(`${entry.name}\thttp://${entry.address}:${config.port}`);
} else {
    console.log(chosen ? `http://${chosen.address}:${config.port}` : `http://localhost:${config.port}`);
}
