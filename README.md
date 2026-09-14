# PulseStation v3

This build fixes registration and PSN import separation.

## Important
Use GitHub only for the repository. The functioning app must be opened from the Render `.onrender.com` URL. GitHub Pages cannot run `server.js`, create accounts, or safely hold the PSN server credential.

## Account flow
A PulseStation username/password account is saved first. After that succeeds, the browser starts PSN import as a separate request. A PSN error can no longer block account creation.

## PSN importer
Set `PSN_NPSSO` in Render's Environment settings. Community users only enter their PSN Online ID. Never expose the NPSSO in GitHub or browser code.

## Diagnostic test
Open `https://YOUR-APP.onrender.com/api/diagnostics`. You should see JSON with `backendReachable: true`. `psnConfigured` must be `true` for live PSN lookup.

This test build uses local JSON persistence so deployment has fewer moving parts. On a free Render web service, accounts can reset after a service restart. Move to Postgres after the flow is confirmed.
