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
// No-ops unless sections/suf-nav.liquid is on the page, so it is safe to load
// before either layout renders that section.
import "./suf-nav.js";
import "./suf-search.js";
import "./suf-form.js";
import "./suf-totop.js";

console.debug("[suf] loaded");
