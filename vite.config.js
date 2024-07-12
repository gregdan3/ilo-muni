import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "./src/",
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
      },
    },
    outDir: "dist",
  },
  publicDir: "./static",
});
