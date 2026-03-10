import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
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
    include: ['pdfjs-dist/build/pdf'],
  },
  build: {
    // Désactivation du code-splitting pour éviter les erreurs React sur Vercel
    // Un bundle unique est plus gros mais garantit le bon ordre de chargement
    outDir: "dist",
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      external: ['pdfjs-dist', /^pdfjs-dist\//],
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
