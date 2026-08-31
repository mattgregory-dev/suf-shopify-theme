// Behaviour for sections/suf-nav.liquid.
//
// A new file rather than a trim of suf-header.js. That module is written
// entirely against the legacy dt-* markup -- .menu-trigger, .sub-menu-block,
// .mobile-menu, and a sticky implementation that CLONES the whole header --
// and none of those selectors exist here. What carried over is the shape:
// listeners bound once, the breakpoint consulted at event time rather than at
// load, and no jQuery.
//
// The sticky state is an IntersectionObserver on a 1px sentinel, matching
// suf-totop.js. The legacy header answered the same question with a scroll
// handler running offsetTop maths on every frame.
//
// Everything here no-ops when the section is not on the page, so importing it
// from suf.js is safe before any layout renders the section.

const MOBILE = window.matchMedia('(max-width: 900px)');

const nav = document.querySelector('[data-sufnav]');
const burger = nav && nav.querySelector('[data-sufnav-burger]');
const sentinel = document.querySelector('[data-sufnav-sentinel]');

/* --------------------------------------------------------------- submenus */

function closeAllPanels() {
  if (!nav) return;
  nav.querySelectorAll('.sufnav__item.is-open').forEach((item) => {
    item.classList.remove('is-open');
    const label = item.querySelector('.sufnav__label');
    if (label) label.setAttribute('aria-expanded', 'false');
  });
}

function setPanel(item, open) {
  // On desktop the panels are mutually exclusive -- two open at once would
  // overlap. Stacked, they are an accordion and several may stay open.
  if (open && !MOBILE.matches) closeAllPanels();
  item.classList.toggle('is-open', open);
  const label = item.querySelector('.sufnav__label');
  if (label) label.setAttribute('aria-expanded', String(open));
}

function togglePanel(item) {
  setPanel(item, !item.classList.contains('is-open'));
}

/* ------------------------------------------------------------- the drawer */

function setMenu(open) {
  if (!nav || !burger) return;
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  if (!open) closeAllPanels();
}

/* --------------------------------------------------------------- compress */

function initSticky() {
  if (!nav || !sentinel || !nav.classList.contains('sufnav--sticky')) return;

  // No observer support means the header simply never compresses, which is a
  // cosmetic loss and not a broken header.
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    ([entry]) => nav.classList.toggle('is-compressed', !entry.isIntersecting),
    { threshold: 0 }
  );
  observer.observe(sentinel);
}

/* ---------------------------------------------------------------- wiring */

function init() {
  if (!nav) return;

  nav.addEventListener('click', (event) => {
    if (event.target.closest('[data-sufnav-burger]')) {
      setMenu(!nav.classList.contains('is-open'));
      return;
    }

    // Search and the mobile drawer both occupy the space under the bar, so
    // they cannot both be open -- the panel would slide out underneath the
    // menu. The drawer yields.
    //
    // No preventDefault: suf-search.js owns the toggle and runs after this,
    // since its listener is on document and this one is on the header. The
    // opposite case needs no code -- the search module already closes its
    // panel on any click outside it, and the burger is outside.
    if (event.target.closest('[data-suf-search-toggle]')) {
      setMenu(false);
      return;
    }

    // The submenu parent is a <button>, so it has nothing to prevent: clicking
    // it toggles its panel and never navigates. Its own destination is the
    // first row inside the panel.
    const label = event.target.closest('.sufnav__item--has > .sufnav__label');
    if (label) togglePanel(label.parentElement);
  });

  nav.querySelectorAll('.sufnav__item--has').forEach((item) => {
    // Hover is driven from here rather than from CSS, so that opening a panel
    // and saying it is open are the same action. See the .is-open comment in
    // _suf-nav.scss.
    //
    // Guarded on the breakpoint: stacked, these are tap-to-expand accordions,
    // and a stray mouseenter would spring them open.
    item.addEventListener('mouseenter', () => {
      if (!MOBILE.matches) setPanel(item, true);
    });

    item.addEventListener('mouseleave', () => {
      // Not while the keyboard is inside it -- the pointer wandering off must
      // not close a panel someone is tabbing through.
      if (MOBILE.matches) return;
      if (item.contains(document.activeElement)) return;
      setPanel(item, false);
    });

    // Focus leaving closes it too, so keyboard users are not left with a panel
    // hanging open behind them.
    item.addEventListener('focusout', (event) => {
      if (MOBILE.matches) return;
      if (item.contains(event.relatedTarget)) return;
      setPanel(item, false);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (nav.classList.contains('is-open')) {
      setMenu(false);
      if (burger) burger.focus();
      return;
    }
    closeAllPanels();
  });

  // A click outside dismisses the open drawer, the same way the search panel
  // behaves.
  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('is-open')) return;
    if (event.target.closest('[data-sufnav]')) return;
    setMenu(false);
  });

  // Crossing the breakpoint leaves the menu in a state that means nothing on
  // the other side of it: a drawer that is now a row, or panels held open by a
  // hover that has ended.
  MOBILE.addEventListener('change', () => setMenu(false));

  initSticky();
}

init();
