/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
            },
        },
    },
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: './src/setupTests.ts',
        css: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'json-summary'],
            exclude: [
                'node_modules/',
                'src/vite-env.d.ts',
                '**/generated.ts',
                'src/main.tsx',
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
