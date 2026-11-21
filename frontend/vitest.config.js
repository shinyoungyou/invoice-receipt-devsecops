import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      // Paths in lcov.info are written relative to the repo root
      // (frontend/src/...), matching backend/coverage/lcov.info, because
      // SonarQube scans the whole repository from the root.
      reporter: ['text', ['lcov', { projectRoot: '..' }]],
      reportsDirectory: 'coverage'
    }
  }
});
