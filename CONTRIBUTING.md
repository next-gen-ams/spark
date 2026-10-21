# Contributing to Spark

Start with the [directory map](README.md#directory-map) and the README of the
project you own. Each directory is an independent published site. Some contain
editable static source; others are exports from a separate source project.

## Delivery flow

**Branch → PR → checks and review → merge → Pages deployment → live verification.**

Use a small branch such as `feature/project-slug`, `fix/project-issue` or
`docs/project-handoff`. Start from the current remote `main` and stage only the
intended files:

```sh
git fetch origin
git switch -c feature/project-slug origin/main
# Make and verify the scoped changes, then inspect the complete diff.
git diff --check
git diff
git add your-project/ README.md
git diff --cached
git commit -m "feat(project-slug): describe the delivered change"
git push -u origin feature/project-slug
```

Open a pull request against `main` using the provided template. Never push a
release, a scheduled snapshot or a hotfix directly to `main`. Existing scripts
that used direct pushes must publish through a branch and PR too.

### Main protection

- All changes must come through a PR, including changes by administrators.
- The GitHub Actions `check` job in **Repository checks** must pass. Its expected
  source is the GitHub Actions app; the PR must include the latest `main`.
- Resolve review threads before merging. Force pushes and deletion of `main`
  are disabled. Do not bypass or weaken these requirements to publish a release.
- Human review is encouraged, especially for shared assets, auth or deployment
  changes. A second person's approving review is not currently mandatory, so the
  existing maintainer can still deliver independently through a passing PR.

If `main` moves, merge `origin/main` into your branch, resolve conflicts and let
checks run again. Keep the required job running for every PR; renaming it or
adding path filters can leave PRs waiting for an expected check.

## Add a project

1. Agree on the owner and canonical editable source. Choose an unused lowercase,
   hyphenated directory such as `project-slug/`. Its deployed address will be
   `https://spark.kmt.global/project-slug/`; keep the slug stable after sharing it.
2. Add the static entry `project-slug/index.html` and assets within that directory.
   Keep a project's dependencies local unless a shared asset is intentional and
   coordinated. Do not introduce a repository-wide framework or build step for
   one site.
3. If you use a framework, build at its canonical source with the correct base
   path for `/project-slug/`, then copy only that project's export here. GitHub
   Pages has no server runtime or generic SPA rewrite. Use routing that works on
   static hosting and verify refreshes/deep links; do not replace the root page
   or a global 404 handler to support one app. Production auth callbacks must use
   the deployed HTTPS path and be configured in the owning identity service.
4. Add `project-slug/README.md` using the outline below. Do not include local
   machine paths, private access links, real credentials or confidential data.
   Link to a permitted source location or describe how the owner provides access.
5. Add a row to the root README's directory map. Leave `index.html`, `CNAME`,
   `.nojekyll`, existing app directories and legacy redirects unchanged unless
   their modification is an agreed part of the task.
6. Preview the site at its actual subdirectory path. From the repo root, run
   `python3 -m http.server 8000 --bind 127.0.0.1` and visit
   `http://127.0.0.1:8000/project-slug/`. For a project-specific preview command,
   follow its README. Auth flows requiring HTTPS need their own approved test setup.
7. Run the checks below, review publication suitability and open the PR. Add UI
   screenshots when useful. After merge, wait for Pages and verify the real URL,
   dependencies, refresh/deep links and the feature you delivered.

### Project README outline

```markdown
# Project name

- Purpose and owning team or GitHub handle:
- Published route: https://spark.kmt.global/project-slug/
- Canonical editable source and how authorised contributors obtain access:
- Maintenance mode: editable static source / compiled static export
- Runtime and build prerequisites; exact build/export command and base path:
- Local preview command and test URL:
- Tests and dependency/security audit commands:
- Configuration names and secret references (never values):
- Public-data suitability and authentication/backend boundaries:
- Release/export steps, assets to retain and recovery procedure:
- Known limitations or external services needed for verification:
```

## Check before pushing

From the repository root, with Python 3.9+ and Node.js 20+:

```sh
python3 scripts/check_site.py
python3 -m unittest discover -s scripts -p 'test_*.py'
node --test scripts/asset-compatibility.test.cjs
npm --prefix pr-dashboard test
npm --prefix pr-dashboard audit --package-lock-only --ignore-scripts
git diff --check
```

Also run the owning project's build/tests, dependency audit and applicable static
security checks. Scan staged changes before committing, for example
`git diff --cached | gitleaks stdin --redact`. Before pushing, fetch `origin` and
scan every outbound commit with `gitleaks git --log-opts="origin/main..HEAD" --redact`;
a staged-only scan after committing would be empty. Review the complete outbound
diff with `git diff origin/main...HEAD` too. Fix new actionable findings before
publication; exposed credentials, unresolved high/critical
findings or an unavailable required scan stop the push. State scan coverage and
pre-existing findings in the PR. Never send source to an unapproved scanner.

The required CI job runs references, Python tests, ExcelJS compatibility and
PR Dashboard tests. It is not a full security, authenticated-flow or dependency
audit for every mini-site. The PR Dashboard lockfile does not inventory bundles
in other applications. Green checks do not certify private-data suitability.

## Preserve links and shared assets

- Preserve existing directory routes, exact legacy filename casing, auth callbacks
  and cached-client assets. Do not mass-clean or reformat other mini-sites.
- For EMT and Tracking Dashboard exports, edit/test the canonical source first.
  Read the [directory map](README.md#directory-map) before replacing generated files.
- Keep the four ExcelJS compatibility symlinks and old loader URLs intact. Read
  [shared vendor guidance](assets/vendor/README.md) before changing them or the
  publishing tooling. Use a Git checkout with symlink support; a ZIP download is
  not a supported publication source for these aliases.
- Everything here is public, including snapshots and history. Keep secrets in
  1Password; use server-enforced authorisation for confidential data. Hiding a
  site from the root page or adding a browser password is not confidentiality.

## Release and recovery

The existing GitHub Pages configuration publishes the root of `main` to
`spark.kmt.global` after a merge. Branch protection changes the route into `main`;
it does not change Pages, application paths or the ExcelJS packaging behavior.
Do not require the post-merge Pages `build`/`deploy` jobs as PR checks: this site
publishes after merge and does not currently have PR preview deployments.

Wait for a successful Pages run for the merged commit. Check the live root,
affected sites, assets and any relevant legacy redirect. Shared changes need
entry checks for all existing mini-sites. Use synthetic data for checks and
explicit authorisation for any production-data mutation or outbound messages.
Report the deployed commit, checks and limits; do not report a merge as a verified
deployment. Record durable release/process decisions in the existing
[maintenance record](docs/repository-maintenance.md).

For rollback, revert the relevant change on a new branch, run checks, and merge
the revert through a PR. Do not reset or force-push production history. Retain
release assets until removal is authorised and cached clients and recovery have
been considered.
