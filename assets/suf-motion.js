// Scroll-triggered accents. See frontend/styles/components/_suf-motion.scss.
//
// One IntersectionObserver adds `.is-in` to each accent as it scrolls into
// view, then stops watching it. There is no scroll handler and no replay: the
// effect is a one-shot reveal, so once an element has played there is nothing
// left to observe.
//
// The demo this came from (mockups/motion-accents-demo.html) has a replay
// button and a forced reflow to make it work. Neither is ported -- replaying
// an entrance animation on content the reader has already seen is a different
// feature, and not one anybody asked for.

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

// Every element that _suf-motion.scss gives a hidden resting state, or that
// carries the .is-in trigger for its children. If one is added there and not
// here, it never becomes visible -- keep the two in step.
//
// .suf-numstrip is the CONTAINER, not its cells: the four cells reveal as one
// staggered sweep, and that only works if a single entry starts them. Observed
// individually, their timing would follow scroll speed instead, and a fast
// flick would fire all four at once.
// .suf-bars and .suf-steps are containers too, for the same reason.
// Groups, not one selector, because they do not all want to fire at the same
// point. Each gets its own observer; the rootMargin is the only thing that
// differs.
//
// The bottom margin pulls the trigger line UP from the fold, so an accent
// fires once it is properly on screen rather than the instant its first pixel
// clears the bottom -- otherwise the animation happens below the reader's
// eyeline and they arrive to find it already over.
const GROUPS = [
  {
    // .suf-numstrip, .suf-bars, .suf-steps and .suf-gymline are CONTAINERS,
    // not the things that move. Their children reveal as one staggered sweep,
    // and that only works if a single entry starts them. Observed
    // individually, the timing would follow scroll speed instead, and a fast
    // flick would fire them all at once.
    selector: '.suf-eyebrow, .suf-numstrip, .suf-bars, .suf-steps, .suf-gymline',
    rootMargin: '0px 0px -10% 0px',
  },
  {
    // The offset frames wait until more of the image is in view. They are a
    // slow, quiet 12px rise on a tall element -- fired at the same point as
    // the rest they were over before the photo they belong to had arrived.
    //
    // The MEDIA element rather than the frame itself: a ::after cannot be
    // observed and cannot carry a class, so the state lives on its parent.
    // splitfact is matched on --framed, not the base class: an unframed one
    // has no ::after and nothing to reveal, so observing it would be work with
    // no effect.
    selector: '.suf-spotlight__media, .suf-cert__media, .suf-splitfact__media--framed',
    rootMargin: '0px 0px -40% 0px',
  },
];

function revealAll(elements) {
  elements.forEach((el) => el.classList.add('is-in'));
}

function watch(group) {
  const elements = [...document.querySelectorAll(group.selector)];
  if (!elements.length) return;

  // Without observer support the accents would stay at opacity 0 forever.
  // Showing them immediately loses the animation and keeps the page.
  if (!('IntersectionObserver' in window)) {
    revealAll(elements);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        // One shot. Unobserving here is what keeps this from re-firing every
        // time the reader scrolls back up past an accent.
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: group.rootMargin, threshold: 0 }
  );

  elements.forEach((el) => observer.observe(el));
}

function init() {
  // Nothing to do. Under reduced motion the stylesheet never applies the
  // hidden state, so there is nothing to reveal -- and adding the class anyway
  // would be a no-op that only looks meaningful.
  if (REDUCED.matches) return;

  GROUPS.forEach(watch);
}

init();
