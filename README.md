# PulseStation

A PlayStation-themed community web app with profiles, trophies, games, parties,
game groups, trophy guides, reviews and optional MapGenie links.

This repository is intentionally **flat**. Every project file lives in the root,
so you can upload all files to GitHub in one operation.

## Upload files

Upload every file in this folder to the root of one GitHub repository.

Do not upload the ZIP itself into the repository. Upload the files inside it.

## Deploy

GitHub stores the project. The backend needs Node.js, so use Render to run it.

1. Create a GitHub repository, for example `pulsestation-community`.
2. Upload every file from this folder to the repository root.
3. Sign in to Render.
4. Choose **New + → Blueprint**.
5. Connect your GitHub repository.
6. Render detects `render.yaml`.
7. Apply the Blueprint.
8. When deployment completes, Render gives you one live URL.

The same URL serves both the frontend and the Express API.

## Demo login

Email: `liam@demo.local`

Password: `Play1234!`

The included PlayStation-like trophy, game and playtime values are seeded demo
data and are visibly marked as such in the UI.

## Real PSN sync

Real PSN sync is disabled by default. The integration boundary is in:

`psnProvider.js`

Do not collect users' PlayStation passwords. Configure an authorised provider on
the server and then set:

- `PSN_SYNC_MODE=provider`
- `PSN_PROVIDER_BASE_URL`
- `PSN_PROVIDER_TOKEN`

## Flat file list

- `index.html`
- `styles.css`
- `app.js`
- `server.js`
- `store.js`
- `auth.js`
- `seed.js`
- `psnProvider.js`
- `package.json`
- `render.yaml`
- `ENV-EXAMPLE.txt`
- `GITIGNORE.txt`
- `README.md`
- `DEPLOY.md`

`db.json` is created automatically when the server first starts.

## Important storage note

The free Render web-service filesystem is temporary. The app will run, but newly
created accounts and community changes can reset after a service restart or
redeploy.

For a real community launch, move persistence to PostgreSQL or attach persistent
storage and set `DATA_DIR` to that mount path.


## Why there are no hidden files in this package

This version is intentionally packaged with **15 visible files**.

Normally Git projects use `.gitignore` and `.env.example`, but some phones and file
managers hide filenames beginning with a dot. To avoid that confusion:

- `ENV-EXAMPLE.txt` replaces `.env.example`
- `GITIGNORE.txt` replaces `.gitignore`

Neither is required for Render to boot the app. If you later work with Git on a
computer, you can rename `GITIGNORE.txt` to `.gitignore`.
