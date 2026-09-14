/**
 * PulseStation PSN importer
 *
 * Users only provide a PSN Online ID. The app owner supplies ONE server-side
 * NPSSO secret through Render. Never expose that secret to the browser and
 * never ask community users for their Sony password or NPSSO token.
 *
 * Data availability depends on the target user's PlayStation privacy settings.
 */
let cachedAuth = null;
let cachedUntil = 0;

function loadPsnApi() {
  try {
    return require("psn-api");
  } catch (err) {
    const e = new Error("The psn-api package is not installed. Run npm install and redeploy.");
    e.code = "PSN_LIBRARY_MISSING";
    throw e;
  }
}

async function getAuthorization() {
  if ((process.env.PSN_SYNC_MODE || "disabled") !== "psn-api") {
    const err = new Error("PSN auto-sync is disabled on this server.");
    err.code = "PSN_SYNC_DISABLED";
    throw err;
  }
  const npsso = String(process.env.PSN_NPSSO || "").trim();
  if (!npsso) {
    const err = new Error("PSN auto-sync needs the server-side PSN_NPSSO secret in Render.");
    err.code = "PSN_NOT_CONFIGURED";
    throw err;
  }
  if (cachedAuth?.accessToken && Date.now() < cachedUntil) return cachedAuth;

  const { exchangeNpssoForAccessCode, exchangeAccessCodeForAuthTokens } = loadPsnApi();
  const accessCode = await exchangeNpssoForAccessCode(npsso);
  cachedAuth = await exchangeAccessCodeForAuthTokens(accessCode);
  // PSN access tokens are short-lived. Refresh from the server-held NPSSO before expiry.
  cachedUntil = Date.now() + 45 * 60 * 1000;
  return cachedAuth;
}

function firstSettled(result, fallback = null) {
  return result?.status === "fulfilled" ? result.value : fallback;
}

function findSearchIdentity(search, onlineId) {
  const wanted = String(onlineId).toLowerCase();
  const results = (search?.domainResponses || []).flatMap(d => d?.results || []);
  const exact = results.find(r => String(r?.socialMetadata?.onlineId || "").toLowerCase() === wanted);
  const pick = exact || results[0];
  return pick?.socialMetadata || null;
}

function totalTrophies(obj = {}) {
  return Number(obj.bronze || 0) + Number(obj.silver || 0) + Number(obj.gold || 0) + Number(obj.platinum || 0);
}

function parseHours(playDuration) {
  if (!playDuration) return 0;
  if (typeof playDuration === "number") return Math.round(playDuration / 3600 * 10) / 10;
  const text = String(playDuration);
  // PSN commonly returns ISO-8601 durations such as PT12H34M56S.
  const m = text.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!m) return 0;
  const hours = Number(m[1] || 0) * 24 + Number(m[2] || 0) + Number(m[3] || 0) / 60 + Number(m[4] || 0) / 3600;
  return Math.round(hours * 10) / 10;
}


function httpsUrl(value) {
  if (!value) return null;
  return String(value).replace(/^http:\/\//i, "https://");
}

function bestAvatar(profile, legacy, searchIdentity) {
  const avatars = profile?.avatars || [];
  const preferred = avatars.find(a => a.size === "xl") || avatars.find(a => a.size === "l") || avatars[0];
  return httpsUrl(preferred?.url || legacy?.profile?.avatarUrls?.[0]?.avatarUrl || searchIdentity?.avatarUrl || null);
}

function bestProfilePic(profile, legacy, searchIdentity) {
  return httpsUrl(profile?.profilePicUrl || profile?.profilePictureUrl ||
    legacy?.profile?.personalDetail?.profilePictureUrls?.[0]?.profilePictureUrl ||
    searchIdentity?.profilePicUrl || null);
}

async function resolveIdentity(auth, onlineId) {
  const api = loadPsnApi();
  let legacy = null;
  try { legacy = await api.getProfileFromUserName(auth, onlineId); } catch {}
  if (legacy?.profile?.accountId) {
    return { accountId:String(legacy.profile.accountId), onlineId:legacy.profile.onlineId || onlineId, legacy, searchIdentity:null };
  }

  const search = await api.makeUniversalSearch(auth, onlineId, "SocialAllAccounts");
  const searchIdentity = findSearchIdentity(search, onlineId);
  if (!searchIdentity?.accountId) {
    const err = new Error(`No PlayStation profile could be found for ${onlineId}.`);
    err.code = "PSN_USER_NOT_FOUND";
    throw err;
  }
  return { accountId:String(searchIdentity.accountId), onlineId:searchIdentity.onlineId || onlineId, legacy, searchIdentity };
}

async function fetchAllTitles(api, auth, accountId) {
  const all = [];
  let offset = 0;
  for (let page = 0; page < 6; page++) {
    const response = await api.getUserTitles(auth, accountId, { limit:800, offset });
    const items = response?.trophyTitles || response?.titles || [];
    all.push(...items);
    const total = Number(response?.totalItemCount ?? all.length);
    if (!items.length || all.length >= total || items.length < 800) break;
    offset += items.length;
  }
  return all;
}

async function syncPsnProfile({ onlineId }) {
  const api = loadPsnApi();
  const authorization = await getAuthorization();
  const auth = { accessToken: authorization.accessToken };
  const identity = await resolveIdentity(auth, onlineId);
  const accountId = identity.accountId;

  const calls = await Promise.allSettled([
    api.getProfileFromAccountId(auth, accountId),
    api.getUserTrophyProfileSummary(auth, accountId),
    fetchAllTitles(api, auth, accountId),
    api.getUserPlayedGames(auth, accountId, { limit:200 }),
    api.getBasicPresence(auth, accountId),
    api.getUserRegion(auth, identity.onlineId),
    api.getUserFriendsAccountIds(auth, accountId, { limit:1 })
  ]);

  const profile = firstSettled(calls[0], {});
  const trophySummary = firstSettled(calls[1], identity.legacy?.profile?.trophySummary || {});
  const trophyTitles = firstSettled(calls[2], []);
  const playedResponse = firstSettled(calls[3], {});
  const presence = firstSettled(calls[4], null);
  const region = firstSettled(calls[5], null);
  const friends = firstSettled(calls[6], null);

  const earned = trophySummary?.earnedTrophies || identity.legacy?.profile?.trophySummary?.earnedTrophies || {};
  const played = playedResponse?.titles || playedResponse?.games || [];

  const trophyByName = new Map();
  for (const t of trophyTitles) {
    trophyByName.set(String(t.trophyTitleName || t.titleName || "").toLowerCase(), t);
  }

  const games = played.map((g, index) => {
    const title = g.name || g.localizedName || g.titleName || `PlayStation Game ${index + 1}`;
    const trophy = trophyByName.get(String(title).toLowerCase());
    const userTrophies = trophy?.userTrophies || trophy || {};
    const earnedForGame = userTrophies.earnedTrophies || trophy?.earnedTrophies || {};
    const totalForGame = userTrophies.totalTrophies || trophy?.definedTrophies || {};
    return {
      externalId:g.titleId || g.npTitleId || g.conceptId || trophy?.npCommunicationId || title,
      npCommunicationId:trophy?.npCommunicationId || null,
      npServiceName:trophy?.npServiceName || null,
      title,
      imageUrl:httpsUrl(g.imageUrl || g.conceptIconUrl || g.npTitleIconUrl || trophy?.trophyTitleIconUrl || null),
      platform:g.category || g.platform || g.service || trophy?.trophyTitlePlatform || trophy?.titlePlatform || "PlayStation",
      hours:parseHours(g.playDuration),
      playCount:Number(g.playCount || 0),
      firstPlayed:g.firstPlayedDateTime || null,
      lastPlayed:g.lastPlayedDateTime || trophy?.lastUpdatedDateTime || null,
      progress:Number(userTrophies.progress ?? userTrophies.progressPercentage ?? trophy?.progress ?? 0),
      trophiesEarned:totalTrophies(earnedForGame),
      trophyCount:totalTrophies(totalForGame),
      earnedTrophies:earnedForGame,
      totalTrophies:totalForGame
    };
  });

  // Add trophy-only titles that are not returned by played-games visibility.
  for (const t of trophyTitles) {
    const title = t.trophyTitleName || t.titleName || "PlayStation Title";
    if (games.some(g => g.title.toLowerCase() === String(title).toLowerCase())) continue;
    const userTrophies = t.userTrophies || t;
    const earnedForGame = userTrophies.earnedTrophies || t.earnedTrophies || {};
    const totalForGame = userTrophies.totalTrophies || t.definedTrophies || {};
    games.push({
      externalId:t.npCommunicationId || title,
      npCommunicationId:t.npCommunicationId || null,
      npServiceName:t.npServiceName || null,
      title,
      imageUrl:httpsUrl(t.trophyTitleIconUrl || null),
      platform:t.trophyTitlePlatform || t.titlePlatform || "PlayStation",
      hours:0, playCount:0, firstPlayed:null,
      lastPlayed:t.lastUpdatedDateTime || null,
      progress:Number(userTrophies.progress ?? userTrophies.progressPercentage ?? t.progress ?? 0),
      trophiesEarned:totalTrophies(earnedForGame), trophyCount:totalTrophies(totalForGame),
      earnedTrophies:earnedForGame, totalTrophies:totalForGame
    });
  }

  return {
    onlineId:profile?.onlineId || identity.onlineId,
    accountId,
    avatarUrl:bestAvatar(profile, identity.legacy, identity.searchIdentity),
    profilePicUrl:bestProfilePic(profile, identity.legacy, identity.searchIdentity),
    aboutMe:profile?.aboutMe ?? identity.legacy?.profile?.aboutMe ?? "",
    plus:Boolean(profile?.plus ?? identity.legacy?.profile?.plus),
    languages:profile?.languagesUsed || identity.legacy?.profile?.languagesUsed || [],
    officiallyVerified:Boolean(profile?.isOfficiallyVerified || identity.legacy?.profile?.isOfficiallyVerified),
    region:region?.countryCode || region?.region || region?.country || null,
    presence,
    friendCount:Number(friends?.totalItemCount ?? friends?.totalItemCountValue ?? 0) || null,
    trophyLevel:Number(trophySummary?.trophyLevel ?? trophySummary?.level ?? identity.legacy?.profile?.trophySummary?.level ?? 0),
    trophyProgress:Number(trophySummary?.progress ?? identity.legacy?.profile?.trophySummary?.progress ?? 0),
    trophies:{
      platinum:Number(earned.platinum || 0), gold:Number(earned.gold || 0),
      silver:Number(earned.silver || 0), bronze:Number(earned.bronze || 0)
    },
    trophyTitles,
    games,
    fetchedAt:new Date().toISOString()
  };
}

function rarityName(value, rate) {
  const n = Number(value);
  const names = { 0:"Ultra Rare", 1:"Very Rare", 2:"Rare", 3:"Common" };
  const label = Number.isFinite(n) && names[n] ? names[n] : "PSN Trophy";
  const pct = Number(rate);
  return Number.isFinite(pct) && pct > 0 ? `${label} • ${pct}%` : label;
}

async function getPsnTitleTrophies({ accountId, npCommunicationId, npServiceName }) {
  if (!accountId || !npCommunicationId) return [];
  const api = loadPsnApi();
  const authorization = await getAuthorization();
  const auth = { accessToken:authorization.accessToken };
  const options = { limit:500 };
  if (npServiceName) options.npServiceName = npServiceName;

  const [defsResult, earnedResult] = await Promise.allSettled([
    api.getTitleTrophies(auth, npCommunicationId, "all", options),
    api.getUserTrophiesEarnedForTitle(auth, accountId, npCommunicationId, "all", options)
  ]);
  const defs = firstSettled(defsResult, {})?.trophies || [];
  const earned = firstSettled(earnedResult, {})?.trophies || [];
  const earnedMap = new Map(earned.map(t => [String(t.trophyId), t]));
  return defs.map(t => {
    const e = earnedMap.get(String(t.trophyId)) || {};
    return {
      id:String(t.trophyId),
      name:t.trophyName || `Trophy ${t.trophyId}`,
      grade:String(t.trophyType || "bronze").toLowerCase(),
      rarity:rarityName(e.trophyRare ?? t.trophyRare, e.trophyEarnedRate ?? t.trophyEarnedRate),
      earnedRate:Number(e.trophyEarnedRate ?? t.trophyEarnedRate ?? 0),
      tip:t.trophyDetail || "No trophy description available.",
      earned:Boolean(e.earned),
      earnedAt:e.earnedDateTime || null,
      iconUrl:httpsUrl(t.trophyIconUrl || null),
      hidden:Boolean(t.trophyHidden)
    };
  });
}

module.exports = { syncPsnProfile, getPsnTitleTrophies };
