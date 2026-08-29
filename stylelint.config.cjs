// Stylelint, deliberately WITHOUT a shared preset.
//
// stylelint-config-standard-scss would have flagged around 150 things here on
// the day it was added, and most of them are decisions this codebase has
// already made -- bare hex values like #4a6d80, class names that must stay
// legacy (.dt-sc-flex, .shopify-section), nesting depth in the forked header.
// A linter whose output is mostly disagreements about house style is one people
// learn to scroll past, which is the same failure mode docs/workflow.md guards
// against for Theme Check.
//
// So every rule below is enabled by name, and each one is here because it
// catches a MISTAKE rather than a preference. Adding a rule is fine; adding a
// preset is not.
//
// Scope is frontend/styles only. assets/*.css and assets/*.css.liquid are
// inherited or Liquid-templated and are not ours to lint.

module.exports = {
  customSyntax: 'postcss-scss',

  rules: {
    // ---------------------------------------------------------------------
    // THE ONES THAT CATCH REAL BUGS
    // ---------------------------------------------------------------------

    // A shorthand after a longhand silently wipes it. This found a live one
    // on its first run: the mobile drawer set transition-property and
    // transition-duration, then a `transition:` shorthand two lines later
    // discarded both. Nothing errors and the rule still appears in DevTools.
    //
    // Closely related to the shorthand trap in architecture.md, and the one
    // rule here that most justifies the install.
    'declaration-block-no-shorthand-property-overrides': true,

    // The same property twice in one block -- almost always an edit that did
    // not finish.
    //
    // The exception is the legacy header's token bridge, which deliberately
    // writes a value and then a themed override on the next line. That idiom
    // is consecutive and has different values, so it is ignored by name
    // rather than by turning the rule off.
    'declaration-block-no-duplicate-properties': [
      true,
      { ignore: ['consecutive-duplicates-with-different-values'] },
    ],

    // `padding: 10px 0 10px 0` -- harmless, but it means nobody read it back.
    'shorthand-property-no-redundant-values': true,

    // Typos. All cheap, all zero-hit today, all silent failures if they ever
    // do fire: a misspelled property is simply dropped by the browser.
    'property-no-unknown': true,
    'unit-no-unknown': true,
    'media-feature-name-no-unknown': true,
    'selector-pseudo-class-no-unknown': true,
    'selector-pseudo-element-no-unknown': true,
    'color-no-invalid-hex': true,
    'block-no-empty': true,

    // ---------------------------------------------------------------------
    // CONSISTENCY WORTH ENFORCING
    // ---------------------------------------------------------------------

    // The repo had both `rgba(0, 32, 54, .12)` and `rgb(0 32 54 / 12%)` in
    // adjacent files, which makes shadows and overlays hard to compare by eye
    // when tuning them. Both are auto-fixable -- see `npm run lint:css:fix`.
    'color-function-notation': 'modern',

    // exceptProperties opacity: the rule covers `opacity` as well as colour
    // alphas, and --fix happily rewrote 23 `opacity: 0` to `opacity: 0%`.
    // Both are valid, but percentage opacity is a much newer syntax and the
    // unitless form is what every reference and every other theme file uses.
    // Nothing was gained for the risk.
    'alpha-value-notation': ['percentage', { exceptProperties: ['opacity'] }],

    // Every custom property this codebase owns is --suf-*. The prefix is what
    // keeps them from colliding with the ~30 legacy templates, so it is worth
    // enforcing rather than trusting.
    'custom-property-pattern': '^suf-[a-z0-9-]+$',

    // ---------------------------------------------------------------------
    // DELIBERATELY OFF
    // ---------------------------------------------------------------------

    // 87 warnings, and it cannot tell a real conflict from a deliberate one:
    // it compares selectors in source order with no idea which elements exist.
    // `npm run audit:css` answers the same question against the RENDERED DOM,
    // which is why that tool was written. Two tools disagreeing about the same
    // thing is worse than one.
    'no-descending-specificity': null,

    // Re-opening a selector further down a file is a deliberate pattern here
    // -- .suf-splitfact--dark states its layout, then its typography, then its
    // chart colours, each beside the thing it modifies. 12 warnings, all of
    // them that.
    'no-duplicate-selectors': null,

    // Wants `inset:` over top/right/bottom/left and `place-self:` over
    // align-self + justify-self. That is a readability judgement, not a
    // correctness one, and the longhands are often clearer next to a comment
    // explaining one specific edge.
    'declaration-block-no-redundant-longhand-properties': null,
  },
};
