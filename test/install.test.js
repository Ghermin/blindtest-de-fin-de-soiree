const test = require('node:test');
const assert = require('node:assert');
const install = require('../src/install.js');

test('la commande d\'installation télécharge le script du dépôt public puis le lance', () => {
    assert.ok(install.repoPath().includes('/'));
    assert.ok(install.scriptUrl().endsWith('/deploy/termux.sh'));
    const command = install.command();
    assert.ok(command.startsWith('curl -fsSL https://raw.githubusercontent.com/'));
    assert.ok(command.endsWith('-o termux.sh && bash termux.sh'));
    assert.ok(!command.includes('Authorization'));
});
