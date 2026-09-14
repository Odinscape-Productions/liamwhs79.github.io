# Deploy PulseStation v2: GitHub → Render

## 1. Upload the 15 files to GitHub

Create a blank GitHub repository and upload every file from this folder directly to the repository root.

There are no project subfolders.

## 2. Obtain the server-side PSN credential

The automatic PSN importer needs one authenticated PlayStation session owned by the app/server.

Use a dedicated PlayStation account for this if possible.

1. Sign in to `https://www.playstation.com/` in a browser.
2. In the same signed-in browser, open:
   `https://ca.account.sony.com/api/v1/ssocookie`
3. The response should contain an `npsso` value.
4. Copy only the token value.

Treat that token like a password. Never place it in GitHub, JavaScript, `ENV-EXAMPLE.txt`, screenshots or chat logs.

## 3. Create the Render Blueprint

1. Open Render.
2. Choose **New + → Blueprint**.
3. Connect GitHub.
4. Select your PulseStation repository.
5. Render detects `render.yaml`.
6. During initial Blueprint creation, Render asks for `PSN_NPSSO`.
7. Paste the NPSSO token there.
8. Apply the Blueprint.

The Blueprint automatically creates both the web service and a Postgres database.

## 4. Open the live site

Render gives the web service an address similar to:

`https://pulsestation-community.onrender.com`

The same address serves the frontend, account API, community features, Socket.IO and PSN importer.

## 5. Create the first real account

Open the live site and click the profile/avatar button.

Choose **Create account** and enter:

- a PulseStation username;
- your PSN Online ID;
- an optional display name;
- a new PulseStation password.

PulseStation previews the PSN profile as you enter the Online ID and performs a fuller import when the account is created.

The first real PulseStation account created becomes the local `owner` role.

## What the PSN importer attempts to fetch

Subject to PlayStation privacy controls and endpoint availability:

- PSN Online ID and numeric account ID;
- PlayStation avatar/profile picture;
- About Me / profile fields where available;
- PS Plus status where exposed;
- trophy level and level progress;
- Platinum, Gold, Silver and Bronze totals;
- trophy-title history;
- per-title completion and earned trophy counts;
- played games;
- playtime and play count;
- first/last played timestamps;
- basic presence/current platform;
- region where available;
- detailed trophy names/descriptions/earned status when an imported game is opened.

Private data is not bypassed. If PSN says a field is unavailable, PulseStation leaves it unavailable.

## Database note

The Render Blueprint uses free Postgres for initial testing. Render's free Postgres databases currently expire after 30 days. Upgrade the database before expiration for a permanent community.

## Updating

Upload or push changed files to the same GitHub repository. Render automatically redeploys the web service from new commits.
