import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      // Measure everything under the API routes, shared libs, hooks and
      // services by default. Anything intentionally untested must be listed
      // in `exclude` below with a one-line justification; nothing currently is.
      include: ['src/app/api/**', 'src/lib/**', 'src/hooks/**', 'src/services/**'],
      exclude: [],
      // Actuals at the time these were set: 85/74/88/85. Known debt below the
      // aggregate: src/services/webdav/webdav.ts and src/hooks/webdav/useWebDav.tsx
      // (~30% each) and src/app/api/admin/[[...path]]/route.ts (~66%).
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
