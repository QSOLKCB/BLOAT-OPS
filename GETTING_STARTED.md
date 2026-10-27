# Getting started

Use a desktop browser with WebGL2, a keyboard and a mouse. Chromium is the automated browser target. Touch controls, gamepads, Safari/WebKit and Firefox are not certified by this initial verification.

## Local HTTP play

From the repository root, run `node tools/serve.mjs`, then open <http://127.0.0.1:8080/>. Node 22 or later is sufficient for serving; verification uses the recorded Node version in [the evidence](docs/VERIFICATION.md). No npm installation is required to serve, build or run simulation tests. Python's `python3 -m http.server 8080 --bind 127.0.0.1` is an alternative.

Click **Begin operation** to capture the mouse and enable local audio. Escape pauses; click Resume to capture again. If your browser denies pointer lock, click the game view. WebGL2 startup failures are shown on the menu instead of silently continuing.

## Offline file

Run `node tools/build.mjs`. Open `dist/BLOAT-OPS-standalone.html` directly, or open the source `index.html`, which redirects there for `file:` URLs. Rebuild after changing source or assets. The generated file embeds its scripts, textures, models and notices. It needs no server or network connection. The generated file is a CI artifact, not a second editable copy of the game.

The HTTP application also uses only local resources, but normal browser caching is not an offline installation mechanism. Use the standalone file for guaranteed packaged offline access; there is no service worker.

## Verification

```sh
node tools/check.mjs
node --test tests/*.test.mjs
node tools/build.mjs
node tools/benchmark.mjs
```

Browser checks require a development-only Playwright installation:

```sh
npm install --prefix /tmp/bloat-browser --no-audit --no-fund playwright@1.56.1
/tmp/bloat-browser/node_modules/.bin/playwright install --with-deps chromium
NODE_PATH=/tmp/bloat-browser/node_modules node tools/browser-check.cjs
```

Use `BROWSER_PATH` only to select an explicitly installed compatible Chromium/headless-shell executable. The CI workflow pins Ubuntu 24.04, avoiding the inherited Ubuntu-latest/old-Playwright incompatibility. Browser tests serve their own bounded local HTTP instance, check the repository prefix and open the standalone artifact with HTTP(S) blocked.

## Asset preparation

The checked-in converted models are ready to run. Only maintainers changing assets need Python + NumPy and `tools/convert-models.py`. Download the exact source files in `assets/manifest.json`, check their SHA-256 values, place them under the recorded input names, then run `python tools/convert-models.py /path/to/inputs`. The converter supports only the selected packs' embedded-buffer glTF skins/linear animation channels and flat-colour OBJ materials. It is not a general glTF importer.
