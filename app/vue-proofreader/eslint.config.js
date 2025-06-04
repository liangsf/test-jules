import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import eslintConfigPrettier from 'eslint-config-prettier'; // To disable ESLint rules that conflict with Prettier
import pluginPrettier from 'eslint-plugin-prettier'; // To run Prettier as an ESLint rule

export default [
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'], // Using flat config for Vue
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: tseslint.parser } } },
  {
    // Configuration for Prettier
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      'prettier/prettier': 'error', // Report Prettier violations as ESLint errors
    },
  },
  eslintConfigPrettier, // This should be last to override other configs
];
