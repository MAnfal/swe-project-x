import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Alias resolution is read from tsconfig.json rather than restated here, so a path
  // added to tsconfig cannot silently fail to resolve under the test runner.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
