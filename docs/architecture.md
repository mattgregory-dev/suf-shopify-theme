# Architecture

## Pull before you push

**The merchant's work exists only on the theme.** Text, images and blocks added
in the theme editor are written to that theme's `templates/*.json` and
`config/settings_data.json`. Nothing sends them to the repo, and a push
overwrites them silently.

```
git status      # clean, or the pull buries your own work
npm run pull    # merchant edits land in the working tree
git diff        # this is their work, now visible
git commit
npm run deploy
```

Two files, two owners: they own `templates/` and `config/settings_data.json`,
we own everything else. The clean tree is what makes it safe — `git diff` is
then exactly what came down, and you can keep or revert any of it.

Details, and how to recover an edit already lost, in
[workflow.md](workflow.md).

## The core rule: new code is ADDITIVE

Do not refactor, reformat, or "modernize" the inherited theme. New work goes in
`frontend/`, compiles to `assets/suf.*`, and is prefixed `suf-` / `--suf-` so it
cannot collide with the legacy 117KB framework stylesheet.

**Why this is not just caution:** several stylesheets are *Liquid-templated CSS*
rendered at request time against merchant settings —

| File | Reads |
|---|---|
| `assets/dt-custom.css.liquid` | 133 Liquid tags — `settings.base_font`, `blog_bg_color`, … |
| `assets/dt-framework.css.liquid` | 27 tags — `settings.breadcrumb_*` |
| `assets/font-all.min.css.liquid` | `settings.animae_enable` |
| `assets/social-buttons.js.liquid` | `settings.social_sharing_*` |

There is no build-time value for `settings.blog_bg_color`. **No build tool can
compile these.** Porting them to Sass would silently break every corresponding
control in the merchant's theme editor.

## Front-end stack

```
frontend/styles/
  main.scss              entry -> assets/suf.css
  _tokens.scss           CSS custom properties
  _mixins.scss           breakpoints (Sass vars — media queries can't read var())
  components/
assets/suf.js            hand-written native ES module (NOT generated)
```

- **Sass, written in a modern-CSS dialect.** Use `@use`/`@forward` (`@import` is
  deprecated in Dart Sass). Use native nesting.
- **Theming goes through custom properties, never `$variables`.** `$vars` are
  compile-time and cannot respond to a Liquid `settings.*` value; `var()` can.
  Breakpoints are the exception and stay Sass variables, because media query
  conditions cannot read `var()`.
- **No bundler on purpose.** `assets/` is flat and served over HTTP, so
  `suf.js` can `import './suf-thing.js'` relatively. It **cannot** import from
  npm. The day you need an npm package is the day to add Vite —
  `frontend/styles/` is already shaped for it and only the loader line in
  `layout/theme.liquid` changes.
- `assets/suf.css` is **gitignored, not committed** — it churns on every style
  edit. **Consequence: a clean clone has no compiled CSS.** Always build before
  pushing; `npm run deploy` runs `css:build` then pushes to Sporto - Redesign,
  which is the LIVE theme.

Both files load from `layout/theme.liquid`, marked with `{% comment %}`.

## Layouts: `theme.liquid` and `suf.liquid`

There are two layouts, and which one a page uses is the single biggest factor in
what it weighs.

| Layout | Used by | Loads |
|---|---|---|
| `layout/theme.liquid` | every inherited template | jQuery, dt-plugins (Swiper), select2, handlebars, dt-theme.js, dT_main*.js, ajax-cart, lazysizes, dt-framework.css, dt-custom.css, swiper, select2.css, `suf.css`, `suf.js` |
| `layout/suf.liquid` | `page.suf-*` templates | `suf.css`, `suf.js` (which imports `suf-nav`, `suf-motion` and `suf-search`), the Hanken Grotesk fonts, `content_for_header`. jQuery, `dt-framework.css` and `dt-custom.css` are **not** loaded — the file's own header comment says so and why |

A template opts in with a top-level key (JSON) or a tag (Liquid):

```json
{ "layout": "suf", "sections": { "main": { "type": "suf-main-page" } } }
```

```liquid
{% layout 'suf' %}
```

`templates/password.json` already uses the JSON form for `layout/password.liquid`
— that is the in-repo proof it works on a Vintage theme.

### Rules for suf.liquid

- **Never add a legacy asset back to it.** If a section needs jQuery or
  dt-framework.css, the section is what needs porting. The moment this layout
  loads the legacy stack it stops being worth having.
- **Only `suf-*` sections belong in a suf template.** Inherited sections are
  styled by `dt-framework.css` and will render unstyled here.
- **No lazysizes.** Use native `loading="lazy"`, not `class="lazyload"`.
- **The header is shared, and it is new code.** `sections/suf-nav.liquid` is
  rendered by BOTH layouts, so they read one `settings_data` key: one logo, one
  menu, no drift. It was written from scratch on 2026-08-30/31 and replaced two
  headers — `sections/header.liquid` and the fork `sections/suf-header.liquid`,
  both since deleted.
  - Its CSS is **not** scoped under `.suf-body`. It cannot be: the class only
    exists on one of the two layouts it renders on. It scopes to `.sufnav-wrap`
    instead, which the section itself emits. `_suf-search.scss` does the same,
    for the same reason.
  - On `theme.liquid` it is up against `dt-framework.css`, which styles buttons
    with `button[type="button"]` — (0,1,1), enough to beat any single class.
    That is why `_suf-nav.scss` nests everything one level deeper, and why it
    declares properties it does not care about (`margin`, `float`,
    `border-radius`): an **undeclared** property is a gap the legacy sheet
    fills no matter how specific your selector is.
- **Never add to the legacy block in the layout.** If something needs jQuery or
  `dt-framework.css`, port the section instead.

### Why `suf.css` base rules are scoped under `.suf-body`

`suf.css` is loaded by *both* layouts, so an unscoped reset or base-typography
rule in it would restyle all ~30 inherited templates — exactly the collision the
additive rule exists to prevent. `suf.liquid` puts `class="suf-body"` on
`<body>`; `theme.liquid` does not. Base and `.rte` rules therefore nest under
`.suf-body`, while component classes (`.suf-footer`, `.suf-social`) are safe
unscoped because the prefix already makes them unique.

### The trap that scoping creates: base rules out-specify components

This produced roughly a dozen bugs before it was understood, and the fix is now
structural — but the shape is worth knowing, because the same collision can
still be written by hand inside a component (see "It is not only the base
layer" below).

Scoping costs specificity. A scoped base rule carries a class **and** an
element:

| Selector | Specificity | |
|---|---|---|
| `.suf-body a` | (0,1,1) | base |
| `.suf-body p` | (0,1,1) | base |
| `.suf-btn--primary` | (0,1,0) | component — **loses** |
| `.suf-cta__subhead` | (0,1,0) | component — **loses** |

So a component that set `color` on an `<a>`, or `margin` on a `<p>`, was
overridden by the base layer no matter where it sat in the cascade. Primary
buttons rendered with blue link text; a centred CTA subhead sat left-aligned
because its `margin: 0 auto` lost to `.suf-body p`. Nothing was misspelled and
the component rule was plainly present in DevTools — just struck through.

**The fix: the base layer is wrapped in `:where()`.**

```scss
:where(.suf-body) {
  p, ul, ol { margin: 0 0 var(--suf-space-md); }
  a { color: var(--suf-color-link); }
}
```

`:where()` contributes **zero** specificity, so those rules are (0,0,1). The
scoping still applies — they match only inside `.suf-body`, so the ~30 legacy
templates stay untouched — but the base layer now sits *under* the components
instead of competing with them, which is what a base layer is for. A plain
component class at (0,1,0) wins automatically.

**What this removed.** The base file used to carry exclusion lists naming every
component that renders as an `<a>` or a `<button>`:

```scss
a:not(:where(.suf-btn, .suf-link, .suf-tcard, .suf-resource, .suf-social__link))
```

That was one file being asked to remember what other files were doing. Every
new link-like component had to be added to it or it silently inherited link
blue — and it was forgotten twice. Those lists are gone. A component that
declares its own colour beats the base without being announced anywhere.

The corollary: a component that relies on the base for a property must now
declare it. `.suf-btn` and `.suf-social__link` gained `color: inherit` when the
lists were deleted, because that was what the exclusions had been buying them.

**The LEGACY BASE COMPATIBILITY block used to be the one exception**, left
unwrapped at the bottom of `_suf-base.scss` because the forked header's
inherited markup needed its weight. It went with that header on 2026-08-31.

What survives there is two rules on `.suf-body a`, unwrapped and deliberately
so: they strip the browser's default underline, with `.rte a` putting it back
in prose. They were never legacy compatibility — they only lived in that block
— and deleting them underlines every link on every suf page.

**Do not reach for `!important`.** It wins the fight and loses the file: the
next override has nowhere to go.

#### Shorthands make it worse

`font: inherit` on the form-control rule was the most damaging instance,
because a shorthand resets **every** longhand it covers — `font-size`,
`font-weight`, `font-style`, `line-height` and `font-family` together. A button
that set only `font-size` and `font-weight` lost both to a rule that never
mentioned either. The same applies to `background`, `border`, `margin` and
`padding`.

When a base rule uses a shorthand, assume it collides with far more than it
appears to.

#### Auditing for it

This trap recurred at least a dozen times — anchors, then buttons, then the
`font` shorthand on those same buttons, then the eyebrow's `<p>` margin —
because each fix addressed only the instance in front of it. `:where()` closed
the base-layer case; the in-component case below is still live, so the check is
still worth running:

1. List the scoped base rules and the properties each sets, expanding
   shorthands to their longhands.
2. From the rendered HTML, list which elements carry a `suf-` class — a
   component only collides where it renders as an element the base rule
   targets.
3. Any component declaration at (0,1,0) that shares a property with a base rule
   matching the same element is losing, whatever the cascade order.

Components rendering as `<a>`, `<button>` or `<p>` are where this lives. That
is where the buttons, the standalone links and every eyebrow, subhead and role
line are.

#### It is not only the base layer

The rule is broader than "scoped base rules beat components". **Any selector
mixing a class with an element out-specifies a plain class** — including one
written inside a component, against that component's own children:

```scss
.suf-gcard {
  > p { font-size: 15px; }        // (0,1,1)
}
.suf-gcard__price { font-size: clamp(36px, 3.2vw, 52px); }   // (0,1,0) -- loses
```

That shipped. `.suf-gcard > p` was meant as "the body copy", but `__price`,
`__meta` and `__soldout` are all `<p>` and all direct children, so the generic
rule flattened three siblings it was never aimed at. The child combinator does
not help: the price *is* a direct child.

**Give the thing a class instead of reaching for its element.** A component that
names every child explicitly cannot collide with itself.

The audit above catches these too, as long as step 2 compares each rendered
element against *every* rule that matches it rather than only the base ones.

## Accessibility baseline

Applied to all new and forked work from 2026-08-23. Not chasing a specific
conformance level — these are the practices that prevent the common failures.

**Every interactive control needs an accessible name.** For an icon-only
control the name goes on the *control*, not the icon:

```liquid
<a href="{{ routes.cart_url }}" aria-label="{{ 'cart.general.title' | t }}, 3 items">
  {% render 'suf-icon', icon: 'cart' %}
</a>
```

**Icons are decorative by default.** `snippets/suf-icon.liquid` emits
`aria-hidden="true" focusable="false"` unless you pass `label`. Pass `label`
only when the icon is the whole control and nothing else names it — never both
that and an `aria-label` on the parent, or it is announced twice.

**Never `display: none` text that assistive tech still needs.** Use the
`visually-hidden` mixin in `frontend/styles/_mixins.scss`. `display: none`
removes the element from the accessibility tree; the mixin does not. The header
icons were the case in point: the vendor's `.icon__fallback-text` spans were
the only accessible name those links had, so hiding them the obvious way would
have produced three unlabelled links.

**Do not duplicate information to assistive tech.** The cart count is in the
link's `aria-label`, so the visible badge carries `aria-hidden="true"` — it is
announced once, not twice.

**Landmarks get names, not redundant roles.** `<nav aria-label="Menu">`, not
`<nav role="navigation">`; the element already implies the role.

**Keep the focus ring.** `:focus-visible` styling in `_suf-base.scss` is
deliberate. A layout can have no visible focus indicator only if it has
something better, and none of this does yet.

**Prefer real semantics.** A control that toggles something should be a
`<button>` with `aria-expanded`, not a `<div>` with a class. The inherited
header violates this — the mobile menu toggle is a `<div>` and nothing tracks
expanded state. That is fixed as part of the vanilla-JS rewrite, since it needs
the JS to maintain the attribute, not just markup.

**How to check:** tab through the page and confirm every stop is visible and
announces something meaningful, then inspect the accessibility tree in DevTools.
Both take a minute and catch nearly everything at this level.

## Commerce: sections sell in place

**A section that shows a price sells from where it stands.** It renders a real
`{% form 'product' %}` posting a variant id, not a link to the product page.
The legacy product templates are not being rebuilt, so sending a buyer there
takes them from a page that works to one that does not.

**`go_to_checkout` adds `return_to=/checkout`, skipping the cart.** It is a
per-section or per-block checkbox, defaulting to off. When to turn it on:

| | |
|---|---|
| Skip the cart | one high-value purchase, nothing else on the page to add to it |
| Go to the cart | a page selling several things, or a small item someone may pair with another |

Certifications and bundles skip it. The study guides deliberately do not —
that page sells two things and the cart is where a second one gets added.

**A `<form>` cannot live inside an `<a>`.** This is why a card that sells in
place is not a whole-card link, and why sections that sell have a branch: a
product set renders the form, no product renders a link. Any section that
gains a buy button inherits that constraint.

### What the buyer chooses travels as a line item property, never a variant

Bundles ask questions — which two certifications, which seminar. Those answers
are `properties[Name]` inputs inside the buy form.

**Variants exist to vary price, inventory or SKU.** None of these do: every
combination of a bundle costs the same. Using variants would also put a matrix
in the merchant's admin and mean editing every bundle product each time a
seminar is added or retired.

Properties are pure theme output — nothing is configured in Shopify — and they
ride through to the cart, checkout, the order, the confirmation email and
exports.

**Name the key as the label you want to read.** The key IS what Shopify prints,
so `properties[Seminar]` reads as "Seminar:" on the order, which is where staff
pick it up.

**Two Shopify behaviors these lean on:**

| | |
|---|---|
| A blank value is DROPPED, not shown empty | so an unanswered question leaves no line |
| An `_`-prefixed key is hidden from the customer | but kept on the order |

**Prefer an explicit value to a blank one where the blank is meaningful.** A
seminar bundle whose Seminar line is simply absent cannot be told apart from
one where the picker failed to render, so "choose later" submits
`Credit — to be booked later` rather than an empty string.

**The `|` convention in textarea settings.** Where a section takes a list one
item per line, a pipe adds a second field to the line — `suf-legal`'s list
blocks and `suf-cert`'s combinations both use it. Reuse it rather than
inventing a second syntax.

## Naming: the `suf` prefix marks new work

**Everything net-new carries a `suf` marker. This is permanent, not a migration
label.** One test tells you whether a file is ours or inherited.

| Kind | Pattern | Example |
|---|---|---|
| Stylesheet / script | `suf.*` | `assets/suf.css`, `assets/suf.js` |
| CSS custom property | `--suf-*` | `--suf-color-accent` |
| CSS class | `.suf-*` | `.suf-example` |
| Page template | `page.suf-*.json` | `templates/page.suf-about.json` |
| Section / snippet | `suf-*.liquid` | `sections/suf-hero.liquid` |

Legacy files are never renamed to match. The prefix distinguishes new from
inherited; renaming inherited files would defeat that and destroy `git blame`.

**Do not drop the prefix once the legacy equivalent is deleted.** For templates
that would mean changing `template_suffix` on every live page — the one
operation with real production risk. See
[migration.md](migration.md#page-cutover-without-changing-urls). The prefix is
an accurate permanent label, not scaffolding.

`sections/` and `snippets/` are flat — Shopify allows no subdirectories — so the
prefix is the only grouping mechanism available there. It costs nothing in the
theme editor, which lists sections by their `{% schema %}` `name`, not filename.

### The prefix means "ours to change", not "we wrote it"

A `suf-` file is one this project is free to modify. That is **not** the same as
one this project authored, and the difference matters legally, not just
stylistically.

**Files forked verbatim from the inherited theme keep the prefix but are still
vendor code.** Each carries a banner comment naming its original. Current list:

| File | Forked from | Status |
|---|---|---|
| _(none)_ | | |

The only entry was `sections/suf-header.liquid`, a verbatim fork of
`sections/header.liquid`. Both were deleted on 2026-08-31 when
`sections/suf-nav.liquid` replaced them — see
[migration.md](migration.md#the-header-rebuild).

**If you fork one, add the banner and add it to that table.**

#### Why this is written down

This theme is a purchased ThemeForest item. Its licence permits using it on the
store; it does not permit redistributing the source, and a derivative does not
reset that. 195 of the 222 tracked files here are vendor code.

The repo is therefore **private, and must stay private**. The plan is to extract
the net-new work into a separate public repo at the end of the rebuild, as a
case study. When that happens the `suf` prefix is the extraction manifest —
which is precisely why a forked file wearing the prefix is a trap: it would
carry vendor source into a public repo under a filename that looks like ours.
Forks are excluded from extraction until they have been genuinely rewritten.

Do not `git init` a public repo from this history either. Every commit contains
the full theme, so deleting files later publishes them regardless. Extraction
means a fresh repository.

#### Third-party licences to honour

| Asset | Licence | Obligation |
|---|---|---|
| jQuery, select2, handlebars, lazysizes, swiper | MIT | keep the licence headers in the minified files; ship a `NOTICE` if extracted |
| `hanken-grotesk-*.woff2` | SIL OFL 1.1 | licence text ships as [`OFL.txt`](../OFL.txt) in the repo root |

`OFL.txt` is the canonical file from the upstream project, copyright line
included. It lives at the repo root rather than in `assets/`: Shopify restricts
which file types `assets/` accepts, and a rejected file breaks `theme push`.
The repo is the distribution unit, which is where self-hosted fonts normally
carry their licence. Keep it if the net-new code is ever extracted — the
obligation travels with the font files.

### Inherited prefixes worth recognising

| Prefix | Means |
|---|---|
| `main-*` | The one mandatory content section for a template type. No presets — cannot be added from the editor. Pairs 1:1 with a template, except `main-page`, which serves ~20 page templates. |
| `home-*` | Optional, repeatable blocks. All carry presets. |
| `dt-*` / `dT_*` | ThemeForest vendor code. |

`main-` and `home-` are conventions, not technical bindings — the JSON template
names its section explicitly via `"type"`.
