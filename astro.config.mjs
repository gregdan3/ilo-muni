import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkToc from "remark-toc";
import compress from "astro-compress";
import robotsTxt from "astro-robots-txt";

import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  site: "https://ilo.muni.la/",
  base: "",
  publicDir: "./static",
  integrations: [
    mdx(),
    sitemap(),
    icon({ iconDir: "src/icons" }),
    robotsTxt(),
    compress(),
  ],
  markdown: {
    remarkPlugins: [
      [
        remarkToc,
        {
          heading: "Table of Contents",
          maxDepth: 4,
        },
      ],
    ],
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
