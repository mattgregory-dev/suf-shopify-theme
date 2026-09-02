// Back to top: reveal on scroll.
//
// ONLY THE REVEAL NEEDS JAVASCRIPT. The jump is `scroll-behavior: smooth` in
// _suf-base.scss, which is guarded by prefers-reduced-motion and leaves the
// browser's focus handling intact, unlike an animated scrollTop.
//
// An observer rather than a scroll listener: this fires twice rather than on
// every scroll event, and nothing here binds to scroll at all -- so the
// listener leak recorded in docs/migration.md cannot recur.

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
