import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-mcp/**', 'dist-electron/**', 'output/**', '.playwright-cli/**', 'node_modules/**', 'logs/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/**/*.{ts,tsx}', 'vite.config.ts'], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['electron/**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: globals.node }, rules: { '@typescript-eslint/no-require-imports': 'off' } },
  { files: ['scripts/**/*.mjs', 'eslint.config.js'], languageOptions: { globals: globals.node } },
);
