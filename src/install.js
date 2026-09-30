const config = require('./config.js');

function repoPath() {
    const match = String(config.repo || '').match(/github\.com[/:]([^/]+\/[^/.]+)/);
    return match ? match[1] : '';
}

function scriptUrl() {
    return `https://raw.githubusercontent.com/${repoPath()}/${config.branch}/deploy/termux.sh`;
}

function command() {
    return `curl -fsSL ${scriptUrl()} -o termux.sh && bash termux.sh`;
}

module.exports = { repoPath, scriptUrl, command };
