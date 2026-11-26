/** @type {import("lint-staged").Configuration} */
const config = {
  "*.{ts,tsx,mts,cts,js,mjs,cjs,jsx}": ["eslint --fix --max-warnings=0", "prettier --write"],
  "*.{json,md,css,yml,yaml}": ["prettier --write"],
};

export default config;
