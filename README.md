# PulseStation v8 — GitHub Pages Edition

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
## v6: real library tracking fix

The game catalogue is now deliberately split:

- **My games** contains only titles imported for the signed-in player's tracker profile or manually added by that player.
- **Discover** contains PulseStation's curated recommendations.
- The home "Your games" rail no longer falls back to recommendations when the player's library is empty.

For Exophase, v6 attempts to resolve the profile's public `playerProfileId` and then pages through its public JSON games feed:

`https://api.exophase.com/public/player/<playerProfileId>/games?page=N&environment=&sort=1&showHidden=0`

Where the tracker exposes it, imported titles include platform, playtime, completion percentage, last-played timestamp, artwork and a canonical tracker URL.

Public tracker coverage still matters. If a PSN ID is not indexed by a tracker or the tracker prevents public reading, a GitHub Pages app cannot manufacture the missing account history.


## v7 simplified PS gamer hub

The app now centres around one obvious action on Home:

**SYNC PSN PROFILE**

The main navigation is simplified to:

- Home
- My Games
- Trophies
- Social
- PS Toolbox

The PS Toolbox adds:

- PSN Sync Centre
- Backlog Roulette
- Platinum Planner
- PS Plus Claim Tracker
- Session Planner
- Release Watch
- PlayStation / tracker / MapGenie quick links

Parties, groups, messages and players are consolidated under one Social section.


## v8 Share Profile linking

PulseStation now supports PlayStation's official Share Profile URL/QR as the preferred profile connection method.

Supported methods:
- Scan the PS5 Share Profile QR with the phone camera
- Upload a screenshot containing the QR
- Paste `https://profile.playstation.com/<Online-ID>`
- Enter an Online ID manually

The official Share Profile URL is stored independently of tracker syncing. A tracker HTTP error no longer undoes the profile link or gets reported as a PlayStation privacy failure.

The Share Profile URL identifies the public PlayStation profile. It is not a Sony login token and does not prove account ownership by itself.
