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

## Trap: the Shopify CLI works for you but not for tooling

**Symptom** — `SyntaxError: The requested module 'node:module' does not provide
an export named 'enableCompileCache'`, from a CLI that works fine when typed by
hand.

**Cause** — two different Node versions. `~/.bashrc` exits early for
non-interactive shells (the standard `case $- in *i*` guard) and nvm is sourced
*below* that guard. So:

| Shell | Node | CLI |
|---|---|---|
| your interactive terminal | nvm's v22 | works |
| `bash -c` / `bash -lc` from tooling | system `/usr/bin/node` v20 | fails |

Shopify CLI 4.7 requires Node 22+.

**Fix, for a one-off** — call nvm's binary by full path, or source nvm first.
**Fix, properly** — make Node 22 the system default so both shells agree, e.g.
`nvm alias default 22` plus a symlink on the system PATH.

This is also why [workflow.md](workflow.md) says to use `bash -lc`: that gets
`~/.profile` for the `npm-global` PATH entry. It does **not** get you nvm's node.

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
