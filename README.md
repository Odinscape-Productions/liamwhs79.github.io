# PulseStation v5 — GitHub Pages Edition

PulseStation is a PlayStation-inspired community web app designed to run entirely
from GitHub Pages, with no Node server, Render service, database server or Sony login.

## What now works directly on GitHub Pages

- Local PulseStation username/password accounts
- Multiple local accounts on the same device/browser
- Profile themes and original avatars
- Public PSN profile import from third-party tracker pages
- Trophy totals and tracker-source badges
- Imported tracked game links where a source exposes them
- Game library
- Backlog and wishlist
- Personal hours/completion tracking
- Parties / local LFG
- Game groups
- Group chat
- Direct messages
- Friends
- Notifications
- Community activity
- Profile comparison
- Reviews
- Trophy guide links
- MapGenie links
- Data backup / restore
- PWA install + offline app shell

## Public PlayStation data

PulseStation does **not** log into Sony and never asks for a Sony password.

The importer attempts public third-party pages for the entered PSN Online ID:

- Exophase: `https://www.exophase.com/psn/user/<PSN-ID>/`
- PSNProfiles: `https://psnprofiles.com/<PSN-ID>`
- TrueTrophies: `https://www.truetrophies.com/gamer/<PSN-ID>`

Because normal browsers often cannot fetch those sites cross-origin, PulseStation
uses Jina Reader (`r.jina.ai`) as a public reader layer. Public tracker sites can
change their HTML/Markdown, rate limits, privacy rules or reader access at any time,
so the importer is deliberately best-effort. Failure of a tracker never blocks the
local PulseStation account.

Imported values display their source links so users can verify them.

## Important local-account limitation

This edition follows the Berry Haven model: account data, messages, groups and
community changes are stored in `localStorage` in that browser.

That means two different phones do not automatically share the same database.

Use **Profile → Data vault → Export backup** to save the full PulseStation database,
then **Import backup** on another browser/device if you want to move it manually.

## Upload to GitHub

Upload every file in this folder into the root of your GitHub repository.

Then enable:

**Repository → Settings → Pages → Deploy from branch → main / root**

No backend URL is required.

## Files

- `index.html`
- `styles.css`
- `app.js`
- `storage.js`
- `psn-importer.js`
- `seed-data.js`
- `manifest.webmanifest`
- `service-worker.js`
- `icon.svg`
- `README.md`
- `DEPLOY-GITHUB-PAGES.md`
- `TRACKER-SOURCES.md`
- `UPLOAD_THESE_FILES.txt`

PulseStation is a fan/community project and is not affiliated with Sony Interactive Entertainment.
