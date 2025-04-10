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
      external: [],
      output: {
        globals: {}
      }
    }
  }
});
