// Net-new SUF JavaScript. Native ES module — no bundler.
//
// Loaded from layout/theme.liquid with:
//   <script src="{{ 'suf.js' | asset_url }}" type="module"></script>
//
// Because assets/ is flat and served over HTTP, this file CAN import other
// modules in the same folder using relative paths, e.g.:
//   import { formatMoney } from './suf-money.js';
// That gives multi-file JS without a build step. It cannot import from npm --
// that is the point at which we would add Vite.
//
// type="module" is deferred by default, so the DOM is already parsed here.

import "./suf-header.js";

console.debug("[suf] loaded");
