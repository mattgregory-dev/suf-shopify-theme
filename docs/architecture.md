# Architecture

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
  pushing; `npm run deploy` runs `css:build` then `shopify theme push`.

Both files load from `layout/theme.liquid`, marked with `{% comment %}`.

## Layouts: `theme.liquid` and `suf.liquid`

There are two layouts, and which one a page uses is the single biggest factor in
what it weighs.

| Layout | Used by | Loads |
|---|---|---|
| `layout/theme.liquid` | every inherited template | jQuery, dt-plugins (Swiper), select2, handlebars, dt-theme.js, dT_main*.js, ajax-cart, lazysizes, dt-framework.css, dt-custom.css, swiper, select2.css, `suf.css`, `suf.js` |
| `layout/suf.liquid` | `page.suf-*` templates | `suf.css`, `suf.js`, the Indivisible fonts, `content_for_header` — plus jQuery, `dt-framework.css`, `dt-custom.css` and the two search files, **only** for the forked header |

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
- **The header is a fork, not new code.** `sections/suf-header.liquid` began as
  a verbatim copy of `sections/header.liquid` so it can be reduced without
  touching the ~30 templates that render the original. The legacy assets in the
  layout exist solely to keep it working and come off as it shrinks. Checklist
  in [migration.md](migration.md#reducing-the-forked-header).
- **Never add to the legacy block in the layout.** If something needs jQuery or
  `dt-framework.css`, port the section instead.

### Why `suf.css` base rules are scoped under `.suf-body`

`suf.css` is loaded by *both* layouts, so an unscoped reset or base-typography
rule in it would restyle all ~30 inherited templates — exactly the collision the
additive rule exists to prevent. `suf.liquid` puts `class="suf-body"` on
`<body>`; `theme.liquid` does not. Base and `.rte` rules therefore nest under
`.suf-body`, while component classes (`.suf-footer`, `.suf-social`) are safe
unscoped because the prefix already makes them unique.

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
| `sections/suf-header.liquid` | `sections/header.liquid` | verbatim; being reduced, see [migration.md](migration.md#reducing-the-forked-header) |

**If you fork another one, add the banner and add it to that table.**

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
