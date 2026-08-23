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

### Inherited prefixes worth recognising

| Prefix | Means |
|---|---|
| `main-*` | The one mandatory content section for a template type. No presets — cannot be added from the editor. Pairs 1:1 with a template, except `main-page`, which serves ~20 page templates. |
| `home-*` | Optional, repeatable blocks. All carry presets. |
| `dt-*` / `dT_*` | ThemeForest vendor code. |

`main-` and `home-` are conventions, not technical bindings — the JSON template
names its section explicitly via `"type"`.
