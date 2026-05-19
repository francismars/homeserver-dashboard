import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: [
        'src/app/api/admin/[...path]/route.ts',
        'src/app/api/admin/generate_signup_token/route.ts',
        'src/app/api/cloudflare-config/route.ts',
        'src/app/api/health/route.ts',
        'src/app/api/public-health/route.ts',
        'src/app/api/server-config/route.ts',
        'src/app/api/webdav/utils.ts',
        'src/hooks/admin/useAdminInfo.tsx',
        'src/hooks/admin/useDisabledUsers.tsx',
        'src/hooks/webdav/useWebDav.tsx',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 45,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
