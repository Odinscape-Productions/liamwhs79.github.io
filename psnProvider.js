/**
 * PSN provider boundary
 * ---------------------
 * This starter deliberately ships with PSN_SYNC_MODE=disabled.
 *
 * Do NOT collect a user's PlayStation password in this app.
 * Do NOT bolt unsupported scraping or auth bypasses into this file.
 *
 * When you have an authorised source/provider, normalize its response to:
 *
 * {
 *   onlineId: "KARN_91",
 *   avatarUrl: "https://...",
 *   level: 387,
 *   trophies: { platinum: 46, gold: 188, silver: 604, bronze: 2142 },
 *   library: [
 *     {
 *       externalId: "...",
 *       title: "...",
 *       hours: 118,
 *       progress: 82,
 *       trophies: 43,
 *       lastPlayed: "2026-09-14T18:40:00Z"
 *     }
 *   ]
 * }
 */

async function syncPsnProfile({ onlineId }) {
  const mode = process.env.PSN_SYNC_MODE || "disabled";

  if (mode === "disabled") {
    const err = new Error("Real PSN syncing is not configured. Demo data is active.");
    err.code = "PSN_SYNC_DISABLED";
    throw err;
  }

  if (mode === "provider") {
    const base = process.env.PSN_PROVIDER_BASE_URL;
    const token = process.env.PSN_PROVIDER_TOKEN;
    if (!base || !token) {
      const err = new Error("PSN provider settings are incomplete.");
      err.code = "PSN_PROVIDER_MISCONFIGURED";
      throw err;
    }

    const response = await fetch(`${base.replace(/\/$/, "")}/profile/${encodeURIComponent(onlineId)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });

    if (!response.ok) {
      const err = new Error(`PSN provider returned ${response.status}`);
      err.code = "PSN_PROVIDER_ERROR";
      throw err;
    }

    return await response.json();
  }

  throw new Error(`Unknown PSN_SYNC_MODE: ${mode}`);
}

module.exports = { syncPsnProfile };
