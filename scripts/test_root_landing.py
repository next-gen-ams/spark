"""Keep the root page from disclosing the app directory."""

import unittest

from check_site import ROOT, References


class RootLandingTest(unittest.TestCase):
    def test_root_contains_no_app_paths_or_names(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8").lower()
        for entry in ROOT.iterdir():
            if entry.is_dir() and (entry / "index.html").is_file():
                with self.subTest(app=entry.name):
                    self.assertNotIn(entry.name.lower(), html)
                    self.assertNotIn(entry.name.replace("-", " ").lower(), html)

    def test_root_references_only_own_brand_assets(self):
        parser = References()
        parser.feed((ROOT / "index.html").read_text(encoding="utf-8"))
        self.assertEqual(set(parser.urls), {
            "/assets/brand/kmt-logo.png", "/assets/fonts/dm-sans-variable.ttf",
        })
        html = (ROOT / "index.html").read_text(encoding="utf-8").lower()
        self.assertNotRegex(html, r"<(?:a|script|iframe|form)\b")


if __name__ == "__main__":
    unittest.main()
