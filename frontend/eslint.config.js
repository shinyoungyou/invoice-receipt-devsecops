import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'coverage/']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node
    }
  }
];
