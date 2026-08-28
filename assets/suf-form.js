// Form feedback focus.
//
// Shopify's {% form %} posts and REDIRECTS -- the browser lands on a freshly
// parsed document. Visually the success or error note is obvious, but a screen
// reader user is returned to the top of a new page with no announcement that
// anything happened, and the note may be well below the fold.
//
// Moving focus to the note fixes both: it is announced, and it becomes the
// scroll and tab-order anchor for whatever follows.
//
// The note carries tabindex="-1" so it can receive programmatic focus without
// entering the tab order. preventScroll plus a manual scrollIntoView gives a
// smooth landing instead of a jump, while still respecting reduced motion.

const note = document.querySelector("[data-suf-form-success]");

if (note) {
  note.focus({ preventScroll: true });

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  note.scrollIntoView({
    behavior: reduced ? "auto" : "smooth",
    block: "center",
  });
}
