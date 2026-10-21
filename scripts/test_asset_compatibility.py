"""Keep existing script URLs working when Pages flattens repository symlinks."""

import hashlib
import json
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path

from check_site import ROOT


MANIFEST = json.loads((ROOT / "assets/vendor/exceljs-manifest.json").read_text())


class AssetCompatibilityTest(unittest.TestCase):
    def test_exceljs_aliases_are_internal_and_unchanged(self):
        canonical = ROOT / MANIFEST["file"]
        self.assertEqual(hashlib.sha256(canonical.read_bytes()).hexdigest(), MANIFEST["sha256"])
        self.assertEqual(len(MANIFEST["aliases"]), 4)
        for name in MANIFEST["aliases"]:
            alias = ROOT / name
            with self.subTest(alias=name):
                self.assertTrue(alias.is_symlink())
                self.assertEqual(alias.resolve(), canonical.resolve())
                self.assertTrue(alias.resolve().is_relative_to(ROOT))
                self.assertEqual(alias.read_bytes(), canonical.read_bytes())

    def test_pages_tar_dereference_preserves_legacy_url_contents(self):
        # Pages' upload action dereferences symlinks before deploying the archive.
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "pages.tar"
            subprocess.run(
                ["tar", "-hcf", str(archive), "-C", str(ROOT), "--", *MANIFEST["aliases"]],
                check=True, capture_output=True,
            )
            with tarfile.open(archive) as packed:
                for name in MANIFEST["aliases"]:
                    with self.subTest(alias=name):
                        member = packed.getmember(name)
                        self.assertTrue(member.isfile())
                        self.assertFalse(member.issym())
                        self.assertEqual(
                            hashlib.sha256(packed.extractfile(member).read()).hexdigest(),
                            MANIFEST["sha256"],
                        )

    def test_emt_entry_and_retained_bundles_do_not_reference_next_output(self):
        for file in (ROOT / "emt-tracker").rglob("*"):
            if file.is_file() and file.suffix in (".html", ".js", ".css"):
                with self.subTest(file=str(file.relative_to(ROOT))):
                    self.assertNotIn("_next/", file.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
