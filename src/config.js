const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
    }
}

module.exports = {
    port: Number(process.env.BLINDTEST_PORT) || 3000,
    host: process.env.BLINDTEST_HOST || '0.0.0.0',
    hostPin: process.env.BLINDTEST_HOST_PIN || '',
    publicUrl: (process.env.BLINDTEST_PUBLIC_URL || '').replace(/\/+$/, ''),
    homeRoom: (process.env.BLINDTEST_HOME_ROOM === undefined ? 'MAISON' : process.env.BLINDTEST_HOME_ROOM).toUpperCase(),
    trustProxy: process.env.BLINDTEST_TRUST_PROXY === '1',
    dataDir: process.env.BLINDTEST_DATA_DIR || path.join(__dirname, '..', 'data'),
    castAppId: process.env.BLINDTEST_CAST_APP_ID || '',
    country: (process.env.BLINDTEST_COUNTRY || 'FR').toUpperCase(),
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID || '',
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET || ''
    }
};
