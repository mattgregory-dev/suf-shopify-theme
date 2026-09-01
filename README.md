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
| `npm run deploy` | `css:build` then push to **Sporto - Redesign** (#000000000000) — **which is the LIVE theme** |
| `npm run lint` | Theme Check |
| `npm run format` | Prettier — **scoped to `frontend/` + `suf.js` only** |

`assets/suf.css` is generated and gitignored, so **a clean clone has no compiled
CSS**. Always build before pushing — `npm run deploy` does both.

Every push script names its target theme explicitly. There is deliberately no
unaimed `shopify theme push` here: the prompt it shows includes the live theme.

## Two layouts

| Layout | Used by | Weight |
|---|---|---|
| `layout/theme.liquid` | every inherited template | the full legacy stack: jQuery, Swiper, select2, handlebars, lazysizes, four legacy stylesheets |
| `layout/suf.liquid` | `page.suf-*` templates | `suf.css`, `suf.js`, the Hanken Grotesk fonts, `content_for_header`. No jQuery and no legacy stylesheets — the last two went with the header rebuild |

A template opts in with `"layout": "suf"` (JSON) or `{% layout 'suf' %}`
(Liquid). Only `suf-*` sections belong on the suf layout — inherited sections
are styled by `dt-framework.css`, which it does not load.

The header and footer are **shared**: `sections/suf-nav.liquid` and
`sections/suf-footer.liquid` render on both layouts, so the two read one
`settings_data` key — one logo, one menu, no drift. Consent renders from
`content_for_header`, which both layouts output, so the cookie banner works on
either.

Legacy templates are not going away, and they are not being rebuilt. They keep
the full legacy stack and stand on their own alongside the new pages; what the
shared chrome needed to survive `dt-framework.css` was added to
`frontend/styles/`, not worked around there. Read
[docs/migration.md](docs/migration.md) before assigning a suf template to a live
page.

## Documentation

| Read | For |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Why new code is additive, the front-end stack, the `suf` naming rule |
| [docs/workflow.md](docs/workflow.md) | Environment setup, linting policy, formatting, commit conventions |
| [docs/wsl-tooling.md](docs/wsl-tooling.md) | Traps when driving the WSL toolchain from Windows — read if a command fails in a way that makes no sense |
| [docs/migration.md](docs/migration.md) | Production divergence, page cutover, in-flight rebuild state |
| [docs/redesign-open-items.md](docs/redesign-open-items.md) | What is unfinished, what was decided and why, and the traps that recur — read before picking the redesign back up |

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
