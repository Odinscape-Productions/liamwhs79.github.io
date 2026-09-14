require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { Server } = require("socket.io");

const { initStore, readDb, writeDb, updateDb, flushStore, closeStore } = require("./store");
const { seedIfNeeded } = require("./seed");
const { signToken, authRequired, authOptional } = require("./auth");
const { syncPsnProfile, getPsnTitleTrophies } = require("./psnProvider");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors:{ origin:process.env.APP_ORIGIN || true } });
const PORT = Number(process.env.PORT || 4173);
const publicDir = __dirname;

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy:{ directives:{
    defaultSrc:["'self'"], scriptSrc:["'self'","https://cdn.socket.io"],
    styleSrc:["'self'","'unsafe-inline'"], imgSrc:["'self'","data:","https:","http:"],
    connectSrc:["'self'","ws:","wss:"]
  }}
}));
app.use(cors({ origin:process.env.APP_ORIGIN || true }));
app.use(express.json({ limit:"1mb" }));

const authLimiter = rateLimit({ windowMs:60_000, limit:30, standardHeaders:true, legacyHeaders:false });
const psnLookupLimiter = rateLimit({ windowMs:60_000, limit:12, standardHeaders:true, legacyHeaders:false });
app.use("/api/auth", authLimiter);
app.use("/api/psn/lookup", psnLookupLimiter);

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, username, psnAccountId, psnTrophyTitles, psnSyncError, ...safe } = user;
  return safe;
}
function ownUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}
function getUser(db,id){ return db.users.find(u=>u.id===id); }
function gameFor(db,id){ return db.games.find(g=>g.id===id || g.slug===id); }
function slugify(value){ return String(value||"game").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"game"; }
function shortName(value){ return String(value||"PS").split(/\s+/).filter(Boolean).slice(0,3).map(x=>x[0]).join("").toUpperCase().slice(0,4); }
function totalTrophyObject(obj={}){ return Number(obj.bronze||0)+Number(obj.silver||0)+Number(obj.gold||0)+Number(obj.platinum||0); }
function humanLastPlayed(iso){
  if(!iso) return "PlayStation history";
  const diff=Math.max(0,Date.now()-new Date(iso).getTime());
  const h=Math.floor(diff/3600000), d=Math.floor(h/24);
  if(h<1)return "Just now"; if(h<24)return `${h}h ago`; if(d<7)return `${d}d ago`; return new Date(iso).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
}
function addActivity(db,userId,type,title,gameId=null){
  db.activity.unshift({id:randomUUID(),userId,type,title,gameId,at:"now",createdAt:new Date().toISOString()});
  db.activity=db.activity.slice(0,80);
}
function enrichParty(db,p){ return {...p,game:gameFor(db,p.gameId),host:publicUser(getUser(db,p.hostId)),memberProfiles:p.members.map(id=>publicUser(getUser(db,id))).filter(Boolean)}; }
function enrichGroup(db,g){ return {...g,game:gameFor(db,g.gameId),owner:publicUser(getUser(db,g.ownerId)),memberProfiles:g.members.map(id=>publicUser(getUser(db,id))).filter(Boolean)}; }

function mergePsnGames(db,user,psn){
  const library=[];
  for(const source of psn.games||[]){
    const stable=String(source.externalId||source.npCommunicationId||source.title);
    const id=`psn-${slugify(stable)}`;
    let game=db.games.find(g=>g.id===id);
    if(!game){
      game={
        id, slug:id, title:source.title, short:shortName(source.title), genre:"PlayStation",
        platform:String(source.platform||"PlayStation").replace(/_/g," ").toUpperCase(), accent:"#3e8bff",
        cover:"linear-gradient(145deg,#071a38,#0b4fa7 55%,#48a6ff)", imageUrl:source.imageUrl||null,
        mapGenieUrl:"", description:"Imported automatically from this player's PlayStation activity.",
        trophyCount:Number(source.trophyCount||0), trophies:[], source:"psn",
        npCommunicationId:source.npCommunicationId||null, npServiceName:source.npServiceName||null
      };
      db.games.unshift(game);
    } else {
      game.title=source.title||game.title; game.imageUrl=source.imageUrl||game.imageUrl;
      game.platform=String(source.platform||game.platform||"PlayStation").replace(/_/g," ").toUpperCase();
      game.trophyCount=Number(source.trophyCount||game.trophyCount||0);
      game.npCommunicationId=source.npCommunicationId||game.npCommunicationId;
      game.npServiceName=source.npServiceName||game.npServiceName;
    }
    library.push({
      gameId:id, hours:Number(source.hours||0), progress:Number(source.progress||0),
      trophies:Number(source.trophiesEarned||0), trophyCount:Number(source.trophyCount||0),
      lastPlayed:humanLastPlayed(source.lastPlayed), lastPlayedAt:source.lastPlayed||null,
      playCount:Number(source.playCount||0), source:"psn"
    });
  }
  user.library=library;
  user.hours=Math.round(library.reduce((sum,x)=>sum+Number(x.hours||0),0)*10)/10;
}

function applyPsnToUser(db,user,psn){
  user.handle=psn.onlineId; user.psnOnlineId=psn.onlineId; user.psnAccountId=psn.accountId;
  user.psnAvatarUrl=psn.avatarUrl||null; user.psnProfilePicUrl=psn.profilePicUrl||null;
  if(!user.displayName || user.displayName===user.handle) user.displayName=psn.onlineId;
  if(psn.aboutMe && (!user.bio || user.bio==="New to PulseStation.")) user.bio=psn.aboutMe;
  user.level=Number(psn.trophyLevel||0); user.trophyProgress=Number(psn.trophyProgress||0);
  user.platinum=Number(psn.trophies?.platinum||0); user.gold=Number(psn.trophies?.gold||0);
  user.silver=Number(psn.trophies?.silver||0); user.bronze=Number(psn.trophies?.bronze||0);
  user.psPlus=Boolean(psn.plus); user.psnRegion=psn.region||null; user.psnLanguages=psn.languages||[];
  user.psnOfficiallyVerified=Boolean(psn.officiallyVerified); user.psnFriendCount=psn.friendCount||null;
  user.psnPresence=psn.presence||null; user.psnTrophyTitles=psn.trophyTitles||[];
  user.psnLinked=true; user.psnVerified=false; user.dataSource="psn-live";
  user.psnLastSync=psn.fetchedAt||new Date().toISOString(); user.psnSyncStatus="synced";
  mergePsnGames(db,user,psn);
  if(user.library[0]) user.currentGame=user.library[0].gameId;
  return user;
}

async function tryPsnSync(db,user,onlineId){
  try{
    const psn=await syncPsnProfile({onlineId});
    applyPsnToUser(db,user,psn);
    return {ok:true,psn};
  }catch(err){
    user.psnSyncStatus="unavailable"; user.psnSyncError=err.message; user.psnLastSyncAttempt=new Date().toISOString();
    return {ok:false,error:err};
  }
}

const signInSchema=z.object({ username:z.string().min(3).max(24).regex(/^[A-Za-z0-9_-]+$/), password:z.string().min(8).max(100) });
const registrationSchema=z.object({
  username:z.string().min(3).max(24).regex(/^[A-Za-z0-9_-]+$/),
  psnOnlineId:z.string().min(3).max(16).regex(/^[A-Za-z0-9_-]+$/),
  displayName:z.string().min(1).max(36).optional().or(z.literal("")),
  password:z.string().min(8).max(100)
});

app.get("/api/status",(_req,res)=>{
  const db=readDb();
  res.json({ok:true,demoData:Boolean(db?.meta?.demoData),psnSyncMode:process.env.PSN_SYNC_MODE||"disabled",psnConfigured:Boolean(process.env.PSN_NPSSO),version:"2.0.0"});
});

app.post("/api/psn/lookup",async(req,res)=>{
  const parsed=z.object({onlineId:z.string().min(3).max(16).regex(/^[A-Za-z0-9_-]+$/)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Enter a valid PSN Online ID."});
  try{
    const psn=await syncPsnProfile({onlineId:parsed.data.onlineId});
    res.json({profile:{onlineId:psn.onlineId,avatarUrl:psn.avatarUrl,profilePicUrl:psn.profilePicUrl,aboutMe:psn.aboutMe,level:psn.trophyLevel,trophies:psn.trophies,plus:psn.plus,presence:psn.presence,games:psn.games.slice(0,6)},privacyNote:"Only data allowed by PlayStation privacy settings is returned."});
  }catch(err){
    const status=["PSN_SYNC_DISABLED","PSN_NOT_CONFIGURED"].includes(err.code)?503:404;
    res.status(status).json({error:err.message,code:err.code||"PSN_LOOKUP_FAILED"});
  }
});

app.post("/api/auth/register",async(req,res)=>{
  const parsed=registrationSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Use a valid PulseStation username, PSN Online ID and a password of at least 8 characters."});
  const db=readDb(); const onlineId=parsed.data.psnOnlineId; const username=parsed.data.username;
  if(db.users.some(u=>u.canLogin!==false && String(u.username||"").toLowerCase()===username.toLowerCase()))
    return res.status(409).json({error:"That PulseStation username is already taken."});
  const hasRealAccount=db.users.some(u=>u.canLogin!==false && u.passwordHash);
  const user={
    id:randomUUID(),username,passwordHash:await bcrypt.hash(parsed.data.password,12),canLogin:true,
    handle:onlineId,psnOnlineId:onlineId,displayName:parsed.data.displayName||onlineId,role:hasRealAccount?"member":"owner",
    bio:"New to PulseStation.",avatar:"nova",theme:"midnight",level:0,platinum:0,gold:0,silver:0,bronze:0,hours:0,
    psnLinked:false,psnVerified:false,psnSyncStatus:"pending",dataSource:"local",currentGame:null,library:[],createdAt:new Date().toISOString()
  };
  db.users.push(user);
  const synced=await tryPsnSync(db,user,onlineId);
  addActivity(db,user.id,"profile",`${user.handle} joined PulseStation`);
  if(synced.ok)addActivity(db,user.id,"sync","Imported PlayStation profile");
  writeDb(db);
  res.status(201).json({token:signToken(user),user:ownUser(user),psnImported:synced.ok,psnMessage:synced.ok?"PlayStation profile imported.":synced.error?.message});
});

app.post("/api/auth/login",async(req,res)=>{
  const parsed=signInSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Enter your PulseStation username and password."});
  const db=readDb();
  const user=db.users.find(u=>u.canLogin!==false && String(u.username||"").toLowerCase()===parsed.data.username.toLowerCase());
  if(!user || !user.passwordHash || !(await bcrypt.compare(parsed.data.password,user.passwordHash)))
    return res.status(401).json({error:"PulseStation username or password is incorrect."});
  if(process.env.PSN_AUTO_SYNC!=="false" && process.env.PSN_NPSSO){ await tryPsnSync(db,user,user.psnOnlineId||user.handle); writeDb(db); }
  res.json({token:signToken(user),user:ownUser(user)});
});

app.get("/api/me",authRequired,(req,res)=>{
  const db=readDb(); const user=getUser(db,req.auth.sub);
  if(!user)return res.status(404).json({error:"User not found."});
  res.json({user:ownUser(user)});
});

app.put("/api/me/profile",authRequired,(req,res)=>{
  const schema=z.object({displayName:z.string().min(1).max(36).optional(),bio:z.string().max(220).optional(),avatar:z.enum(["nova","vortex","prism","pulse","orbit","cipher","ember","glacier"]).optional(),theme:z.enum(["midnight","aurora","void","ember","glacier","sakura"]).optional(),currentGame:z.string().nullable().optional()});
  const parsed=schema.safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Invalid profile update."});
  let updated; updateDb(db=>{const user=getUser(db,req.auth.sub);Object.assign(user,parsed.data);addActivity(db,user.id,"profile","Updated profile identity");updated=ownUser(user);return db;});
  io.emit("profile:updated",publicUser(updated)); res.json({user:updated});
});

app.put("/api/me/password",authRequired,async(req,res)=>{
  const parsed=z.object({currentPassword:z.string().min(8),newPassword:z.string().min(8).max(100)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Passwords must be at least 8 characters."});
  const db=readDb(); const user=getUser(db,req.auth.sub);
  if(!user || !(await bcrypt.compare(parsed.data.currentPassword,user.passwordHash)))return res.status(401).json({error:"Current password is incorrect."});
  user.passwordHash=await bcrypt.hash(parsed.data.newPassword,12); writeDb(db); res.json({ok:true});
});

app.get("/api/community",authOptional,(_req,res)=>{
  const db=readDb(); res.json({demoData:Boolean(db.meta?.demoData),users:db.users.map(publicUser),activity:db.activity.map(a=>({...a,user:publicUser(getUser(db,a.userId)),game:gameFor(db,a.gameId)}))});
});
app.get("/api/users/:id",(req,res)=>{const db=readDb();const user=db.users.find(u=>u.id===req.params.id||String(u.handle).toLowerCase()===req.params.id.toLowerCase());if(!user)return res.status(404).json({error:"Profile not found."});res.json({user:publicUser(user)});});
app.get("/api/games",(_req,res)=>{const db=readDb();res.json({games:db.games,demoData:Boolean(db.meta?.demoData)});});

app.get("/api/games/:slug",authOptional,async(req,res)=>{
  const db=readDb(); const game=gameFor(db,req.params.slug); if(!game)return res.status(404).json({error:"Game not found."});
  let detailGame={...game};
  if(game.source==="psn" && game.npCommunicationId && req.auth){
    const user=getUser(db,req.auth.sub);
    if(user?.psnAccountId){
      try{ detailGame.trophies=await getPsnTitleTrophies({accountId:user.psnAccountId,npCommunicationId:game.npCommunicationId,npServiceName:game.npServiceName}); detailGame.trophyCount=detailGame.trophies.length||game.trophyCount; }
      catch{ /* keep summary if privacy/PSN unavailable */ }
    }
  }
  const reviews=db.reviews.filter(r=>r.gameId===game.id).map(r=>({...r,user:publicUser(getUser(db,r.userId))}));
  const parties=db.parties.filter(p=>p.gameId===game.id).map(p=>enrichParty(db,p));
  const groups=db.groups.filter(g=>g.gameId===game.id).map(g=>enrichGroup(db,g));
  res.json({game:detailGame,reviews,parties,groups});
});

app.post("/api/games/:slug/reviews",authRequired,(req,res)=>{
  const parsed=z.object({rating:z.number().int().min(1).max(5),body:z.string().min(10).max(1000)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Review needs a 1–5 rating and at least 10 characters."});
  const db=readDb();const game=gameFor(db,req.params.slug);if(!game)return res.status(404).json({error:"Game not found."});
  const review={id:randomUUID(),gameId:game.id,userId:req.auth.sub,rating:parsed.data.rating,body:parsed.data.body,createdAt:new Date().toISOString()};db.reviews.unshift(review);addActivity(db,req.auth.sub,"review",`Reviewed ${game.title}`,game.id);writeDb(db);
  const enriched={...review,user:publicUser(getUser(db,review.userId))};io.emit("review:created",enriched);res.status(201).json({review:enriched});
});

app.get("/api/parties",(_req,res)=>{const db=readDb();res.json({parties:db.parties.map(p=>enrichParty(db,p))});});
app.post("/api/parties",authRequired,(req,res)=>{
  const parsed=z.object({gameId:z.string(),title:z.string().min(3).max(80),maxMembers:z.number().int().min(2).max(16),mic:z.enum(["Required","Preferred","Optional","No mic"]),skill:z.string().min(1).max(32),startsAt:z.string().min(2).max(60)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Invalid party details."});
  const db=readDb();const game=gameFor(db,parsed.data.gameId);if(!game)return res.status(404).json({error:"Game not found."});const party={id:randomUUID(),...parsed.data,gameId:game.id,hostId:req.auth.sub,members:[req.auth.sub],status:"open",createdAt:new Date().toISOString()};db.parties.unshift(party);addActivity(db,req.auth.sub,"party",`Created party: ${party.title}`,game.id);writeDb(db);const enriched=enrichParty(db,party);io.emit("party:created",enriched);res.status(201).json({party:enriched});
});
app.post("/api/parties/:id/join",authRequired,(req,res)=>{const db=readDb();const party=db.parties.find(p=>p.id===req.params.id);if(!party)return res.status(404).json({error:"Party not found."});if(party.members.includes(req.auth.sub))return res.json({party:enrichParty(db,party)});if(party.members.length>=party.maxMembers)return res.status(409).json({error:"Party is full."});party.members.push(req.auth.sub);if(party.members.length>=party.maxMembers)party.status="full";addActivity(db,req.auth.sub,"party",`Joined ${party.title}`,party.gameId);writeDb(db);const enriched=enrichParty(db,party);io.emit("party:updated",enriched);res.json({party:enriched});});

app.get("/api/groups",(_req,res)=>{const db=readDb();res.json({groups:db.groups.map(g=>enrichGroup(db,g))});});
app.post("/api/groups",authRequired,(req,res)=>{const parsed=z.object({gameId:z.string(),name:z.string().min(3).max(60),description:z.string().min(8).max(240),visibility:z.enum(["public","private"])}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Invalid group details."});const db=readDb();const game=gameFor(db,parsed.data.gameId);if(!game)return res.status(404).json({error:"Game not found."});const group={id:randomUUID(),...parsed.data,gameId:game.id,ownerId:req.auth.sub,members:[req.auth.sub],createdAt:new Date().toISOString()};db.groups.unshift(group);addActivity(db,req.auth.sub,"group",`Created group: ${group.name}`,game.id);writeDb(db);const enriched=enrichGroup(db,group);io.emit("group:created",enriched);res.status(201).json({group:enriched});});
app.post("/api/groups/:id/join",authRequired,(req,res)=>{const db=readDb();const group=db.groups.find(g=>g.id===req.params.id);if(!group)return res.status(404).json({error:"Group not found."});if(group.visibility==="private"&&group.ownerId!==req.auth.sub)return res.status(403).json({error:"This group is private."});if(!group.members.includes(req.auth.sub))group.members.push(req.auth.sub);addActivity(db,req.auth.sub,"group",`Joined ${group.name}`,group.gameId);writeDb(db);const enriched=enrichGroup(db,group);io.emit("group:updated",enriched);res.json({group:enriched});});

app.post("/api/psn/sync",authRequired,async(req,res)=>{
  const db=readDb();const user=getUser(db,req.auth.sub);if(!user)return res.status(404).json({error:"User not found."});
  const onlineId=String(req.body?.onlineId||user.psnOnlineId||user.handle||"");
  const parsed=z.string().min(3).max(16).regex(/^[A-Za-z0-9_-]+$/).safeParse(onlineId);if(!parsed.success)return res.status(400).json({error:"Enter a valid PSN Online ID."});
  const result=await tryPsnSync(db,user,parsed.data);writeDb(db);
  if(!result.ok){const status=["PSN_SYNC_DISABLED","PSN_NOT_CONFIGURED"].includes(result.error.code)?503:502;return res.status(status).json({error:result.error.message,code:result.error.code||"PSN_SYNC_ERROR"});}
  addActivity(db,user.id,"sync","Refreshed PlayStation profile");writeDb(db);io.emit("profile:updated",publicUser(user));res.json({user:ownUser(user)});
});

// Flat repository, but only frontend assets are public. Never expose db.json, server source, or config files.
app.get("/styles.css",(_req,res)=>res.sendFile(path.join(publicDir,"styles.css")));
app.get("/app.js",(_req,res)=>res.sendFile(path.join(publicDir,"app.js")));
app.get(["/","/index.html"],(_req,res)=>res.sendFile(path.join(publicDir,"index.html")));
app.get("/{*splat}",(req,res,next)=>{if(req.path.startsWith("/api/") || req.path.startsWith("/socket.io/"))return next();res.sendFile(path.join(publicDir,"index.html"));});
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:"Unexpected server error."});});
io.on("connection",socket=>socket.emit("connected",{ok:true,at:new Date().toISOString()}));

(async()=>{
  await initStore();
  await seedIfNeeded(readDb);
  await flushStore();
  server.listen(PORT,"0.0.0.0",()=>console.log(`PulseStation running on 0.0.0.0:${PORT}`));
})();

async function shutdown(){ try{await closeStore();}finally{process.exit(0);} }
process.on("SIGTERM",shutdown);
process.on("SIGINT",shutdown);
