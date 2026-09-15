window.PSNPublicImporter = (() => {
  const reader = target => `https://r.jina.ai/${target}`;
  const timeout = (promise,ms=14000) => Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error("Tracker request timed out.")),ms))
  ]);

  const cleanNumber = value => Number(String(value||"").replace(/[^\d]/g,"")) || 0;
  const matchNum = (text, patterns) => {
    for (const p of patterns) {
      const m=text.match(p);
      if(m) return cleanNumber(m[1]);
    }
    return 0;
  };
  const matchPercent = text => {
    const m=text.match(/(?:completion|completed|progress)[^\d]{0,30}(\d{1,3}(?:\.\d+)?)\s*%/i)
      || text.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
    return m ? Math.min(100,Number(m[1])) : 0;
  };
  const markdownImages = text => [...text.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)[^)]*\)/g)].map(m=>m[1]);
  const gameLinks = text => {
    const out=[];
    const seen=new Set();
    const rx=/\[([^\]\n]{2,80})\]\((https?:\/\/[^)\s]+)\)/g;
    for(const m of text.matchAll(rx)){
      const title=m[1].replace(/!\[[^\]]*\]/g,"").replace(/\s+/g," ").trim();
      const url=m[2];
      if(!title || /home|profile|forum|leaderboard|login|register|report/i.test(title)) continue;
      if(!/game|troph|psn/i.test(url)) continue;
      const key=title.toLowerCase();
      if(seen.has(key)) continue;
      seen.add(key);
      out.push({title,url});
      if(out.length>=60) break;
    }
    return out;
  };

  async function fetchPublic(url){
    const res=await timeout(fetch(reader(url),{headers:{Accept:"text/plain"}}));
    if(!res.ok) throw new Error(`Reader returned ${res.status}`);
    const text=await res.text();
    if(!text || text.length<80) throw new Error("Tracker returned no readable profile data.");
    return text;
  }

  function parseCommon(text,source,url,onlineId){
    const lower=text.toLowerCase();
    if(/page not found|profile not found|404 not found|no player|could not find/i.test(text)) throw new Error("Public profile was not found.");
    const imgs=markdownImages(text);
    const avatar=imgs.find(u=>/avatar|profile|user|cdn|image/i.test(u)) || imgs[0] || "";
    const platinum=matchNum(text,[
      /platinum(?: trophies?)?[\s:*|_-]{0,12}([\d,]+)/i,
      /([\d,]+)\s+platinum/i
    ]);
    const gold=matchNum(text,[/gold(?: trophies?)?[\s:*|_-]{0,12}([\d,]+)/i,/([\d,]+)\s+gold/i]);
    const silver=matchNum(text,[/silver(?: trophies?)?[\s:*|_-]{0,12}([\d,]+)/i,/([\d,]+)\s+silver/i]);
    const bronze=matchNum(text,[/bronze(?: trophies?)?[\s:*|_-]{0,12}([\d,]+)/i,/([\d,]+)\s+bronze/i]);
    const level=matchNum(text,[
      /trophy level[\s:*|_-]{0,12}([\d,]+)/i,
      /\blevel[\s:*|_-]{0,12}([\d,]+)/i
    ]);
    const hours=matchNum(text,[
      /([\d,]+)\s*(?:hours|hrs)\b/i,
      /playtime[\s:*|_-]{0,12}([\d,]+)/i
    ]);
    return {
      source,url,onlineId,ok:true,avatar,platinum,gold,silver,bronze,level,hours,
      completion:matchPercent(text),games:gameLinks(text),rawLength:text.length,
      fetchedAt:new Date().toISOString()
    };
  }

  async function exophase(onlineId){
    const url=`https://www.exophase.com/psn/user/${encodeURIComponent(onlineId)}/`;
    const text=await fetchPublic(url);
    const data=parseCommon(text,"Exophase",url,onlineId);
    // Exophase reader output commonly exposes total playtime as "<number> hours".
    data.hours = data.hours || matchNum(text,[/([\d,]+)\s+hours/i]);
    return data;
  }

  async function psnprofiles(onlineId){
    const url=`https://psnprofiles.com/${encodeURIComponent(onlineId)}`;
    const text=await fetchPublic(url);
    return parseCommon(text,"PSNProfiles",url,onlineId);
  }

  async function truetrophies(onlineId){
    const url=`https://www.truetrophies.com/gamer/${encodeURIComponent(onlineId)}`;
    const text=await fetchPublic(url);
    return parseCommon(text,"TrueTrophies",url,onlineId);
  }

  function merge(results,onlineId){
    const good=results.filter(r=>r.status==="fulfilled").map(r=>r.value);
    if(!good.length){
      const reasons=results.map(r=>r.reason?.message).filter(Boolean);
      throw new Error(reasons[0] || "No public tracker could read this PSN ID.");
    }
    const best=(field,mode="max")=>{
      const vals=good.map(x=>Number(x[field]||0)).filter(Boolean);
      if(!vals.length) return 0;
      return mode==="first" ? vals[0] : Math.max(...vals);
    };
    const images=good.map(x=>x.avatar).filter(Boolean);
    const games=[];
    const seen=new Set();
    for(const s of good){
      for(const g of s.games||[]){
        const key=g.title.toLowerCase();
        if(!seen.has(key)){seen.add(key);games.push({...g,source:s.source});}
      }
    }
    return {
      onlineId, handle:onlineId,
      level:best("level"), platinum:best("platinum"), gold:best("gold"),
      silver:best("silver"), bronze:best("bronze"), hours:best("hours"),
      completion:best("completion"), avatarUrl:images[0]||"",
      games:games.slice(0,80),
      sources:good.map(s=>({name:s.source,url:s.url,ok:true,fetchedAt:s.fetchedAt,
        fields:{
          level:s.level,platinum:s.platinum,gold:s.gold,silver:s.silver,bronze:s.bronze,
          hours:s.hours,completion:s.completion,games:(s.games||[]).length
        }})),
      fetchedAt:new Date().toISOString()
    };
  }

  async function importProfile(onlineId,onProgress=()=>{}){
    onlineId=String(onlineId||"").trim();
    if(!onlineId) throw new Error("Enter a PSN Online ID.");
    const sources=[
      ["Exophase",exophase],["PSNProfiles",psnprofiles],["TrueTrophies",truetrophies]
    ];
    let done=0;
    const jobs=sources.map(async([name,fn])=>{
      onProgress({name,status:"checking",done,total:sources.length});
      try{
        const value=await fn(onlineId);
        done++;
        onProgress({name,status:"found",done,total:sources.length,value});
        return value;
      }catch(error){
        done++;
        onProgress({name,status:"unavailable",done,total:sources.length,error:error.message});
        throw error;
      }
    });
    const results=await Promise.allSettled(jobs);
    return merge(results,onlineId);
  }

  return {importProfile};
})();
