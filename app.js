const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const Store=window.PulseStore;
const Importer=window.PSNPublicImporter;

const state={
  db:Store.read(), me:null, games:[...(window.PULSE_SEED?.games||[])],
  route:"home", selectedGame:null, gameFilter:"owned", activeConversation:null
};

const themes={midnight:["#07111f","#3e8bff"],aurora:["#071817","#46e6b0"],void:["#0b0816","#9b75ff"],ember:["#1b0c08","#ff784d"],glacier:["#071319","#69d7ff"],sakura:["#180d19","#ff7fc1"]};
const avatars=["nova","vortex","prism","pulse","orbit","cipher","ember","glacier"];

function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function safeUrl(v=""){v=String(v||"").trim();return /^https?:\/\//i.test(v)?v.replace(/["'()\\]/g,""):""}
function toast(msg){const e=document.createElement("div");e.className="toast";e.textContent=msg;$("#toast-stack").appendChild(e);setTimeout(()=>e.remove(),4000)}
function ago(ts){const d=Math.max(0,Date.now()-Number(ts||Date.now()));const m=Math.floor(d/60000);if(m<1)return"now";if(m<60)return`${m}m`;const h=Math.floor(m/60);if(h<24)return`${h}h`;return`${Math.floor(h/24)}d`}
function openModal(html){$("#modal-content").innerHTML=html;$("#modal-backdrop").hidden=false;document.body.style.overflow="hidden"}
let pulseQrStream=null;
function stopQrCamera(){
  if(pulseQrStream){
    pulseQrStream.getTracks().forEach(t=>t.stop());
    pulseQrStream=null;
  }
}
function closeModal(){stopQrCamera();$("#modal-backdrop").hidden=true;document.body.style.overflow=""}
function setTheme(t){document.body.dataset.theme=t||"midnight"}
function user(id){return state.db.users.find(u=>u.id===id)}
function game(id){return state.games.find(g=>g.id===id)}
function libItem(id){return state.me?.library?.find(x=>x.gameId===id)}
function isFriend(id){return state.me?.friends?.includes(id)}
function avatarHTML(u,size="avatar-md"){
  const remote=safeUrl(u?.trackerAvatarUrl);
  if(remote)return `<div class="avatar external ${size}"><img src="${esc(remote)}" alt="${esc(u?.handle||"avatar")}" loading="lazy"></div>`;
  return `<div class="avatar ${esc(u?.avatar||"nova")} ${size}"><span class="avatar-glyph"></span></div>`
}

function reload(){state.db=Store.read();state.me=Store.getCurrentUser(state.db);mergeImportedGames();renderAll()}
function trackerGameId(x){
  return x?.id || `tracker-${String(x?.title||"game").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)}`;
}
function importedCover(x){
  const image=safeUrl(x?.image);
  if(image) return `linear-gradient(to top,rgba(2,8,15,.88),rgba(2,8,15,.08)),url("${image}") center/cover no-repeat`;
  return "linear-gradient(145deg,#071329,#123f87 52%,#6397ff)";
}
function mergeImportedGames(){
  // Reset to curated Discover catalogue, then append the signed-in user's actual imports.
  state.games=[...(window.PULSE_SEED?.games||[])];
  const imported=state.me?.importedGames||[];
  const existing=new Set(state.games.map(g=>g.id));
  for(const x of imported){
    const id=trackerGameId(x);
    if(existing.has(id)) continue;
    state.games.push({
      id,title:x.title,
      short:String(x.title||"PS").split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase(),
      platform:x.platform||"PlayStation",genre:"Your tracked game",accent:"#5bd8ff",
      cover:importedCover(x),mapUrl:"",guideUrl:x.url||"https://psnprofiles.com/guides",
      trophyCount:0,description:`Imported from ${x.source||"a public PlayStation tracker"}.`,
      trophies:[],source:"tracker",trackerUrl:x.url||"",trackerImage:x.image||""
    });
    existing.add(id);
  }
}
function route(name){
  state.route=name;
  $$(".route").forEach(e=>e.classList.toggle("active",e.dataset.page===name));
  $$("[data-route]").forEach(e=>e.classList.toggle("active",e.dataset.route===name));
  const labels={home:["PLAYSTATION COMMUNITY HUB","Good evening"],games:["YOUR PLAYSTATION LIBRARY","My Games"],trophies:["ACHIEVEMENTS","Trophies"],social:["PLAY TOGETHER","Social"],toolbox:["PS GAMER TOOLS","Toolbox"],"game-detail":["GAME HUB",state.selectedGame?.title||"Game"]};
  const l=labels[name]||labels.home;$("#page-kicker").textContent=l[0];$("#page-title").textContent=l[1];
  window.scrollTo({top:0,behavior:"smooth"});
  if(name==="social")renderSocial();if(name==="toolbox")renderToolbox();
}
function requireAccount(action){
  if(state.me)return true;
  openAuthModal(action);
  return false;
}

function renderChrome(){
  const me=state.me||{displayName:"Guest Player",handle:"NO ACCOUNT",avatar:"orbit",theme:"midnight"};
  setTheme(me.theme);
  $("#profile-button").innerHTML=avatarHTML(me,"avatar-sm");
  $("#sidebar-user").innerHTML=state.me?`
    <button class="mini-user" id="side-profile-open" style="width:100%;border:0;background:none;color:inherit;text-align:left;padding:0">
      ${avatarHTML(me,"avatar-sm")}<span><strong>${esc(me.displayName)}</strong><small>@${esc(me.handle||me.username)}</small></span>
    </button>`:`<button class="soft-button" id="side-signin">Create / sign in</button>`;
  $("#side-profile-open")?.addEventListener("click",openProfile);
  $("#side-signin")?.addEventListener("click",()=>openAuthModal());

  const synced=Boolean(me.trackerLastSync);
  $("#side-data-state").textContent=synced?"Public PSN data imported":"Local profile";
  $("#side-data-copy").textContent=synced?`Last refreshed ${new Date(me.trackerLastSync).toLocaleString("en-GB")}.`:"No Sony login required. Tracker importing is optional.";
  $("#source-badge").textContent=synced?"TRACKED":"LOCAL";
  $("#open-sync").textContent=me.psnShareUrl?(synced?"Refresh PSN profile":"Sync linked profile"):"Connect PSN profile";

  const notes=state.me?state.db.notifications.filter(n=>n.userId===state.me.id&&!n.read):[];
  $("#notification-count").textContent=notes.length||"";
  $("#notification-count").style.display=notes.length?"grid":"none";
  const unread=state.me?state.db.messages.filter(m=>m.to===state.me.id&&!m.read).length:0;
  $("#message-dot").style.display=unread?"block":"none";
}

function renderHome(){
  const me=state.me||{displayName:"Guest Player",handle:"Create an account",avatar:"orbit",level:0,platinum:0,gold:0,silver:0,bronze:0,hours:0,library:[]};
  $("#hero-player").innerHTML=`<div class="profile-orbit">${avatarHTML(me,"avatar-xl")}<strong>${esc(me.displayName)}</strong><p>@${esc(me.handle||me.username)}</p><span class="level-badge"><i></i> Trophy level ${Number(me.level||0).toLocaleString()}</span>${me.trackerLastSync?`<span class="psn-live-pill">● PUBLIC TRACKERS</span>`:`<span class="local-badge">LOCAL PROFILE</span>`}</div>`;
  $("#stat-strip").innerHTML=[
    ["Platinum",me.platinum,"platinum"],["Gold",me.gold,"gold"],["Silver",me.silver,"silver"],["Bronze",me.bronze,"bronze"],["Hours tracked",Number(me.hours||0).toLocaleString(),""]
  ].map(([l,v,c])=>`<div class="stat-card"><small>${l}</small><strong class="${c}">${v||0}</strong></div>`).join("");

  const ids=(me.library||[]).slice(0,12).map(x=>x.gameId);
  if(!ids.length){
    $("#recent-games").innerHTML=`<div class="empty tracked-empty"><strong>No tracked games yet</strong><span>Import your public PSN tracker data and PulseStation will build this rail from games actually attached to your profile.</span><button class="primary-button" data-import-profile>Import my PSN games</button></div>`;
  }else{
    $("#recent-games").innerHTML=ids.map(id=>{
      const g=game(id);if(!g)return"";const li=libItem(g.id);
      return `<button class="game-card" data-open-game="${g.id}" style="--game-cover:${g.cover};--game-accent:${g.accent}">
        <span class="demo-tag ${g.source==="tracker"?"live-tag":""}">${g.source==="tracker"?"YOUR PSN DATA":"YOUR LIBRARY"}</span>
        <div class="game-card-content"><h3>${esc(g.title)}</h3><p>${Number(li?.hours||0).toLocaleString()} hours • ${Math.round(li?.progress||0)}%</p><div class="progress-line"><span style="width:${li?.progress||0}%"></span></div><div class="game-card-meta"><span>${Math.round(li?.progress||0)}% complete</span><span>${li?.lastPlayed||"Tracked"}</span></div></div>
      </button>`;
    }).join("");
  }

  const synced=Boolean(me.trackerLastSync);
  $("#home-sync-summary").innerHTML=synced
    ? `<span><b>${(me.library||[]).filter(x=>String(x.gameId).startsWith("exophase-")||String(x.gameId).startsWith("tracker-")).length}</b> tracked games</span><span><b>${Number(me.platinum||0).toLocaleString()}</b> platinum</span><span><b>${Number(me.hours||0).toLocaleString()}</b> tracked hours</span><span><b>${new Date(me.trackerLastSync).toLocaleString("en-GB")}</b> last sync</span>`
    : `<span><b>Not synced yet</b> Add your PSN ID and pull in public tracker data.</span>`;
  $("#home-sync-button").textContent=me.psnShareUrl?(synced?"REFRESH PSN PROFILE":"SYNC LINKED PROFILE"):"CONNECT PSN PROFILE";
  $("#home-sync-note").textContent=synced?`${(me.trackerSources||[]).length} public source${(me.trackerSources||[]).length===1?"":"s"} connected`:"No Sony login required.";

  $("#home-parties").innerHTML=state.db.parties.slice(0,3).map(partyRow).join("")||`<div class="empty">No parties yet.</div>`;
  $("#activity-feed").innerHTML=state.db.activity.slice(0,6).map(activityRow).join("");
}
function partyRow(p){const g=game(p.gameId),host=user(p.hostId);return `<div class="party-row"><div class="game-token" style="--game-cover:${g?.cover||"var(--panel-hi)"}">${esc(g?.short||"PS")}</div><div class="party-row-copy"><strong>${esc(p.title)}</strong><small>${esc(g?.title||"Game")} • ${p.members.length}/${p.maxMembers}</small></div><div class="member-bubbles">${p.members.slice(0,3).map(id=>avatarHTML(user(id),"")).join("")}</div></div>`}
function activityRow(a){const u=user(a.userId)||{};return `<div class="activity-item">${avatarHTML(u,"avatar-sm")}<div class="activity-copy"><strong>${esc(u.displayName||u.handle||"Player")}</strong><p>${esc(a.title)}</p></div><time>${ago(a.createdAt)}</time></div>`}

function renderGames(){
  const catalogIds=new Set((window.PULSE_SEED?.games||[]).map(g=>g.id));
  let list=[];

  if(state.gameFilter==="owned"){
    const owned=new Set((state.me?.library||[]).map(x=>x.gameId));
    list=state.games.filter(g=>owned.has(g.id));
  }else if(state.gameFilter==="discover"){
    list=state.games.filter(g=>catalogIds.has(g.id));
  }else if(state.gameFilter==="backlog"){
    list=state.games.filter(g=>state.me?.backlog?.includes(g.id));
  }else if(state.gameFilter==="wishlist"){
    list=state.games.filter(g=>state.me?.wishlist?.includes(g.id));
  }

  if(!state.me && state.gameFilter!=="discover"){
    $("#games-grid").innerHTML=`<div class="empty tracked-empty"><strong>Create a local account first</strong><span>Your imported library is kept separate from the Discover recommendations.</span><button class="primary-button" data-create-account>Create account</button></div>`;
    return;
  }

  if(!list.length){
    const copy=state.gameFilter==="owned"
      ? `<strong>No PSN games imported yet</strong><span>My games now contains only games actually returned by your tracker import, plus games you deliberately add yourself.</span><button class="primary-button" data-import-profile>Import my PSN games</button>`
      : state.gameFilter==="discover"
        ? `<strong>No recommendations loaded</strong>`
        : `<strong>Nothing here yet</strong><span>Add games from My games or Discover.</span>`;
    $("#games-grid").innerHTML=`<div class="empty tracked-empty">${copy}</div>`;
    return;
  }

  $("#games-grid").innerHTML=list.map(g=>{
    const li=libItem(g.id),wish=state.me?.wishlist?.includes(g.id),back=state.me?.backlog?.includes(g.id);
    const label=g.source==="tracker"?"YOUR PSN DATA":li?"YOUR LIBRARY":"DISCOVER";
    return `<article class="library-card" style="--game-cover:${g.cover};--game-accent:${g.accent}">
      <button class="card-click-layer" data-open-game="${g.id}" aria-label="Open ${esc(g.title)}"></button>
      <span class="demo-tag ${g.source==="tracker"?"live-tag":""}">${label}</span>
      <div class="library-card-content"><span class="platform-pill">${esc(g.platform)}</span><h3>${esc(g.title)}</h3><p>${esc(g.genre)} ${li?`• ${Number(li.hours||0).toLocaleString()} hours`:""}</p><div class="progress-line"><span style="width:${li?.progress||0}%"></span></div><div class="library-card-foot"><span>${li?`${Math.round(li.progress||0)}% complete`:"Recommendation"}</span><span>${g.source==="tracker"?"TRACKED":g.trophyCount?`${g.trophyCount} trophies`:""}</span></div>
      <div class="game-action-row"><button data-game-action="library" data-game="${g.id}" class="${li?"active":""}">${li?"✓ Library":"+ Library"}</button><button data-game-action="backlog" data-game="${g.id}" class="${back?"active":""}">${back?"✓ Backlog":"+ Backlog"}</button><button data-game-action="wishlist" data-game="${g.id}" class="${wish?"active":""}">${wish?"♥ Wishlist":"♡ Wishlist"}</button></div></div>
    </article>`;
  }).join("");
}

function renderTrophies(){
  const me=state.me||{};
  $("#trophy-ring").innerHTML=`<strong>${me.platinum||0}</strong><span>PLATINUM</span>`;
  $("#trophy-summary").innerHTML=[["Platinum",me.platinum,"var(--platinum)"],["Gold",me.gold,"var(--gold)"],["Silver",me.silver,"var(--silver)"],["Bronze",me.bronze,"var(--bronze)"]].map(([l,v,c])=>`<div class="trophy-count"><b style="color:${c}">${v||0}</b><small>${l}</small></div>`).join("");
  let trophies=(me.pinnedTrophies||[]);
  if(!trophies.length)trophies=state.games.flatMap(g=>(g.trophies||[]).slice(0,1).map(t=>({...t,game:g.title}))).slice(0,8);
  $("#trophy-grid").innerHTML=trophies.map(t=>`<div class="trophy-card" style="--trophy-color:${({platinum:"var(--platinum)",gold:"var(--gold)",silver:"var(--silver)",bronze:"var(--bronze)"})[t.grade]||"var(--accent)"}"><div class="trophy-icon"></div><div><h3>${esc(t.name)}</h3><p>${esc(t.game||"Showcase")}</p><small>${esc(t.rarity||t.grade||"Pinned")}</small></div></div>`).join("");
  const sources=me.trackerSources||[];
  $("#tracker-source-panel").innerHTML=`<span class="eyebrow">PUBLIC DATA SOURCES</span><h3 style="margin:5px 0 4px">Tracker import status</h3><p style="color:var(--muted);font-size:11px">PulseStation never asks for your Sony password. These are public third-party profile pages.</p><div class="source-grid">${sources.length?sources.map(s=>`<div class="source-card"><strong>${esc(s.name)}</strong><p>Level ${s.fields?.level||"—"} • ${s.fields?.platinum||0} platinum • ${s.fields?.hours||0} hours</p><a href="${esc(s.url)}" target="_blank" rel="noopener">Open source ↗</a></div>`).join(""):`<div class="empty">No public tracker data imported yet.</div>`}</div>`;
}

function renderParties(){
  $("#party-grid").innerHTML=state.db.parties.map(p=>{
    const g=game(p.gameId),host=user(p.hostId),joined=state.me&&p.members.includes(state.me.id),full=p.members.length>=p.maxMembers;
    return `<article class="party-card"><div class="party-card-top"><div class="game-token" style="--game-cover:${g?.cover}">${esc(g?.short)}</div><div><span class="eyebrow">${esc(g?.title||"Game")}</span><h3>${esc(p.title)}</h3><p>Hosted by @${esc(host?.handle||host?.username||"player")}</p></div></div><div class="party-tags"><span class="tag">${esc(p.startsAt)}</span><span class="tag">${esc(p.mic)}</span><span class="tag">${esc(p.skill)}</span></div><div class="party-card-bottom"><div class="member-bubbles">${p.members.slice(0,6).map(id=>avatarHTML(user(id),"")).join("")}</div><button class="join-button" data-join-party="${p.id}" ${joined||full?"disabled":""}>${joined?"Joined":full?"Full":`Join • ${p.members.length}/${p.maxMembers}`}</button></div></article>`;
  }).join("");
}
function renderGroups(){
  $("#groups-grid").innerHTML=state.db.groups.map(gp=>{
    const g=game(gp.gameId),joined=state.me&&gp.members.includes(state.me.id);
    return `<article class="group-card"><div class="group-banner" style="--game-cover:${g?.cover}"></div><div class="group-body"><span class="eyebrow">${esc(g?.title||"Community")}</span><h3>${esc(gp.name)}</h3><p>${esc(gp.description)}</p><div class="group-foot"><small>${gp.members.length} members • ${esc(gp.visibility)}</small><div style="display:flex;gap:7px"><button class="join-button" data-open-group="${gp.id}">Open</button><button class="join-button" data-join-group="${gp.id}" ${joined?"disabled":""}>${joined?"Member":"Join"}</button></div></div></div></article>`;
  }).join("");
}

function renderMessages(){
  if(!state.me){$("#conversation-list").innerHTML=`<div class="empty">Create an account to use messages.</div>`;$("#chat-panel").innerHTML=`<div class="empty" style="margin:20px">Messages are stored locally on this device.</div>`;return}
  const others=state.db.users.filter(u=>u.id!==state.me.id);
  if(!state.activeConversation)state.activeConversation=others[0]?.id||null;
  $("#conversation-list").innerHTML=`<span class="eyebrow" style="padding:8px;display:block">CONVERSATIONS</span>`+others.map(u=>{
    const msgs=state.db.messages.filter(m=>(m.from===state.me.id&&m.to===u.id)||(m.from===u.id&&m.to===state.me.id)).sort((a,b)=>a.createdAt-b.createdAt);
    const last=msgs.at(-1);const unread=msgs.filter(m=>m.to===state.me.id&&!m.read).length;
    return `<button class="conversation-item ${state.activeConversation===u.id?"active":""}" data-conversation="${u.id}">${avatarHTML(u,"avatar-sm")}<span style="min-width:0;flex:1"><strong>${esc(u.displayName)} ${unread?`<b style="color:var(--danger)">• ${unread}</b>`:""}</strong><small>${esc(last?.body||"Start a conversation")}</small></span></button>`;
  }).join("");
  const other=user(state.activeConversation);
  if(!other){$("#chat-panel").innerHTML=`<div class="empty" style="margin:20px">No conversation selected.</div>`;return}
  Store.mutate(db=>db.messages.filter(m=>m.from===other.id&&m.to===state.me.id).forEach(m=>m.read=true));
  state.db=Store.read();
  const msgs=state.db.messages.filter(m=>(m.from===state.me.id&&m.to===other.id)||(m.from===other.id&&m.to===state.me.id)).sort((a,b)=>a.createdAt-b.createdAt);
  $("#chat-panel").innerHTML=`<div class="chat-head">${avatarHTML(other,"avatar-sm")}<span><strong>${esc(other.displayName)}</strong><small>@${esc(other.handle||other.username)}${other.isDemo?" • demo profile":""}</small></span></div><div class="chat-messages" id="chat-messages">${msgs.length?msgs.map(m=>`<div class="bubble ${m.from===state.me.id?"mine":""}">${esc(m.body)}<time>${new Date(m.createdAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</time></div>`).join(""):`<div class="empty">No messages yet.</div>`}</div><form class="chat-compose" id="message-form"><input name="body" maxlength="600" placeholder="Write a message…" autocomplete="off"><button>Send</button></form>`;
  setTimeout(()=>{$("#chat-messages")?.scrollTo({top:99999})},20);
  $("#message-form")?.addEventListener("submit",e=>{e.preventDefault();const input=e.currentTarget.body;const body=input.value.trim();if(!body)return;Store.mutate(db=>db.messages.push({id:Store.uid("msg"),from:state.me.id,to:other.id,body,createdAt:Date.now(),read:false}));input.value="";reload();renderMessages()});
}

function renderCommunity(){
  const users=state.db.users.filter(u=>u.id!==state.me?.id);
  $("#community-grid").innerHTML=users.map(u=>`<article class="player-card"><div class="player-head">${avatarHTML(u,"avatar-md")}<div><h3>${esc(u.displayName)}</h3><p>@${esc(u.handle||u.username)} • Level ${u.level||0}${u.isDemo?' <span class="local-badge">DEMO</span>':''}</p></div></div><p class="player-bio">${esc(u.bio||"PulseStation player")}</p><div class="mini-trophies"><span style="color:var(--platinum)">♜ ${u.platinum||0}</span><span style="color:var(--gold)">♜ ${u.gold||0}</span><span style="color:var(--silver)">♜ ${u.silver||0}</span><span style="color:var(--bronze)">♜ ${u.bronze||0}</span></div><div class="friend-actions"><button class="join-button" data-friend="${u.id}">${isFriend(u.id)?"✓ Friend":"+ Friend"}</button><button class="join-button" data-message-user="${u.id}">Message</button></div></article>`).join("");
  $("#community-activity").innerHTML=state.db.activity.slice(0,15).map(activityRow).join("");
}

function renderAll(){state.db=Store.read();state.me=Store.getCurrentUser(state.db);mergeImportedGames();renderChrome();renderHome();renderGames();renderTrophies();renderParties();renderGroups();renderMessages();renderCommunity();renderSocial();renderToolbox()}

function renderSocial(){
  // Reuse the existing local social systems, but render into the consolidated Social page.
  const partyTarget=$("#social-party-grid");
  if(partyTarget) partyTarget.innerHTML=state.db.parties.map(p=>{
    const g=game(p.gameId),host=user(p.hostId),joined=state.me&&p.members.includes(state.me.id),full=p.members.length>=p.maxMembers;
    return `<article class="party-card"><div class="party-card-top"><div class="game-token" style="--game-cover:${g?.cover}">${esc(g?.short||"PS")}</div><div><span class="eyebrow">${esc(g?.title||"Game")}</span><h3>${esc(p.title)}</h3><p>Hosted by @${esc(host?.handle||host?.username||"player")}</p></div></div><div class="party-tags"><span class="tag">${esc(p.startsAt)}</span><span class="tag">${esc(p.mic)}</span><span class="tag">${esc(p.skill)}</span></div><div class="party-card-bottom"><div class="member-bubbles">${p.members.slice(0,6).map(id=>avatarHTML(user(id),"")).join("")}</div><button class="join-button" data-join-party="${p.id}" ${joined||full?"disabled":""}>${joined?"Joined":full?"Full":`Join • ${p.members.length}/${p.maxMembers}`}</button></div></article>`;
  }).join("");

  const groupTarget=$("#social-groups-grid");
  if(groupTarget) groupTarget.innerHTML=state.db.groups.map(gp=>{
    const g=game(gp.gameId),joined=state.me&&gp.members.includes(state.me.id);
    return `<article class="group-card"><div class="group-banner" style="--game-cover:${g?.cover}"></div><div class="group-body"><span class="eyebrow">${esc(g?.title||"Community")}</span><h3>${esc(gp.name)}</h3><p>${esc(gp.description)}</p><div class="group-foot"><small>${gp.members.length} members • ${esc(gp.visibility)}</small><div style="display:flex;gap:7px"><button class="join-button" data-open-group="${gp.id}">Open</button><button class="join-button" data-join-group="${gp.id}" ${joined?"disabled":""}>${joined?"Member":"Join"}</button></div></div></div></article>`;
  }).join("");

  renderSocialMessages();
  renderSocialPlayers();
}

function renderSocialMessages(){
  const list=$("#social-conversation-list"),chat=$("#social-chat-panel");
  if(!list||!chat)return;
  if(!state.me){
    list.innerHTML=`<div class="empty">Create an account to use messages.</div>`;
    chat.innerHTML=`<div class="empty" style="margin:20px">Messages are stored locally on this device.</div>`;
    return;
  }
  const others=state.db.users.filter(u=>u.id!==state.me.id);
  if(!state.activeConversation) state.activeConversation=others[0]?.id||null;
  list.innerHTML=`<span class="eyebrow" style="padding:8px;display:block">CONVERSATIONS</span>`+others.map(u=>{
    const msgs=state.db.messages.filter(m=>(m.from===state.me.id&&m.to===u.id)||(m.from===u.id&&m.to===state.me.id)).sort((a,b)=>a.createdAt-b.createdAt);
    const last=msgs.at(-1);const unread=msgs.filter(m=>m.to===state.me.id&&!m.read).length;
    return `<button class="conversation-item ${state.activeConversation===u.id?"active":""}" data-social-conversation="${u.id}">${avatarHTML(u,"avatar-sm")}<span style="min-width:0;flex:1"><strong>${esc(u.displayName)} ${unread?`<b style="color:var(--danger)">• ${unread}</b>`:""}</strong><small>${esc(last?.body||"Start a conversation")}</small></span></button>`;
  }).join("");

  const other=user(state.activeConversation);
  if(!other){chat.innerHTML=`<div class="empty" style="margin:20px">No conversation selected.</div>`;return}
  Store.mutate(db=>db.messages.filter(m=>m.from===other.id&&m.to===state.me.id).forEach(m=>m.read=true));
  state.db=Store.read();
  const msgs=state.db.messages.filter(m=>(m.from===state.me.id&&m.to===other.id)||(m.from===other.id&&m.to===state.me.id)).sort((a,b)=>a.createdAt-b.createdAt);
  chat.innerHTML=`<div class="chat-head">${avatarHTML(other,"avatar-sm")}<span><strong>${esc(other.displayName)}</strong><small>@${esc(other.handle||other.username)}${other.isDemo?" • demo profile":""}</small></span></div><div class="chat-messages" id="social-chat-messages">${msgs.length?msgs.map(m=>`<div class="bubble ${m.from===state.me.id?"mine":""}">${esc(m.body)}<time>${new Date(m.createdAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</time></div>`).join(""):`<div class="empty">No messages yet.</div>`}</div><form class="chat-compose" id="social-message-form"><input name="body" maxlength="600" placeholder="Write a message…" autocomplete="off"><button>Send</button></form>`;
  $("#social-message-form")?.addEventListener("submit",e=>{
    e.preventDefault();const body=e.currentTarget.body.value.trim();if(!body)return;
    Store.mutate(db=>db.messages.push({id:Store.uid("msg"),from:state.me.id,to:other.id,body,createdAt:Date.now(),read:false}));
    e.currentTarget.body.value="";reload();renderSocialMessages();
  });
}

function renderSocialPlayers(){
  const grid=$("#social-community-grid"),feed=$("#social-community-activity");
  if(!grid||!feed)return;
  const users=state.db.users.filter(u=>u.id!==state.me?.id);
  grid.innerHTML=users.map(u=>`<article class="player-card"><div class="player-head">${avatarHTML(u,"avatar-md")}<div><h3>${esc(u.displayName)}</h3><p>@${esc(u.handle||u.username)} • Level ${u.level||0}${u.isDemo?' <span class="local-badge">DEMO</span>':''}</p></div></div><p class="player-bio">${esc(u.bio||"PulseStation player")}</p><div class="mini-trophies"><span style="color:var(--platinum)">♜ ${u.platinum||0}</span><span style="color:var(--gold)">♜ ${u.gold||0}</span><span style="color:var(--silver)">♜ ${u.silver||0}</span><span style="color:var(--bronze)">♜ ${u.bronze||0}</span></div><div class="friend-actions"><button class="join-button" data-friend="${u.id}">${isFriend(u.id)?"✓ Friend":"+ Friend"}</button><button class="join-button" data-social-message-user="${u.id}">Message</button></div></article>`).join("");
  feed.innerHTML=state.db.activity.slice(0,15).map(activityRow).join("");
}

function renderToolbox(){
  const me=state.me;
  const sync=$("#tool-sync-status");
  if(sync){
    sync.innerHTML=me?.trackerLastSync
      ? `<strong>${(me.library||[]).filter(x=>String(x.gameId).startsWith("exophase-")||String(x.gameId).startsWith("tracker-")).length} games imported</strong><span>Last synced ${new Date(me.trackerLastSync).toLocaleString("en-GB")}</span>`
      : `<strong>Not synced yet</strong><span>Add your PSN ID to build your real library.</span>`;
  }

  const opts=state.games.map(g=>`<option value="${g.id}">${esc(g.title)}</option>`).join("");
  if($("#planner-game-select")) $("#planner-game-select").innerHTML=opts;
  if($("#session-game-select")) $("#session-game-select").innerHTML=opts;

  if($("#planner-current")){
    const p=me?.platinumPlan;
    $("#planner-current").innerHTML=p?`<strong>${esc(game(p.gameId)?.title||"Game")}</strong><span>${esc(p.goal||"No goal set")}</span><small>${esc(p.notes||"")}</small>`:`<span>No platinum plan saved yet.</span>`;
  }

  if($("#plus-list")){
    $("#plus-list").innerHTML=(me?.plusClaims||[]).map((x,i)=>`<div class="mini-list-row"><span>${esc(x.title)}</span><button data-remove-plus="${i}">×</button></div>`).join("")||`<div class="empty">No claimed games tracked yet.</div>`;
  }

  if($("#session-list")){
    $("#session-list").innerHTML=(me?.sessionPlans||[]).map((x,i)=>`<div class="mini-list-row"><span><b>${esc(x.title)}</b><small>${esc(game(x.gameId)?.title||"Game")} • ${esc(x.when)}</small></span><button data-remove-session="${i}">×</button></div>`).join("")||`<div class="empty">No sessions planned.</div>`;
  }

  if($("#release-list")){
    $("#release-list").innerHTML=(me?.releaseWatch||[]).map((x,i)=>`<div class="mini-list-row"><span>${esc(x.title)}</span><button data-remove-release="${i}">×</button></div>`).join("")||`<div class="empty">No watched releases yet.</div>`;
  }

  const backlog=(me?.backlog||[]).map(id=>game(id)).filter(Boolean);
  if($("#roulette-result")){
    $("#roulette-result").textContent=backlog.length?`${backlog.length} games ready to roll.`:"Add games to your backlog first.";
  }
}

function openAuthModal(){
  openModal(`<div class="onboarding"><span class="eyebrow">LOCAL PULSESTATION ACCOUNT</span><h2>Welcome to PulseStation</h2><p class="modal-intro">Accounts live on this device, just like Berry Haven. Your PSN Online ID is only used to look for public tracker pages.</p><div class="auth-feature-grid"><div class="auth-feature"><b>No email</b>Username + password only.</div><div class="auth-feature"><b>No Sony login</b>Public profiles only.</div><div class="auth-feature"><b>GitHub Pages ready</b>No backend required.</div></div><div class="login-split"><button class="active" data-auth="register">Create account</button><button data-auth="login">Sign in</button></div><form id="auth-form"><div class="field"><label>PulseStation username</label><input name="username" value="" minlength="3" maxlength="24" required></div><div id="register-block"><div class="form-grid" style="margin-top:10px"><div class="field"><label>Display name</label><input name="displayName" maxlength="36"></div><div class="field"><label>PSN Online ID</label><input name="psnOnlineId" maxlength="32" placeholder="Your public PlayStation name"></div></div></div><div class="field" style="margin-top:10px"><label>Password</label><input type="password" name="password" minlength="8" required></div><label style="display:flex;gap:8px;align-items:center;color:var(--muted);font-size:10px;margin-top:10px"><input type="checkbox" name="remember" checked> Keep me signed in on this device</label><div id="auth-error" class="form-error"></div><div class="modal-actions"><button class="primary-button" style="width:100%">Create account</button></div></form><p class="backup-note">Because this is GitHub Pages, accounts are stored in your browser. Use Profile → Data vault to export a backup or move your data to another device.</p></div>`);
  let mode="register";
  $$("[data-auth]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.auth;$$("[data-auth]").forEach(x=>x.classList.toggle("active",x===b));$("#register-block").style.display=mode==="register"?"":"none";$("#auth-form button[type='submit'], #auth-form .primary-button").textContent=mode==="register"?"Create account":"Sign in"}));
  $("#auth-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{if(mode==="register"){const u=await Store.createAccount({username:f.get("username"),password:f.get("password"),displayName:f.get("displayName"),psnOnlineId:f.get("psnOnlineId")});Store.setCurrentUser(u.id,f.get("remember")==="on");closeModal();reload();toast("Account created");if(u.psnOnlineId)setTimeout(()=>openImportModal(),250)}else{await Store.login(f.get("username"),f.get("password"),f.get("remember")==="on");closeModal();reload();toast("Signed in")}}catch(err){$("#auth-error").textContent=err.message}});
}

function openProfile(){
  if(!requireAccount())return;
  const me=state.me;
  openModal(`<span class="eyebrow">PROFILE STUDIO</span><h2>Your PulseStation identity</h2><div class="profile-grid">${avatarHTML(me,"avatar-xl")}<div><h3 style="font-size:24px;margin:0">${esc(me.displayName)}</h3><p style="color:var(--muted);margin:4px 0">@${esc(me.handle||me.username)} • ${me.trackerLastSync?"Public tracker linked":"Local profile"}</p><div class="profile-stats-mini"><span>♜ ${me.platinum||0}<br>Plat</span><span>${me.level||0}<br>Level</span><span>${me.hours||0}<br>Hours</span><span>${me.friends?.length||0}<br>Friends</span></div></div></div><form id="profile-form"><div class="form-grid"><div class="field"><label>Display name</label><input name="displayName" value="${esc(me.displayName)}"></div><div class="field"><label>PSN Online ID</label><input name="psnOnlineId" value="${esc(me.psnOnlineId||"")}"></div><div class="field full"><label>Bio</label><textarea name="bio" maxlength="220">${esc(me.bio||"")}</textarea></div><div class="field full"><label>Avatar</label><div class="avatar-picker">${avatars.map(a=>`<button type="button" class="avatar-choice ${me.avatar===a?"active":""}" data-avatar="${a}">${avatarHTML({avatar:a},"avatar-md")}</button>`).join("")}</div></div><div class="field full"><label>Theme</label><div class="theme-picker">${Object.entries(themes).map(([k,v])=>`<button type="button" class="theme-choice ${me.theme===k?"active":""}" data-theme-choice="${k}" style="--sw1:${v[0]};--sw2:${v[1]}"><span>${k.toUpperCase()}</span></button>`).join("")}</div></div></div><input type="hidden" name="avatar" value="${me.avatar}"><input type="hidden" name="theme" value="${me.theme}"><div class="modal-actions"><button type="button" class="glass-button" id="import-public">Refresh trackers</button><button class="primary-button">Save profile</button></div></form><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><span class="eyebrow">DATA VAULT</span><div class="data-vault" style="margin-top:10px"><button id="export-data">Export backup</button><button id="import-data">Import backup</button><button id="switch-account">Switch / sign out</button></div><input type="file" id="backup-file" accept=".json,application/json" hidden>`);
  $$(".avatar-choice").forEach(b=>b.addEventListener("click",()=>{$$(".avatar-choice").forEach(x=>x.classList.remove("active"));b.classList.add("active");$('[name="avatar"]').value=b.dataset.avatar}));
  $$(".theme-choice").forEach(b=>b.addEventListener("click",()=>{$$(".theme-choice").forEach(x=>x.classList.remove("active"));b.classList.add("active");$('[name="theme"]').value=b.dataset.themeChoice;setTheme(b.dataset.themeChoice)}));
  $("#profile-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);Store.updateCurrent({displayName:f.get("displayName"),psnOnlineId:f.get("psnOnlineId"),handle:f.get("psnOnlineId")||state.me.username,bio:f.get("bio"),avatar:f.get("avatar"),theme:f.get("theme")});closeModal();reload();toast("Profile saved")});
  $("#import-public").addEventListener("click",openImportModal);
  $("#export-data").addEventListener("click",()=>{const blob=new Blob([Store.exportDb()],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`PulseStation-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)});
  $("#import-data").addEventListener("click",()=>$("#backup-file").click());
  $("#backup-file").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{Store.importDb(await file.text());closeModal();reload();toast("Backup imported. Sign in to a local account.")}catch(err){toast(err.message)}});
  $("#switch-account").addEventListener("click",()=>{Store.clearSession();closeModal();reload();openAuthModal()});
}

function openImportModal(){
  if(!requireAccount())return;

  const currentId=state.me.psnOnlineId||state.me.handle||"";
  const currentShare=state.me.psnShareUrl||"";

  openModal(`<span class="eyebrow">CONNECT PLAYSTATION PROFILE</span>
  <h2>Link once. Refresh whenever you want.</h2>
  <p class="modal-intro">Use PlayStation's own <b>Share Profile</b> QR/link for the cleanest connection. It gives PulseStation the official profile URL and Online ID without a Sony password.</p>

  <div class="link-method-tabs">
    <button class="chip active" type="button" data-link-method="qr">Scan QR</button>
    <button class="chip" type="button" data-link-method="link">Paste link</button>
    <button class="chip" type="button" data-link-method="manual">Online ID</button>
  </div>

  <div class="link-method-pane active" data-link-pane="qr">
    <div class="qr-connect-box">
      <div class="qr-icon">▦</div>
      <strong>Scan your PlayStation Share Profile QR</strong>
      <p>On PS5: Profile → Share Profile. Point this phone at the QR, or upload a screenshot of it.</p>
      <div class="qr-actions">
        <button class="primary-button" type="button" id="start-qr-camera">Open camera</button>
        <label class="glass-button qr-upload-label">Use screenshot<input type="file" id="qr-image-file" accept="image/*" hidden></label>
      </div>
      <video id="qr-video" class="qr-video" playsinline muted hidden></video>
      <div id="qr-status" class="qr-status">Waiting for a QR code.</div>
    </div>
  </div>

  <div class="link-method-pane" data-link-pane="link">
    <div class="field">
      <label>PlayStation Share Profile link</label>
      <input id="psn-share-link" value="${esc(currentShare)}" placeholder="https://profile.playstation.com/YourOnlineID">
    </div>
    <button class="primary-button" type="button" id="use-share-link" style="margin-top:10px">Link this profile</button>
  </div>

  <div class="link-method-pane" data-link-pane="manual">
    <div class="field">
      <label>PSN Online ID</label>
      <input id="manual-psn-id" value="${esc(currentId)}" maxlength="32">
    </div>
    <button class="primary-button" type="button" id="use-manual-id" style="margin-top:10px">Use this Online ID</button>
  </div>

  <details class="advanced-import">
    <summary>Tracker fallback</summary>
    <div class="field" style="margin-top:10px">
      <label>Exophase username/profile URL if different</label>
      <input id="exophase-hint" placeholder="Optional">
    </div>
  </details>

  <div class="linked-profile-preview" id="linked-profile-preview">
    ${currentShare?`<span class="official-psn-chip"><b>✓ Official PlayStation share link</b> @${esc(currentId)}</span>`:""}
  </div>
  <div class="import-progress" id="import-progress"></div>
  <div id="import-error" class="form-error"></div>

  <div class="modal-actions">
    <button class="primary-button" id="sync-linked-profile" type="button" ${currentId?"":"disabled"}>SYNC PUBLIC PROFILE DATA</button>
  </div>`);

  const progress=$("#import-progress");
  const errorBox=$("#import-error");
  let linked={
    onlineId:currentId,
    shareUrl:currentShare,
    official:Boolean(currentShare),
    inputType:currentShare?"playstation-share":"manual-id"
  };

  function selectMethod(method){
    $$("[data-link-method]").forEach(b=>b.classList.toggle("active",b.dataset.linkMethod===method));
    $$("[data-link-pane]").forEach(p=>p.classList.toggle("active",p.dataset.linkPane===method));
    if(method!=="qr")stopQrCamera();
  }

  $$("[data-link-method]").forEach(b=>b.addEventListener("click",()=>selectMethod(b.dataset.linkMethod)));

  function acceptIdentity(parsed){
    if(!parsed){
      errorBox.textContent="That does not look like a PlayStation Share Profile link or valid Online ID.";
      return false;
    }

    linked=parsed;
    Store.updateCurrent({
      psnOnlineId:parsed.onlineId,
      handle:parsed.onlineId,
      psnShareUrl:parsed.official?parsed.shareUrl:(state.me.psnShareUrl||""),
      psnLinkMethod:parsed.inputType,
      psnLinkDate:new Date().toISOString()
    });

    state.me=Store.getCurrentUser(Store.read());

    $("#linked-profile-preview").innerHTML=parsed.official
      ? `<span class="official-psn-chip"><b>✓ Official PlayStation share link</b> @${esc(parsed.onlineId)}</span><a href="${esc(parsed.shareUrl)}" target="_blank" rel="noopener">Open PlayStation profile ↗</a>`
      : `<span class="manual-psn-chip"><b>Online ID set</b> @${esc(parsed.onlineId)}</span>`;

    $("#sync-linked-profile").disabled=false;
    errorBox.textContent="";
    return true;
  }

  $("#use-share-link").addEventListener("click",()=>{
    acceptIdentity(Importer.parsePlayStationShare($("#psn-share-link").value));
  });

  $("#use-manual-id").addEventListener("click",()=>{
    acceptIdentity(Importer.parsePlayStationShare($("#manual-psn-id").value));
  });

  async function decodeBitmap(bitmap){
    if(!("BarcodeDetector" in window)){
      throw new Error("QR decoding is not supported by this browser. Paste the Share Profile link instead.");
    }
    const detector=new BarcodeDetector({formats:["qr_code"]});
    const codes=await detector.detect(bitmap);
    if(!codes.length)throw new Error("No QR code was found in that image.");
    const parsed=Importer.parsePlayStationShare(codes[0].rawValue||"");
    if(!parsed?.official)throw new Error("A QR was found, but it is not a PlayStation Share Profile QR.");
    acceptIdentity(parsed);
    $("#qr-status").textContent=`✓ Found @${parsed.onlineId}`;
    $("#psn-share-link").value=parsed.shareUrl;
    selectMethod("link");
  }

  $("#qr-image-file").addEventListener("change",async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    $("#qr-status").textContent="Reading screenshot…";
    try{
      const bitmap=await createImageBitmap(file);
      await decodeBitmap(bitmap);
      bitmap.close?.();
    }catch(err){
      $("#qr-status").textContent=err.message;
    }
  });

  $("#start-qr-camera").addEventListener("click",async()=>{
    const status=$("#qr-status");
    const video=$("#qr-video");

    if(!navigator.mediaDevices?.getUserMedia){
      status.textContent="Camera access is unavailable here. Use a screenshot or paste the Share Profile link.";
      return;
    }
    if(!("BarcodeDetector" in window)){
      status.textContent="This browser doesn't support live QR decoding. Use a screenshot or paste the link.";
      return;
    }

    try{
      stopQrCamera();
      pulseQrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
      video.srcObject=pulseQrStream;
      video.hidden=false;
      await video.play();
      status.textContent="Point the camera at the PlayStation QR…";

      const detector=new BarcodeDetector({formats:["qr_code"]});
      let active=true;

      const scan=async()=>{
        if(!pulseQrStream||!active)return;
        try{
          const codes=await detector.detect(video);
          if(codes.length){
            const parsed=Importer.parsePlayStationShare(codes[0].rawValue||"");
            if(parsed?.official){
              active=false;
              acceptIdentity(parsed);
              status.textContent=`✓ Found @${parsed.onlineId}`;
              $("#psn-share-link").value=parsed.shareUrl;
              stopQrCamera();
              video.hidden=true;
              selectMethod("link");
              return;
            }
          }
        }catch{}
        requestAnimationFrame(scan);
      };
      scan();
    }catch(err){
      status.textContent=`Camera couldn't start: ${err.message}`;
    }
  });

  $("#sync-linked-profile").addEventListener("click",async()=>{
    if(!linked?.onlineId){
      errorBox.textContent="Link or enter a PlayStation profile first.";
      return;
    }

    const button=$("#sync-linked-profile");
    button.disabled=true;
    button.textContent="SYNCING PUBLIC DATA…";
    progress.innerHTML="";
    errorBox.textContent="";

    try{
      const result=await Importer.importProfile(
        linked.onlineId,
        p=>{
          const key=String(p.name||"source").replace(/[^a-z0-9]/gi,"-");
          let row=$(`[data-progress="${key}"]`,progress);
          if(!row){
            row=document.createElement("div");
            row.className="import-row";
            row.dataset.progress=key;
            progress.appendChild(row);
          }
          const fallback=p.status==="checking"?"Checking…":p.status==="found"?"✓ Found":"Unavailable";
          row.innerHTML=`<span>${esc(p.name)}</span><span>${esc(p.detail||fallback)}</span>`;
        },
        {exophaseHint:$("#exophase-hint").value.trim()}
      );

      const importedGames=(result.games||[]).map(x=>({...x,id:trackerGameId(x)}));

      Store.mutate(db=>{
        const me=db.users.find(u=>u.id===state.me.id);
        me.psnOnlineId=linked.onlineId;
        me.handle=linked.onlineId;
        if(linked.official)me.psnShareUrl=linked.shareUrl;
        me.level=result.level||0;
        me.platinum=result.platinum||0;
        me.gold=result.gold||0;
        me.silver=result.silver||0;
        me.bronze=result.bronze||0;
        me.hours=result.hours||0;
        me.trackerAvatarUrl=result.avatarUrl||me.trackerAvatarUrl||"";
        me.trackerSources=result.sources||[];
        me.trackerLastSync=result.fetchedAt;
        me.trackerStatus="synced";
        me.importedGames=importedGames;

        const manual=(me.library||[]).filter(x=>!String(x.gameId||"").startsWith("exophase-")&&!String(x.gameId||"").startsWith("tracker-"));
        const tracked=importedGames.map(x=>({
          gameId:x.id,
          hours:Number(x.hours)||0,
          progress:Number(x.progress)||0,
          lastPlayed:x.lastPlayed?new Date(x.lastPlayed).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"Tracked"
        }));
        me.library=[...tracked,...manual];
      });

      Store.addActivity(state.me.id,"sync",`Synced public profile data for ${linked.onlineId}`);
      reload();

      progress.insertAdjacentHTML("afterbegin",`<div class="import-result-card"><strong>${importedGames.length} games imported</strong><span>Level ${result.level||"—"} • ${result.platinum||0} platinum • ${Number(result.hours||0).toLocaleString()} tracked hours</span><small>${result.sources.length} tracker source${result.sources.length===1?"":"s"} returned readable data.</small></div>`);

      button.disabled=false;
      button.textContent="OPEN MY GAMES";
      button.onclick=()=>{closeModal();state.gameFilter="owned";route("games");renderGames()};
    }catch(err){
      const linkedMsg=linked.official
        ? `<div class="link-success-box"><b>✓ PlayStation profile linked successfully</b><span>@${esc(linked.onlineId)}</span><small>Your official Share Profile URL is saved. The tracker refresh failed separately.</small></div>`
        : "";

      errorBox.innerHTML=`${linkedMsg}<div class="tracker-error-box"><b>Tracker sync couldn't complete.</b><span>${esc(err.message)}</span><small>This is a third-party reader/tracker access problem, not proof that your PSN profile is private.</small></div>`;
      button.disabled=false;
      button.textContent="TRY TRACKERS AGAIN";
      reload();
    }
  });
}

function openPartyModal(){
  if(!requireAccount())return;
  openModal(`<span class="eyebrow">CREATE PARTY</span><h2>Plan a game night</h2><form id="party-form"><div class="form-grid"><div class="field full"><label>Game</label><select name="gameId">${state.games.map(g=>`<option value="${g.id}">${esc(g.title)}</option>`).join("")}</select></div><div class="field full"><label>Party title</label><input name="title" value="Chill trophy run" maxlength="80"></div><div class="field"><label>Maximum players</label><input name="maxMembers" type="number" min="2" max="16" value="4"></div><div class="field"><label>Mic</label><select name="mic"><option>Preferred</option><option>Required</option><option>Optional</option><option>No mic</option></select></div><div class="field"><label>Skill</label><input name="skill" value="Any"></div><div class="field"><label>Starts</label><input name="startsAt" value="Tonight 21:30"></div></div><div class="modal-actions"><button class="primary-button">Create party</button></div></form>`);
  $("#party-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);Store.mutate(db=>db.parties.unshift({id:Store.uid("party"),gameId:f.get("gameId"),title:f.get("title"),hostId:state.me.id,members:[state.me.id],maxMembers:Number(f.get("maxMembers")),mic:f.get("mic"),skill:f.get("skill"),startsAt:f.get("startsAt"),createdAt:Date.now()}));Store.addActivity(state.me.id,"party",`Created party: ${f.get("title")}`,f.get("gameId"));closeModal();reload();toast("Party created")});
}
function openGroupModal(){
  if(!requireAccount())return;
  openModal(`<span class="eyebrow">CREATE GROUP</span><h2>Start a game community</h2><form id="group-form"><div class="form-grid"><div class="field full"><label>Game</label><select name="gameId">${state.games.map(g=>`<option value="${g.id}">${esc(g.title)}</option>`).join("")}</select></div><div class="field full"><label>Group name</label><input name="name" value="Platinum Hunters"></div><div class="field full"><label>Description</label><textarea name="description">Routes, tips and friendly sessions for players chasing 100%.</textarea></div><div class="field"><label>Visibility</label><select name="visibility"><option value="public">Public</option><option value="private">Private</option></select></div></div><div class="modal-actions"><button class="primary-button">Create group</button></div></form>`);
  $("#group-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);Store.mutate(db=>db.groups.unshift({id:Store.uid("group"),gameId:f.get("gameId"),name:f.get("name"),description:f.get("description"),ownerId:state.me.id,members:[state.me.id],visibility:f.get("visibility"),createdAt:Date.now()}));Store.addActivity(state.me.id,"group",`Created group: ${f.get("name")}`,f.get("gameId"));closeModal();reload();toast("Group created")});
}
function openGroup(id){
  const gp=state.db.groups.find(g=>g.id===id);if(!gp)return;const g=game(gp.gameId);const joined=state.me&&gp.members.includes(state.me.id);const msgs=state.db.groupMessages.filter(m=>m.groupId===id).sort((a,b)=>a.createdAt-b.createdAt);
  openModal(`<span class="eyebrow">${esc(g?.title||"GROUP")}</span><h2>${esc(gp.name)}</h2><p class="modal-intro">${esc(gp.description)}</p><div class="party-tags"><span class="tag">${gp.members.length} members</span><span class="tag">${esc(gp.visibility)}</span></div>${joined?`<div class="group-chat"><span class="eyebrow">GROUP CHAT</span><div class="group-chat-log">${msgs.length?msgs.map(m=>`<div class="group-chat-line"><b>${esc(user(m.userId)?.displayName||"Player")}:</b> ${esc(m.body)}</div>`).join(""):`<div class="empty">No group messages yet.</div>`}</div><form id="group-chat-form" class="chat-compose"><input name="body" placeholder="Post to the group…" maxlength="500"><button>Post</button></form></div>`:`<div class="tracker-banner">Join this group to post in group chat.</div>`}`);
  $("#group-chat-form")?.addEventListener("submit",e=>{e.preventDefault();const body=e.currentTarget.body.value.trim();if(!body)return;Store.mutate(db=>db.groupMessages.push({id:Store.uid("gmsg"),groupId:id,userId:state.me.id,body,createdAt:Date.now()}));openGroup(id);reload()});
}

async function openGame(id){
  const g=game(id);if(!g)return;state.selectedGame=g;route("game-detail");
  const reviews=state.db.reviews.filter(r=>r.gameId===g.id);
  const li=libItem(g.id);
  $("#game-detail").innerHTML=`<section class="game-detail-hero" style="--game-cover:${g.cover}"><span class="demo-tag ${g.source==="tracker"?"live-tag":""}">${g.source==="tracker"?"PUBLIC TRACKER":"COMMUNITY CATALOG"}</span><div class="game-detail-copy"><span class="eyebrow">${esc(g.platform)} • ${esc(g.genre)}</span><h2>${esc(g.title)}</h2><p>${esc(g.description)}</p><div class="game-detail-actions">${g.mapUrl?`<a class="glass-button" href="${esc(g.mapUrl)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">MapGenie ↗</a>`:""}<a class="glass-button" href="${esc(g.guideUrl||"https://psnprofiles.com/guides")}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">Trophy guides ↗</a><button class="glass-button" id="review-game">Write review</button></div></div></section><div class="detail-grid"><div class="panel"><div class="section-heading compact"><div><span class="eyebrow">TROPHY GUIDE</span><h2>Checklist</h2></div><small style="color:var(--muted)">${li?`${li.progress||0}% complete`:"Not tracked locally"}</small></div><div class="trophy-list">${g.trophies?.length?g.trophies.map(t=>`<div class="trophy-row" style="--trophy-color:${t.grade==="platinum"?"var(--platinum)":t.grade==="gold"?"var(--gold)":t.grade==="silver"?"var(--silver)":"var(--bronze)"}"><div class="trophy-icon"></div><div><h4>${esc(t.name)}</h4><p>${esc(t.tip)}</p></div><span class="rarity">${esc(t.rarity)}</span></div>`).join(""):`<div class="empty">Detailed trophies were not exposed by the public tracker import. Open the linked trophy guide for the full list.</div>`}</div></div><div class="stack"><div class="panel"><span class="eyebrow">YOUR TRACKING</span><h3 style="margin:5px 0 12px">Personal progress</h3><div class="form-grid"><div class="field"><label>Hours</label><input id="game-hours" type="number" value="${li?.hours||0}" min="0"></div><div class="field"><label>Completion %</label><input id="game-progress" type="number" value="${li?.progress||0}" min="0" max="100"></div></div><button class="soft-button" id="save-game-progress">Save progress</button></div><div class="panel"><span class="eyebrow">PLAYER REVIEWS</span><h3 style="margin:5px 0 4px">${reviews.length} local reviews</h3>${reviews.map(r=>`<div class="review"><div class="review-top"><div class="review-user">${avatarHTML(user(r.userId),"")}<strong>@${esc(user(r.userId)?.handle||"player")}</strong></div><span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</span></div><p>${esc(r.body)}</p></div>`).join("")||`<div class="empty">Be the first reviewer.</div>`}</div></div></div>`;
  $("#review-game").addEventListener("click",()=>openReview(g));
  $("#save-game-progress").addEventListener("click",()=>{if(!requireAccount())return;const hours=Math.max(0,Number($("#game-hours").value)||0),progress=Math.max(0,Math.min(100,Number($("#game-progress").value)||0));Store.mutate(db=>{const me=db.users.find(u=>u.id===state.me.id);let x=me.library.find(x=>x.gameId===g.id);if(!x){x={gameId:g.id,hours:0,progress:0,lastPlayed:"Today"};me.library.unshift(x)}x.hours=hours;x.progress=progress;x.lastPlayed="Today"});reload();openGame(g.id);toast("Game progress saved")});
}
function openReview(g){if(!requireAccount())return;openModal(`<span class="eyebrow">${esc(g.title)}</span><h2>Write a review</h2><form id="review-form"><div class="field"><label>Rating</label><select name="rating">${[5,4,3,2,1].map(n=>`<option value="${n}">${n} / 5</option>`).join("")}</select></div><div class="field" style="margin-top:12px"><label>Your review</label><textarea name="body" minlength="10" maxlength="1000" required></textarea></div><div class="modal-actions"><button class="primary-button">Publish review</button></div></form>`);$("#review-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);Store.mutate(db=>db.reviews.unshift({id:Store.uid("review"),gameId:g.id,userId:state.me.id,rating:Number(f.get("rating")),body:f.get("body"),createdAt:Date.now()}));Store.addActivity(state.me.id,"review",`Reviewed ${g.title}`,g.id);closeModal();reload();openGame(g.id);toast("Review published")})}

function openCompare(){
  const candidates=state.db.users.filter(u=>u.id!==state.me?.id);if(!requireAccount()||!candidates.length)return;
  openModal(`<span class="eyebrow">PROFILE COMPARISON</span><h2>Compare trophy profiles</h2><div class="field"><label>Compare with</label><select id="compare-select">${candidates.map(u=>`<option value="${u.id}">${esc(u.displayName)} (@${esc(u.handle||u.username)})</option>`).join("")}</select></div><div id="compare-view" style="margin-top:18px"></div>`);
  const render=()=>{const other=user($("#compare-select").value),me=state.me;$("#compare-view").innerHTML=`<div class="compare-grid"><div class="compare-player">${avatarHTML(me,"avatar-lg")}<h3>${esc(me.displayName)}</h3><p>@${esc(me.handle)}</p></div><div class="compare-vs">VS</div><div class="compare-player">${avatarHTML(other,"avatar-lg")}<h3>${esc(other.displayName)}</h3><p>@${esc(other.handle||other.username)}</p></div><table class="compare-table">${[["Trophy level",me.level,other.level],["Platinum",me.platinum,other.platinum],["Gold",me.gold,other.gold],["Silver",me.silver,other.silver],["Bronze",me.bronze,other.bronze],["Tracked hours",me.hours,other.hours]].map(([l,a,b])=>`<tr><td>${Number(a||0).toLocaleString()}</td><td>${l}</td><td style="text-align:right">${Number(b||0).toLocaleString()}</td></tr>`).join("")}</table></div>`};$("#compare-select").addEventListener("change",render);render();
}
function openNotifications(){
  if(!requireAccount())return;const notes=state.db.notifications.filter(n=>n.userId===state.me.id);Store.mutate(db=>db.notifications.filter(n=>n.userId===state.me.id).forEach(n=>n.read=true));openModal(`<span class="eyebrow">NOTIFICATIONS</span><h2>Your activity</h2><div class="notification-list">${notes.length?notes.map(n=>`<div class="notification"><strong>${esc(n.title)}</strong><p>${esc(n.body)} • ${ago(n.createdAt)}</p></div>`).join(""):`<div class="empty">Nothing new.</div>`}</div>`);reload();
}

document.addEventListener("click",e=>{
  if(e.target.closest("[data-import-profile]")){openImportModal();return}
  if(e.target.closest("[data-create-account]")){openAuthModal();return}
  const r=e.target.closest("[data-route]");if(r){route(r.dataset.route);return}
  const og=e.target.closest("[data-open-game]");if(og){openGame(og.dataset.openGame);return}
  const ga=e.target.closest("[data-game-action]");if(ga){if(!requireAccount())return;const id=ga.dataset.game,action=ga.dataset.gameAction;Store.mutate(db=>{const me=db.users.find(u=>u.id===state.me.id);if(action==="library"){const i=me.library.findIndex(x=>x.gameId===id);if(i>=0)me.library.splice(i,1);else me.library.unshift({gameId:id,hours:0,progress:0,lastPlayed:"Added today"})}else{const arr=action==="wishlist"?me.wishlist:me.backlog;const i=arr.indexOf(id);if(i>=0)arr.splice(i,1);else arr.unshift(id)}});reload();return}
  const jp=e.target.closest("[data-join-party]");if(jp){if(!requireAccount())return;Store.mutate(db=>{const p=db.parties.find(x=>x.id===jp.dataset.joinParty);if(p&&!p.members.includes(state.me.id)&&p.members.length<p.maxMembers)p.members.push(state.me.id)});reload();toast("Joined party");return}
  const jg=e.target.closest("[data-join-group]");if(jg){if(!requireAccount())return;Store.mutate(db=>{const g=db.groups.find(x=>x.id===jg.dataset.joinGroup);if(g&&!g.members.includes(state.me.id))g.members.push(state.me.id)});reload();toast("Joined group");return}
  const op=e.target.closest("[data-open-group]");if(op){openGroup(op.dataset.openGroup);return}
  const fr=e.target.closest("[data-friend]");if(fr){if(!requireAccount())return;const id=fr.dataset.friend;Store.mutate(db=>{const me=db.users.find(u=>u.id===state.me.id);const i=me.friends.indexOf(id);if(i>=0)me.friends.splice(i,1);else me.friends.push(id)});reload();return}
  const mu=e.target.closest("[data-message-user]");if(mu){if(!requireAccount())return;state.activeConversation=mu.dataset.messageUser;route("messages");return}
  const cv=e.target.closest("[data-conversation]");if(cv){state.activeConversation=cv.dataset.conversation;renderMessages();return}
});
$$("[data-game-filter]").forEach(b=>b.addEventListener("click",()=>{state.gameFilter=b.dataset.gameFilter;$$("[data-game-filter]").forEach(x=>x.classList.toggle("active",x===b));renderGames()}));
$("#profile-button").addEventListener("click",()=>state.me?openProfile():openAuthModal());
$("#hero-edit-profile").addEventListener("click",()=>state.me?openProfile():openAuthModal());
$("#open-sync").addEventListener("click",openImportModal);
$("#new-party").addEventListener("click",openPartyModal);
$("#new-group").addEventListener("click",openGroupModal);
$("#game-back").addEventListener("click",()=>route("games"));
$("#compare-profiles").addEventListener("click",openCompare);
$("#notification-button").addEventListener("click",openNotifications);
$("#modal-close").addEventListener("click",closeModal);
$("#modal-backdrop").addEventListener("click",e=>{if(e.target===e.currentTarget)closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
$("#global-search").addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();if(q.length<3)return;const g=state.games.find(g=>g.title.toLowerCase().includes(q));if(g)openGame(g.id)});
window.addEventListener("pulse:dbchange",()=>{state.db=Store.read()});


$("#home-sync-button")?.addEventListener("click",openImportModal);
$("#tool-sync-button")?.addEventListener("click",openImportModal);
$("#social-new-party")?.addEventListener("click",openPartyModal);
$("#social-new-group")?.addEventListener("click",openGroupModal);

$$("[data-social-tab]").forEach(b=>b.addEventListener("click",()=>{
  const tab=b.dataset.socialTab;
  $$("[data-social-tab]").forEach(x=>x.classList.toggle("active",x===b));
  $$("[data-social-pane]").forEach(x=>x.classList.toggle("active",x.dataset.socialPane===tab));
}));

document.addEventListener("click",e=>{
  const shortcut=e.target.closest("[data-tool-shortcut]");
  if(shortcut){
    route("toolbox");
    setTimeout(()=>document.querySelector(`#tool-${shortcut.dataset.toolShortcut}`)?.scrollIntoView({behavior:"smooth",block:"center"}),80);
    return;
  }
  const c=e.target.closest("[data-social-conversation]");
  if(c){state.activeConversation=c.dataset.socialConversation;renderSocialMessages();return}
  const mu=e.target.closest("[data-social-message-user]");
  if(mu){state.activeConversation=mu.dataset.socialMessageUser;route("social");$$("[data-social-tab]").forEach(x=>x.classList.toggle("active",x.dataset.socialTab==="messages"));$$("[data-social-pane]").forEach(x=>x.classList.toggle("active",x.dataset.socialPane==="messages"));renderSocialMessages();return}
  const rp=e.target.closest("[data-remove-plus]");
  if(rp&&state.me){Store.mutate(db=>db.users.find(u=>u.id===state.me.id).plusClaims.splice(Number(rp.dataset.removePlus),1));reload();renderToolbox();return}
  const rs=e.target.closest("[data-remove-session]");
  if(rs&&state.me){Store.mutate(db=>db.users.find(u=>u.id===state.me.id).sessionPlans.splice(Number(rs.dataset.removeSession),1));reload();renderToolbox();return}
  const rr=e.target.closest("[data-remove-release]");
  if(rr&&state.me){Store.mutate(db=>db.users.find(u=>u.id===state.me.id).releaseWatch.splice(Number(rr.dataset.removeRelease),1));reload();renderToolbox();return}
});

$("#roulette-button")?.addEventListener("click",()=>{
  if(!requireAccount())return;
  const backlog=(state.me.backlog||[]).map(id=>game(id)).filter(Boolean);
  if(!backlog.length){toast("Add some games to your backlog first.");return}
  const pick=backlog[Math.floor(Math.random()*backlog.length)];
  $("#roulette-result").innerHTML=`<strong>${esc(pick.title)}</strong><span>${esc(pick.platform)} • ${esc(pick.genre)}</span>`;
});

$("#platinum-planner-form")?.addEventListener("submit",e=>{
  e.preventDefault();if(!requireAccount())return;
  const f=new FormData(e.currentTarget);
  Store.updateCurrent({platinumPlan:{gameId:f.get("gameId"),goal:f.get("goal"),notes:f.get("notes"),updatedAt:Date.now()}});
  reload();renderToolbox();toast("Platinum plan saved");
});

$("#plus-form")?.addEventListener("submit",e=>{
  e.preventDefault();if(!requireAccount())return;
  const title=new FormData(e.currentTarget).get("title").trim();if(!title)return;
  Store.mutate(db=>db.users.find(u=>u.id===state.me.id).plusClaims.unshift({title,addedAt:Date.now()}));
  e.currentTarget.reset();reload();renderToolbox();
});

$("#session-form")?.addEventListener("submit",e=>{
  e.preventDefault();if(!requireAccount())return;
  const f=new FormData(e.currentTarget);
  Store.mutate(db=>db.users.find(u=>u.id===state.me.id).sessionPlans.unshift({title:f.get("title"),gameId:f.get("gameId"),when:f.get("when"),addedAt:Date.now()}));
  e.currentTarget.reset();reload();renderToolbox();toast("Session saved");
});

$("#release-form")?.addEventListener("submit",e=>{
  e.preventDefault();if(!requireAccount())return;
  const title=new FormData(e.currentTarget).get("title").trim();if(!title)return;
  Store.mutate(db=>db.users.find(u=>u.id===state.me.id).releaseWatch.unshift({title,addedAt:Date.now()}));
  e.currentTarget.reset();reload();renderToolbox();
});


if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
renderAll();
if(!state.me)setTimeout(()=>openAuthModal(),450);
