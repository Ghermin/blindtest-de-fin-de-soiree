const test = require('node:test');
const assert = require('node:assert');
const install = require('../src/install.js');

test('la commande d\'installation pointe sur le script du dépôt, avec ou sans jeton', () => {
    assert.ok(install.repoPath().includes('/'));
    assert.ok(install.scriptUrl().endsWith('/deploy/termux.sh'));
    const anonymous = install.command('');
    assert.ok(anonymous.startsWith('curl -fsSL https://raw.githubusercontent.com/'));
    assert.ok(!anonymous.includes('Authorization'));
    const withToken = install.command('github_pat_xyz');
    assert.ok(withToken.startsWith('T=github_pat_xyz; curl'));
    assert.ok(withToken.includes('Authorization: token $T'));
    assert.ok(withToken.endsWith('GITHUB_TOKEN=$T bash termux.sh'));
});

test('le jeton vient de GITHUB_TOKEN quand il est défini', () => {
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = ' github_pat_env ';
    try {
        assert.strictEqual(install.githubToken(), 'github_pat_env');
    } finally {
        if (previous === undefined) delete process.env.GITHUB_TOKEN;
        else process.env.GITHUB_TOKEN = previous;
    }
});
