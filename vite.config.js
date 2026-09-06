import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': { target: process.env.LIFEPASS_DEV_API_TARGET || 'http://localhost:8080', changeOrigin: true },
    },
  },
});
