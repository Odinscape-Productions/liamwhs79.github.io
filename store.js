const fs = require("fs");
const path = require("path");

// Flat repository layout:
// - local development stores db.json beside server.js
// - Render persistent mode can set DATA_DIR=/var/data
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : __dirname;

const dbPath = path.join(dataDir, "db.json");

function ensureDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readDb() {
  ensureDir();
  if (!fs.existsSync(dbPath)) return null;
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDb(db) {
  ensureDir();
  const tmp = `${dbPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, dbPath);
  return db;
}

function updateDb(mutator) {
  const db = readDb();
  const next = mutator(db) || db;
  return writeDb(next);
}

module.exports = { readDb, writeDb, updateDb, dbPath };
