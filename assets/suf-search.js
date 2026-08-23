// Predictive search for layout/suf.liquid.
//
// Replaces assets/dT_main.js + dT_main_app.js -- 148 KB of Vue and axios --
// with Shopify's native /search/suggest.json and about 150 lines. Those two
// files did nothing else on this layout once the cart drawer and the wishlist
// went, so removing them is what finally makes jQuery removable too.
//
// Markup: snippets/suf-search.liquid. Opened by the header's search icon,
// which carries data-suf-search-toggle.
//
// The form is a real GET to the search page, so with this file absent or
// broken the search box still works; only the suggestions are lost.

const PANEL = '[data-suf-search]';
const LIMIT = 6;
const DEBOUNCE_MS = 250;

const qs = (sel, root = document) => root.querySelector(sel);

let controller = null;
let debounce = null;
let active = -1;

function currencySymbol() {
  const panel = qs(PANEL);
  return (panel && panel.dataset.currencySymbol) || '';
}

function els() {
  const panel = qs(PANEL);
  if (!panel) return null;
  return {
    panel,
    input: qs('.suf-search__input', panel),
    results: qs('.suf-search__results', panel),
    status: qs('.suf-search__status', panel),
    toggles: [...document.querySelectorAll('[data-suf-search-toggle]')],
  };
}

/* ------------------------------------------------------------------ open/close */

function openPanel() {
  const e = els();
  if (!e) return;
  e.panel.hidden = false;
  e.toggles.forEach((t) => t.setAttribute('aria-expanded', 'true'));
  // Focus lands after the panel is displayed, or the browser refuses it.
  requestAnimationFrame(() => e.input && e.input.focus());
}

function closePanel() {
  const e = els();
  if (!e) return;
  e.panel.hidden = true;
  e.toggles.forEach((t) => t.setAttribute('aria-expanded', 'false'));
  clearResults();
}

/* ------------------------------------------------------------------ rendering */

function clearResults() {
  const e = els();
  if (!e) return;
  e.results.replaceChildren();
  e.results.hidden = true;
  e.input.setAttribute('aria-expanded', 'false');
  e.input.removeAttribute('aria-activedescendant');
  e.status.textContent = '';
  active = -1;
}

function setActive(index) {
  const e = els();
  if (!e) return;
  const items = [...e.results.children];
  if (!items.length) return;

  active = (index + items.length) % items.length;
  items.forEach((li, i) => {
    const on = i === active;
    li.classList.toggle('is-active', on);
    li.setAttribute('aria-selected', String(on));
    if (on) {
      e.input.setAttribute('aria-activedescendant', li.id);
      li.scrollIntoView({ block: 'nearest' });
    }
  });
}

function render(products, query) {
  const e = els();
  if (!e) return;

  e.results.replaceChildren();
  active = -1;

  if (!products.length) {
    e.results.hidden = true;
    e.input.setAttribute('aria-expanded', 'false');
    e.status.textContent = 'No results for ' + query;
    return;
  }

  products.forEach((product, i) => {
    const li = document.createElement('li');
    li.className = 'suf-search__result';
    li.id = 'suf-search-result-' + i;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');

    const link = document.createElement('a');
    link.className = 'suf-search__result-link';
    link.href = product.url;
    // Product titles are merchant data. textContent, never innerHTML.
    link.textContent = product.title;

    if (product.featured_image && product.featured_image.url) {
      const img = document.createElement('img');
      img.className = 'suf-search__result-image';
      img.src = product.featured_image.url;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 60;
      img.height = 60;
      li.append(img);
    }

    const body = document.createElement('div');
    body.className = 'suf-search__result-body';
    body.append(link);

    if (product.price) {
      const price = document.createElement('span');
      price.className = 'suf-search__result-price';
      // suggest.json gives a bare number; the symbol comes from Liquid.
      price.textContent = currencySymbol() + product.price;
      body.append(price);
    }

    li.append(body);
    e.results.append(li);
  });

  e.results.hidden = false;
  e.input.setAttribute('aria-expanded', 'true');
  e.status.textContent = products.length + (products.length === 1 ? ' result' : ' results');
}

/* ------------------------------------------------------------------ fetching */

async function search(query) {
  const e = els();
  if (!e) return;

  // Supersede any request still in flight, so a slow early response cannot
  // overwrite the results for what was typed later.
  if (controller) controller.abort();
  controller = new AbortController();

  const url =
    '/search/suggest.json?q=' +
    encodeURIComponent(query) +
    '&resources[type]=product&resources[limit]=' +
    LIMIT +
    '&resources[options][unavailable_products]=last';

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('search responded ' + response.status);
    const data = await response.json();
    render((data.resources && data.resources.results && data.resources.results.products) || [], query);
  } catch (error) {
    if (error.name === 'AbortError') return;
    // A failed suggestion must not break the form; submitting still searches.
    clearResults();
    console.warn('[suf] predictive search unavailable:', error.message);
  }
}

/* ------------------------------------------------------------------ wiring */

function init() {
  if (!qs(PANEL)) return;

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-suf-search-toggle]');
    if (toggle) {
      event.preventDefault();
      const e = els();
      if (e.panel.hidden) openPanel();
      else closePanel();
      return;
    }

    if (event.target.closest('[data-suf-search-close]')) {
      event.preventDefault();
      closePanel();
      return;
    }

    // A click anywhere outside an open panel dismisses it.
    const e = els();
    if (e && !e.panel.hidden && !event.target.closest(PANEL)) closePanel();
  });

  document.addEventListener('input', (event) => {
    if (!event.target.matches('.suf-search__input')) return;
    const query = event.target.value.trim();

    clearTimeout(debounce);
    if (query.length < 2) {
      clearResults();
      return;
    }
    debounce = setTimeout(() => search(query), DEBOUNCE_MS);
  });

  document.addEventListener('keydown', (event) => {
    const e = els();
    if (!e || e.panel.hidden) return;

    if (event.key === 'Escape') {
      closePanel();
      e.toggles[0] && e.toggles[0].focus();
      return;
    }

    if (!event.target.matches('.suf-search__input')) return;
    const items = [...e.results.children];

    if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault();
      setActive(active + 1);
    } else if (event.key === 'ArrowUp' && items.length) {
      event.preventDefault();
      setActive(active - 1);
    } else if (event.key === 'Enter' && active > -1 && items[active]) {
      // Enter on a highlighted suggestion follows it; otherwise the form
      // submits normally and runs a full search.
      event.preventDefault();
      const link = qs('a', items[active]);
      if (link) window.location.assign(link.href);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
