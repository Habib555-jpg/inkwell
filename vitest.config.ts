import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: 'forks',
    // each test file boots its own in-memory Postgres (PGlite WASM, ~150MB); cap concurrency to stay within memory
    maxWorkers: 3,
    // the e2e novel runs ~70 AI operations in well under a minute; production default stays 30/min
    env: { AI_RATE_LIMIT_PER_MIN: '1000' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
});
