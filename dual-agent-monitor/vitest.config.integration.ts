import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: 'integration',
      include: [
        'tests/integration/**/*.test.{ts,tsx}'
      ],
      exclude: [
        'tests/unit/**',
        'tests/e2e/**',
        'tests/performance/**'
      ],
      testTimeout: 30000,
      hookTimeout: 30000,
      teardownTimeout: 30000,
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true
        }
      }
    }
  })
);