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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // CRITICAL: Vendor chunks - React must load first
          if (id.includes('node_modules')) {
            // React core + scheduler (React dependency) + React Router
            // These MUST be in the same chunk to prevent createContext errors
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/') ||
              id.includes('/react-router') ||
              id.includes('/@remix-run/')
            ) {
              return 'vendor-react';
            }
            // Radix UI (React-dependent, but lazy-loadable)
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            // TanStack Query
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            // Form libraries
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
              return 'vendor-form';
            }
            // Date libraries
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }
            // Supabase
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // PDF/Export (heavy, lazy-load)
            if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('pdfjs')) {
              return 'vendor-export';
            }
            // Charts (heavy, lazy-load)
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            // All other vendors in misc
            return 'vendor-misc';
          }

          // AI Agents chunk
          if (id.includes('/src/ai/agents/')) {
            return 'ai-agents';
          }

          // Phase-based chunks for lazy-loaded pages
          if (id.includes('/src/pages/phase0/')) return 'pages-phase0';
          if (id.includes('/src/pages/phase1/')) return 'pages-phase1';
          if (id.includes('/src/pages/phase2/')) return 'pages-phase2';
          if (id.includes('/src/pages/phase3/')) return 'pages-phase3';
          if (id.includes('/src/pages/phase4/')) return 'pages-phase4';
          if (id.includes('/src/pages/phase5/')) return 'pages-phase5';
          if (id.includes('/src/pages/pro/')) return 'pages-pro';
          if (id.includes('/src/pages/b2b/') || id.includes('/src/pages/tenders/')) return 'pages-b2b';

          // Services chunks
          if (id.includes('/src/services/phase0/')) return 'services-phase0';
          if (id.includes('/src/services/phase1/')) return 'services-phase1';
          if (id.includes('/src/services/phase2/')) return 'services-phase2';
          if (id.includes('/src/services/phase3/')) return 'services-phase3';
          if (id.includes('/src/services/phase4/')) return 'services-phase4';
          if (id.includes('/src/services/phase5/')) return 'services-phase5';
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  // Important for Vercel deployment
  base: '/',
}));
