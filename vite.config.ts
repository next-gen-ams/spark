import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const basePath = process.env.GITHUB_PAGES === 'true' ? '/emt-tracker' : '';

export default defineConfig({
  base: `${basePath}/`,
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  // Only these public Microsoft application identifiers enter the browser.
  define: {
    'process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID': JSON.stringify(
      process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
    ),
    'process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID': JSON.stringify(
      process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || '',
    ),
    'process.env.NEXT_PUBLIC_APP_BASE_PATH': JSON.stringify(basePath),
  },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: { outDir: 'dist/client/emt-tracker', sourcemap: false },
});
