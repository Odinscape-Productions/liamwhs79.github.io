const fs = require("fs");
const path = require("path");

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const dbPath = path.join(dataDir, "db.json");
let memoryDb = null;
let pool = null;
let writeQueue = Promise.resolve();

function ensureDir() { fs.mkdirSync(dataDir, { recursive:true }); }

async function initStore() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require("pg");
    const databaseUrl = process.env.DATABASE_URL;
    const needsTls = /sslmode=require/i.test(databaseUrl);
    pool = new Pool({
      connectionString:databaseUrl,
      ssl:needsTls ? { rejectUnauthorized:false } : false,
      max:10,
      idleTimeoutMillis:30_000
    });
    await pool.query(`CREATE TABLE IF NOT EXISTS pulsestation_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const result = await pool.query("SELECT data FROM pulsestation_state WHERE id = 1");
    memoryDb = result.rows[0]?.data || null;
    return;
  }

  ensureDir();
  memoryDb = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath,"utf8")) : null;
}

function readDb() { return memoryDb; }

async function persistPostgres(snapshot) {
  await pool.query(
    `INSERT INTO pulsestation_state (id, data, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(snapshot)]
  );
}

function writeDb(db) {
  memoryDb = db;
  const snapshot = JSON.parse(JSON.stringify(db));
  if (pool) {
    writeQueue = writeQueue.then(() => persistPostgres(snapshot)).catch(err => console.error("Database persist failed:", err));
  } else {
    ensureDir();
    const tmp = `${dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot,null,2));
    fs.renameSync(tmp, dbPath);
  }
  return db;
}

function updateDb(mutator) {
  const next = mutator(memoryDb) || memoryDb;
  return writeDb(next);
}

async function flushStore() { await writeQueue; }
async function closeStore() { await flushStore(); if (pool) await pool.end(); }

module.exports = { initStore, readDb, writeDb, updateDb, flushStore, closeStore, dbPath };
