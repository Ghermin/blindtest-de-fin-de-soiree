const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const config = require('./config.js');

function githubToken() {
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
    try {
        const lines = fs.readFileSync(path.join(os.homedir(), '.git-credentials'), 'utf8').split(/\r?\n/);
        for (const line of lines) {
            const match = line.match(/^https:\/\/(?:[^:@/]+:)?([^@/]+)@github\.com/);
            if (match) return decodeURIComponent(match[1]);
        }
    } catch {
        return '';
    }
    return '';
}

function repoPath() {
    const match = String(config.repo || '').match(/github\.com[/:]([^/]+\/[^/.]+)/);
    return match ? match[1] : '';
}

function scriptUrl() {
    return `https://raw.githubusercontent.com/${repoPath()}/${config.branch}/deploy/termux.sh`;
}

function command(token) {
    if (!token) return `curl -fsSL ${scriptUrl()} -o termux.sh && bash termux.sh`;
    return `T=${token}; curl -fsSL -H "Authorization: token $T" ${scriptUrl()} -o termux.sh && GITHUB_TOKEN=$T bash termux.sh`;
}

module.exports = { githubToken, repoPath, scriptUrl, command };
