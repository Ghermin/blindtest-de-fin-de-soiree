const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'commonjs',
            globals: { ...globals.node }
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'prefer-const': 'error',
            eqeqeq: ['error', 'always'],
            'no-var': 'error',
            'no-console': 'off'
        }
    },
    {
        files: ['public/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            globals: { ...globals.browser }
        }
    },
    {
        ignores: ['node_modules/**', 'data/**', 'docs/**']
    }
];
