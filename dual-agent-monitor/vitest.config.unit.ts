import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: 'unit',
      include: [
        'server/**/__tests__/**/*.test.ts',
        'src/**/__tests__/**/*.test.{ts,tsx}',
        'tests/unit/**/*.test.{ts,tsx}'
      ],
      exclude: [
        'tests/integration/**',
        'tests/e2e/**',
        'tests/performance/**'
      ]
    }
  })
);