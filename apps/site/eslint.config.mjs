import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  ...nextCoreWebVitals,
  {
    files: ['**/*.{js,jsx,mjs}'],
    rules: {
      'no-unused-vars': 'error',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts']),
]);
