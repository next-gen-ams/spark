import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const here = fileURLToPath(new URL('.', import.meta.url));
const source = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root: here,
  publicDir: `${source}/public`,
  plugins: [react()],
  define: { 'process.env.NEXT_PUBLIC_APP_BASE_PATH': JSON.stringify('') },
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: [
      { find: '@/lib/microsoft-auth', replacement: `${here}/mock-auth.ts` },
      { find: '@/lib/emt-api', replacement: `${here}/mock-api.ts` },
      { find: 'next/image', replacement: `${here}/mock-image.tsx` },
      { find: '@', replacement: source },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 4193,
    strictPort: true,
    fs: { allow: [source] },
  },
});
