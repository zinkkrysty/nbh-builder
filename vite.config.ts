import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['nabocity.localhost', '.localhost'],
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['nabocity.localhost', '.localhost'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        assets: resolve(__dirname, 'assets.html')
      }
    }
  }
});
