import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    // ECharts is tree-shaken to the four chart types used here; its shared
    // renderer still forms one intentionally self-contained static chunk.
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
