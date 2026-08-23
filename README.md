# SUF Shopify Theme

Vintage-era Shopify theme (jQuery, select2, handlebars), inherited as an
**unpublished duplicate of an older version of the production theme**. Safe to
edit; not live.

Currently being simplified and rebuilt: the goal is a clean base first, then
features added back deliberately.

## Quick start

Two terminals:

```
npm run dev          # sass --watch -> assets/suf.css
shopify theme dev    # local server, hot-reloads CSS and sections
```

| Command | Does |
|---|---|
| `npm run dev` | `sass --watch` → `assets/suf.css` |
| `npm run css:build` | One-off compressed build |
| `npm run deploy` | `css:build` then `shopify theme push` |
| `npm run lint` | Theme Check |
| `npm run format` | Prettier — **scoped to `frontend/` + `suf.js` only** |

`assets/suf.css` is generated and gitignored, so **a clean clone has no compiled
CSS**. Always build before pushing — `npm run deploy` does both.

## Two layouts

| Layout | Used by | Weight |
|---|---|---|
| `layout/theme.liquid` | every inherited template | the full legacy stack: jQuery, Swiper, select2, handlebars, lazysizes, four legacy stylesheets |
| `layout/suf.liquid` | `page.suf-*` templates | `suf.css`, `suf.js`, the Indivisible fonts — plus jQuery and two legacy stylesheets, temporarily, for the forked header |

A template opts in with `"layout": "suf"` (JSON) or `{% layout 'suf' %}`
(Liquid). Only `suf-*` sections belong on the suf layout — inherited sections
are styled by `dt-framework.css`, which it does not load.

The suf layout has **no cookie banner yet**, and its header is a fork of the
legacy one that is still being reduced. Read
[docs/migration.md](docs/migration.md) before assigning it to a live page.

## Documentation

| Read | For |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Why new code is additive, the front-end stack, the `suf` naming rule |
| [docs/workflow.md](docs/workflow.md) | Environment setup, linting policy, formatting, commit conventions |
| [docs/migration.md](docs/migration.md) | Production divergence, page cutover, in-flight rebuild state |

**Read `docs/architecture.md` before changing anything.** The single most
important constraint — that several stylesheets are Liquid-templated and cannot
be compiled by any build tool — is not discoverable from the file tree.

`docs/migration.md` is temporary and should be deleted once the redesign has
shipped.

## Layout

```
frontend/styles/     Sass source -> assets/suf.css   (not uploaded to Shopify)
assets/              flat, served over HTTP; suf.js is hand-written
sections/ snippets/  Liquid; new files prefixed suf-
templates/           new page templates prefixed page.suf-
docs/                not uploaded to Shopify
```

Shopify only stores `assets`, `config`, `layout`, `locales`, `sections`,
`snippets` and `templates`. Everything else here — `frontend/`, `docs/`,
`package.json`, config dotfiles — is versioned but never pushed.
