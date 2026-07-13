import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3100" } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("/@codemirror/") || id.includes("/@lezer/")) return "editor";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/@tanstack/"))
            return "react";
        },
      },
    },
  },
});
