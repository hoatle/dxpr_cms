# DXPR CMS Trial Experience

This contains the WebAssembly trial experience.

## Run locally

```shell
ddev launch https://dxpr-cms-trial.ddev.site
```

This will download the latest published DXPR CMS trial artifact and allow testing JavaScript changes.

### Testing a custom artifact build

```shell
ddev build-trial
# Use `local.html` to test the artifact.
ddev launch https://dxpr-cms-trial.ddev.site/local.html
```

## Tests

The [cgi-install.test.js](tests/cgi-install.test.js) and [cgi-interactive-install.test.js](tests/cgi-interactive-install.test.js)
allows running PhpCgiNode to test serving the trial over Node instead of the browser.

This requires a `tests/fixtures/trial.zip` to be available. This can be downloaded from `https://git.drupalcode.org/api/v4/projects/157093/jobs/artifacts/0.x/raw/trial.zip?job=build+trial+artifact`
or a custom build artifact.

### Testing a custom build from source

If a build is located at `tests/fixtures/dxpr-cms` two debugging tests will run. This allows testing against actual
code instead of having to build the artifact.
