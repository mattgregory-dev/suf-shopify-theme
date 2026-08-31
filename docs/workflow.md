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
| `npm run preview` | `css:build` then push to the **Sporto - Redesign** theme (#000000000000) |
| `npm run lint` | Theme Check |
| `npm run lint:css` | Stylelint over `frontend/styles` |
| `npm run lint:css:fix` | Same, auto-fixing what it can |
| `npm run format` | Prettier — **scoped to `frontend/` + `suf.js` only** |
| `shopify theme dev` | Local server. Hot-reloads CSS and sections by default. |

Normal loop is two terminals: `npm run dev` alongside `shopify theme dev`.

### Sharing a preview with the client

`shopify theme dev` creates a *development* theme: tied to your CLI session and
cleaned up automatically, so it is not something to share. To show someone the
work, push to a real unpublished theme and share its preview from admin:

```
npm run preview        # builds CSS, pushes to Sporto - Redesign (#000000000000)
```

Then Online Store → Themes → that theme → ⋯ → Preview, and use the share option
in the preview bar. The viewer needs no admin access, and `?view=` URLs work
because a preview is real Shopify rather than a sandbox.

**`npm run deploy` was deliberately removed.** It ran `shopify theme push`
with no `--theme`, which prompts with a list that includes the LIVE theme. One
wrong keystroke would overwrite two years of production work. Every push script
here names its target explicitly; keep it that way.

Pushing sends `config/settings_data.json`, so the seeded suf-nav and suf-footer
settings travel with it and the preview matches local. It also
*overwrites* that theme's settings, so never aim a push at a theme whose
settings matter.

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

- **Baseline is ~706 offenses across 224 files. This is inherited and expected**
  for a Vintage theme (`DeprecatedFilter`, `DeprecatedTag`, lazysizes). **Do not
  mass-fix.** Treat it as a ratchet: lint new work, leave the legacy count
  alone. It was ~1,080 before unreferenced sections and snippets were removed,
  ~719 before `sections/suf-header.liquid` was forked, and ~735 while both
  headers existed. Deleting them on 2026-08-31 gave back the 16 duplicated
  offenses and more. New code should still add none.
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
- Some `MissingAsset` offenses are real 404s inherited from the theme, e.g.
  `assets/loading.gif` is referenced but absent. Production has the file.

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
