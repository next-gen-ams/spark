# Repository maintenance review — 21 October 2026

Reviewed `main` at `7dd4f946e75dc8b53680b8d64d1286932f8e4c9e`:
270 tracked files across nine app directories. This review covers repository
structure and static references; it is not a live application or backend audit.

## Changes included

- Added a repository map and source/publication boundaries in the root README.
- Added root ignore rules for local credentials, dependencies and Python caches.
- Added an offline local-reference checker, regression tests and a read-only CI
  workflow. No directory migration or asset deletion is included.
- Replaced the root project directory with a neutral shared-link prompt. No app
  names, links or project metadata remain in the root HTML. Added `noindex,
  nofollow` to that page. Direct app URLs are unchanged. This reduces casual
  discovery; the public repository and static files remain accessible.

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

- `python3 scripts/check_site.py`: 234 local references checked; zero missing.
- `python3 -m unittest discover -s scripts -p 'test_*.py'`: 11 tests passed,
  including root-page privacy, missing-asset failure, traversal and symlink
  containment checks.
- Existing PR Dashboard tests: 22 passed.
- `npm --prefix pr-dashboard audit --package-lock-only --ignore-scripts`: zero
  reported vulnerabilities; no third-party npm
  dependencies are declared in this particular package.
- Gitleaks working-tree scan: three generic-key findings, inspected as existing
  `sb_publishable_` browser keys. No server credential was identified by this
  scan. This classification does not verify backend row-level permissions.
- Exact staged diff reviewed; `gitleaks stdin --redact` on that diff identified
  no secrets. Local Semgrep checks on the three new Python scripts identified no
  shell execution, dynamic-code evaluation, unsafe deserialization or disabled
  TLS checks. These are targeted rules, not a comprehensive application audit.
- Workflow review: read-only repository permission, pinned checkout action,
  disabled persisted credentials, no deployment step or credential input.
- No application data, database policy, authentication behavior or external
  automation was changed by this maintenance work.

## KMT branding refinement — 22 October 2026

The root page now uses the existing KMT logo, its purple (`#763BFF`) and near-black
(`#131222`), a pale lavender canvas and the established “See Infinitely.” line.
Logo and licensed DM Sans font copies
are hosted under root `assets/`, so no app directory or external font service is
referenced by the page. No project names or navigation are exposed. The deliberate
light palette preserves the original dark KMT wordmark in either browser theme.

Local visual checks at 1280 px, 390 px and 320 px passed. Body text contrast is
6.43:1 on white; heading and tagline also pass AA. The Impeccable mechanical
check reported no findings. The source logo and font match the existing binary
assets; only the copied licence's line endings/whitespace are normalised.

## Welcome copy refinement — 22 October 2026

The visible lockup now reads KMT / Spark. “Marketing technology.” introduces the
business, followed by the established “Engineering what’s next.” and
“See Infinitely.” lines. A separate, quieter “Have a shared link?” prompt explains
how to continue to the visitor's workspace. No input form, project directory or
navigation is added. Brand positioning now leads; the link instruction follows.

## Published verification — 22 October 2026

- [PR #1](https://github.com/next-gen-ams/spark/pull/1) merged as
  `c49d0c74e0edd0277b11656f792e56d439d9a5f0`.
- GitHub Pages deployment and main-branch Repository checks passed:
  [Pages run](https://github.com/next-gen-ams/spark/actions/runs/39686673256),
  [checks run](https://github.com/next-gen-ams/spark/actions/runs/39686672940).
- The live root page shows KMT Spark, the marketing technology positioning,
  the two established brand lines and the shared-link prompt. No project
  directory is displayed.
- All nine app directory URLs and five legacy HTML aliases returned HTTP 200.
  Including their statically referenced local dependencies and the EMT silent
  authentication callback, 109 live URLs were verified byte-for-byte against
  the release files, with no missing or mismatched resources.
- Browser navigation confirmed all nine app entry pages or their expected
  sign-in gates. Each of the five legacy aliases reached its correct directory
  route. No credentials were entered, app records changed or emails sent.
- Limits: these are entry, redirect and static-resource checks, not authenticated
  business-flow or backend-permission tests. External third-party links and
  dynamically constructed resource URLs were outside this verification.
- Legacy EMT assets and duplicated libraries remain retained pending approval;
  publishing this release does not authorise their removal.
