// النسخ الاحتياطي اليومي لقاعدة المنصة (المرحلة 2 — الخطوة 6أ، v13)
// نسخة JSON كاملة لكل الجداول، مضغوطة gzip، ومقسّمة على صفوف `backup_chunks` (حد الصف في D1 ≈ 2MB) فلا يحدّها حجم القاعدة ولا تحتاج R2.
// تُستثنى الأسرار: كلمات المرور وبصماتها، الجلسات، رموز تلجرام المؤقتة، بصمات مفاتيح API وروابط المناديب، والإعدادات السرية.
// تُطلق من /wa/health مرة يومياً بعد 03:00 بتوقيت الرياض، وتُحفظ آخر KEEP نسخة. التنزيل للمدير فقط (مسار backups).
import { json, bad, today, audit, getSettings } from './core.js';
import { SECRET_SETTINGS } from './schema.js';

const KEEP = 30;
const CHUNK = 900_000;          // بايت مضغوط لكل صف (≈1.2MB بعد base64)
const RUN_AFTER = '03:00';      // توقيت الرياض
const MAX_TRIES = 3;            // محاولات اليوم عند الفشل

// جداول لا تُنسخ إطلاقاً (جلسات ورموز مؤقتة، والنسخ نفسها)
const SKIP = new Set(['sessions', 'tg_codes', 'tg_state', 'backups', 'backup_chunks']);
// أعمدة سرية تُحذف من صفوف جداولها
const DROP_COLS = { users: ['pass_hash', 'pass_salt'], api_tokens: ['token_hash'], reps: ['portal_hash'] };
// جداول صفوفها كبيرة (ملفات base64) تُقرأ بدفعات صغيرة كي لا تتجاوز حد استجابة D1
const SMALL_PAGE = { files: 4, legacy_import: 100 };

const secretSetting = (k) => SECRET_SETTINGS.includes(k) || k.startsWith('tg_') || /token|secret|password|api_key/i.test(k);

const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// ينشئ نسخة جديدة ويعيد سجلها. kind: daily | manual
export async function createBackup(db, { kind = 'daily', user = null } = {}) {
  const ins = await db.prepare('INSERT INTO backups (day, kind, user_id) VALUES (?, ?, ?)').bind(today(), kind, user?.id || null).run();
  const id = ins.meta.last_row_id;
  try {
    const { results: tl } = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name").all();
    const tables = tl.map((t) => t.name).filter((t) => !SKIP.has(t));

    // ضغط متدفق: النص يُكتب في gzip، والناتج يُجمَّع في قطع تُحفظ فور امتلائها
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter(); const reader = cs.readable.getReader(); const enc = new TextEncoder();
    let parts = [], len = 0, seq = 0, size = 0, raw = 0;
    const flush = async (force) => {
      while (len >= CHUNK || (force && len > 0)) {
        const all = new Uint8Array(len); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
        const take = Math.min(CHUNK, len);
        await db.prepare('INSERT INTO backup_chunks (backup_id, seq, data) VALUES (?, ?, ?)').bind(id, seq++, b64(all.subarray(0, take))).run();
        parts = take < len ? [all.slice(take)] : []; len -= take;
      }
    };
    const pump = (async () => { for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); len += value.length; size += value.length; await flush(false); } await flush(true); })();
    const put = (s) => { const u = enc.encode(s); raw += u.length; return writer.write(u); };

    let rows = 0;
    await put(`{"format":"nubl-hub-backup","version":1,"created_at":${JSON.stringify(new Date().toISOString())},"tables":{`);
    for (let ti = 0; ti < tables.length; ti++) {
      const t = tables[ti]; const drop = DROP_COLS[t] || []; const page = SMALL_PAGE[t] || 500;
      await put(`${ti ? ',' : ''}${JSON.stringify(t)}:[`);
      let first = true;
      for (let off = 0; ; off += page) {
        const { results } = await db.prepare(`SELECT * FROM "${t}" ORDER BY rowid LIMIT ? OFFSET ?`).bind(page, off).all();
        let chunk = '';
        for (const r of results) {
          if (t === 'settings' && secretSetting(r.key)) continue;
          for (const c of drop) delete r[c];
          chunk += (first ? '' : ',') + JSON.stringify(r); first = false; rows++;
        }
        if (chunk) await put(chunk);
        if (results.length < page) break;
      }
      await put(']');
    }
    await put('}}');
    await writer.close();
    await pump;

    await db.prepare("UPDATE backups SET status = 'ok', tables = ?, rows = ?, raw_size = ?, size = ?, chunks = ?, done_at = datetime('now') WHERE id = ?")
      .bind(tables.length, rows, raw, size, seq, id).run();
    await prune(db);
    return await db.prepare('SELECT * FROM backups WHERE id = ?').bind(id).first();
  } catch (e) {
    await db.batch([
      db.prepare('DELETE FROM backup_chunks WHERE backup_id = ?').bind(id),
      db.prepare("UPDATE backups SET status = 'failed', error = ?, done_at = datetime('now') WHERE id = ?").bind(String(e.message || e).slice(0, 300), id),
    ]);
    throw e;
  }
}

// تبقى آخر KEEP نسخة فقط
async function prune(db) {
  const { results } = await db.prepare('SELECT id FROM backups ORDER BY id DESC LIMIT -1 OFFSET ?').bind(KEEP).all();
  if (!results.length) return 0;
  const ids = results.map((r) => r.id);
  const qs = ids.map(() => '?').join(',');
  await db.batch([
    db.prepare(`DELETE FROM backup_chunks WHERE backup_id IN (${qs})`).bind(...ids),
    db.prepare(`DELETE FROM backups WHERE id IN (${qs})`).bind(...ids),
  ]);
  return ids.length;
}

// يُستدعى كل 10 دقائق من /wa/health: نسخة واحدة يومياً بعد RUN_AFTER، مع إعادة المحاولة حتى MAX_TRIES عند الفشل
export async function maybeBackup(db) {
  const now = new Date(Date.now() + 3 * 3600e3).toISOString().slice(11, 16);
  if (now < RUN_AFTER) return { skipped: 'early' };
  const s = await getSettings(db); const t = today();
  if (s.backup_last === t) return { skipped: 'done' };
  const [d, n] = String(s.backup_try || '').split(':');
  const tries = d === t ? Number(n) || 0 : 0;
  if (tries >= MAX_TRIES) return { skipped: 'failed_today' };
  // الحجز أولاً حتى لا تتكرر النسخة إن تداخلت دورتان
  await db.batch([
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backup_last', ?)").bind(t),
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backup_try', ?)").bind(`${t}:${tries + 1}`),
  ]);
  try {
    const b = await createBackup(db, { kind: 'daily' });
    return { id: b.id, rows: b.rows, size: b.size, chunks: b.chunks };
  } catch (e) {
    await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backup_last', ?)").bind(s.backup_last || '').run(); // يُعاد في الدورة التالية
    return { error: e.message };
  }
}

// GET backups · POST backups (نسخة الآن) · GET backups/:id (تنزيل .json.gz) — للمدير فقط
export async function backupsRoute(db, request, user, id) {
  if (user.role !== 'admin') return bad('النسخ الاحتياطية للمدير العام فقط', 403);
  const method = request.method.toUpperCase();
  if (!id && method === 'GET') {
    const { results } = await db.prepare(`SELECT b.id, b.day, b.kind, b.status, b.tables, b.rows, b.raw_size, b.size, b.chunks, b.error, b.created_at, b.done_at, u.name AS user_name
      FROM backups b LEFT JOIN users u ON u.id = b.user_id ORDER BY b.id DESC LIMIT ?`).bind(KEEP + 5).all();
    const s = await getSettings(db);
    return json({ rows: results, keep: KEEP, run_after: RUN_AFTER, last_day: s.backup_last || null });
  }
  if (!id && method === 'POST') {
    const b = await createBackup(db, { kind: 'manual', user });
    await audit(db, user, 'backup', 'backups', b.id, `${b.rows} rows, ${b.size} bytes`);
    return json({ row: b }, 201);
  }
  if (id && method === 'GET') {
    const b = await db.prepare("SELECT * FROM backups WHERE id = ? AND status = 'ok'").bind(id).first();
    if (!b) return bad('النسخة غير موجودة', 404);
    const { results } = await db.prepare('SELECT seq, data FROM backup_chunks WHERE backup_id = ? ORDER BY seq').bind(id).all();
    if (results.length !== b.chunks) return bad('النسخة ناقصة — أنشئ نسخة جديدة', 500);
    const bins = results.map((r) => unb64(r.data));
    const out = new Uint8Array(bins.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of bins) { out.set(x, o); o += x.length; }
    await audit(db, user, 'download', 'backups', b.id, b.day);
    return new Response(out, { headers: {
      'content-type': 'application/gzip', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'content-disposition': `attachment; filename="nubl-hub-backup-${b.day}-${b.id}.json.gz"`,
    } });
  }
  return bad('إجراء غير معروف', 404);
}
