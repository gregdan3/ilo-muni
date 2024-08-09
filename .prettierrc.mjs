// .prettierrc.mjs
/** @type {import("prettier").Config} */
export default {
  proseWrap: "always",
  plugins: ["prettier-plugin-astro"],
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
  ],
};
