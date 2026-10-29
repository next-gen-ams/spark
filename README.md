# Spark

Spark hosts independent GMS tools and client mini-sites at
[spark.kmt.global](https://spark.kmt.global/). This is a **public static publishing
repository**. Some directories contain editable HTML/JavaScript; others contain
compiled releases maintained in a separate source location.

New contributors: read [CONTRIBUTING.md](CONTRIBUTING.md) for adding a project,
checks and release steps. Coding agents must also follow [AGENTS.md](AGENTS.md).
Use a short-lived branch and PR; `main` requires the GitHub Actions `check` job
to pass on an up-to-date branch. Merging still triggers the existing Pages release.

## Directory map

| Directory | Purpose | Maintenance |
| --- | --- | --- |
| `emt-tracker/` | Executive agendas, decisions and reminders | Compiled React/Vite release; see its [README](emt-tracker/README.md) and the [`emt-tracker-source` branch](https://github.com/next-gen-ams/spark/tree/emt-tracker-source) for editable source |
| `gms-tracking/` | Original paid performance dashboard | Retained V1 deployment; coordinate changes with the Tracking Dashboard source project |
| `gms-tracking-v2/` | Current V2 paid performance dashboard | Published from the separate Tracking Dashboard source project |
| `pr-dashboard/` | RMIT DSC China PR tracker | Editable static app, refresh scripts and tests; see its [README](pr-dashboard/README.md) |
| `rmit-inton-performance/` | RMIT INTON paid performance (Meta and TikTok) | Compiled static export from a private source project; see its [README](rmit-inton-performance/README.md) |
| `uq-info-day/` | UQ China Info Day planner | Standalone static page and preserved ExcelJS URL |
| `uq-china-social-wip/` | UQ social and boosting planner | Standalone static page and preserved ExcelJS URL |
| `gms-way-quiz/` | GMS Way quiz | Standalone static page |
| `gms-way-training/` | GMS Way training | Standalone static page |
| `gms-website-directions/` | Website direction presentation | Standalone static page |

`index.html` is a KMT-branded landing page with no project names or links.
Its original KMT logo and locally hosted DM Sans font live in `assets/`. Users must
open the complete link shared with them. Its `noindex, nofollow` directive
discourages indexing of the root page; it does not enforce access control.
The public GitHub repository still exposes its file tree.
Root-level legacy HTML files redirect to directory routes. Keep their exact
spelling and casing, including `GMS-way-quiz.html`, to preserve existing links.
`CNAME` configures the custom domain; `.nojekyll` keeps publication as plain static files.

## Before publishing

- Keep existing directory URLs stable. Directory names are deployed routes.
- For compiled apps, edit and verify the canonical source before exporting a
  release. Do not hand-edit generated bundles.
- Keep credentials in 1Password. Public files, snapshots and client-side password
  gates are not confidential storage. Browser publishable keys require backend
  access controls; do not publish server credentials or private records.
- Review the complete diff and run the relevant checks and security scan before
  pushing your branch. Use a PR for every release, including scheduled updates.
  Merge, Pages deployment and live verification are separate delivery steps.
- Preserve superseded assets until removal is approved and cached-client,
  rollback and release requirements have been considered.

## Checks

From the repository root, using Python 3.9+ and Node.js 20+:

```sh
python3 scripts/check_site.py
python3 -m unittest discover -s scripts -p 'test_*.py'
node --test scripts/asset-compatibility.test.cjs
npm --prefix pr-dashboard test
npm --prefix pr-dashboard audit --package-lock-only --ignore-scripts
```

The offline site check validates literal HTML links, script/image references,
inline and external CSS URLs, redirect targets and relative JavaScript imports.
It skips external URLs, template expressions, vendored JavaScript and `_next/`
bundles. It does not execute applications, inspect database policies or verify
remote services. The PR Dashboard lockfile does not cover dependencies embedded
in other sites' compiled or vendored bundles; audit those at their source.

The read-only repository-check workflow runs the offline checks and PR Dashboard
tests on pushes and pull requests. It neither publishes a site nor refreshes data.
For the PR Dashboard preview, use its documented localhost-only server.

See [the 21 October 2026 maintenance review](docs/repository-maintenance.md) for
verified cleanup candidates and remaining work.

## Shared assets and retention

The four existing ExcelJS URLs are compatibility symlinks to one verified bundle;
Pages dereferences them into ordinary files. See [shared vendor guidance](assets/vendor/README.md)
before changing deployment tooling or refreshing an app from its separate source.
The offline XLSX tests use synthetic records only.

The retired EMT Next output was removed after current-reference checks. The
immediately previous Vite JS/CSS pair remains for existing sessions. The
`archive/spark-pre-cleanup-2026-10-22` tag preserves the full pre-cleanup tree.
