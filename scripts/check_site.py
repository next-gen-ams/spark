#!/usr/bin/env python3
"""Check literal local HTML/CSS references and relative JS imports, offline."""

import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CSS_URL = re.compile(r"url\(\s*[\"']?([^\"'\s)]+)")


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
        self.in_style = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "style":
            self.in_style = True
        self.urls.extend(CSS_URL.findall(attrs.get("style", "")))
        for name in ("href", "src", "poster"):
            if attrs.get(name):
                self.urls.append(attrs[name])
        if tag == "meta" and attrs.get("http-equiv", "").lower() == "refresh":
            match = re.search(r"url\s*=\s*(.+)", attrs.get("content", ""), re.I)
            if match:
                self.urls.append(match[1].strip("\"' "))

    def handle_endtag(self, tag):
        if tag == "style":
            self.in_style = False

    def handle_data(self, data):
        if self.in_style:
            self.urls.extend(CSS_URL.findall(data))


def local_target(source, url):
    """Return a repository-local target, or None for external/dynamic URLs."""
    if any(marker in url for marker in ("${", "{{", "<%")):
        return None
    parts = urlsplit(url)
    if parts.scheme or parts.netloc or not parts.path:
        return None
    path = unquote(parts.path)
    target = (ROOT / path.lstrip("/") if path.startswith("/") else source.parent / path).resolve()
    if not target.is_relative_to(ROOT):
        raise ValueError("local URL escapes the repository")
    return target / "index.html" if target.is_dir() else target


def main():
    files = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    errors = []
    checked = 0
    for name in filter(None, files):
        source = ROOT / name
        if source.suffix not in (".html", ".css", ".js", ".mjs"):
            continue
        # Generated bundles and vendored libraries are not editable source.
        if "vendor" in source.parts or "_next" in source.parts or source.name.endswith(".min.js"):
            continue
        content = source.read_text(encoding="utf-8")
        urls = []
        if source.suffix == ".html":
            parser = References()
            parser.feed(content)
            urls.extend(parser.urls)
        if source.suffix == ".css":
            urls.extend(CSS_URL.findall(content))
        if source.suffix in (".js", ".mjs"):
            urls.extend(re.findall(r"(?:from\s*|import\s*(?:\(\s*)?)[\"'](\.[^\"']+)[\"']", content))
        for url in urls:
            try:
                target = local_target(source, url)
                if target is not None:
                    checked += 1
                    if not target.is_file():
                        errors.append(f"{name}: missing {url}")
            except ValueError as error:
                errors.append(f"{name}: {error}")
    for error in errors:
        print(error, file=sys.stderr)
    print(f"Checked {checked} local references; {len(errors)} errors.")
    return bool(errors)


if __name__ == "__main__":
    sys.exit(main())
