import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://localhost:3100", ws: true } } },
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
