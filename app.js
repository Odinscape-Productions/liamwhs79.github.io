const state = {
  token: localStorage.getItem("pulse_token") || "",
  me: null,
  games: [],
  parties: [],
  groups: [],
  community: [],
  activity: [],
  demoData: true,
  selectedGame: null,
  gameFilter: "all"
};

const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => [...parent.querySelectorAll(sel)];

const themeSwatches = {
  midnight:["#07111f","#3e8bff"],
  aurora:["#071817","#46e6b0"],
  void:["#0b0816","#9b75ff"],
  ember:["#1b0c08","#ff784d"],
  glacier:["#071319","#69d7ff"],
  sakura:["#180d19","#ff7fc1"]
};
const avatars = ["nova","vortex","prism","pulse","orbit","cipher","ember","glacier"];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

async function api(path, options = {}) {
  const headers = { "Content-Type":"application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  $("#toast-stack").appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function avatarHTML(user, size = "avatar-md") {
  const avatar = user?.avatar || "nova";
  return `<div class="avatar ${avatar} ${size}"><span class="avatar-glyph"></span></div>`;
}

function gameById(id) {
  return state.games.find(g => g.id === id || g.slug === id);
}

function meLibrary(gameId) {
  return state.me?.library?.find(item => item.gameId === gameId);
}

function setTheme(theme) {
  document.body.dataset.theme = theme || "midnight";
}

function route(name) {
  $$(".route").forEach(el => el.classList.toggle("active", el.dataset.page === name));
  $$("[data-route]").forEach(el => el.classList.toggle("active", el.dataset.route === name));
  $$(".mobile-nav button").forEach(el => el.classList.toggle("active", el.dataset.route === name));

  const labels = {
    home:["YOUR PLAYSTATION COMMUNITY","Good evening"],
    games:["LIBRARY & DISCOVERY","Games"],
    trophies:["ACHIEVEMENTS","Trophies"],
    parties:["LOOKING FOR GROUP","Parties"],
    groups:["COMMUNITIES","Game groups"],
    community:["PLAYERS","Community"],
    "game-detail":["GAME HUB",state.selectedGame?.title || "Game"]
  };
  const label = labels[name] || labels.home;
  $("#page-kicker").textContent = label[0];
  $("#page-title").textContent = label[1];
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openModal(html) {
  $("#modal-content").innerHTML = html;
  $("#modal-backdrop").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  $("#modal-backdrop").hidden = true;
  document.body.style.overflow = "";
}

function defaultGuest() {
  return {
    id:"guest", handle:"GUEST_PLAYER", displayName:"Guest Player",
    bio:"Sign in to create parties, join groups, review games and customise your profile.",
    avatar:"orbit", theme:"midnight", level:0, platinum:0,gold:0,silver:0,bronze:0,hours:0,
    dataSource:"demo", library:[]
  };
}

function renderChrome() {
  const me = state.me || defaultGuest();
  setTheme(me.theme);

  $("#profile-button").innerHTML = avatarHTML(me,"avatar-sm");
  $("#sidebar-user").innerHTML = `
    <button class="mini-user" id="side-profile-open" style="width:100%;border:0;background:none;color:inherit;text-align:left;padding:0">
      ${avatarHTML(me,"avatar-sm")}
      <span><strong>${escapeHtml(me.displayName)}</strong><small>@${escapeHtml(me.handle)}</small></span>
    </button>
  `;
  $("#side-profile-open")?.addEventListener("click", openProfileSettings);

  const isPsn = me.dataSource === "psn-provider";
  $("#side-data-state").textContent = isPsn ? "PSN provider linked" : (state.demoData ? "Demo stats active" : "Local account");
  $("#side-data-copy").textContent = isPsn ? "Synced through your configured provider." : "Seeded PlayStation stats are clearly labelled.";
  $("#demo-badge").style.display = state.demoData && !isPsn ? "" : "none";
}

function renderHome() {
  const me = state.me || defaultGuest();
  $("#hero-player").innerHTML = `
    <div class="profile-orbit">
      ${avatarHTML(me,"avatar-xl")}
      <strong>${escapeHtml(me.displayName)}</strong>
      <p>@${escapeHtml(me.handle)}</p>
      <span class="level-badge"><i></i> Trophy level ${Number(me.level || 0).toLocaleString()}</span>
    </div>
  `;

  const stats = [
    ["Platinum",me.platinum,"platinum"],
    ["Gold",me.gold,"gold"],
    ["Silver",me.silver,"silver"],
    ["Bronze",me.bronze,"bronze"],
    ["Hours played",Number(me.hours || 0).toLocaleString(),""]
  ];
  $("#stat-strip").innerHTML = stats.map(([label,val,cls]) => `
    <div class="stat-card"><small>${label}</small><strong class="${cls}">${val}</strong></div>
  `).join("");

  const recent = (me.library?.length ? me.library : [
    {gameId:"ghost-yotei",hours:118,progress:82,trophies:43,lastPlayed:"Today"},
    {gameId:"helldivers-2",hours:246,progress:61,trophies:24,lastPlayed:"Yesterday"},
    {gameId:"spider-man-2",hours:73,progress:100,trophies:42,lastPlayed:"3 days ago"},
    {gameId:"astro-bot",hours:41,progress:76,trophies:34,lastPlayed:"1 week ago"}
  ]).slice(0,5);

  $("#recent-games").innerHTML = recent.map(item => {
    const game = gameById(item.gameId);
    if (!game) return "";
    return `
      <button class="game-card" data-open-game="${game.slug}" style="--game-cover:${game.cover};--game-accent:${game.accent}">
        ${state.demoData && me.dataSource !== "psn-provider" ? `<span class="demo-tag">DEMO DATA</span>` : ""}
        <div class="game-card-content">
          <h3>${escapeHtml(game.title)}</h3>
          <p>${item.hours} hours • ${item.trophies}/${game.trophyCount} trophies</p>
          <div class="progress-line"><span style="width:${item.progress}%"></span></div>
          <div class="game-card-meta"><span>${item.progress}% complete</span><span>${escapeHtml(item.lastPlayed)}</span></div>
        </div>
      </button>`;
  }).join("");

  $("#home-parties").innerHTML = state.parties.slice(0,3).map(partyRowHTML).join("") || `<div class="empty">No open parties yet.</div>`;
  $("#activity-feed").innerHTML = state.activity.slice(0,5).map(activityHTML).join("");
}

function partyRowHTML(p) {
  return `
  <div class="party-row">
    <div class="game-token" style="--game-cover:${p.game?.cover || "var(--panel-hi)"}">${escapeHtml(p.game?.short || "GAME")}</div>
    <div class="party-row-copy"><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.game?.title || "")} • ${p.members.length}/${p.maxMembers}</small></div>
    <div class="member-bubbles">${(p.memberProfiles || []).slice(0,3).map(u => avatarHTML(u,"")).join("")}</div>
  </div>`;
}

function activityHTML(a) {
  const user = a.user || {};
  return `
    <div class="activity-item">
      ${avatarHTML(user,"avatar-sm")}
      <div class="activity-copy"><strong>${escapeHtml(user.displayName || user.handle || "Player")}</strong><p>${escapeHtml(a.title)}</p></div>
      <time>${escapeHtml(a.at || "")}</time>
    </div>`;
}

function renderGames() {
  let games = [...state.games];
  if (state.gameFilter === "owned") games = games.filter(g => meLibrary(g.id));
  if (state.gameFilter === "platinum") games = games.filter(g => meLibrary(g.id)?.progress >= 100);

  $("#games-grid").innerHTML = games.map(g => {
    const item = meLibrary(g.id);
    const progress = item?.progress ?? 0;
    return `
      <button class="library-card" data-open-game="${g.slug}" style="--game-cover:${g.cover};--game-accent:${g.accent}">
        ${state.demoData && state.me?.dataSource !== "psn-provider" ? `<span class="demo-tag">DEMO CATALOG</span>` : ""}
        <div class="library-card-content">
          <span class="platform-pill">${escapeHtml(g.platform)}</span>
          <h3>${escapeHtml(g.title)}</h3>
          <p>${escapeHtml(g.genre)} ${item ? `• ${item.hours} hours played` : "• Community game"}</p>
          <div class="progress-line"><span style="width:${progress}%"></span></div>
          <div class="library-card-foot"><span>${item ? `${item.trophies}/${g.trophyCount} trophies` : `${g.trophyCount} trophies`}</span><span>${progress}%</span></div>
        </div>
      </button>`;
  }).join("") || `<div class="empty">Nothing matches this filter yet.</div>`;
}

function trophyColor(grade) {
  return ({platinum:"var(--platinum)",gold:"var(--gold)",silver:"var(--silver)",bronze:"var(--bronze)"})[grade] || "var(--accent)";
}

function renderTrophies() {
  const me = state.me || defaultGuest();
  $("#trophy-ring").innerHTML = `<strong>${me.platinum || 0}</strong><span>PLATINUM</span>`;
  $("#trophy-summary").innerHTML = [
    ["Platinum",me.platinum,"var(--platinum)"],["Gold",me.gold,"var(--gold)"],
    ["Silver",me.silver,"var(--silver)"],["Bronze",me.bronze,"var(--bronze)"]
  ].map(([l,v,c]) => `<div class="trophy-count" style="border-top-color:${c}"><b style="color:${c}">${v || 0}</b><small>${l}</small></div>`).join("");

  const trophies = state.games.flatMap(g => g.trophies.filter(t => t.earned).map(t => ({...t,game:g}))).slice(0,9);
  $("#trophy-grid").innerHTML = trophies.map(t => `
    <div class="trophy-card" style="--trophy-color:${trophyColor(t.grade)}">
      <div class="trophy-icon"></div>
      <div><h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.game.title)}</p><small>${escapeHtml(t.rarity)} • ${escapeHtml(t.grade)}</small></div>
    </div>`).join("");
}

function renderParties() {
  $("#party-grid").innerHTML = state.parties.map(p => {
    const joined = p.members.includes(state.me?.id);
    const full = p.members.length >= p.maxMembers;
    return `
      <article class="party-card">
        <div class="party-card-top">
          <div class="game-token" style="--game-cover:${p.game?.cover}">${escapeHtml(p.game?.short)}</div>
          <div><span class="eyebrow">${escapeHtml(p.game?.title)}</span><h3>${escapeHtml(p.title)}</h3><p>Hosted by @${escapeHtml(p.host?.handle || "player")}</p></div>
        </div>
        <div class="party-tags"><span class="tag">${escapeHtml(p.startsAt)}</span><span class="tag">${escapeHtml(p.mic)}</span><span class="tag">${escapeHtml(p.skill)}</span></div>
        <div class="party-card-bottom">
          <div class="member-bubbles">${p.memberProfiles.slice(0,6).map(u => avatarHTML(u,"")).join("")}</div>
          <button class="join-button" data-join-party="${p.id}" ${joined || full ? "disabled" : ""}>${joined ? "Joined" : full ? "Full" : `Join • ${p.members.length}/${p.maxMembers}`}</button>
        </div>
      </article>`;
  }).join("") || `<div class="empty">No parties yet. Create the first one.</div>`;
}

function renderGroups() {
  $("#groups-grid").innerHTML = state.groups.map(g => {
    const joined = g.members.includes(state.me?.id);
    return `
      <article class="group-card">
        <div class="group-banner" style="--game-cover:${g.game?.cover}"></div>
        <div class="group-body">
          <span class="eyebrow">${escapeHtml(g.game?.title)}</span>
          <h3>${escapeHtml(g.name)}</h3>
          <p>${escapeHtml(g.description)}</p>
          <div class="group-foot">
            <small>${g.members.length} members • ${escapeHtml(g.visibility)}</small>
            <button class="join-button" data-join-group="${g.id}" ${joined ? "disabled" : ""}>${joined ? "Member" : "Join group"}</button>
          </div>
        </div>
      </article>`;
  }).join("");
}

function renderCommunity() {
  $("#community-grid").innerHTML = state.community.map(u => `
    <article class="player-card">
      <div class="player-head">${avatarHTML(u,"avatar-md")}<div><h3>${escapeHtml(u.displayName)}</h3><p>@${escapeHtml(u.handle)} • Level ${u.level}</p></div></div>
      <p class="player-bio">${escapeHtml(u.bio)}</p>
      <div class="mini-trophies">
        <span style="color:var(--platinum)">♜ ${u.platinum}</span>
        <span style="color:var(--gold)">♜ ${u.gold}</span>
        <span style="color:var(--silver)">♜ ${u.silver}</span>
        <span style="color:var(--bronze)">♜ ${u.bronze}</span>
      </div>
    </article>
  `).join("");
  $("#community-activity").innerHTML = state.activity.slice(0,12).map(activityHTML).join("");
}

async function openGame(slug) {
  try {
    const data = await api(`/api/games/${encodeURIComponent(slug)}`);
    state.selectedGame = data.game;
    renderGameDetail(data);
    route("game-detail");
  } catch (err) { toast(err.message); }
}

function renderGameDetail(data) {
  const g = data.game;
  const lib = meLibrary(g.id);
  $("#game-detail").innerHTML = `
    <section class="game-detail-hero" style="--game-cover:${g.cover}">
      ${state.demoData && state.me?.dataSource !== "psn-provider" ? `<span class="demo-tag">DEMO GAME DATA</span>` : ""}
      <div class="game-detail-copy">
        <span class="eyebrow">${escapeHtml(g.platform)} • ${escapeHtml(g.genre)}</span>
        <h2>${escapeHtml(g.title)}</h2>
        <p>${escapeHtml(g.description)}</p>
        <div class="game-detail-actions">
          <button class="primary-button" data-detail-tab="trophies">${g.trophyCount} trophies</button>
          ${g.mapGenieUrl ? `<a class="glass-button" href="${escapeHtml(g.mapGenieUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;text-decoration:none">Open MapGenie ↗</a>` : ""}
          <button class="glass-button" id="review-game">Write review</button>
        </div>
      </div>
    </section>

    <div class="detail-grid">
      <div class="panel">
        <div class="section-heading compact"><div><span class="eyebrow">GUIDE + CHECKLIST</span><h2>Trophy list</h2></div><small style="color:var(--muted)">${lib ? `${lib.progress}% complete` : "Community guide"}</small></div>
        <div class="trophy-list">
          ${g.trophies.map(t => `
            <div class="trophy-row" style="--trophy-color:${trophyColor(t.grade)}">
              <div class="trophy-icon"></div>
              <div><h4>${escapeHtml(t.name)}</h4><p>${escapeHtml(t.tip)}</p></div>
              <span class="rarity">${escapeHtml(t.rarity)}</span>
            </div>`).join("")}
        </div>
      </div>

      <div class="stack">
        <div class="panel">
          <span class="eyebrow">ACTIVE PARTIES</span>
          <h3 style="margin:5px 0 12px">${data.parties.length} squads open</h3>
          <div class="stack">${data.parties.map(partyRowHTML).join("") || `<div class="empty">No parties for this game yet.</div>`}</div>
        </div>
        <div class="panel">
          <span class="eyebrow">PLAYER REVIEWS</span>
          <h3 style="margin:5px 0 4px">${data.reviews.length} community takes</h3>
          <div>${data.reviews.map(r => `
            <div class="review">
              <div class="review-top">
                <div class="review-user">${avatarHTML(r.user,"")}<strong>@${escapeHtml(r.user?.handle || "player")}</strong></div>
                <span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</span>
              </div>
              <p>${escapeHtml(r.body)}</p>
            </div>`).join("") || `<div class="empty">Be the first reviewer.</div>`}</div>
        </div>
      </div>
    </div>
  `;
  $("#review-game")?.addEventListener("click", () => openReviewModal(g));
}

function openProfileSettings() {
  if (!state.me) return openAuthModal();
  const me = state.me;
  openModal(`
    <span class="eyebrow">PROFILE STUDIO</span>
    <h2>Make it yours</h2>
    <p class="modal-intro">Choose an original avatar, change the entire app theme and control what your community profile says.</p>
    <form id="profile-form">
      <div class="form-grid">
        <div class="field"><label>Display name</label><input name="displayName" value="${escapeHtml(me.displayName)}" maxlength="36"></div>
        <div class="field"><label>Current game</label><select name="currentGame"><option value="">None</option>${state.games.map(g=>`<option value="${g.id}" ${me.currentGame===g.id?"selected":""}>${escapeHtml(g.title)}</option>`).join("")}</select></div>
        <div class="field full"><label>Bio</label><textarea name="bio" maxlength="220">${escapeHtml(me.bio)}</textarea></div>
        <div class="field full"><label>Avatar</label><div class="avatar-picker">${avatars.map(a => `<button type="button" class="avatar-choice ${me.avatar===a?"active":""}" data-avatar="${a}">${avatarHTML({avatar:a},"avatar-md")}</button>`).join("")}</div></div>
        <div class="field full"><label>Theme</label><div class="theme-picker">${Object.entries(themeSwatches).map(([k,v]) => `<button type="button" class="theme-choice ${me.theme===k?"active":""}" data-theme-choice="${k}" style="--sw1:${v[0]};--sw2:${v[1]}"><span>${k.toUpperCase()}</span></button>`).join("")}</div></div>
      </div>
      <input type="hidden" name="avatar" value="${me.avatar}">
      <input type="hidden" name="theme" value="${me.theme}">
      <div class="modal-actions"><button type="button" class="glass-button" id="logout">Log out</button><button class="primary-button">Save profile</button></div>
    </form>
  `);

  $$(".avatar-choice").forEach(btn => btn.addEventListener("click", () => {
    $$(".avatar-choice").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
    $('[name="avatar"]').value = btn.dataset.avatar;
  }));
  $$(".theme-choice").forEach(btn => btn.addEventListener("click", () => {
    $$(".theme-choice").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
    $('[name="theme"]').value = btn.dataset.themeChoice;
    setTheme(btn.dataset.themeChoice);
  }));
  $("#logout").addEventListener("click", () => {
    localStorage.removeItem("pulse_token"); state.token=""; state.me=null; closeModal(); setTheme("midnight"); renderAll(); toast("Signed out");
  });
  $("#profile-form").addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const data = await api("/api/me/profile", {
        method:"PUT",
        body:JSON.stringify({
          displayName:fd.get("displayName"),
          bio:fd.get("bio"),
          avatar:fd.get("avatar"),
          theme:fd.get("theme"),
          currentGame:fd.get("currentGame") || null
        })
      });
      state.me=data.user; closeModal(); renderAll(); toast("Profile updated");
    } catch(err){ toast(err.message); }
  });
}

function openAuthModal() {
  openModal(`
    <span class="eyebrow">PULSESTATION ACCOUNT</span>
    <h2>Join the community</h2>
    <p class="modal-intro">App accounts are separate from PlayStation accounts. Never enter your PlayStation password here.</p>
    <div class="notice">Demo login: <b>liam@demo.local</b> / <b>Play1234!</b>. The trophy and playtime data is seeded demo content.</div>
    <div class="login-split"><button class="active" data-auth-tab="login">Sign in</button><button data-auth-tab="register">Create account</button></div>
    <form id="auth-form">
      <div id="register-fields" style="display:none">
        <div class="form-grid">
          <div class="field"><label>Display name</label><input name="displayName" value="Player One"></div>
          <div class="field"><label>Handle</label><input name="handle" value="PLAYER_ONE"></div>
        </div>
      </div>
      <div class="field" style="margin-top:10px"><label>Email</label><input type="email" name="email" value="liam@demo.local"></div>
      <div class="field" style="margin-top:10px"><label>Password</label><input type="password" name="password" value="Play1234!"></div>
      <div id="auth-error" class="form-error"></div>
      <div class="modal-actions"><button class="primary-button" style="width:100%">Continue</button></div>
    </form>
  `);
  let mode="login";
  $$("[data-auth-tab]").forEach(btn => btn.addEventListener("click", () => {
    mode=btn.dataset.authTab;
    $$("[data-auth-tab]").forEach(b=>b.classList.toggle("active",b===btn));
    $("#register-fields").style.display=mode==="register"?"":"none";
  }));
  $("#auth-form").addEventListener("submit", async e => {
    e.preventDefault(); $("#auth-error").textContent="";
    const fd=new FormData(e.currentTarget);
    const body={email:fd.get("email"),password:fd.get("password")};
    if(mode==="register"){body.displayName=fd.get("displayName");body.handle=fd.get("handle")}
    try{
      const data=await api(`/api/auth/${mode}`,{method:"POST",body:JSON.stringify(body)});
      state.token=data.token; state.me=data.user; localStorage.setItem("pulse_token",state.token);
      closeModal(); await load(); toast(mode==="login"?"Welcome back":"Account created");
    }catch(err){$("#auth-error").textContent=err.message}
  });
}

function openPartyModal() {
  if (!state.me) return openAuthModal();
  openModal(`
    <span class="eyebrow">CREATE PARTY</span><h2>Build a squad</h2>
    <p class="modal-intro">A lightweight LFG room that updates for everyone using the same backend.</p>
    <form id="party-form">
      <div class="form-grid">
        <div class="field full"><label>Game</label><select name="gameId">${state.games.map(g=>`<option value="${g.id}">${escapeHtml(g.title)}</option>`).join("")}</select></div>
        <div class="field full"><label>Party title</label><input name="title" value="Chill trophy run" maxlength="80"></div>
        <div class="field"><label>Maximum players</label><input name="maxMembers" type="number" min="2" max="16" value="4"></div>
        <div class="field"><label>Mic</label><select name="mic"><option>Preferred</option><option>Required</option><option>Optional</option><option>No mic</option></select></div>
        <div class="field"><label>Skill</label><input name="skill" value="Any"></div>
        <div class="field"><label>Starts</label><input name="startsAt" value="Tonight 21:30"></div>
      </div>
      <div class="modal-actions"><button class="primary-button">Create party</button></div>
    </form>
  `);
  $("#party-form").addEventListener("submit", async e => {
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    try{
      await api("/api/parties",{method:"POST",body:JSON.stringify({
        gameId:fd.get("gameId"),title:fd.get("title"),maxMembers:Number(fd.get("maxMembers")),
        mic:fd.get("mic"),skill:fd.get("skill"),startsAt:fd.get("startsAt")
      })});
      closeModal(); await refreshCommunityData(); renderAll(); toast("Party created");
    }catch(err){toast(err.message)}
  });
}

function openGroupModal() {
  if (!state.me) return openAuthModal();
  openModal(`
    <span class="eyebrow">CREATE GAME GROUP</span><h2>Start a community</h2>
    <form id="group-form">
      <div class="form-grid">
        <div class="field full"><label>Game</label><select name="gameId">${state.games.map(g=>`<option value="${g.id}">${escapeHtml(g.title)}</option>`).join("")}</select></div>
        <div class="field full"><label>Group name</label><input name="name" value="Platinum Hunters"></div>
        <div class="field full"><label>Description</label><textarea name="description">Routes, tips and friendly sessions for players chasing 100%.</textarea></div>
        <div class="field full"><label>Visibility</label><select name="visibility"><option value="public">Public</option><option value="private">Private</option></select></div>
      </div>
      <div class="modal-actions"><button class="primary-button">Create group</button></div>
    </form>
  `);
  $("#group-form").addEventListener("submit", async e => {
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    try{
      await api("/api/groups",{method:"POST",body:JSON.stringify(Object.fromEntries(fd.entries()))});
      closeModal(); await refreshCommunityData(); renderAll(); toast("Group created");
    }catch(err){toast(err.message)}
  });
}

function openReviewModal(game) {
  if (!state.me) return openAuthModal();
  openModal(`
    <span class="eyebrow">${escapeHtml(game.title)}</span><h2>Write a review</h2>
    <form id="review-form">
      <div class="field"><label>Rating</label><select name="rating">${[5,4,3,2,1].map(n=>`<option value="${n}">${n} / 5</option>`).join("")}</select></div>
      <div class="field" style="margin-top:12px"><label>Your review</label><textarea name="body" minlength="10" maxlength="1000" placeholder="What did you love? What should players know?"></textarea></div>
      <div class="modal-actions"><button class="primary-button">Publish review</button></div>
    </form>
  `);
  $("#review-form").addEventListener("submit", async e => {
    e.preventDefault();const fd=new FormData(e.currentTarget);
    try{
      await api(`/api/games/${game.slug}/reviews`,{method:"POST",body:JSON.stringify({rating:Number(fd.get("rating")),body:fd.get("body")})});
      closeModal(); await openGame(game.slug); toast("Review published");
    }catch(err){toast(err.message)}
  });
}

function openSyncModal() {
  if (!state.me) return openAuthModal();
  openModal(`
    <span class="eyebrow">REAL PLAYSTATION DATA</span><h2>Connect a PSN provider</h2>
    <p class="modal-intro">This starter does not pretend its demo stats are real. The backend has a provider boundary, but real syncing stays disabled until you configure an authorised integration.</p>
    <div class="notice"><b>Security rule:</b> never ask users for their PlayStation password. The supplied backend accepts only an Online ID and calls your configured server-side provider.</div>
    <form id="sync-form">
      <div class="field"><label>PSN Online ID</label><input name="onlineId" value="${escapeHtml(state.me.handle || "")}" maxlength="32"></div>
      <div id="sync-message" class="form-error"></div>
      <div class="modal-actions"><button class="primary-button">Try sync</button></div>
    </form>
  `);
  $("#sync-form").addEventListener("submit", async e => {
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    try{
      const data=await api("/api/psn/sync",{method:"POST",body:JSON.stringify({onlineId:fd.get("onlineId")})});
      state.me=data.user; $("#sync-message").className="form-success"; $("#sync-message").textContent="Sync complete."; renderAll();
    }catch(err){$("#sync-message").textContent=err.message}
  });
}

function renderAll() {
  renderChrome(); renderHome(); renderGames(); renderTrophies(); renderParties(); renderGroups(); renderCommunity();
}

async function refreshCommunityData() {
  const [parties,groups,community] = await Promise.all([
    api("/api/parties"), api("/api/groups"), api("/api/community")
  ]);
  state.parties=parties.parties; state.groups=groups.groups;
  state.community=community.users; state.activity=community.activity; state.demoData=community.demoData;
}

async function load() {
  const [status,games] = await Promise.all([api("/api/status"),api("/api/games")]);
  state.games=games.games; state.demoData=status.demoData;

  if(state.token){
    try{state.me=(await api("/api/me")).user}
    catch{localStorage.removeItem("pulse_token");state.token="";state.me=null}
  }
  await refreshCommunityData();
  renderAll();
}

document.addEventListener("click", async e => {
  const routeBtn=e.target.closest("[data-route]");
  if(routeBtn){route(routeBtn.dataset.route);return}

  const game=e.target.closest("[data-open-game]");
  if(game){openGame(game.dataset.openGame);return}

  const joinParty=e.target.closest("[data-join-party]");
  if(joinParty){
    if(!state.me)return openAuthModal();
    try{await api(`/api/parties/${joinParty.dataset.joinParty}/join`,{method:"POST"});await refreshCommunityData();renderAll();toast("Joined party")}
    catch(err){toast(err.message)}
    return;
  }

  const joinGroup=e.target.closest("[data-join-group]");
  if(joinGroup){
    if(!state.me)return openAuthModal();
    try{await api(`/api/groups/${joinGroup.dataset.joinGroup}/join`,{method:"POST"});await refreshCommunityData();renderAll();toast("Joined group")}
    catch(err){toast(err.message)}
    return;
  }
});

$$("[data-game-filter]").forEach(btn=>btn.addEventListener("click",()=>{
  state.gameFilter=btn.dataset.gameFilter;
  $$("[data-game-filter]").forEach(b=>b.classList.toggle("active",b===btn));
  renderGames();
}));

$("#profile-button").addEventListener("click",openProfileSettings);
$("#hero-edit-profile").addEventListener("click",openProfileSettings);
$("#open-sync").addEventListener("click",openSyncModal);
$("#new-party").addEventListener("click",openPartyModal);
$("#new-group").addEventListener("click",openGroupModal);
$("#game-back").addEventListener("click",()=>route("games"));
$("#modal-close").addEventListener("click",closeModal);
$("#modal-backdrop").addEventListener("click",e=>{if(e.target===e.currentTarget)closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});

$("#global-search").addEventListener("input",e=>{
  const q=e.target.value.trim().toLowerCase();
  if(!q)return;
  const game=state.games.find(g=>g.title.toLowerCase().includes(q));
  if(game && q.length>=3) openGame(game.slug);
});

if(window.io){
  const socket=io();
  ["party:created","party:updated","group:created","group:updated","review:created","profile:updated"].forEach(evt=>{
    socket.on(evt,async()=>{try{await refreshCommunityData();renderAll()}catch{}});
  });
}

load().catch(err=>{
  console.error(err);
  toast("Backend unavailable. Start the Node server with npm run dev.");
});
