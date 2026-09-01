# Workflow

## Environment: the CLI lives in WSL

The repo is on the WSL filesystem. If your shell is Windows-side (Git Bash,
PowerShell) it cannot see WSL binaries, so run WSL-side commands as:

```
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd ~/projects/suf/theme && shopify ...'
```

Wrap the command in **single** quotes. The outer shell will otherwise expand
`$PATH`, `$?` etc. before WSL sees them — this silently produces wrong results
rather than an error (e.g. `echo "$PATH" | grep npm-global` returns the Windows
PATH and reports a false negative). Use `printenv PATH` when inspecting.

For anything longer than one line, write a script file and run
`bash script.sh` instead of inlining. Nested quoting through two shells fails in
ways that look like environment problems.

`~/.npm-global/bin` is on the PATH in both `~/.profile` and `~/.bashrc`, each
behind a `case` guard so it is not added twice. Note this means `bash -lc` works
but bare `bash -c` does not — that mode reads neither file.

`bash -lc` is still the right invocation, but only for the PATH entry. Node
itself is now the same v22 in every shell mode — one system install, nvm removed
— so a bare `bash -c` calling `~/.npm-global/bin/shopify` by full path works
too. Do not reinstall nvm; see
[wsl-tooling.md](wsl-tooling.md#resolved-and-worth-keeping-resolved-one-node-no-nvm).

Every other way this boundary breaks — and there are several, none of which look
like quoting errors — is catalogued in [wsl-tooling.md](wsl-tooling.md).

## Commands

| Command | Does |
|---|---|
| `npm run dev` | `sass --watch` → `assets/suf.css` |
| `npm run css:build` | One-off compressed build |
| `npm run deploy` | `css:build` then push to **Sporto - Redesign** (#000000000000) — **the LIVE theme since 2026-09-01** |
| `npm run lint` | Theme Check |
| `npm run lint:css` | Stylelint over `frontend/styles` |
| `npm run lint:css:fix` | Same, auto-fixing what it can |
| `npm run format` | Prettier — **scoped to `frontend/` + `suf.js` only** |
| `shopify theme dev` | Local server. Hot-reloads CSS and sections by default. |

Normal loop is two terminals: `npm run dev` alongside `shopify theme dev`.

### `npm run deploy` PUSHES TO THE LIVE SITE

It was called `preview` until 2026-09-01, and the rename is not cosmetic. The
script has always pushed to Sporto - Redesign (#000000000000); what changed is
that **that theme is now published**. The name said preview and the effect was
deploy, which is the kind of gap that catches someone out late at night.

```
npm run deploy         # builds CSS, pushes to the LIVE theme
```

It carries `--allow-live`, which the CLI requires when the target is published.
Note what that flag is and is not:

- `--allow-live` is a PERMISSION. It says "proceed if the target happens to be
  live". It is a no-op when the theme is not live, so the script keeps working
  unchanged if a different theme is ever published.
- `--live` is a TARGET, meaning "push to whatever is live right now". It is
  never wanted in a script. The target here stays the explicit `--theme <id>`.

The flag also removes the confirmation dialog, which until now was the last
thing standing between a stray push and production. **The only remaining
protection is that the theme id is written out in `package.json`** — keep it
that way. The note further down on why an unaimed push script was deleted is
the same rule, and it is the reason the id is there.

Without it the CLI prompts, and in a non-interactive shell — a hook, CI, a
coding agent's tool call — that prompt does not render. It hangs or fails with
nothing that looks like a question. Same family as the `--fail-level` trap in
the Theme Check notes below.

### Showing work to the client without publishing it

Now that the redesign is live, this needs a target that is not the live theme.
`shopify theme dev` will not do: it creates a *development* theme tied to your
CLI session and cleaned up automatically, so there is nothing stable to share.

Push to an unpublished theme instead and share its preview from admin — Online
Store → Themes → that theme → ⋯ → Preview, then the share option in the preview
bar. The viewer needs no admin access, and `?view=` URLs work because a preview
is real Shopify rather than a sandbox.

**There is no script for this yet.** Adding one means creating a staging theme
and giving it its own `--theme` id; worth doing before the product, cart,
collection and blog rebuilds, which is the next time work in progress will need
somewhere to live that is not the live site.

### Testing on a real phone

The same preview link is the answer. `shopify theme dev` binds to
`127.0.0.1:9292` **inside WSL**, so a phone on the same wifi cannot reach it —
WSL2 has its own network namespace and Windows does not forward to it.

`shopify theme dev --host 0.0.0.0` exists and would work, but it needs a
`netsh interface portproxy` rule on the Windows side plus a firewall opening,
and the WSL IP changes on most restarts, so it is a recurring chore rather than
setup. Worth it only for a long session of iterating on mobile CSS.

For a checklist pass, `npm run deploy` and open the site on the phone.
`?view=` works there, so unassigned templates are reachable.

What only a real device gives you, and why the mobile pass is tracked as
outstanding rather than assumed: true touch targets, iOS Safari rather than a
Chrome emulation of it, browser chrome actually eating viewport height — which
is what `100dvh` on the nav drawer exists for — and the sticky header against a
collapsing address bar. None of that reproduces in devtools.

To debug rather than look: Android over USB gives full devtools at
`chrome://inspect`. iOS needs a Mac for Safari's remote inspector.

### The theme editor writes to the THEME, not the repo

You can open **Customize** on any unpublished theme without publishing it, and
its template picker lists every template in that theme — so `page.suf-*` are all
editable there. Safe: it touches that theme's files and nothing else in the
store.

**But nothing comes back.** Edits land in that theme's `config/settings_data.json`
and templates, and the next `npm run deploy` overwrites them, silently. If you
edit in the editor, pull before you push again:

```
shopify theme pull --theme 000000000000 --only config/settings_data.json
```

The repo is the source of truth while the redesign is in flight. Section
settings are seeded directly into `templates/*.json` here, which is the same
data the editor would write — so prefer editing them here and pushing. The
editor is for the merchant after launch.

**Do NOT confuse this with a page's template assignment.** Online Store → Pages
→ *Theme template* sets `template_suffix`, which is **store data shared by every
theme**, so changing it points the LIVE theme at a template it does not have.
That is the one destructive control, and it belongs at cutover. See
[migration.md](migration.md).

**The NAME `npm run deploy` was once removed, and has been reused.** The
original script ran `shopify theme push` with no `--theme`, which prompts with a
list that includes the LIVE theme — one wrong keystroke would have overwritten
two years of production work. That script is gone and is not what exists today.

The rule it was deleted for still stands, and now matters more rather than
less: **every push script names its target explicitly.** The current `deploy`
carries `--theme 000000000000`, and since that theme is live, the id in
`package.json` is the only thing deciding what gets overwritten. `--allow-live`
removed the confirmation dialog that used to back it up. Do not replace the id
with `--live`, and do not remove it and rely on the prompt.

Pushing sends `config/settings_data.json`, so the seeded suf-nav and suf-footer
settings travel with it and the pushed theme matches local. It also
*overwrites* that theme's settings — which, now that the target is published,
means the live site's. Pull `config/settings_data.json` before pushing if
anyone has touched the editor since the last deploy.

`shopify theme dev` already provides hot reload for CSS and sections — it
defaults to `--live-reload hot-reload`. That is not a reason to add a bundler.

## Linting

Two linters, covering different things and deliberately not overlapping:
Theme Check for Liquid and theme structure, Stylelint for the SCSS.

### Stylelint

`stylelint.config.cjs`, and **it extends no preset**. Every rule is named
individually, and the file explains why each one is on or off -- read it before
adding to it.

`stylelint-config-standard-scss` would have reported ~150 problems on the day
it was added, nearly all of them decisions this codebase has already made:
bare hex values, legacy class names, nesting depth in the forked header. That
is the same "output people learn to scroll past" failure the Theme Check policy
below is written around. The rule of thumb: a rule earns its place by catching
a MISTAKE, not a preference.

Two rules are off for a specific reason rather than by omission.
`no-descending-specificity` (87 warnings) answers the same question as
`npm run audit:css` but from source order alone, with no idea which elements
exist -- the audit answers it against the rendered DOM, and two tools
disagreeing is worse than one. `no-duplicate-selectors` (12) fires on a
deliberate pattern: re-opening a selector further down a file to keep each
group of declarations beside the thing it modifies.

It paid for itself on the first run, finding a dead pair of
`transition-property` / `transition-duration` declarations in the mobile drawer
that a `transition:` shorthand two lines below had always been resetting.

**Unlike Theme Check, there is no inherited baseline.** `frontend/styles` is
all net-new, so `npm run lint:css` should exit clean. Keep it that way.

### Theme Check

`.theme-check.yml` extends `theme-check:recommended`.

- **Baseline is ~650 offenses across 217 files. This is inherited and expected**
  for a Vintage theme (`DeprecatedFilter`, `DeprecatedTag`, lazysizes). **Do not
  mass-fix.** Treat it as a ratchet: lint new work, leave the legacy count
  alone. It was ~1,080 before unreferenced sections and snippets were removed,
  ~719 before `sections/suf-header.liquid` was forked, and ~735 while both
  headers existed. Deleting them on 2026-08-31 gave back the 16 duplicated
  offenses and more, and adding the missing `assets/loading.gif` on
  2026-09-01 took 679 to 650 from one file. New code should still add none.
- **Trap: `--fail-level` does not work.** Verified on CLI 3.92.1 — exits `0`
  with 178 errors present, at every level. CI gating must parse
  `--output json` and count offenses itself.
- **`LiquidHTMLSyntaxError` is suppressed for four files.** They are JavaScript;
  Theme Check parses `.liquid` assets with its LiquidHTML parser, which misreads
  `if (qty <= 0)` and `innerHTML = '<a href="'...` as broken markup. The code is
  valid — do not "fix" it. See the comment in `.theme-check.yml`.
- A file that fails to parse gets **no other checks run on it**, so fixing a
  syntax error usually *raises* the offense count. That is more coverage, not a
  regression.
- **`MissingAsset` offenses are real 404s, and they are worth fixing** --
  unlike most of this baseline. `assets/loading.gif` was 29 of them, one per
  lazysizes image across 18 inherited files, so it 404'd on nearly every legacy
  page. Pulling the 43-byte file from production cleared all 29. Two remain,
  both `snippets/pagination-custom.liquid` on the customer templates. See
  [migration.md](migration.md).

## Formatting

Prettier + `@shopify/prettier-plugin-liquid`, configured but **deliberately not
run across the theme** — reformatting the inherited files would destroy
`git blame` on code nobody has read yet. `npm run format` is scoped to new code;
editor format-on-save covers files you actively touch, so formatting converges
naturally.

## Line endings

`.gitattributes` pins `eol=lf`. SVGs are excluded (`*.svg -text`) — one had
`CRCRLF` endings and normalizing them is pure churn.

`git add --renormalize .` would touch **268 files** and has intentionally not
been run. If you ever do it, make it one isolated commit.

## Committing

**Do not commit unless told to.** Leave finished work in the working tree,
unstaged, and report what is ready. This applies to `git add`, `--amend`,
rebases and branch rewrites too. Changes are reviewed before anything enters
history.

### Commit messages

- **Do not add a `Co-Authored-By` trailer.** Omit it entirely.
- Subject line, imperative mood, conventional-commit prefix.
- **Write a body only when there is a trap or a non-obvious consequence** —
  something a dev acting on the commit needs and cannot get from the diff.
- Skip the body entirely when the subject says it all.
- Background and architecture belong in `docs/`, not in `git log`. But note
  these docs are the only versioned record, so a body must be self-contained:
  do not write "see the docs" in place of the fact itself.

## Assistant context files are not tracked

`CLAUDE.md`, `AGENTS.md` and equivalents are gitignored. They are tooling for
whichever coding agent a developer uses, not part of the theme, so the repo
stays agnostic about which one that is. Keep a local stub pointing at `docs/`.
