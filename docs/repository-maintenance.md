# Repository maintenance review — 21 October 2026

Reviewed `main` at `7dd4f946e75dc8b53680b8d64d1286932f8e4c9e`:
270 tracked files across nine app directories. This review covers repository
structure and static references; it is not a live application or backend audit.

## Changes included

- Added a repository map and source/publication boundaries in the root README.
- Added root ignore rules for local credentials, dependencies and Python caches.
- Added an offline local-reference checker, regression tests and a read-only CI
  workflow. That root-page release included no directory migration or asset deletion.
- Replaced the root project directory with a neutral shared-link prompt. No app
  names, links or project metadata remain in the root HTML. Added `noindex,
  nofollow` to that page. Direct app URLs are unchanged. This reduces casual
  discovery; the public repository and static files remain accessible.

## Original cleanup findings — status updated 22 October 2026

Paths below are relative to the repository root. Coco authorised conditional
cleanup on 22 October 2026; the resulting scope and compatibility checks follow.

| Exact path | Evidence and likely benefit | Required next step |
| --- | --- | --- |
| `emt-tracker/_next/` | Legacy Next-style static output; the current entry page loads Vite assets from `emt-tracker/assets/` instead. Roughly 18 MB of older files. | Removed from the current tree after the checks below; recoverable from the archive tag. |
| `emt-tracker/assets/index-BnZBXd45.js` and `emt-tracker/assets/index-B6wFMor2.css` | Older entry assets; current HTML references `index-DP38htVr.js` and `index-IwQI6KxW.css`. | Retained: this is the immediately previous Vite release, intentionally kept for existing sessions. |
| `uq-info-day/exceljs.min.js`, `uq-china-social-wip/exceljs.min.js`, `gms-tracking/vendor/exceljs.min.js`, `gms-tracking-v2/vendor/exceljs.min.js` | Four byte-identical 947,702-byte bundles. A shared copy could save 2,843,106 bytes. | Consolidated into one verified bundle with four compatibility symlinks; source loaders and deployed URL contents stay unchanged. |

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
- At the root-page release, legacy EMT assets and duplicated libraries were
  retained pending approval. The subsequent authorised cleanup is recorded below.

## Authorised asset cleanup — 22 October 2026

### Scope and recovery

- Retired `emt-tracker/_next/`: 125 files, 18,483,972 bytes. The current app is the
  React/Vite release published on 19 October, while the last change to these Next
  artifacts was 29 September. The live HTML and retained Vite scripts/styles do
  not reference this tree. No service-worker registration or dynamic JS import
  was found in the current entry bundle. The live HTML cache lifetime is 600 s.
- Retained `emt-tracker/assets/index-BnZBXd45.js` and `index-B6wFMor2.css`
  (1,103,456 bytes together): the previous Vite release remains available for
  existing sessions, as the source release record originally intended.
- Full recovery tree: tag `archive/spark-pre-cleanup-2026-10-22`, pointing at
  `8c7358f3c6c77db9a8b4aa93a0acc9b7342c03b6`. Git history is not rewritten.
- Removed internal `_next/` resource URLs are retired; this is not a promise to
  preserve pre-Vite cached browser tabs indefinitely. Current app entry URLs,
  root aliases, Microsoft callback, current and preceding Vite bundles, fonts
  and logos are preserved. No app data, account or backend setting is changed.

### ExcelJS compatibility

The four 947,702-byte ExcelJS bundles were identical, and matched the official
npm ExcelJS 4.4.0 distribution with its tarball integrity verified. One original
bundle now lives at `assets/vendor/exceljs-7e49da68588e250d.min.js`, with its MIT
licence and checksum manifest. Relative symlinks retain all four old paths.
No application HTML or lazy-loader source is changed, so separate app source
projects continue to publish the same script URLs.

The current Pages build log confirms `upload-pages-artifact` uses
`tar --dereference --hard-dereference`. The deployed four paths therefore remain
regular JavaScript responses with exactly the old bytes, including for cached
HTML. This saves three physical checkout copies (2,843,106 bytes before small
symlink metadata), not deployed transfer size or Git blob/history size. The
artifact intentionally contains the compatibility copies.

### Checks

- 234 local references and 14 Python tests passed, including internal symlink
  containment and a dereferenced tar archive with byte-identical old script paths.
- Four synthetic XLSX write/read round trips passed using the existing browser
  UMD bundle via each original path: text, numbers, formula/results, styles and
  merged cells survive. No production export, credentials or app data are used.
- Existing PR Dashboard tests: 22 passed. The read-only CI workflow now also runs
  the four ExcelJS tests. Version pinning prevents silent shared-library upgrades.
- As before, the PR Dashboard package audit does not inventory vendored bundle
  dependencies. This is deduplication of the existing version, not a dependency
  security upgrade.

Pre-push review covered the exact outbound paths and compatibility-link targets.
Gitleaks found no outbound secrets; targeted offline Semgrep checks found no
shell execution, unbounded eval or unsafe extraction in the new test tools.
The available PR Dashboard package audit reported zero vulnerabilities; the
unchanged vendored bundle's transitive dependency tree is not covered by that
lockfile audit. No authentication, authorisation, database or production workflow
configuration is changed; the only workflow edit adds a read-only synthetic test.

### Cleanup publication and live verification

- [PR #2](https://github.com/next-gen-ams/spark/pull/2) merged as
  `81f3e68f9fc167a016cd3967b5150f9d0fcbcd65`. Main CI passed all 40 tests,
  including Linux Pages-style tar expansion with both dereference flags.
- [Pages deployment](https://github.com/next-gen-ams/spark/actions/runs/39690279517)
  and [main checks](https://github.com/next-gen-ams/spark/actions/runs/39690279095)
  completed successfully.
- 118 live URLs returned HTTP 200 and matched the release files byte-for-byte:
  root, nine apps, five legacy aliases, static dependencies, Microsoft callback,
  both preceding Vite assets, runtime logos and the shared/legacy ExcelJS URLs.
- All four original ExcelJS HTTP responses passed checksum validation and
  synthetic browser-UMD XLSX round trips after deployment. No production login,
  export or data mutation was needed. Two sampled retired Next resource URLs
  returned the expected 404.
- The archive tag was checked on the remote and resolves to the complete
  pre-cleanup commit `8c7358f3c6c77db9a8b4aa93a0acc9b7342c03b6`.
- The original CI packaging test exposed GNU tar's hard-link behaviour; its
  test invocation was corrected to use the two flags already present in Pages.
  The fix passed before merge; no production packaging workflow was changed.

## Contributor handoff and protected delivery — 22 October 2026

The delivery convention follows ECC's GitHub Flow and verification-loop guidance,
adapted to Spark's independent static sites: scoped branch, PR, local/security
checks, required CI, merge, Pages publication, then live verification. Existing
compiled releases stay committed here; there is no new root build system.

- Added root AGENTS.md, CONTRIBUTING.md and a PR template. They cover source vs
  export boundaries, new-project naming/README/base paths, shared dependencies,
  public-data suitability, scoped changes and release/recovery steps.
- Enabled protection for `main`: PR required for everyone including admins,
  required GitHub Actions `check` (app ID 15368), up-to-date branch, resolved
  review threads, no force push or branch deletion. An additional approving
  reviewer is not mandatory, preserving the existing sole-maintainer PR flow.
  The deployment-only Pages checks are intentionally not pre-merge requirements.
- Pages remains legacy publication of the `main` root to `spark.kmt.global`.
  Root/app files, URLs, auth and ExcelJS aliases are outside this change.
- The local RMIT weekly snapshot task was found paused. Its old prompt assumes
  direct push to main; its project README now requires migration to a PR flow
  before resumption. No scheduler status or credential access was changed.

The protection API response was checked against this policy. Local verification
passed 234 references, 40 tests and exact-outbound-diff Gitleaks with no findings.
The available PR Dashboard package audit reported zero vulnerabilities; it does
not cover vendored dependencies. Only six Markdown files change, so application
build/type/static-security checks have no new executable code to assess. The
first protected PR merge, Pages publication and live checks remain to be verified.
