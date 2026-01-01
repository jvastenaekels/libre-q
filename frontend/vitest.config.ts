/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: './src/setupTests.ts',
        include: ['src/**/*.test.{ts,tsx}'],
        css: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'json-summary'],
            exclude: [
                'node_modules/',
                'src/vite-env.d.ts',
                '**/generated.ts',
                'src/main.tsx',
                'e2e/**',
                'src/**/*.d.ts',
                'src/test/**',
                '**/*.json',
                'postcss.config.js',
                'tailwind.config.js',
            ],
            thresholds: {
                global: {
                    lines: 65,
                    functions: 65,
                    branches: 50,
                    statements: 65,
                },
            },
        },
    },
});
