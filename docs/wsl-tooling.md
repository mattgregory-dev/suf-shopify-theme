# Driving this repo from Windows

The repo lives on the WSL filesystem; the toolchain (node, npm, sass, the
Shopify CLI) is installed **inside** WSL. Anything driving it from the Windows
side — Git Bash, PowerShell, VS Code's terminal, a coding agent — crosses a
shell boundary on every command, and the failures that produces do not look like
quoting failures. They look like broken environments, missing files and corrupt
paths, which is why they get re-diagnosed from scratch every time.

[workflow.md](workflow.md#environment-the-cli-lives-in-wsl) covers the basic
rule. This file is the catalogue of specific traps, each with the symptom you
will actually see.

## The two invocations that work

Everything below is a variation on getting a command intact across the boundary.
These two forms do that reliably:

```
# One-liners. Double quotes outside, so the harness's own single-quote
# wrapping is not what closes your string.
wsl.exe -d Ubuntu-24.04 -- bash -c "cd ~/projects/suf/theme && npm run css:build"

# Anything multi-line, or containing quotes, backticks or $. Feed it on
# stdin -- nothing is parsed by an intermediate shell.
wsl.exe -d Ubuntu-24.04 -- python3 - <<'PYEOF'
...script...
PYEOF
```

For writing whole files, prefer an editor tool that takes a path and content
directly over any heredoc. It sidesteps every trap on this page at once.

## Trap: apostrophes in content break the command

**Symptom** — `bash: -c: line NNN: unexpected EOF while looking for matching
quote`, on a command that looks balanced.

**Cause** — the command is wrapped in single quotes before it runs. A single
quote anywhere in your content closes that wrapper early. CSS is full of them:
`content: ''`, `font-family: 'Hanken Grotesk'`.

**Fix** — use double quotes in the content, or write the file with an editor
tool. Prettier will normalise SCSS quotes afterwards anyway, so authoring with
`"` costs nothing.

## Trap: backticks are executed

**Symptom** — output from a command you never intended to run, mixed into your
results. Seen in practice: documenting `` `npm run deploy` `` in a doc edit
actually invoked `npm run deploy`.

**Cause** — backticks are command substitution in `sh`. Prose and code comments
are full of them.

**Fix** — never pass backticked text through a shell argument. Use a quoted
heredoc (`<<'EOF'`) or an editor tool.

### The quoted heredoc does not save you inside `bash -c "…"`

Worth stating separately, because the fix above looks like it was applied and
the thing still fails.

    # STILL BROKEN. The heredoc is quoted, and it does not matter.
    wsl.exe -d Ubuntu-24.04 -- bash -c "cd ~/x && git commit -F- <<'EOF'
    ... a message containing `backticks` ...
    EOF"

The quoting protects the text from the shell that *runs* the heredoc. But the
whole thing is first a double-quoted argument to `bash -c`, so the OUTER shell
expands backticks and `$` while the heredoc is still just characters inside a
string. It never gets the chance to protect anything.

Seen in practice: a commit message documenting a CSS rule ran two of its own
lines as commands, then hung until the tool timed out. Nothing was staged and
nothing was committed, so the recovery was to check for `.git/index.lock` and
retry — but the failure reads like a broken git, not a quoting problem.

**Fix** — feed it on stdin (`bash -s <<'EOF'`), which is the second of the two
invocations at the top of this file. For commit messages specifically, write
the message to a file with an editor tool and use `git commit -F <file>`:
nothing crosses a shell boundary at all.

## Trap: `$` is expanded before WSL ever sees it

**Symptom** — a shell loop that iterates on nothing, a `grep` that matches
everything or nothing, a `sed` that silently changes no lines, a Python script
whose variables are all empty. Nothing errors. The command reports success and
does the wrong thing.

Seen repeatedly in one session: `for f in a b c; do grep "$f" ...; done` searched
for the empty string and returned every file in the repo. `sed
's/^\$var: true/\$var: false/'` matched nothing, so a "test" of a toggle proved
the opposite of what it claimed.

**Cause** — the same one as the backticks above. `wsl.exe -- bash -c "..."`
makes the whole command a double-quoted string in the OUTER shell first, so
that shell expands `$f`, `$SP`, `$X` and friends and hands WSL the result. A
loop variable that does not exist outside expands to nothing.

Escaping (`\$`) works in some layers and not others, and which layer ate it is
not visible from the output. Do not try to out-quote it.

**Fix** — keep `$` out of the boundary entirely:

- Feed the script on stdin: `bash -s <<'EOF'` — quoted, so nothing expands.
- For anything non-trivial, write the script to a file with an editor tool and
  run it by path. This is the only approach that has never failed here.
- Prefer the Grep and Glob tools over shell loops. They take a pattern, not a
  command line.

**The tell:** if a command that loops or substitutes returns a suspiciously
round result — all files, no files, no matches — assume the variable was eaten
before assuming the logic is wrong.

## Trap: `npm run css:build` during development strips the source maps

**Symptom** — devtools stops showing which partial a rule came from. Every rule
is attributed to `suf.css` instead of `_suf-nav.scss:412`. Restarting
`npm run dev` fixes it, and then it breaks again a few minutes later.

**Cause** — the two scripts build differently, and they are not
interchangeable:

```
css:watch   sass ... --style=expanded --embed-sources     <- npm run dev
css:build   sass ... --style=compressed --no-source-map   <- npm run preview
```

`css:build` is the DEPLOY build. `--no-source-map` strips the
`sourceMappingURL` comment from `assets/suf.css`, so the `.map` file is still
on disk but nothing points at it. Running it while someone is working in
devtools silently undoes their tooling.

**Fix** — to verify a stylesheet change mid-session, use the dev-shaped build:

```
npx sass frontend/styles/main.scss:assets/suf.css --style=expanded --embed-sources
```

`css:build` is correct where it is actually used — `npm run preview` runs it
before `shopify theme push`, which is exactly when you want compressed output
and no maps.

## Trap: npm cannot run from a UNC path

**Symptom** — `npm error code ERR_INVALID_URL`, immediately, with no other
detail.

**Cause** — the command ran Windows-side with the working directory set to
`\\wsl.localhost\Ubuntu-24.04\...`. npm cannot resolve a UNC path as a base URL.

**Fix** — run it inside WSL, with a WSL path:

```
wsl.exe -d Ubuntu-24.04 -- bash -c "cd ~/projects/suf/theme && npm run css:build"
```

Reading and searching files over the UNC path is fine. It is only executing the
node toolchain that fails.

## Trap: Git Bash rewrites absolute paths

**Symptom** — a path arrives at the WSL side with Windows junk prepended:

```
python3: can't open file '/home/.../theme/C:/Program Files/Git/home/user/script.py'
```

**Cause** — MSYS path conversion. Git Bash sees an argument starting with `/`
and helpfully translates it to a Windows path before `wsl.exe` gets it.

**Fix** — do not pass WSL absolute paths as arguments across the boundary. Put
them inside a heredoc fed on stdin, where no translation happens. If an argument
is unavoidable, `MSYS_NO_PATHCONV=1` disables the translation.

## Trap: sed is the wrong tool here

**Symptom** — `sed: -e expression #1, char NNN: unterminated 's' command`, or a
substitution that silently does nothing.

**Cause** — the pattern crosses two shells, and sed has its own metacharacters on
top. Backticks, `&`, `/` and newlines in replacement text all need escaping at
two levels.

**Fix** — use a Python heredoc on stdin and assert before writing:

```
wsl.exe -d Ubuntu-24.04 -- python3 - <<'PYEOF'
import io
p = '/home/user/projects/suf/theme/docs/example.md'
s = io.open(p, encoding='utf-8').read()
old, new = 'exact text', 'replacement'
assert s.count(old) == 1, s.count(old)   # fail loudly, never half-apply
io.open(p, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))
PYEOF
```

The `assert` matters. A silent no-op edit is worse than an error: the build still
succeeds and the wrong thing ships.

Note `newline='\n'`. Writing from the Windows side without it produces CRLF,
which shows up as a whole-file diff.

## Resolved, and worth keeping resolved: one Node, no nvm

There is exactly **one** Node on this machine: system `/usr/bin/node`, installed
from the NodeSource apt repo. nvm was removed on 2026-08-27. Keep it that way.

It used to be two. nvm supplied v22 and the system supplied v20, and which one
you got depended on how the shell started — nvm is sourced *below* the
interactive-only guard in `~/.bashrc`, so anything non-interactive fell through
to v20. Shopify CLI 4.7 requires 22+, so the CLI worked when typed by hand and
failed from tooling, git hooks, CI and editors, with a `SyntaxError` about
`enableCompileCache` that says nothing about versions.

The Shopify CLI was also installed twice, once under each Node. Now it is
installed once, in `~/.npm-global`, with `npm config set prefix ~/.npm-global`
so global installs land there without sudo.

**If you reinstall nvm, you reintroduce the bug.** Should you ever genuinely
need two Node versions, set `nvm alias default` AND source nvm above the
interactivity guard, so both shell modes agree.

To upgrade Node, edit the apt source rather than reaching for a version manager:

```
sudo sed -i 's/node_22\.x/node_NN.x/' /etc/apt/sources.list.d/nodesource.list
sudo apt-get update && sudo apt-get install -y nodejs
```

## Trap: a discard deletes the compiled CSS, and the watcher does not notice

**Symptom** — the dev site renders as unstyled HTML: bare bullets, blue
underlined links. `shopify theme dev` reports 200s. `npm run dev` reports
`Sass is watching for changes.` Everything looks healthy.

**Cause** — `assets/suf.css` is gitignored, so git can never restore it. Any
discard-with-untracked, `git clean -fdx`, or fresh clone removes it. And
`sass --watch` watches its **inputs**: with nothing in `frontend/styles/`
changed, it has no reason to rebuild, so a healthy-looking watcher sits there
next to a missing output file.

**Fix** — restart `npm run dev` after any discard, clean, checkout or stash.
Touching any `.scss` file also forces a rebuild.

**Tell** — if the served HTML is correct but every style is missing, check that
`assets/suf.css` exists before investigating anything else. A GUI client's
"discard all changes" is the usual cause and leaves no reflog entry, so
`git reflog` will show nothing and mislead you.

## `sed -i` breaks the theme dev watcher

**Symptom.** Two at once, and they do not look related:

- Every page 500s with `sections/sedUErZ6x` in the error.
- One section file stops updating in the browser no matter what you change in
  it, while every other file uploads fine.

**Cause.** `sed -i` does not edit in place. It writes a temp file *next to the
original* and renames it over the top. `shopify theme dev` sees the temp file
appear inside `sections/` and uploads it as a section — Shopify then tries to
render a file with no schema and the whole storefront 500s. The rename also
swaps the inode out from under the watcher, which goes on watching a file that
no longer exists.

**Fix.** Do not use `sed -i` anywhere under `sections/`, `snippets/`,
`templates/`, `layout/` or `assets/`. Write with the editor tools, or read and
rewrite with Python. `cat file > file` is not a workaround: it preserves the
inode but does not wake a watcher that has already lost it.

To recover once it has happened:

1. Recreate the stray file (`printf '' > sections/sedUErZ6x`), wait for the
   upload, then `rm` it — the watcher only sends a delete for a file it has
   seen. That clears the 500.
2. Restart `npm run dev` to fix the stuck file. Nothing short of a restart
   reattaches the watcher.
