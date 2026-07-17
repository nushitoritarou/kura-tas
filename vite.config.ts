/// <reference types="vitest" />
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { viteSingleFile } from 'vite-plugin-singlefile';
import * as child from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let commitHash = 'unknown';
try {
  commitHash = child.execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('Failed to get git commit hash');
}

const now = new Date();
// System is in UTC, so manually add 9 hours for JST
const jstOffset = 9 * 60 * 60 * 1000;
const jstDate = new Date(now.getTime() + jstOffset);

const buildTime = jstDate.toLocaleString('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC' // Since we already added the offset, we treat it as UTC to prevent further offset
});

// package.json から version を読み込む
let version = '0.0.0';
try {
  const pkgPath = path.resolve(__dirname, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  version = pkg.version || '0.0.0';
} catch (e) {
  console.warn('Failed to read version from package.json', e);
}

export default defineConfig(({ mode }) => {
  const isDebug = mode === 'debug';

  return {
    plugins: [viteSingleFile(), tsconfigPaths()],
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __COMMIT_HASH__: JSON.stringify(commitHash),
      __BUILD_TIME__: JSON.stringify(buildTime),
      __DEBUG_MODE__: isDebug,
    },
    test: {
      globals: true,
      environment: 'node',
      coverage: {
        all: true,
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: [
          'src/**/*.test.ts',
          'src/**/__tests__/**',
          'src/types.ts',
          'src/main.ts',
          'src/**/renderer.ts',
          'src/**/ui.ts',
          'src/core/el.ts',
          'src/core/handle.ts',
        ],
      },
    },
    build: {
      target: 'esnext',
      assetsInlineLimit: 100000000,
      chunkSizeWarningLimit: 100000000,
      cssCodeSplit: false,
      // @ts-ignore
      brotliSize: false,
      rollupOptions: {
        inlineDynamicImports: true,
        output: {
          manualChunks: undefined,
        },
      },
    },
  };
});
