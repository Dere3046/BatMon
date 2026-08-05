import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ["echarts"],
          mui: ["@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
