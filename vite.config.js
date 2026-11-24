import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { rollupOptions: { input: {
    home: resolve(process.cwd(), 'index.html'),
    tripArea: resolve(process.cwd(), 'trip-area.html'),
    navigator: resolve(process.cwd(), 'navigator.html')
  } } }
});