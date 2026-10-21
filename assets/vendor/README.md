# Shared ExcelJS bundle

`exceljs-7e49da68588e250d.min.js` is the existing ExcelJS 4.4.0 browser bundle,
unchanged. Its SHA-256 and four compatibility paths are recorded in
`exceljs-manifest.json`. The bytes match the official npm 4.4.0 distribution;
the npm tarball's SHA-512 integrity was also checked. The MIT licence is retained.

The four original script paths are relative Git symlinks to this one file.
Do not replace them with JavaScript loaders or change the existing HTML: old
pages and lazy export loaders must keep receiving exactly the same bundle.

Spark's current no-Jekyll GitHub Pages workflow uses `upload-pages-artifact`
with `tar --dereference --hard-dereference`. It publishes ordinary files at the
original four URLs. The compatibility tests exercise the same dereference
behaviour and perform synthetic browser-bundle XLSX round trips at all four
paths. A publishing workflow change must preserve this behaviour.

This removes three physical copies from the checkout, not from the deployed
site: keeping old URLs compatible intentionally materialises those copies in
the Pages artifact. Git already stored the identical bytes as one blob, so this
is not a Git-history size reduction. No dependency upgrade is included.

Keep symlink support enabled in development checkouts. When exporting an app
from its separate source project, leave its loader paths unchanged and preserve
these aliases. Do not overwrite this shared file for a single app's upgrade;
add a new content-addressed version and plan that app's migration separately.

After a release, verify the four real HTTP responses and synthetic XLSX round
trips without signing into any app:

```sh
SPARK_ASSET_BASE_URL=https://spark.kmt.global/ node --test scripts/asset-compatibility.test.cjs
```
