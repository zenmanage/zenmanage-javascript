import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry point — browser-safe, no Node.js built-ins
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    minify: false,
    target: 'es2020',
    platform: 'neutral',
  },
  // Node.js entry point — includes FileSystemCache (fs/path/util)
  {
    entry: ['src/node.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
    treeshake: true,
    minify: false,
    target: 'es2020',
    platform: 'node',
    external: ['fs', 'path', 'util'],
  },
]);
