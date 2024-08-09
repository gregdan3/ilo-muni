import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

import sitemap from "@astrojs/sitemap";
import remarkToc from "remark-toc";

// https://astro.build/config
export default defineConfig({
  site: "https://gregdan3.github.io/ilo-muni/",
  base: "/ilo-muni",
  publicDir: "./static",
  integrations: [mdx(), sitemap()],
  markdown: {
    remarkPlugins: [[remarkToc, { heading: "Table of Contents", maxDepth: 3 }]],
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  devToolbar: {
    enabled: false,
  },
});
