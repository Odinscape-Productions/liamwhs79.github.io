window.PulseStore = (() => {
  const KEY = "pulsestation_v5_database";
  const SESSION = "pulsestation_v5_session";

  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
  const clone = obj => JSON.parse(JSON.stringify(obj));

  function freshDb() {
    return {
      version:5,
      createdAt:new Date().toISOString(),
      users:clone(window.PULSE_SEED?.demoUsers || []),
      parties:clone(window.PULSE_SEED?.parties || []),
      groups:clone(window.PULSE_SEED?.groups || []),
      messages:[],
      groupMessages:[],
      reviews:[],
      activity:[
        {id:uid("act"),userId:"demo-sky",type:"party",title:"Opened a Helldivers 2 party",gameId:"helldivers-2",createdAt:Date.now()-1200000},
        {id:uid("act"),userId:"demo-moth",type:"trophy",title:"Added a new platinum to the cabinet",gameId:"astro-bot",createdAt:Date.now()-7200000}
      ],
      notifications:[],
      trackerCache:{},
      settings:{seeded:true}
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const db = freshDb();
        write(db);
        return db;
      }
      const db = JSON.parse(raw);
      if (!db || db.version !== 5) {
        const next = freshDb();
        if (db?.users) {
          const real = db.users.filter(u => !u.isDemo);
          next.users.push(...real);
        }
        write(next);
        return next;
      }
      return db;
    } catch {
      const db = freshDb();
      write(db);
      return db;
    }
  }

  function write(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
    window.dispatchEvent(new CustomEvent("pulse:dbchange"));
    return db;
  }

  function mutate(fn) {
    const db = read();
    const result = fn(db);
    write(db);
    return result;
  }

  function currentUserId() { return sessionStorage.getItem(SESSION) || localStorage.getItem(SESSION) || ""; }
  function setCurrentUser(id, remember=true) {
    sessionStorage.setItem(SESSION,id);
    if (remember) localStorage.setItem(SESSION,id); else localStorage.removeItem(SESSION);
  }
  function clearSession() { sessionStorage.removeItem(SESSION); localStorage.removeItem(SESSION); }

  async function hashPassword(password, salt) {
    const bytes = new TextEncoder().encode(`${salt}|${password}|PulseStation-v5`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }

  async function createAccount({username,password,displayName,psnOnlineId}) {
    username = username.trim();
    psnOnlineId = psnOnlineId.trim();
    const db = read();
    if (db.users.some(u => !u.isDemo && String(u.username).toLowerCase() === username.toLowerCase())) {
      throw new Error("That PulseStation username already exists on this device.");
    }
    const salt = uid("salt");
    const passwordHash = await hashPassword(password,salt);
    const user = {
      id:uid("user"), username, passwordHash, salt, displayName:displayName.trim() || psnOnlineId || username,
      psnOnlineId, handle:psnOnlineId || username, avatar:"nova", theme:"midnight",
      bio:"New to PulseStation.", level:0, platinum:0, gold:0, silver:0, bronze:0, hours:0,
      library:[], wishlist:[], backlog:[], friends:[], pinnedTrophies:[], trackerSources:[],
      trackerStatus:"not-synced", trackerLastSync:null, localAccount:true, isDemo:false,
      createdAt:new Date().toISOString()
    };
    db.users.push(user);
    db.activity.unshift({id:uid("act"),userId:user.id,type:"profile",title:`${user.handle} joined PulseStation`,createdAt:Date.now()});
    write(db);
    setCurrentUser(user.id,true);
    return user;
  }

  async function login(username,password,remember=true) {
    const db=read();
    const user=db.users.find(u=>!u.isDemo && String(u.username).toLowerCase()===String(username).trim().toLowerCase());
    if(!user) throw new Error("No local PulseStation account matches that username.");
    const hash=await hashPassword(password,user.salt);
    if(hash!==user.passwordHash) throw new Error("Incorrect password.");
    setCurrentUser(user.id,remember);
    return user;
  }

  function getCurrentUser(db=read()) { return db.users.find(u=>u.id===currentUserId()) || null; }
  function userById(id,db=read()) { return db.users.find(u=>u.id===id) || null; }

  function updateCurrent(patch) {
    return mutate(db=>{
      const user=userById(currentUserId(),db);
      if(!user) throw new Error("Sign in first.");
      Object.assign(user,patch);
      return user;
    });
  }

  function addActivity(userId,type,title,gameId=null) {
    mutate(db=>{
      db.activity.unshift({id:uid("act"),userId,type,title,gameId,createdAt:Date.now()});
      db.activity=db.activity.slice(0,120);
    });
  }

  function notify(userId,title,body,type="info") {
    mutate(db=>{
      db.notifications.unshift({id:uid("note"),userId,title,body,type,read:false,createdAt:Date.now()});
      db.notifications=db.notifications.slice(0,100);
    });
  }

  function exportDb() {
    const payload = {app:"PulseStation",version:5,exportedAt:new Date().toISOString(),db:read()};
    return JSON.stringify(payload,null,2);
  }

  function importDb(text) {
    const payload=JSON.parse(text);
    if(payload?.app!=="PulseStation" || !payload.db?.users) throw new Error("That is not a PulseStation backup.");
    const db=payload.db;
    db.version=5;
    write(db);
    clearSession();
    return db;
  }

  function reset() {
    localStorage.removeItem(KEY);
    clearSession();
    const db=freshDb();
    write(db);
    return db;
  }

  return {read,write,mutate,uid,currentUserId,setCurrentUser,clearSession,createAccount,login,getCurrentUser,userById,updateCurrent,addActivity,notify,exportDb,importDb,reset};
})();
