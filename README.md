# PulseStation v2

A PlayStation-themed community web app with real local accounts, automatic PSN profile importing, trophies, games, playtime, parties, game groups, reviews and trophy guides.

Everything remains in **one flat folder** for easy GitHub upload.

## What changed in v2

- No email sign-in.
- PulseStation accounts use a username + PulseStation password.
- Registration also asks for a PSN Online ID.
- The server automatically looks up that PSN Online ID and imports the PlayStation profile.
- Automatic PSN refresh on sign-in.
- Real PlayStation avatar/profile picture support.
- Trophy level and Platinum/Gold/Silver/Bronze totals from PSN.
- Trophy-title history and game completion percentages.
- Played games and playtime where PlayStation privacy settings allow access.
- Presence / current PlayStation status where available.
- Detailed trophy data is fetched when an imported game is opened.
- Community accounts, groups, reviews and parties are stored in Postgres on Render.
- Demo community content is still visibly labelled and kept separate from live PSN data.

## Important PSN limitation

A PSN Online ID can be used to **look up** data, but it does not prove that the PulseStation user owns that PlayStation account. Imported PSN profiles are therefore marked as linked/imported, not ownership-verified.

The importer can only return information that the target account's PlayStation privacy settings allow the server-side PSN account to view.

## Security model

Community users must NEVER enter their Sony/PlayStation password or NPSSO token into PulseStation.

PulseStation has its own password system. Passwords are stored as bcrypt hashes.

The app owner configures one PSN service credential on the server using the Render secret environment variable `PSN_NPSSO`. That value never goes to the browser and must never be committed to GitHub.

## One-click Render structure

`render.yaml` creates:

1. a Node.js web service;
2. a Render Postgres database;
3. a generated JWT secret;
4. a protected prompt for `PSN_NPSSO`.

The free Render Postgres database survives web-service sleep/redeploys, but Render currently expires free Postgres databases after 30 days. Upgrade the database before then if you want long-term community data.

## Files

- `index.html` – interface
- `styles.css` – PlayStation-themed design
- `app.js` – browser app
- `server.js` – Express API + Socket.IO
- `auth.js` – JWT authentication
- `store.js` – Postgres/local JSON persistence
- `seed.js` – demo community data
- `psnProvider.js` – automatic PSN importer
- `package.json` – Node dependencies
- `render.yaml` – Render Blueprint
- `ENV-EXAMPLE.txt` – visible environment-variable reference
- `GITIGNORE.txt` – visible ignore-file reference
- `DEPLOY.md` – deployment instructions
- `UPLOAD_THESE_FILES.txt` – upload checklist
- `README.md` – this file

## Local development

If you want to run locally, copy the values in `ENV-EXAMPLE.txt` into a real `.env` file and run:

```bash
npm install
npm run dev
```

Without `DATABASE_URL`, local development stores state in `db.json` beside the source files.

## PSN library

The project uses the community `psn-api` Node library for PlayStation Network data. It is not an official Sony SDK and Sony can change private/community-facing endpoints. Keep the dependency updated and expect occasional maintenance if PSN changes.
