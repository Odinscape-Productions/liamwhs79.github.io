const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const Store=window.PulseStore;
const Importer=window.PSNPublicImporter;

const state={
  db:Store.read(), me:null, games:[...(window.PULSE_SEED?.games||[])],
  route:"home", selectedGame:null, gameFilter:"all", activeConversation:null
};

const themes={midnight:["#07111f","#3e8bff"],aurora:["#071817","#46e6b0"],void:["#0b0816","#9b75ff"],ember:["#1b0c08","#ff784d"],glacier:["#071319","#69d7ff"],sakura:["#180d19","#ff7fc1"]};
const avatars=["nova","vortex","prism","pulse","orbit","cipher","ember","glacier"];

function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function safeUrl(v=""){v=String(v||"").trim();return /^https?:\/\//i.test(v)?v.replace(/["'()\\]/g,""):""}
function toast(msg){const e=document.createElement("div");e.className="toast";e.textContent=msg;$("#toast-stack").appendChild(e);setTimeout(()=>e.remove(),4000)}
function ago(ts){const d=Math.max(0,Date.now()-Number(ts||Date.now()));const m=Math.floor(d/60000);if(m<1)return"now";if(m<60)return`${m}m`;const h=Math.floor(m/60);if(h<24)return`${h}h`;return`${Math.floor(h/24)}d`}
function openModal(html){$("#modal-content").innerHTML=html;$("#modal-backdrop").hidden=false;document.body.style.overflow="hidden"}
function closeModal(){$("#modal-backdrop").hidden=true;document.body.style.overflow=""}
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
function mergeImportedGames(){
  const imported=state.me?.importedGames||[];
  const existing=new Set(state.games.map(g=>g.id));
  for(const x of imported){
    const id=`tracker-${String(x.title).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)}`;
    if(existing.has(id))continue;
    state.games.push({id,title:x.title,short:x.title.split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase(),platform:"PSN",genre:"Tracked game",accent:"#5bd8ff",cover:"linear-gradient(145deg,#09172b,#153b68 55%,#3e8bff)",mapUrl:"",guideUrl:x.url||"https://psnprofiles.com/guides",trophyCount:0,description:`Imported from ${x.source||"a public trophy tracker"}.`,trophies:[],source:"tracker"});
    existing.add(id);
  }
}
function route(name){
  state.route=name;
  $$(".route").forEach(e=>e.classList.toggle("active",e.dataset.page===name));
  $$("[data-route]").forEach(e=>e.classList.toggle("active",e.dataset.route===name));
  const labels={home:["PLAYSTATION COMMUNITY HUB","Good evening"],games:["LIBRARY & DISCOVERY","Games"],trophies:["ACHIEVEMENTS","Trophies"],parties:["LOOKING FOR GROUP","Parties"],groups:["COMMUNITIES","Groups"],messages:["DIRECT MESSAGES","Messages"],community:["PLAYERS","Community"],"game-detail":["GAME HUB",state.selectedGame?.title||"Game"]};
  const l=labels[name]||labels.home;$("#page-kicker").textContent=l[0];$("#page-title").textContent=l[1];
  window.scrollTo({top:0,behavior:"smooth"});
  if(name==="messages")renderMessages();
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
  $("#open-sync").textContent=synced?"Refresh public PSN data":"Import public PSN data";

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

  const ids=(me.library||[]).slice(0,8).map(x=>x.gameId);
  const cards=(ids.length?ids:state.games.slice(0,6).map(g=>g.id)).map(id=>{
    const g=game(id);if(!g)return"";const li=libItem(g.id);
    return `<button class="game-card" data-open-game="${g.id}" style="--game-cover:${g.cover};--game-accent:${g.accent}">
      <span class="demo-tag ${g.source==="tracker"?"live-tag":""}">${g.source==="tracker"?"TRACKER":"COMMUNITY"}</span>
      <div class="game-card-content"><h3>${esc(g.title)}</h3><p>${li?`${li.hours||0} hours • ${li.progress||0}%`:`${esc(g.genre)} • ${g.platform}`}</p><div class="progress-line"><span style="width:${li?.progress||0}%"></span></div><div class="game-card-meta"><span>${li?.progress||0}% complete</span><span>${li?.lastPlayed||"Discover"}</span></div></div>
    </button>`;
  });
  $("#recent-games").innerHTML=cards.join("");

  $("#home-parties").innerHTML=state.db.parties.slice(0,3).map(partyRow).join("")||`<div class="empty">No parties yet.</div>`;
  $("#activity-feed").innerHTML=state.db.activity.slice(0,6).map(activityRow).join("");
}
function partyRow(p){const g=game(p.gameId),host=user(p.hostId);return `<div class="party-row"><div class="game-token" style="--game-cover:${g?.cover||"var(--panel-hi)"}">${esc(g?.short||"PS")}</div><div class="party-row-copy"><strong>${esc(p.title)}</strong><small>${esc(g?.title||"Game")} • ${p.members.length}/${p.maxMembers}</small></div><div class="member-bubbles">${p.members.slice(0,3).map(id=>avatarHTML(user(id),"")).join("")}</div></div>`}
function activityRow(a){const u=user(a.userId)||{};return `<div class="activity-item">${avatarHTML(u,"avatar-sm")}<div class="activity-copy"><strong>${esc(u.displayName||u.handle||"Player")}</strong><p>${esc(a.title)}</p></div><time>${ago(a.createdAt)}</time></div>`}

function renderGames(){
  let list=[...state.games];
  if(state.gameFilter==="owned")list=list.filter(g=>libItem(g.id));
  if(state.gameFilter==="backlog")list=list.filter(g=>state.me?.backlog?.includes(g.id));
  if(state.gameFilter==="wishlist")list=list.filter(g=>state.me?.wishlist?.includes(g.id));
  $("#games-grid").innerHTML=list.map(g=>{
    const li=libItem(g.id), wish=state.me?.wishlist?.includes(g.id),back=state.me?.backlog?.includes(g.id);
    return `<article class="library-card" style="--game-cover:${g.cover};--game-accent:${g.accent}">
      <button class="card-click-layer" data-open-game="${g.id}" aria-label="Open ${esc(g.title)}"></button>
      <span class="demo-tag ${g.source==="tracker"?"live-tag":""}">${g.source==="tracker"?"TRACKER":"CATALOG"}</span>
      <div class="library-card-content"><span class="platform-pill">${esc(g.platform)}</span><h3>${esc(g.title)}</h3><p>${esc(g.genre)} ${li?`• ${li.hours||0} hours`:""}</p><div class="progress-line"><span style="width:${li?.progress||0}%"></span></div><div class="library-card-foot"><span>${li?`${li.progress||0}% complete`:"Community game"}</span><span>${g.trophyCount?`${g.trophyCount} trophies`:"Tracked"}</span></div>
      <div class="game-action-row"><button data-game-action="library" data-game="${g.id}" class="${li?"active":""}">${li?"✓ Library":"+ Library"}</button><button data-game-action="backlog" data-game="${g.id}" class="${back?"active":""}">${back?"✓ Backlog":"+ Backlog"}</button><button data-game-action="wishlist" data-game="${g.id}" class="${wish?"active":""}">${wish?"♥ Wishlist":"♡ Wishlist"}</button></div></div>
    </article>`;
  }).join("")||`<div class="empty">Nothing in this view yet.</div>`;
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

function renderAll(){state.db=Store.read();state.me=Store.getCurrentUser(state.db);mergeImportedGames();renderChrome();renderHome();renderGames();renderTrophies();renderParties();renderGroups();renderMessages();renderCommunity()}
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
  const id=state.me.psnOnlineId||state.me.handle||"";
  openModal(`<span class="eyebrow">PUBLIC PSN PROFILE IMPORT</span><h2>Refresh public tracker data</h2><p class="modal-intro">PulseStation checks public profile pages only. It does not sign into Sony or receive your PlayStation password.</p><form id="import-form"><div class="field"><label>PSN Online ID</label><input name="onlineId" value="${esc(id)}" maxlength="32" required></div><div class="tracker-banner">Sources attempted: Exophase, PSNProfiles and TrueTrophies. A source may fail because the profile is private, untracked, rate-limited or blocks public reader access. Your local account still works regardless.</div><div class="import-progress" id="import-progress"><div class="import-row"><span>Ready</span><span>Enter your PSN ID</span></div></div><div id="import-error" class="form-error"></div><div class="modal-actions"><button class="primary-button" id="import-submit">Find public profile data</button></div></form>`);
  $("#import-form").addEventListener("submit",async e=>{e.preventDefault();const onlineId=new FormData(e.currentTarget).get("onlineId").trim();const progress=$("#import-progress");progress.innerHTML="";$("#import-submit").disabled=true;$("#import-submit").textContent="Checking trackers…";try{
    const result=await Importer.importProfile(onlineId,p=>{let row=$(`[data-progress="${p.name}"]`,progress);if(!row){row=document.createElement("div");row.className="import-row";row.dataset.progress=p.name;progress.appendChild(row)}row.innerHTML=`<span>${esc(p.name)}</span><span>${p.status==="checking"?"Checking…":p.status==="found"?"✓ Found":"Unavailable"}</span>`});
    const importedGames=result.games.map(g=>({title:g.title,url:g.url,source:g.source}));
    const patch={psnOnlineId:onlineId,handle:onlineId,level:result.level||state.me.level,platinum:result.platinum||state.me.platinum,gold:result.gold||state.me.gold,silver:result.silver||state.me.silver,bronze:result.bronze||state.me.bronze,hours:result.hours||state.me.hours,trackerAvatarUrl:result.avatarUrl||state.me.trackerAvatarUrl||"",trackerSources:result.sources,trackerLastSync:result.fetchedAt,trackerStatus:"synced",importedGames};
    Store.updateCurrent(patch);Store.addActivity(state.me.id,"sync",`Refreshed public PSN tracker data for ${onlineId}`);closeModal();reload();toast(`Public PSN data imported from ${result.sources.length} source${result.sources.length===1?"":"s"}.`);
  }catch(err){$("#import-error").textContent=`Could not import public data: ${err.message}`;$("#import-submit").disabled=false;$("#import-submit").textContent="Try again"}});
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

if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
renderAll();
if(!state.me)setTimeout(()=>openAuthModal(),450);
