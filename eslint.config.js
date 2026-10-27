import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `.agents` contains Codex instructions and imported third-party skill source;
  // it is not part of the app's lint target. `dist` is build output, while
  // `src/generated` and `.power` are produced by `pac code add-data-source`.
  globalIgnores(['.agents/**', '.playwright-cli/**', 'dist', 'src/generated', '.power']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // shadcn/ui primitives and context providers intentionally co-locate
    // non-component exports (cva variants, React contexts) with their
    // components. Fast Refresh's component-only rule doesn't apply to these.
    files: ['src/components/ui/**/*.{ts,tsx}', 'src/providers/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
