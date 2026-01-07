import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/tests/**',
        '**/__tests__/**',
        '**/types/**',
        '**/*.d.ts',
        '**/coverage/**',
      ],
      all: true,
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
  },
})
