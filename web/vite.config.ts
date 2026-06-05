import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    lib: {
      entry: "src/Widget.tsx",
      name: "KnowledgeWidget",
      fileName: "widget",
      formats: ["iife"],
    },
    rollupOptions: {
      external: [],
    },
  },
});
