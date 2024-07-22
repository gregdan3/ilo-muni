import { defineConfig } from "astro/config";

import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: "https://gregdan3.github.io/ilo-muni/",
  base: "/ilo-muni",
  publicDir: "./static",
  integrations: [mdx()]
});