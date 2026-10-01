// أدوات مشتركة: الاستجابات، كلمات المرور، الجلسات، تهيئة قاعدة البيانات
import { DDL, SCHEMA_VERSION, DEFAULT_SETTINGS } from './schema.js';
import { catalogRows, SEASONS, ARTICLES } from './seed.js';

export const COOKIE = 'nh_s';
const SESSION_DAYS = 14;

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...extra },
  });
}
export const bad = (msg, status = 400) => json({ error: msg }, status);

export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// ---------- كلمات المرور (PBKDF2-SHA256) ----------
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function tempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint8Array(10); crypto.getRandomValues(a);
  return [...a].map((x) => chars[x % chars.length]).join('');
}
export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}
export async function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false;
  const h = await hashPassword(password, salt);
  if (h.hash.length !== hash.length) return false;
  let diff = 0; for (let i = 0; i < hash.length; i++) diff |= h.hash.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

// ---------- الجلسات ----------
export function getCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
export function sessionCookie(token, maxAge = SESSION_DAYS * 86400) {
  return `${COOKIE}=${token}; Path=/marketing/hub; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export async function createSession(db, userId) {
  const token = randomToken();
  const exp = new Date(Date.now() + SESSION_DAYS * 86400e3).toISOString();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, exp).run();
  await db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(userId).run();
  return token;
}
export async function currentUser(db, request) {
  const token = getCookie(request, COOKIE);
  if (!token) return null;
  const row = await db.prepare(
    `SELECT u.id, u.name, u.email, u.role, u.title, u.must_change, u.active, u.commission_rate, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).bind(token).first();
  if (!row || !row.active || row.expires_at < new Date().toISOString()) return null;
  row.token = token;
  return row;
}

// ---------- تهيئة قاعدة البيانات ----------
let READY = false;
export async function ensureDb(db) {
  if (READY) return;
  let ver = null;
  try { ver = await db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").first('value'); } catch (_) { /* أول تشغيل */ }
  if (String(ver) !== String(SCHEMA_VERSION)) {
    await db.batch(DDL.map((s) => db.prepare(s)));
    const stmts = Object.entries(DEFAULT_SETTINGS).map(([k, v]) =>
      db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(k, v));
    stmts.push(db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)").bind(String(SCHEMA_VERSION)));
    await db.batch(stmts);
    await seedIfEmpty(db);
  }
  READY = true;
}

async function seedIfEmpty(db) {
  const n = await db.prepare('SELECT COUNT(*) AS n FROM catalog').first('n');
  if (!n) {
    const rows = catalogRows();
    await db.batch(rows.map((r) => db.prepare(
      `INSERT INTO catalog (kind, sector, code, name, months, monthly, price, unit, plan, delivery, details) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(r.kind, r.sector, r.code, r.name, r.months, r.monthly, r.price, r.unit, r.plan, r.delivery, r.details)));
  }
  const s = await db.prepare('SELECT COUNT(*) AS n FROM seasons').first('n');
  if (!s) {
    await db.batch(SEASONS.map(([name, date, sectors, notes]) =>
      db.prepare('INSERT INTO seasons (name, date, sectors, notes) VALUES (?,?,?,?)').bind(name, date, sectors, notes)));
  }
  const a = await db.prepare('SELECT COUNT(*) AS n FROM articles').first('n');
  if (!a) {
    await db.batch(ARTICLES.map(([cat, title, body]) =>
      db.prepare('INSERT INTO articles (category, title, body) VALUES (?,?,?)').bind(cat, title, body)));
  }
}

export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const o = {}; for (const r of results) o[r.key] = r.value; return o;
}

const COLS_CACHE = {};
export async function tableCols(db, table) {
  if (COLS_CACHE[table]) return COLS_CACHE[table];
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all();
  COLS_CACHE[table] = new Set(results.map((r) => r.name));
  return COLS_CACHE[table];
}

export async function audit(db, user, action, entity, id, detail) {
  try {
    await db.prepare('INSERT INTO audit (user_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?)')
      .bind(user?.id || null, action, entity, id || null, detail ? String(detail).slice(0, 500) : null).run();
  } catch (_) { /* لا يوقف العملية */ }
}

export async function nextNumber(db, table, prefix) {
  const y = new Date().getFullYear();
  const like = `${prefix}-${y}-%`;
  const last = await db.prepare(`SELECT number FROM ${table} WHERE number LIKE ? ORDER BY id DESC LIMIT 1`).bind(like).first('number');
  const n = last ? parseInt(String(last).split('-').pop(), 10) + 1 : 1;
  return `${prefix}-${y}-${String(n).padStart(4, '0')}`;
}

export const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // توقيت الرياض
export function addMonths(dateStr, m) {
  const d = new Date(dateStr + 'T00:00:00Z'); const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + m);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
