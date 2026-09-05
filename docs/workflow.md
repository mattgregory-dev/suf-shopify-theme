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
| `npm run pull` | Pull merchant edits down — templates and settings only |
| `npm run deploy` | `css:build` then push to **Sporto - Redesign** (#000000000000) |
| `npm run lint` | Theme Check |
| `npm run lint:css` | Stylelint over `frontend/styles` |
| `npm run lint:css:fix` | Same, auto-fixing what it can |
| `npm run format` | Prettier — **scoped to `frontend/` + `suf.js` only** |
| `shopify theme dev` | Local server. Hot-reloads CSS and sections by default. |

Normal loop is two terminals: `npm run dev` alongside `shopify theme dev`.

### PULL BEFORE YOU PUSH

**The merchant's work only exists on the theme.** Editor changes — text, images,
added blocks — are written to that theme's `templates/*.json` and
`config/settings_data.json`. Nothing sends them to the repo. A push overwrites
them with whatever is on disk, silently and with no record.

```
git status              # must be clean, or the pull buries your own work
npm run pull            # merchant edits land in the working tree
git diff                # THIS is their work, now visible
git commit              # content: pull merchant edits from the theme
```

The pull is **scoped to templates and settings** on purpose. A blanket pull
would also drop the theme's compiled `suf.css` over the local one and overwrite
sections and snippets — the merchant cannot edit those, so there is nothing to
gain and a working tree to lose.

**A clean tree before pulling is the whole safety net.** Pull writes over local
files; if the tree was clean, `git diff` is exactly what came down and you can
keep or revert it line by line. If it was dirty, your own uncommitted work is
gone with no way to tell what was yours.

**A pull also restores anything the theme still has that you deleted locally.**
Deleted templates come back until a deploy removes them from the theme. That is
correct behavior, and it means checking `git status` for restored files after
every pull, not just changed ones.

**Recovering a clobbered edit:** Online Store → Themes → ⋯ → *Version history*.
Shopify snapshots on save and keeps roughly 30 days.

### `npm run deploy` PUSHES TO THE THEME

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

### `.shopifyignore` is not `.gitignore`, and the difference costs you

**`.gitignore` keeps things out of the REPO. `.shopifyignore` keeps things off
the STORE.** They share no machinery: the CLI walks the working directory and
has no idea what git thinks. A file can be gitignored and still pushed to the
live theme on every deploy, which is exactly what was happening.

`assets/suf.css.map` was going up with every push — 385 KB, more than three
times `suf.css` itself. Not a performance problem: `css:build` uses
`--no-source-map`, so the deployed stylesheet carries no `sourceMappingURL` and
no visitor ever requests the map. The reason to stop is different. `css:watch`
uses `--embed-sources`, so the map's `sourcesContent` holds **all 29 SCSS files
in full, comments and all**, published at a URL on a store whose repo is meant
to stay private.

Note `css:build` not regenerating the map is why this was easy to miss: the
stale file from the last `npm run dev` sits in `assets/` and gets pushed
regardless of how the deploy build was configured.

**Verified in both directions on 2026-09-01, not assumed:**

- **Push** — deleted the map from the theme, pushed, confirmed it was not
  re-added.
- **Pull** — put an EMPTY file at the same path on the theme, pulled, and
  confirmed the real 385 KB local file was not overwritten. A neat test: if the
  ignore were push-only, the empty file would have clobbered the real one.

**An ignored path is unmanaged in BOTH directions, which has a sting.** Push
normally deletes remote files that are missing locally; ignored ones are
skipped entirely, so anything already sitting at that path on the theme stays
there and no longer answers to the CLI. Removing it means admin → Edit code, by
hand. Clean up before adding the ignore, not after.

`assets/suf.css` is deliberately NOT in `.shopifyignore`. It is gitignored
because it is generated and churns, but the store needs it — which is why every
push script builds first.

The flag form `shopify theme push -x "assets/suf.css.map"` does the same job if
a one-off exclusion is ever wanted without touching the file.

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

## Comments

One test, before writing any comment:

> **Would a competent person reading this code re-break it without the note?**

If no, don't write it. Most of what fails that test is narration.

**Earns its place**

- A trap that gives no error — `text-wrap: balance` on an inline box, `| date:`
  on a concatenated string, `item.properties.size` reading falsy, a tag
  delimiter inside a `#` comment.
- **A rejected alternative that looks obviously better.** The highest-value
  kind: it is what stops the next person "fixing" it back.
- An external contract you cannot see from here — Shopify drops blank line item
  properties, 50 blocks per section, iOS zooms inputs under 16px.
- A value that looks arbitrary and is not. One line: `// 54ch: centred text has
  no left edge to return to`.

**Does not**

- **Anything that came from a taste instruction** — "move it 3px", "make it
  navy", "drop the margin". Somebody decided, the code shows the decision,
  there is nothing to preserve. This is the common failure.
- What the code already says.
- **History.** "This used to be X, changed on 2026-08-31." That is `git log`.
- The second sentence restating the first.
- **The mockup.** Never cite it — not as a reason, not as a source, not as
  something the code was "ported from" or "departs from". It is an example
  somebody drew, not a specification: it was wrong about the markup, the type
  sizes, the frame and the checkout, and the code is the source of truth. A
  comment that appeals to it teaches the next reader to go and check it.

**American English**, in comments, commit messages and docs alike — color,
behavior, centered, gray. The CSS property is `color` either way, so a comment
spelling it `colour` two lines above is just noise.

Two things it does not touch: `--suf-grey`, which is a name, and any Liquid
that compares against merchant-entered text — `contains 'colour'` in
`snippets/swatch.liquid` and `snippets/variant-tag-color.liquid` matches option
names a merchant typed, so "fixing" it breaks swatches.

The conversion is incomplete, so fix the whole file when you open one. See
**the file pass** below.

**One idea, one statement**

This is the rule that matters. What makes a block enormous is not facts, it is
saying one thing three ways — assert it, restate it, then explain the
restatement. Cutting the repetition is where nearly all the length goes, and no
fact is lost with it.

**Budget by what is being explained**, not a flat cap:

| | |
|---|---|
| A value or a small decision | 1–2 lines |
| A trap that fails silently | up to ~8 |
| A file header, where there is real architecture | ~15 |
| Longer | it belongs in `docs/` |

A trap gets the larger budget because it has to **name the symptom** — that is
what someone greps for when they hit it, and it is the part that saves the
hour. "The panel looks too wide" finds the iOS zoom note; "font-size" does not.

**Keeping them current**

When you change behavior, re-read the comments on it. A stale comment is worse
than none: two comments in one file describing the same control differently
leaves the reader working out which one is lying. This is the failure the rest
of the policy does not catch, because the comment was correct when written.

State the decision, not the derivation — superseded values are history too.
"6px, not the 18px it was" and "raised from 68% after the mobile pass" are
both changelog. Give the number that is there and why it is right now.

**Speak from now.** The commonest form of this is not a date, it is defining
the code by what it is not: "the mockup's card is a whole-card `<a>`", "not a
dead `<button>`", "100px, not the mockup's 72". Each needs the reader to know
something that is gone before the sentence resolves. Say what the code does
and why it is right — "the button is the card's only action, because a
`<form>` cannot live inside an `<a>`".

A contrast is fine when the alternative is one someone would actually reach
for TODAY: `display:none` where `visually-hidden` is meant, `unset` where
`clip` is meant, "no column-hover script, deliberately". Those stop a change.
A contrast with something deleted only stops comprehension.

For anything transitional, say what kills it. "Inert on the suf layout, goes
when the legacy templates do" beats a paragraph explaining the legacy
behavior, and it tells the next person what to do with the block.

**The check that catches drift: comments should not run past roughly a quarter
of a file.** `_suf-motion.scss` reached 64% and `_suf-instance.scss` 73% before
anyone objected. A ratio flags the problem months before it becomes annoying,
and no per-comment rule does.

A comment costs a line of code. Three lines on a one-line change is nearly
always wrong.

**When trimming an existing block, use a scalpel.** Cut the history, the taste
notes and the restatement; keep the traps and the rejected alternatives. A big
block is a pet peeve, not a defect — some of them are load-bearing throughout.
Less editing is more.

**Sparing caps.** A shout is for a trap that costs an hour, not for every
paragraph heading. Several in a row cancel each other out and the file starts
reading as though everything is urgent. Sentence case is the default; earn the
caps.

### The file pass

**Editing one comment in a file means reading all of them.** Not rewriting
them — reading them, and fixing what the rules above already condemn:

- British spellings anywhere in the file, not just the line being changed
- References to the mockup
- Dates, and anything phrased as a changelog
- Comments that describe a past state instead of the present one
- The same fact explained twice in one file — make one canonical, point the
  other at it
- A block that says one thing three ways

The same applies to a commit body being edited. The point is that the
conversions are incomplete and none of them will ever get their own pass;
they only get done when someone is already in the file.

**What survives a pass, always:** a trap that fails silently, a rejected
alternative still reachable today, an external contract, and a value that
looks arbitrary and is not. When a cut is borderline, keep it — the cost of a
line that did not need to be there is a line. The cost of deleting a trap is
the hour it was written to save.

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
- **Most commits are a subject line and nothing else.**

**`git log` is read as a story arc**, scrolled through to see how the work
moved. That is the job a body has to serve. The moment it stops being
scannable it has failed at the only thing it was for, however good the prose.

**THE BODY IS THE LAST PLACE TO PUT ANYTHING.** Check in order — is it in the
code comment, in `docs/`, or visible in the diff? If yes, the body says
nothing about it. All three sit nearer the code and stay current; the commit
copy is the one that goes stale and the one nobody opens. This is what lets
the body collapse, and it is the rule the rest depends on.

**Default to no body.** Most commits are a subject line. Aim for ~70%.

**When there is one: one idea, one paragraph, about four lines.** Not a
summary of the change — the single thing a reader cannot get from the subject
or the diff. Usually why it happened, or what was rejected.

**Longer has to be UBER-EARNED**, and the test is narrow: the information
exists nowhere else in the repo, AND someone acting without it loses real time
or money. That is roughly one commit in twenty here. Some genuinely qualify —
a decision that will look wrong later and get reverted, a constraint discovered
by a failure nobody would repeat, a correction to something this history
already asserts. Write those properly. Everything else gets four lines.

**Always cut:** "also fixed on the way" lists, verification counts, mechanism,
provenance, and restatement of the subject. A trap goes in the CODE, where
someone hits it — not here.

At most one ALL-CAPS line per body, and usually none.

**Bodies wrap at 72 columns.** `git log` indents by four, so anything wider
wraps raggedly in a default terminal.

**Editing a body means the file pass applies to it too** — American English,
no dates, no mockup, present tense. Same rules as a comment.

## Assistant context files are not tracked

`CLAUDE.md`, `AGENTS.md` and equivalents are gitignored. They are tooling for
whichever coding agent a developer uses, not part of the theme, so the repo
stays agnostic about which one that is. Keep a local stub pointing at `docs/`.
