"""Regression coverage for URL resolution and static HTML extraction."""

import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import check_site


class SiteReferencesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.source = self.root / "app" / "index.html"
        self.source.parent.mkdir()
        self.patcher = patch.object(check_site, "ROOT", self.root)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_directory_route_uses_index(self):
        self.assertEqual(check_site.local_target(self.source, "/app/"), self.source)

    def test_relative_asset_strips_query_and_fragment(self):
        self.assertEqual(
            check_site.local_target(self.source, "image%20one.png?v=2#preview"),
            self.source.parent / "image one.png",
        )

    def test_external_fragment_and_dynamic_urls_are_ignored(self):
        for url in ("https://example.com/a", "//example.com/a", "#section",
                    "data:image/png;base64,AA", "mailto:a@example.com", "${asset}"):
            with self.subTest(url=url):
                self.assertIsNone(check_site.local_target(self.source, url))

    def test_encoded_traversal_is_rejected(self):
        with self.assertRaises(ValueError):
            check_site.local_target(self.source, "/%2e%2e/private.txt")

    def test_symlink_cannot_escape_repository(self):
        (self.root / "outside").symlink_to(self.root.parent, target_is_directory=True)
        with self.assertRaises(ValueError):
            check_site.local_target(self.source, "/outside/private.txt")

    def test_html_extracts_assets_redirect_and_inline_css(self):
        parser = check_site.References()
        parser.feed('''<img src="img.png"><a href="/app/">App</a>
            <meta http-equiv="refresh" content="0; url=/app/">
            <style>body { background: url(bg.png) }</style>
            <div style="background:url(icon.svg)"></div>''')
        self.assertEqual(parser.urls, ["img.png", "/app/", "/app/", "bg.png", "icon.svg"])

    def test_javascript_strings_are_not_parsed_as_css(self):
        parser = check_site.References()
        parser.feed('<script>const text = "url(fake.png)";</script>')
        self.assertEqual(parser.urls, [])

    def test_missing_asset_fails_repository_check(self):
        self.source.write_text('<script src="missing.js"></script>')
        output, errors = io.StringIO(), io.StringIO()
        with patch.object(check_site.subprocess, "check_output", return_value=b"app/index.html\0"):
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                self.assertTrue(check_site.main())
        self.assertIn("missing.js", errors.getvalue())

    def test_existing_asset_passes_repository_check(self):
        self.source.write_text('<script src="app.js"></script>')
        (self.source.parent / "app.js").write_text("// fixture")
        with patch.object(check_site.subprocess, "check_output", return_value=b"app/index.html\0"):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertFalse(check_site.main())


if __name__ == "__main__":
    unittest.main()
