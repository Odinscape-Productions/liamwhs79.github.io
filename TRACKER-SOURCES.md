# Public tracker sources

PulseStation v5 treats third-party trophy sites as optional public profile sources.

## Exophase

Profile pattern:

`https://www.exophase.com/psn/user/<PSN-ID>/`

Useful for publicly tracked PlayStation profile statistics and, where exposed,
playtime/activity information.

## PSNProfiles

Profile pattern:

`https://psnprofiles.com/<PSN-ID>`

Useful for public trophy profiles, trophy counts, completion information and game history.

## TrueTrophies

Profile pattern:

`https://www.truetrophies.com/gamer/<PSN-ID>`

Useful for public trophy tracking and completion/community information.

## Reader layer

A browser-hosted GitHub Pages app cannot assume those sites allow cross-origin
JavaScript requests. PulseStation therefore attempts to read public pages through:

`https://r.jina.ai/<public-url>`

No secret key is embedded in the app.

This is best-effort. If a tracker changes its page format, blocks readers, rate
limits requests, or cannot find the user, PulseStation marks that source unavailable
and keeps the local account working.

Public data should always be treated as tracker data, not as a guaranteed live Sony record.
