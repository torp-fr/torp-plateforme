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
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react-dom') || id.includes('react/')) {
              return 'vendor-react';
            }
            // React Router
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            // TanStack Query
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            // Radix UI components
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            // Form libraries
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
              return 'vendor-form';
            }
            // Date libraries
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }
            // Charts
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            // Supabase
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // PDF/Export
            if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('dompurify')) {
              return 'vendor-export';
            }
            // Other vendors
            return 'vendor-misc';
          }

          // AI Agents chunk
          if (id.includes('/src/ai/agents/')) {
            return 'ai-agents';
          }

          // Phase-based chunks for lazy-loaded pages
          if (id.includes('/src/pages/phase0/')) {
            return 'pages-phase0';
          }
          if (id.includes('/src/pages/phase1/')) {
            return 'pages-phase1';
          }
          if (id.includes('/src/pages/phase2/')) {
            return 'pages-phase2';
          }
          if (id.includes('/src/pages/phase3/')) {
            return 'pages-phase3';
          }
          if (id.includes('/src/pages/phase4/')) {
            return 'pages-phase4';
          }
          if (id.includes('/src/pages/phase5/')) {
            return 'pages-phase5';
          }

          // Pro pages chunk
          if (id.includes('/src/pages/pro/')) {
            return 'pages-pro';
          }

          // B2B pages chunk
          if (id.includes('/src/pages/b2b/') || id.includes('/src/pages/tenders/')) {
            return 'pages-b2b';
          }

          // Services chunks
          if (id.includes('/src/services/')) {
            if (id.includes('/phase0/')) return 'services-phase0';
            if (id.includes('/phase1/')) return 'services-phase1';
            if (id.includes('/phase2/')) return 'services-phase2';
            if (id.includes('/phase3/')) return 'services-phase3';
            if (id.includes('/phase4/')) return 'services-phase4';
            if (id.includes('/phase5/')) return 'services-phase5';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500, // Warning si chunk > 500KB
  },
}));
