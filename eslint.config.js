// ESLint flat config — schemaviz (CommonJS TypeScript project)
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.cjs', '*.js', '!eslint.config.js'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // T3.3 guard: no explicit any in first-party code
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_$',
      }],
      // require() in createAdapter and imageGenerator is intentional (CJS lazy loading)
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
