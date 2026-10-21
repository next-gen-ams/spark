# Repository maintenance review — 21 October 2026

Reviewed `main` at `7dd4f946e75dc8b53680b8d64d1286932f8e4c9e`:
270 tracked files across nine app directories. This review covers repository
structure and static references; it is not a live application or backend audit.

## Changes prepared

- Added a repository map and source/publication boundaries in the root README.
- Added root ignore rules for local credentials, dependencies and Python caches.
- Added an offline local-reference checker, regression tests and a read-only CI
  workflow. No directory migration or asset deletion is included.
- Corrected the landing page's EMT description to weekly, matching the deployed
  app's README.

## Cleanup candidates requiring approval

Paths below are relative to the repository root. Keep them until the relevant
owner approves removal; this review does not establish a retention policy.

| Exact path | Evidence and likely benefit | Required next step |
| --- | --- | --- |
| `emt-tracker/_next/` | Legacy Next-style static output; the current entry page loads Vite assets from `emt-tracker/assets/` instead. Roughly 18 MB of older files. | EMT maintainer: check source release history, cached-client references and rollback requirements before removing. |
| `emt-tracker/assets/index-BnZBXd45.js` and `emt-tracker/assets/index-B6wFMor2.css` | Older entry assets; current HTML references `index-DP38htVr.js` and `index-IwQI6KxW.css`. | Confirm release retention and cached-client compatibility together with the `_next/` review. |
| `uq-info-day/exceljs.min.js`, `uq-china-social-wip/exceljs.min.js`, `gms-tracking/vendor/exceljs.min.js`, `gms-tracking-v2/vendor/exceljs.min.js` | Four byte-identical 947,702-byte bundles. A shared copy could save 2,843,106 bytes. | Coordinate all four source projects before changing references. Separate copies currently preserve independent releases. |

V1/V2 tracking share some identical modules, but they are separate deployments.
Do not merge their directories or turn one into a redirect without a migration
decision. The legacy root redirects remain useful compatibility entry points.

## Further improvements

1. Give every standalone app a short source/build/release handoff. EMT and PR
   Dashboard already have READMEs; other source ownership needs confirmation.
2. Define an asset-retention window and automate release-specific pruning only
   after checking all references and retaining a recoverable release.
3. Record versions and licenses for bundled libraries in the owning source
   projects. The PR Dashboard npm audit does not inventory the vendored ExcelJS,
   Supabase or compiled EMT dependency trees.
4. Review public snapshot/data suitability and backend access rules separately.
   The public repository and static password gates cannot enforce confidentiality.

## Verification and limits

- `python3 scripts/check_site.py`: 238 local references checked; zero missing.
- `python3 -m unittest discover -s scripts -p 'test_*.py'`: nine tests passed,
  including missing-asset failure, traversal and symlink containment checks.
- Existing PR Dashboard tests: 22 passed.
- `npm --prefix pr-dashboard audit --package-lock-only --ignore-scripts`: zero
  reported vulnerabilities; no third-party npm
  dependencies are declared in this particular package.
- Gitleaks working-tree scan: three generic-key findings, inspected as existing
  `sb_publishable_` browser keys. No server credential was identified by this
  scan. This classification does not verify backend row-level permissions.
- Exact staged diff reviewed; `gitleaks stdin --redact` on that diff identified
  no secrets. Local Semgrep checks on the two new Python scripts identified no
  shell execution, dynamic-code evaluation, unsafe deserialization or disabled
  TLS checks. These are targeted rules, not a comprehensive application audit.
- Workflow review: read-only repository permission, pinned checkout action,
  disabled persisted credentials, no deployment step or credential input.
- No application data, database policy, authentication behavior or external
  automation was changed by this maintenance work.
