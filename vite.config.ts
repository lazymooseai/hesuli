import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// TUOTANTOKORJAUS: manualChunks jakaa 1.28 MB bundlen hallittuihin osiin.
// vendor-react / vendor-ui / vendor-charts / vendor-supabase ladataan
// selaimen valimuistiin kerran ja paivittyvat vain kun riippuvuudet muuttuvat.
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("react-router")) {
            return "vendor-react";
          }
          if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("sonner")) {
            return "vendor-ui";
          }
          if (id.includes("recharts") || id.includes("d3-")) {
            return "vendor-charts";
          }
          if (id.includes("@supabase") || id.includes("@tanstack")) {
            return "vendor-data";
          }
          return "vendor-misc";
        },
      },
    },
  },
}));
