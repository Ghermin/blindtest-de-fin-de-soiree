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
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID || '',
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
        refreshToken: process.env.SPOTIFY_REFRESH_TOKEN || '',
        deviceName: process.env.SPOTIFY_DEVICE_NAME || ''
    }
};
