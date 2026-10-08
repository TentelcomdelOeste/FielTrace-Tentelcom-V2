import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const STORAGE_PROXY_PATH = '/.netlify/functions/storage-image';
const ALLOWED_STORAGE_HOSTS = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com']);

function storageImageProxy() {
  return {
    name: 'fieldtrace-storage-image-proxy',
    configureServer(server: any) {
      server.middlewares.use(STORAGE_PROXY_PATH, async (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        try {
          const requestUrl = new URL(req.url || '/', 'http://localhost');
          const target = requestUrl.searchParams.get('url');
          if (!target) {
            res.statusCode = 400;
            res.end('Missing image URL');
            return;
          }

          const targetUrl = new URL(target);
          if (targetUrl.protocol !== 'https:' || !ALLOWED_STORAGE_HOSTS.has(targetUrl.hostname)) {
            res.statusCode = 400;
            res.end('Unsupported image host');
            return;
          }

          const upstream = await fetch(targetUrl);
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.end('Unable to fetch image');
            return;
          }

          const bytes = Buffer.from(await upstream.arrayBuffer());
          res.statusCode = 200;
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=300');
          res.end(bytes);
        } catch (error) {
          console.error('[StorageImageProxy] Error:', error);
          res.statusCode = 502;
          res.end('Storage image proxy error');
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      storageImageProxy(),
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          // The production bundle is currently >2 MiB. Keep it precached so the
          // PWA/Android build does not fail Workbox's default 2 MiB limit.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        manifest: {
          name: 'FieldTrace Pro',
          short_name: 'FieldTrace',
          description: 'Cámara de registro técnico con GPS y metadata offline',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-180x180.png',
              sizes: '180x180',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
