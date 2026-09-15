# Deploy PulseStation on GitHub Pages

1. Extract the ZIP.
2. Open your PulseStation GitHub repository.
3. Remove the previous server/Render files if they are still there.
4. Upload **all 13 files** from this edition to the repository root.
5. Commit the changes.
6. Open **Settings → Pages**.
7. Under Build and deployment, choose **Deploy from a branch**.
8. Select `main` and `/ (root)`.
9. Save.

GitHub will publish the site at your normal `.github.io` address.

## Updating

Replace the changed root files and commit again. GitHub Pages republishes them.

## If the old version remains visible

The new app uses a service worker for offline support. If a phone has aggressively
cached an old copy, close the installed web app/browser tab and reload the GitHub
Pages site. The v5 service worker replaces older PulseStation caches automatically.


v6 uses cache-busted asset URLs and a new `pulsestation-v6` service-worker cache, so replacing the files should also retire the old importer on mobile.


v7 uses cache-busted assets and the `pulsestation-v7` service-worker cache.


v8 uses the `pulsestation-v8` cache and `?v=8` asset URLs.
