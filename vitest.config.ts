import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    root: './src',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'e2e/**',
      'tests/**',
      '**/*.spec.ts',
      '**/*.e2e.ts',
    ],
    watchExclude: [
      'e2e/**',
      'tests/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.{js,ts}',
        '**/types/**',
        '**/*.d.ts',
        'dist/',
        '.eslintrc.cjs',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
