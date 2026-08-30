// Back to top: reveal on scroll.
//
// The ECMAScript equivalent of the jQuery in dt-theme.js.liquid, which showed
// #to-top past 800px of scroll and animated the jump over 900ms. Both halves
// are replaced, and only one of them needs JavaScript:
//
//   REVEAL   here, with an IntersectionObserver.
//   SCROLL   not here. `scroll-behavior: smooth` does it natively, guarded by
//            prefers-reduced-motion, and unlike an animated scrollTop it
//            leaves the browser's own focus handling intact. See
//            _suf-base.scss.
//
// Why an observer rather than a scroll listener: the legacy version ran a
// jQuery selector and a style write on EVERY scroll event for the whole life
// of the page. This fires twice -- crossing the threshold going down, and
// again coming back -- and does its intersection work off the main thread.
//
// docs/migration.md records the header's scroll handler leaking a listener per
// event. Nothing here binds to scroll at all, so that bug cannot recur.

const button = document.querySelector(".suf-totop");

// An 800px-tall strip pinned to the top of the page. While any of it is in
// view we are inside the first 800px; once it leaves, we are past the
// threshold. The distance lives in the CSS height and nowhere else -- a
// scroll listener would need the same number written again in JS, and the two
// would drift the first time someone tuned it.
const sentinel = document.querySelector(".suf-totop__sentinel");

// A missing pair means this module was loaded from a layout with no
// back-to-top. Not an error; nothing to do.
if (button && sentinel) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        button.classList.toggle("is-visible", !entry.isIntersecting);
      }
    },
    { threshold: 0 },
  );

  observer.observe(sentinel);
}
