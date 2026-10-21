# Spark: instructions for coding agents

## Read first

Read [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), and the target
project's README before editing. Spark is a public, static publishing repository
for independent mini-sites, not one application with a common build command.
Follow any more specific instructions in the directory you change.

## Scope and source

- Work on a short-lived branch from current `origin/main`; submit a PR to `main`.
  Do not push directly to `main`, force-push it, or bypass its protection.
- Limit changes to the requested project. Coordinate changes to root branding,
  shared assets, deployment configuration, repository checks or another project.
- For compiled apps, change and verify their canonical source first, then publish
  its static output here. Never hand-edit generated bundles. The root directory
  map identifies EMT's source branch and the separate Tracking Dashboard source.
  If source ownership is unclear, establish it before replacing a release.
- New projects need a unique directory, a project README and an entry in the root
  directory map. Follow the new-project steps in CONTRIBUTING.md.
- Never copy a root-level build over the whole repository. Do not globally ignore
  build output: some existing projects intentionally commit compiled releases.

## Preserve production contracts

- Directory names are public URL routes. Preserve existing paths, casing, legacy
  HTML redirects, authentication callbacks and release assets used by cached pages.
- Keep the root welcome page free of project names and navigation. Put the project
  directory in README.md, not index.html. The public repo remains discoverable.
- Preserve `CNAME`, `.nojekyll` and the current Pages publishing source unless a
  deployment change is explicitly part of the task.
- Read assets/vendor/README.md before touching ExcelJS or its compatibility
  symlinks. Keep symlinks enabled in the checkout and preserve them during exports.
- Deletion needs verified references, cached-client/rollback consideration and
  authorisation. Do not prune old releases merely because their names look stale.

## Security and verification

- Everything committed here is public. Keep credentials in 1Password and inject
  them only at runtime. Do not publish private records, `.env` files, server keys
  or access-bearing private links. A browser password gate is not access control.
- Before pushing, review the exact outbound diff, scan for secrets, run available
  dependency/security checks at the owning source, and inspect changed auth,
  input, data exposure and deployment behavior. New high/critical findings or an
  unavailable required scan block publication; disclose pre-existing findings and
  scan limitations. Never upload source to an unapproved scanner.
- Run all repository checks listed in CONTRIBUTING.md, plus the target project's
  meaningful build/tests where applicable. There is no repository-wide build or
  dependency audit that covers all compiled/vendored applications.
- Preview locally and check the affected entry, asset paths and relevant behavior.
  Use synthetic records. Do not sign in, change production data or send mail just
  to smoke-test a static release without authorisation for those actions.

## Delivery

- Use the PR template. Summarise scope, source provenance, compatibility, checks,
  security findings/limits, and recovery steps where relevant. Review the diff.
- Wait for the required GitHub Actions `check` job in the Repository checks
  workflow, with the branch up to date with `main`. Resolve review threads.
  Do not rename or skip this required job without coordinating branch protection.
- Merge only within the user's authorised scope. Merging triggers the existing
  GitHub Pages publication; a successful PR check alone does not confirm release.
- After merging, confirm the Pages deployment, then verify affected live URLs and
  static dependencies. Check the root and other app entry URLs after shared changes.
  Report local checks, PR/merge, deployment and live verification separately.
- Keep README/source ownership and the existing maintenance record accurate when
  the result changes a durable decision or release process. Do not commit local
  machine paths, private payloads or temporary evidence into public documentation.
