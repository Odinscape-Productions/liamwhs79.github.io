window.PSNPublicImporter = (() => {
  const READER = target => `https://r.jina.ai/${target}`;
  const ALL_ORIGINS = target => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
  const CORS_PROXY = target => `https://corsproxy.io/?url=${encodeURIComponent(target)}`;

  function withTimeout(promise, ms=22000, label="Request") {
    let timer;
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error(`${label} timed out.`)),ms);
    });
    return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
  }

  async function responseText(res) {
    if(!res.ok){
      const err=new Error(`HTTP ${res.status}`);
      err.httpStatus=res.status;
      throw err;
    }
    return await res.text();
  }

  function parsePlayStationShare(value) {
    const raw=String(value||"").trim();
    if(!raw)return null;

    if(!/^https?:\/\//i.test(raw)){
      if(/^[A-Za-z0-9_-]{3,32}$/.test(raw)){
        return {
          onlineId:raw,
          shareUrl:`https://profile.playstation.com/${encodeURIComponent(raw)}`,
          official:false,
          inputType:"manual-id"
        };
      }
      return null;
    }

    try{
      const u=new URL(raw);
      if(u.hostname.toLowerCase()!=="profile.playstation.com")return null;
      const parts=u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const id=(parts[0]?.toLowerCase()==="share"?parts[1]:parts[0])||"";
      if(!/^[A-Za-z0-9_-]{3,32}$/.test(id))return null;
      return {
        onlineId:id,
        shareUrl:`https://profile.playstation.com/${encodeURIComponent(id)}`,
        official:true,
        inputType:"playstation-share"
      };
    }catch{return null}
  }

  async function anonymousReader(url) {
    // Plain anonymous GET only. No browser/proxy/no-cache features that may require auth.
    const res=await withTimeout(fetch(READER(url)),22000,"Public reader");
    return await responseText(res);
  }

  async function publicText(url) {
    const errors=[];
    try{return await anonymousReader(url)}
    catch(err){errors.push(`Reader ${err.message}`)}

    for(const [name,makeUrl] of [["AllOrigins",ALL_ORIGINS],["CORS proxy",CORS_PROXY]]){
      try{
        const res=await withTimeout(fetch(makeUrl(url)),18000,name);
        return await responseText(res);
      }catch(err){errors.push(`${name} ${err.message}`)}
    }
    throw new Error(errors.join(" • ")||"No public reader route succeeded.");
  }

  async function publicRawHtml(url) {
    const errors=[];
    for(const [name,makeUrl] of [["AllOrigins",ALL_ORIGINS],["CORS proxy",CORS_PROXY]]){
      try{
        const res=await withTimeout(fetch(makeUrl(url)),18000,name);
        const text=await responseText(res);
        if(text&&text.length>100)return text;
      }catch(err){errors.push(`${name} ${err.message}`)}
    }
    throw new Error(errors.join(" • ")||"Raw public HTML was unavailable.");
  }

  function stripHtml(html) {
    try {
      const doc=new DOMParser().parseFromString(html,"text/html");
      return doc.body?.innerText || "";
    } catch {
      return String(html||"").replace(/<[^>]+>/g," ");
    }
  }

  function firstProfileImage(html) {
    try {
      const doc=new DOMParser().parseFromString(html,"text/html");
      const images=[...doc.querySelectorAll("img")]
        .map(i=>i.src||i.getAttribute("src")||"")
        .filter(Boolean);
      return images.find(u=>/avatar|profile|user|m\.exophase\.com/i.test(u) && !/LevelIcon|flag|logo|sprite/i.test(u))
        || images.find(u=>/^https?:/i.test(u) && !/LevelIcon|flag|logo|sprite/i.test(u))
        || "";
    } catch { return ""; }
  }

  const num=v=>Number(String(v||"").replace(/[^\d.]/g,""))||0;

  function parseExophaseSummary(text,onlineId) {
    text=String(text||"").replace(/\u00a0/g," ");
    const out={
      source:"Exophase",onlineId,level:0,completion:0,
      bronze:0,silver:0,gold:0,platinum:0,hours:0,
      totalTrophies:0,gamesCount:0,completedGames:0,xp:0
    };

    const at=text.toLowerCase().indexOf(String(onlineId||"").toLowerCase());
    const relevant=at>=0?text.slice(at):text;

    const levelMatch =
      relevant.match(/Image\s*(\d{1,5})/i) ||
      relevant.match(/Profile_LevelIcon[^0-9]{0,80}(\d{1,5})/i) ||
      relevant.match(/\bLevel\s*:?\s*(\d{1,5})/i);
    if(levelMatch) out.level=num(levelMatch[1]);

    const percentMatch=relevant.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
    if(!percentMatch) return out;

    out.completion=Math.min(100,Number(percentMatch[1]));
    let tail=relevant.slice((percentMatch.index||0)+percentMatch[0].length);
    tail=tail.split(/\bReport\b|©2006|Quick Links/i)[0];

    const hoursMatch=tail.match(/([\d,]+(?:\.\d+)?)\s*hours?\b/i);
    if(hoursMatch) out.hours=num(hoursMatch[1]);

    // Exophase compact PSN layout after the completion percentage:
    // ranked: world rank, country rank, bronze, silver, gold, platinum, [hours], total, games, completed, XP
    // unranked: bronze, silver, gold, platinum, [hours], total, games, completed, XP
    const withoutHours=tail.replace(/[\d,]+(?:\.\d+)?\s*hours?\b/i," ");
    const values=[...withoutHours.matchAll(/\b\d[\d,]*(?:\.\d+)?\b/g)].map(m=>num(m[0]));
    const offset=/Not Ranked/i.test(tail)?0:2;

    if(values.length>=offset+4){
      out.bronze=values[offset]||0;
      out.silver=values[offset+1]||0;
      out.gold=values[offset+2]||0;
      out.platinum=values[offset+3]||0;
    }
    if(values.length>=offset+5) out.totalTrophies=values[offset+4]||0;
    if(values.length>=offset+6) out.gamesCount=values[offset+5]||0;
    if(values.length>=offset+7) out.completedGames=values[offset+6]||0;
    if(values.length>=offset+8) out.xp=values[offset+7]||0;

    return out;
  }

  function playerProfileIdFromHtml(html) {
    for(const pattern of [
      /playerProfileId\s*[=:]\s*['"]?([A-Za-z0-9_-]+)/i,
      /["']playerProfileId["']\s*:\s*["']?([A-Za-z0-9_-]+)/i
    ]){
      const m=String(html||"").match(pattern);
      if(m) return m[1];
    }
    return "";
  }

  function parseJson(text) {
    text=String(text||"").trim();
    try{return JSON.parse(text)}catch{}
    const start=text.indexOf("{"),end=text.lastIndexOf("}");
    if(start>=0&&end>start){
      try{return JSON.parse(text.slice(start,end+1))}catch{}
    }
    throw new Error("The public games feed returned an unexpected response.");
  }

  async function publicJson(url) {
    // Direct public endpoint first.
    try{
      const res=await withTimeout(fetch(url,{headers:{Accept:"application/json"}}),16000,"Exophase games");
      if(res.ok) return await res.json();
    }catch{}

    // CORS fallbacks for a static GitHub Pages app.
    try{
      const res=await withTimeout(fetch(ALL_ORIGINS(url)),18000,"Games feed fallback");
      return parseJson(await responseText(res));
    }catch{}

    return parseJson(await publicText(url,{noCache:true}));
  }

  function isPlayStationGame(raw) {
    const platforms=raw?.meta?.platforms||[];
    if(!platforms.length) return true;
    return platforms.some(p=>{
      const slug=String(p?.slug||"").toLowerCase();
      const name=String(p?.name||"").toLowerCase();
      return /(^|-)ps(n|3|4|5|vita)($|-)/.test(slug)
        || /playstation|ps vita|\bps[345]\b/.test(name);
    });
  }

  function hoursFor(raw) {
    const units=raw?.playtimeUnits;
    if(units && (units.hours!=null || units.minutes!=null)){
      return Math.round(((Number(units.hours)||0)+(Number(units.minutes||0)/60))*10)/10;
    }
    const text=String(raw?.playtime||"");
    const h=text.match(/([\d,.]+)\s*h/i),m=text.match(/([\d,.]+)\s*m/i);
    return Math.round(((num(h?.[1]))+(num(m?.[1])/60))*10)/10;
  }

  function normalizeGame(raw) {
    const platforms=(raw?.meta?.platforms||[]).map(p=>p?.name).filter(Boolean);
    return {
      id:`exophase-${raw?.master_id || String(raw?.meta?.title||"game").toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
      externalId:raw?.master_id||null,
      title:String(raw?.meta?.title||"Unknown game").trim(),
      platform:platforms.join(" / ")||"PlayStation",
      hours:hoursFor(raw),
      progress:Math.max(0,Math.min(100,Number(raw?.percent)||0)),
      lastPlayed:raw?.lastplayed_utc?new Date(Number(raw.lastplayed_utc)*1000).toISOString():null,
      image:String(raw?.meta?.image||""),
      url:String(raw?.meta?.canonical_url||""),
      source:"Exophase"
    };
  }

  async function fetchExophaseGames(playerId,onProgress=()=>{}) {
    const all=[],seen=new Set();

    for(let page=1;page<=80;page++){
      onProgress({name:"Exophase game library",status:"checking",detail:`Reading page ${page}`});
      const url=`https://api.exophase.com/public/player/${encodeURIComponent(playerId)}/games?page=${page}&environment=&sort=1&showHidden=0`;
      const data=await publicJson(url);
      const rows=Array.isArray(data?.games)?data.games:[];
      if(!data?.success || !rows.length) break;

      let added=0;
      for(const raw of rows){
        if(!isPlayStationGame(raw)) continue;
        const g=normalizeGame(raw);
        const key=String(g.externalId||g.title.toLowerCase());
        if(seen.has(key)) continue;
        seen.add(key);
        all.push(g);
        added++;
      }

      onProgress({name:"Exophase game library",status:"found",detail:`${all.length} PlayStation games found`});

      // Prevent a looping/repeated page from running forever.
      if(page>1 && added===0) break;
    }

    return all.sort((a,b)=>String(b.lastPlayed||"").localeCompare(String(a.lastPlayed||"")));
  }

  async function exophase(onlineId,onProgress,exophaseHint="") {
    const encoded=encodeURIComponent(onlineId);
    const hint=String(exophaseHint||"").trim();
    const candidates=[
      `https://www.exophase.com/psn/user/${encoded}/`,
      hint?(hint.startsWith("http")?hint:`https://www.exophase.com/user/${encodeURIComponent(hint)}/`):"",
      `https://www.exophase.com/user/${encoded}/`
    ].filter(Boolean);

    let usedUrl="",summary=null,avatar="",playerId="",lastError=null;

    for(const url of [...new Set(candidates)]){
      try{
        onProgress({name:"Exophase",status:"checking",detail:"Reading public profile"});
        const readable=await publicText(url);
        if(/page not found|profile not found|404 not found/i.test(readable))throw new Error("Profile not found.");
        summary=parseExophaseSummary(readable,onlineId);
        usedUrl=url;

        try{
          const html=await publicRawHtml(url);
          playerId=playerProfileIdFromHtml(html);
          avatar=firstProfileImage(html);
        }catch{}

        if(summary.level||summary.totalTrophies||summary.platinum||playerId)break;
      }catch(err){lastError=err}
    }

    if(!usedUrl)throw lastError||new Error("Exophase did not expose a readable public profile.");

    let games=[],gamesError="";
    if(playerId){
      try{games=await fetchExophaseGames(playerId,onProgress)}
      catch(err){gamesError=err.message}
    }else{
      gamesError="Profile stats were readable, but Exophase's public player ID was not available through a browser-safe request.";
    }

    onProgress({
      name:"Exophase",status:"found",
      detail:`${summary.level?`Level ${summary.level}`:"Profile found"}${summary.platinum?` • ${summary.platinum} platinum`:""}${games.length?` • ${games.length} games`:""}`
    });

    return {
      source:"Exophase",url:usedUrl,onlineId,playerId,avatar,summary,games,gamesError,
      fetchedAt:new Date().toISOString()
    };
  }

  async function simpleTracker(name,url,onlineId,onProgress) {
    onProgress({name,status:"checking",detail:"Checking public profile"});
    const text=await publicText(url,{noCache:true});
    if(/page not found|profile not found|404 not found|could not find|no gamer/i.test(text)) {
      throw new Error("Profile not found.");
    }

    const matchNum=patterns=>{
      for(const p of patterns){
        const m=text.match(p);
        if(m) return num(m[1]);
      }
      return 0;
    };

    const result={
      source:name,url,onlineId,
      level:matchNum([/trophy level[^\d]{0,30}([\d,]+)/i,/\blevel[^\d]{0,20}([\d,]+)/i]),
      platinum:matchNum([/platinum(?: trophies?)?[^\d]{0,20}([\d,]+)/i,/([\d,]+)\s+platinum/i]),
      gold:matchNum([/gold(?: trophies?)?[^\d]{0,20}([\d,]+)/i,/([\d,]+)\s+gold/i]),
      silver:matchNum([/silver(?: trophies?)?[^\d]{0,20}([\d,]+)/i,/([\d,]+)\s+silver/i]),
      bronze:matchNum([/bronze(?: trophies?)?[^\d]{0,20}([\d,]+)/i,/([\d,]+)\s+bronze/i]),
      completion:(()=>{const m=text.match(/(?:completion|completed|progress)[^\d]{0,30}(\d{1,3}(?:\.\d+)?)\s*%/i);return m?Number(m[1]):0})(),
      fetchedAt:new Date().toISOString()
    };

    if(!result.level&&!result.platinum&&!result.gold&&!result.silver&&!result.bronze&&!result.completion) {
      throw new Error("Page responded, but its public stats were not readable.");
    }

    onProgress({name,status:"found",detail:`${result.platinum||0} platinum found`});
    return result;
  }

  function getField(sources,field) {
    for(const sourceName of ["Exophase","PSNProfiles","TrueTrophies"]){
      const s=sources.find(x=>x.source===sourceName);
      const value=Number(s?.summary?.[field] ?? s?.[field] ?? 0);
      if(value>0) return value;
    }
    return 0;
  }

  async function importProfile(onlineId,onProgress=()=>{},options={}) {
    onlineId=String(onlineId||"").trim();
    if(!onlineId) throw new Error("Enter a PSN Online ID.");

    const jobs=[
      exophase(onlineId,onProgress,options.exophaseHint||""),
      simpleTracker("PSNProfiles",`https://psnprofiles.com/${encodeURIComponent(onlineId)}`,onlineId,onProgress),
      simpleTracker("TrueTrophies",`https://www.truetrophies.com/gamer/${encodeURIComponent(onlineId)}`,onlineId,onProgress)
    ];

    const settled=await Promise.allSettled(jobs);
    const sources=settled.filter(x=>x.status==="fulfilled").map(x=>x.value);
    const failures=settled.filter(x=>x.status==="rejected").map(x=>x.reason?.message).filter(Boolean);

    if(!sources.length) {
      throw new Error(failures[0]||"No public tracker currently exposes readable data for this PSN ID.");
    }

    const exo=sources.find(s=>s.source==="Exophase");
    const games=Array.isArray(exo?.games)?exo.games:[];
    const summedHours=games.reduce((sum,g)=>sum+(Number(g.hours)||0),0);
    const hours=summedHours || Number(exo?.summary?.hours||0);

    const result={
      onlineId,
      level:getField(sources,"level"),
      platinum:getField(sources,"platinum"),
      gold:getField(sources,"gold"),
      silver:getField(sources,"silver"),
      bronze:getField(sources,"bronze"),
      hours:Math.round(hours*10)/10,
      completion:getField(sources,"completion"),
      avatarUrl:exo?.avatar||"",
      games,
      sources:sources.map(s=>({
        name:s.source,url:s.url,ok:true,fetchedAt:s.fetchedAt,
        fields:{
          level:Number(s?.summary?.level ?? s?.level ?? 0),
          platinum:Number(s?.summary?.platinum ?? s?.platinum ?? 0),
          gold:Number(s?.summary?.gold ?? s?.gold ?? 0),
          silver:Number(s?.summary?.silver ?? s?.silver ?? 0),
          bronze:Number(s?.summary?.bronze ?? s?.bronze ?? 0),
          hours:Number(s?.summary?.hours ?? 0),
          completion:Number(s?.summary?.completion ?? s?.completion ?? 0),
          games:Array.isArray(s.games)?s.games.length:0
        },
        note:s.gamesError||""
      })),
      failures,
      fetchedAt:new Date().toISOString()
    };

    if(!result.level&&!result.platinum&&!result.gold&&!result.silver&&!result.bronze&&!result.games.length) {
      throw new Error("A tracker page was reachable, but it did not expose usable profile or game data.");
    }

    return result;
  }

  return {importProfile,parseExophaseSummary,parsePlayStationShare};
})();
