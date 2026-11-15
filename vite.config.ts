import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'libphext',
      fileName: 'libphext',
      formats: ['es', 'umd']
    },
    outDir: 'dist',
    rollupOptions: {
      // lzma-native is a native Node addon (liblzma binding, used by the
      // xz seal): it cannot be bundled, so it stays an external import
      // and resolves from the consumer's node_modules at runtime. The
      // seal functions are therefore Node-only; every other part of the
      // library bundles as before.
      external: ['lzma-native'],
      output: {
        globals: {
          'lzma-native': 'lzmaNative'
        }
      }
    }
  }
});
