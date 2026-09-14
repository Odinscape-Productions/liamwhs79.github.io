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

const { readDb, writeDb, updateDb } = require("./store");
const { seedIfNeeded } = require("./seed");
const { signToken, authRequired, authOptional } = require("./auth");
const { syncPsnProfile } = require("./psnProvider");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.APP_ORIGIN || true }
});

const PORT = Number(process.env.PORT || 4173);
const publicDir = __dirname;

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.socket.io"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));
app.use(cors({ origin: process.env.APP_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth", authLimiter);

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, email, ...safe } = user;
  return safe;
}

function ownUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function getUser(db, id) {
  return db.users.find(u => u.id === id);
}

function gameFor(db, id) {
  return db.games.find(g => g.id === id || g.slug === id);
}

function enrichParty(db, p) {
  const game = gameFor(db, p.gameId);
  return {
    ...p,
    game,
    host: publicUser(getUser(db, p.hostId)),
    memberProfiles: p.members.map(id => publicUser(getUser(db, id))).filter(Boolean)
  };
}

function enrichGroup(db, g) {
  const game = gameFor(db, g.gameId);
  return {
    ...g,
    game,
    owner: publicUser(getUser(db, g.ownerId)),
    memberProfiles: g.members.map(id => publicUser(getUser(db, id))).filter(Boolean)
  };
}

function addActivity(db, userId, type, title, gameId = null) {
  db.activity.unshift({
    id: randomUUID(), userId, type, title, gameId,
    at: "now", createdAt: new Date().toISOString()
  });
  db.activity = db.activity.slice(0, 50);
}

const credentialsSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(8).max(100)
});

app.get("/api/status", (_req, res) => {
  const db = readDb();
  res.json({
    ok: true,
    demoData: Boolean(db?.meta?.demoData),
    psnSyncMode: process.env.PSN_SYNC_MODE || "disabled",
    version: "1.0.0"
  });
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = credentialsSchema.extend({
    handle: z.string().min(3).max(24).regex(/^[A-Za-z0-9_-]+$/),
    displayName: z.string().min(1).max(36)
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Please check the registration fields." });

  const db = readDb();
  const email = parsed.data.email.toLowerCase();
  const handleLower = parsed.data.handle.toLowerCase();

  if (db.users.some(u => u.email.toLowerCase() === email))
    return res.status(409).json({ error: "An account already uses that email." });

  if (db.users.some(u => u.handle.toLowerCase() === handleLower))
    return res.status(409).json({ error: "That handle is already taken." });

  const user = {
    id: randomUUID(),
    email,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    handle: parsed.data.handle,
    displayName: parsed.data.displayName,
    role: "member",
    bio: "New to PulseStation.",
    avatar: "nova",
    theme: "midnight",
    level: 1,
    platinum: 0, gold: 0, silver: 0, bronze: 0,
    hours: 0,
    psnLinked: false,
    dataSource: "local",
    currentGame: null,
    library: [],
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  addActivity(db, user.id, "profile", `${user.handle} joined the community`);
  writeDb(db);

  res.status(201).json({ token: signToken(user), user: ownUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid credentials." });

  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === parsed.data.email.toLowerCase());
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash)))
    return res.status(401).json({ error: "Email or password is incorrect." });

  res.json({ token: signToken(user), user: ownUser(user) });
});

app.get("/api/me", authRequired, (req, res) => {
  const db = readDb();
  const user = getUser(db, req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: ownUser(user) });
});

app.put("/api/me/profile", authRequired, (req, res) => {
  const schema = z.object({
    displayName: z.string().min(1).max(36).optional(),
    bio: z.string().max(220).optional(),
    avatar: z.enum(["nova","vortex","prism","pulse","orbit","cipher","ember","glacier"]).optional(),
    theme: z.enum(["midnight","aurora","void","ember","glacier","sakura"]).optional(),
    currentGame: z.string().nullable().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid profile update." });

  let updated;
  updateDb(db => {
    const user = getUser(db, req.auth.sub);
    Object.assign(user, parsed.data);
    addActivity(db, user.id, "profile", "Updated profile identity");
    updated = ownUser(user);
    return db;
  });

  io.emit("profile:updated", updated);
  res.json({ user: updated });
});

app.get("/api/community", authOptional, (_req, res) => {
  const db = readDb();
  res.json({
    demoData: Boolean(db.meta?.demoData),
    users: db.users.map(publicUser),
    activity: db.activity.map(a => ({
      ...a,
      user: publicUser(getUser(db, a.userId)),
      game: gameFor(db, a.gameId)
    }))
  });
});

app.get("/api/users/:id", (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.params.id || u.handle.toLowerCase() === req.params.id.toLowerCase());
  if (!user) return res.status(404).json({ error: "Profile not found." });
  res.json({ user: publicUser(user) });
});

app.get("/api/games", (_req, res) => {
  const db = readDb();
  res.json({ games: db.games, demoData: Boolean(db.meta?.demoData) });
});

app.get("/api/games/:slug", (req, res) => {
  const db = readDb();
  const game = gameFor(db, req.params.slug);
  if (!game) return res.status(404).json({ error: "Game not found." });

  const reviews = db.reviews
    .filter(r => r.gameId === game.id)
    .map(r => ({ ...r, user: publicUser(getUser(db, r.userId)) }));

  const parties = db.parties.filter(p => p.gameId === game.id).map(p => enrichParty(db, p));
  const groups = db.groups.filter(g => g.gameId === game.id).map(g => enrichGroup(db, g));
  res.json({ game, reviews, parties, groups });
});

app.post("/api/games/:slug/reviews", authRequired, (req, res) => {
  const parsed = z.object({
    rating: z.number().int().min(1).max(5),
    body: z.string().min(10).max(1000)
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Review needs a 1–5 rating and at least 10 characters." });

  const db = readDb();
  const game = gameFor(db, req.params.slug);
  if (!game) return res.status(404).json({ error: "Game not found." });

  const review = {
    id: randomUUID(), gameId: game.id, userId: req.auth.sub,
    rating: parsed.data.rating, body: parsed.data.body,
    createdAt: new Date().toISOString()
  };
  db.reviews.unshift(review);
  addActivity(db, req.auth.sub, "review", `Reviewed ${game.title}`, game.id);
  writeDb(db);

  const enriched = { ...review, user: publicUser(getUser(db, review.userId)) };
  io.emit("review:created", enriched);
  res.status(201).json({ review: enriched });
});

app.get("/api/parties", (_req, res) => {
  const db = readDb();
  res.json({ parties: db.parties.map(p => enrichParty(db, p)) });
});

app.post("/api/parties", authRequired, (req, res) => {
  const parsed = z.object({
    gameId: z.string(),
    title: z.string().min(3).max(80),
    maxMembers: z.number().int().min(2).max(16),
    mic: z.enum(["Required","Preferred","Optional","No mic"]),
    skill: z.string().min(1).max(32),
    startsAt: z.string().min(2).max(60)
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Invalid party details." });

  const db = readDb();
  const game = gameFor(db, parsed.data.gameId);
  if (!game) return res.status(404).json({ error: "Game not found." });

  const party = {
    id: randomUUID(), ...parsed.data, gameId: game.id,
    hostId: req.auth.sub, members:[req.auth.sub], status:"open",
    createdAt: new Date().toISOString()
  };

  db.parties.unshift(party);
  addActivity(db, req.auth.sub, "party", `Created party: ${party.title}`, game.id);
  writeDb(db);

  const enriched = enrichParty(db, party);
  io.emit("party:created", enriched);
  res.status(201).json({ party: enriched });
});

app.post("/api/parties/:id/join", authRequired, (req, res) => {
  const db = readDb();
  const party = db.parties.find(p => p.id === req.params.id);
  if (!party) return res.status(404).json({ error: "Party not found." });
  if (party.members.includes(req.auth.sub)) return res.json({ party: enrichParty(db, party) });
  if (party.members.length >= party.maxMembers) return res.status(409).json({ error: "Party is full." });

  party.members.push(req.auth.sub);
  if (party.members.length >= party.maxMembers) party.status = "full";
  addActivity(db, req.auth.sub, "party", `Joined ${party.title}`, party.gameId);
  writeDb(db);

  const enriched = enrichParty(db, party);
  io.emit("party:updated", enriched);
  res.json({ party: enriched });
});

app.get("/api/groups", (_req, res) => {
  const db = readDb();
  res.json({ groups: db.groups.map(g => enrichGroup(db, g)) });
});

app.post("/api/groups", authRequired, (req, res) => {
  const parsed = z.object({
    gameId: z.string(),
    name: z.string().min(3).max(60),
    description: z.string().min(8).max(240),
    visibility: z.enum(["public","private"])
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Invalid group details." });

  const db = readDb();
  const game = gameFor(db, parsed.data.gameId);
  if (!game) return res.status(404).json({ error: "Game not found." });

  const group = {
    id: randomUUID(), ...parsed.data, gameId:game.id,
    ownerId:req.auth.sub, members:[req.auth.sub], createdAt:new Date().toISOString()
  };
  db.groups.unshift(group);
  addActivity(db, req.auth.sub, "group", `Created group: ${group.name}`, game.id);
  writeDb(db);

  const enriched = enrichGroup(db, group);
  io.emit("group:created", enriched);
  res.status(201).json({ group: enriched });
});

app.post("/api/groups/:id/join", authRequired, (req, res) => {
  const db = readDb();
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.visibility === "private" && group.ownerId !== req.auth.sub)
    return res.status(403).json({ error: "This group is private." });

  if (!group.members.includes(req.auth.sub)) group.members.push(req.auth.sub);
  addActivity(db, req.auth.sub, "group", `Joined ${group.name}`, group.gameId);
  writeDb(db);

  const enriched = enrichGroup(db, group);
  io.emit("group:updated", enriched);
  res.json({ group: enriched });
});

app.post("/api/psn/sync", authRequired, async (req, res) => {
  const parsed = z.object({ onlineId: z.string().min(3).max(32) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid Online ID." });

  try {
    const psn = await syncPsnProfile({ onlineId: parsed.data.onlineId });

    let updated;
    updateDb(db => {
      const user = getUser(db, req.auth.sub);
      user.handle = psn.onlineId || user.handle;
      user.level = Number(psn.level || user.level);
      user.platinum = Number(psn.trophies?.platinum || 0);
      user.gold = Number(psn.trophies?.gold || 0);
      user.silver = Number(psn.trophies?.silver || 0);
      user.bronze = Number(psn.trophies?.bronze || 0);
      user.psnLinked = true;
      user.dataSource = "psn-provider";
      user.psnLastSync = new Date().toISOString();

      // A real integration should map provider title IDs to this app's game catalog.
      if (Array.isArray(psn.library)) {
        user.providerLibrary = psn.library;
      }
      addActivity(db, user.id, "sync", "Synced PlayStation profile");
      updated = ownUser(user);
      return db;
    });

    res.json({ user: updated });
  } catch (err) {
    const status = err.code === "PSN_SYNC_DISABLED" ? 503 : 502;
    res.status(status).json({
      error: err.message,
      code: err.code || "PSN_SYNC_ERROR",
      demoDataStillActive: true
    });
  }
});

app.use(express.static(publicDir));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

io.on("connection", socket => {
  socket.emit("connected", { ok:true, at:new Date().toISOString() });
});

(async () => {
  await seedIfNeeded(readDb);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`PulseStation running on 0.0.0.0:${PORT}`);
  });
})();
