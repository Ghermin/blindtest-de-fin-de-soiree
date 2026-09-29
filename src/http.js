const https = require('node:https');

function once(url, options) {
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const body = options.body === undefined || options.body === null ? null : String(options.body);
        const request = https.request(target, {
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'blindtest-de-fin-de-soiree',
                Accept: 'application/json',
                ...(options.headers || {}),
                ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
            },
            timeout: options.timeoutMs || 10000
        }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let json = null;
                try {
                    json = text ? JSON.parse(text) : null;
                } catch {
                    json = null;
                }
                resolve({ status: response.statusCode, headers: response.headers, text, json });
            });
        });
        request.on('timeout', () => request.destroy(new Error(`délai dépassé sur ${target.host}`)));
        request.on('error', reject);
        if (body) request.write(body);
        request.end();
    });
}

async function request(url, options = {}) {
    let current = url;
    for (let hop = 0; hop < 4; hop++) {
        const response = await once(current, options);
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
            current = new URL(response.headers.location, current).toString();
            continue;
        }
        return response;
    }
    throw new Error('trop de redirections');
}

async function getJson(url, options = {}) {
    const response = await request(url, options);
    if (response.status >= 400) {
        const error = new Error(`HTTP ${response.status} sur ${new URL(url).host}`);
        error.status = response.status;
        error.json = response.json;
        throw error;
    }
    return response.json;
}

module.exports = { request, getJson };
