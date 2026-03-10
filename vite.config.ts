import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Forward /api and /debug to the Express RAG API server (port 3001)
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Gracefully handle cases where the API server isn't running
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if ('writeHead' in res && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'API server unavailable. Run: npm run dev:api' }));
            }
          });
        },
      },
      '/debug': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if ('writeHead' in res && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'API server unavailable. Run: npm run dev:api' }));
            }
          });
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  build: {
    // Désactivation du code-splitting pour éviter les erreurs React sur Vercel
    // Un bundle unique est plus gros mais garantit le bon ordre de chargement
    outDir: "dist",
    chunkSizeWarningLimit: 5000,
    commonjsOptions: {
      include: [/pdfjs-dist/, /node_modules/],
    },
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('pdfjs-dist')) {
          return;
        }
        warn(warning);
      },
    },
  },
  base: '/',
}));
