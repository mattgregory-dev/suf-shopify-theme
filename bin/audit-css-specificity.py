#!/usr/bin/env python3
"""Find component CSS rules that are silently losing to more specific ones.

WHY THIS EXISTS
---------------
suf.css base rules are scoped under .suf-body, which makes them (0,1,1) -- a
class AND an element. A plain component class is (0,1,0), so the base rule WINS
regardless of cascade order:

    .suf-body p        (0,1,1)   base
    .suf-cta__subhead  (0,1,0)   component -- loses its margin

Nothing errors, nothing is misspelled, and DevTools shows the component rule
present but struck through. This has shipped repeatedly: blue text on primary
buttons, a left-aligned CTA subhead, footer headings at 42px, eyebrows with the
wrong gap, an unpinned price, a disclaimer with no top margin, and a
visually-hidden helper whose negative margin was being reinstated.

See docs/architecture.md, "The trap that scoping creates".

USAGE
-----
    npm run audit:css           # `shopify theme dev` must be running
    npm run audit:css -- -v     # also list the expected overrides

Exits non-zero when it finds a likely bug, so it can gate a commit if wanted.

READING THE OUTPUT
------------------
LIKELY BUGS are a component rule losing to a scoped BASE rule. Nobody writes
`.suf-body p` intending to override a component, so these are almost always
real. Fix by nesting the component under its block (preferred), or by excluding
it from the base rule with :not(:where(...)).

EXPECTED is a component rule losing to a MORE SPECIFIC COMPONENT rule -- a
modifier doing its job. Listed only with -v.

LIMITS
------
An approximate matcher, not a browser. Handles descendant, child, class,
element, attribute, :not() and :where(). Ignores @media blocks, so a rule that
only applies at one breakpoint may still be reported. Compares declared values,
so two rules setting the same value are not reported -- but a shorthand's
longhands have no known value and are always treated as conflicting. It is a
prompt to look, not a linter.
"""

import re
import sys
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser

BASE = "http://127.0.0.1:9292"
CSS = "/cdn/shop/t/8/assets/suf.css"

# Any page that exercises the suf layout. Add new templates as they are built.
PAGES = [
    "suf-meet-the-team",
    "suf-contact",
    "suf-study-guides",
    "suf-about",
]

# Shorthands must expand, or a rule that never names `margin-left` still
# overrides it. `font` is the worst: it resets five longhands at once.
SHORTHANDS = {
    "font": ["font-size", "font-weight", "font-style", "line-height", "font-family"],
    "margin": ["margin-top", "margin-right", "margin-bottom", "margin-left"],
    "padding": ["padding-top", "padding-right", "padding-bottom", "padding-left"],
    "background": ["background-color"],
    "border": ["border-color", "border-width", "border-style"],
    "inset": ["top", "right", "bottom", "left"],
    "flex": ["flex-grow", "flex-shrink", "flex-basis"],
}

VOID = {"img", "br", "input", "meta", "link", "hr", "source", "col", "area", "wbr"}


def fetch(path, tries=8):
    for attempt in range(tries):
        try:
            return urllib.request.urlopen(BASE + path, timeout=30).read().decode("utf-8", "replace")
        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as exc:
            if attempt == tries - 1:
                sys.exit("could not fetch %s (%s)\nIs `shopify theme dev` running?" % (path, exc))
            time.sleep(2)


def properties(body):
    """prop -> declared value. A shorthand also registers its longhands with a
    value of None, meaning "affected, exact value unknown"."""
    out = {}
    for prop, value in re.findall(r"([a-z-]+)\s*:\s*([^;]*)", body):
        out[prop] = value.strip()
        for longhand in SHORTHANDS.get(prop, []):
            out.setdefault(longhand, None)
    return out


def specificity(selector):
    """:where() contributes nothing. :not() contributes its argument's weight."""
    flat = re.sub(r":where\([^)]*\)", " ", selector)
    flat = re.sub(r":not\(([^)]*)\)", r" \1 ", flat)
    ids = len(re.findall(r"#[\w-]+", flat))
    classes = (
        len(re.findall(r"\.[\w-]+", flat))
        + len(re.findall(r"\[[^\]]+\]", flat))
        + len(re.findall(r"(?<!:):(?!:)[a-z-]+(?:\([^)]*\))?", flat))
    )
    elements = len(re.findall(r"(?:^|[\s>+~])([a-z][a-z0-9]*)(?![\w-])", " " + flat))
    return (ids, classes, elements)


def compounds(selector):
    """Split into compound parts, outermost first.

    :not() is captured as an EXCLUSION rather than dropped. Dropping it makes
    `a:not(.suf-btn)` match every button and report collisions that cannot
    happen -- which is how an audit turns into noise people learn to ignore.
    """
    parts = []
    for chunk in re.split(r"\s*[>\s]\s*", selector.strip()):
        if not chunk:
            continue
        excluded = set()
        for negation in re.findall(r":not\(([^)]*)\)", chunk):
            excluded.update(re.findall(r"\.([\w-]+)", negation))
        stripped = re.sub(r":not\([^)]*\)", "", chunk)
        stripped = re.sub(r":where\([^)]*\)", "", stripped)
        tag = re.match(r"^([a-z][a-z0-9]*)", stripped)
        parts.append(
            {
                "classes": set(re.findall(r"\.([\w-]+)", stripped)),
                "not_classes": excluded,
                "tag": tag.group(1) if tag else None,
                "id": (re.search(r"#([\w-]+)", stripped) or [None, None])[1],
                "attrs": set(re.findall(r"\[([\w-]+)", stripped)),
            }
        )
    return parts


def is_base(selector):
    """A scoped base rule: .suf-body plus bare elements, no component class."""
    body = re.sub(r":not\([^)]*\)|:where\([^)]*\)", "", selector)
    return body.startswith(".suf-body") and not re.search(r"\.suf-(?!body\b)", body)


class Tree(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.nodes = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        node = {
            "tag": tag,
            "classes": set((attrs.get("class") or "").split()),
            "id": attrs.get("id"),
            "attrs": set(attrs),
            "ancestors": list(self.stack),
        }
        self.nodes.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                del self.stack[i:]
                return


def part_matches(part, node):
    if part["tag"] and part["tag"] != node["tag"]:
        return False
    if part["id"] and part["id"] != node["id"]:
        return False
    if not part["classes"] <= node["classes"]:
        return False
    if part["not_classes"] & node["classes"]:
        return False
    return part["attrs"] <= node["attrs"]


def matches(parts, node):
    if not part_matches(parts[-1], node):
        return False
    chain = list(node["ancestors"])
    for part in reversed(parts[:-1]):
        while chain:
            if part_matches(part, chain.pop()):
                break
        else:
            return False
    return True


def show(entries):
    for tag, own, sel_a, spec_a, sel_b, spec_b, shared in entries:
        print('<%s class="%s">' % (tag, own[:60]))
        print("   %-46s %s  loses  %s" % (sel_a, spec_a, ",".join(shared)))
        print("   %-46s %s  wins\n" % (sel_b, spec_b))


def main():
    verbose = "-v" in sys.argv or "--verbose" in sys.argv

    css = fetch(CSS)
    # Drop @media blocks: comparing rules across breakpoints produces noise.
    flat = re.sub(r"@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}", "", css)

    rules = []
    for selector, body in re.findall(r"([^{}]+)\{([^{}]*)\}", flat):
        props = properties(body)
        if not props:
            continue
        for one in selector.split(","):
            one = one.strip()
            if "suf-" not in one or "::" in one or ":hover" in one or ":focus" in one:
                continue
            rules.append((one, specificity(one), props, compounds(one)))

    nodes = []
    for page in PAGES:
        tree = Tree()
        tree.feed(fetch("/pages/about?view=" + page))
        nodes.extend(tree.nodes)

    print("%d rules, %d elements, %d pages\n" % (len(rules), len(nodes), len(PAGES)))

    seen = set()
    suspect, expected = [], []
    for node in nodes:
        if not any(c.startswith("suf-") for c in node["classes"]):
            continue
        hits = [r for r in rules if matches(r[3], node)]
        for sel_a, spec_a, props_a, _ in hits:
            for sel_b, spec_b, props_b, _ in hits:
                if sel_a == sel_b or spec_b <= spec_a:
                    continue
                # Only a real conflict when the values actually differ. Both
                # rules setting `text-decoration: none` changes nothing, and
                # reporting it trains people to ignore the output.
                shared = sorted(
                    prop
                    for prop in set(props_a) & set(props_b)
                    if props_a[prop] is None
                    or props_b[prop] is None
                    or props_a[prop] != props_b[prop]
                )
                if not shared:
                    continue
                key = (sel_a, sel_b, tuple(shared))
                if key in seen:
                    continue
                seen.add(key)
                own = " ".join(sorted(c for c in node["classes"] if c.startswith("suf-")))
                entry = (node["tag"], own, sel_a, spec_a, sel_b, spec_b, shared)
                if is_base(sel_b) and not is_base(sel_a):
                    suspect.append(entry)
                else:
                    expected.append(entry)

    print("=" * 74)
    print("LIKELY BUGS -- a component rule losing to a scoped BASE rule")
    print("=" * 74 + "\n")
    if suspect:
        show(suspect)
    else:
        print("none\n")

    print("=" * 74)
    print("EXPECTED -- a more specific component rule winning (%d)" % len(expected))
    print("=" * 74)
    if verbose:
        print()
        show(expected)
    else:
        print("A modifier overriding its own component is how this is meant to")
        print("work. Pass -v to list them.\n")

    return 1 if suspect else 0


if __name__ == "__main__":
    sys.exit(main())
