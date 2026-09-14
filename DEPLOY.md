# GitHub + Render: quickest setup

## GitHub

Create a blank repository and upload **all files in this folder at once** to the
repository root.

Your GitHub repository should immediately show `index.html`, `server.js`,
`package.json`, `render.yaml`, and the other files. There should be no project
subfolders.

## Render

1. Open Render.
2. Select **New +**.
3. Choose **Blueprint**.
4. Connect GitHub if needed.
5. Select the repository you just created.
6. Render reads `render.yaml`.
7. Create/apply the Blueprint.
8. Wait for the deployment log to report that the service is live.
9. Open the generated `.onrender.com` address.

No frontend URL or API URL needs to be edited. Express serves `index.html`,
`styles.css`, and `app.js` from the same host as `/api/...`.

## Updating

Upload or push changed files to the same GitHub repository. Render can redeploy
automatically from the new commit.


## Visible-file edition

This package deliberately contains no hidden dot-files, so all 15 files should be
visible on Windows, Android and most archive/file-manager apps.

`ENV-EXAMPLE.txt` is documentation only. Render receives its environment settings
from `render.yaml`.

`GITIGNORE.txt` is also documentation unless you rename it to `.gitignore`.
