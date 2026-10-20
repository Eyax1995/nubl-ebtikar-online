// عارض سجل التدقيق (المرحلة 2 — الخطوة 6ب) — للمدير العام فقط
// GET audit?user_id=&entity=&action=&from=&to=&q=&limit=&offset=  ·  GET audit/facets (قوائم التصفية)
// التواريخ from/to بتوقيت الرياض (YYYY-MM-DD) و`at` مخزّن بتوقيت UTC، فتُحوَّل الحدود بفارق 3 ساعات.
import { json, bad } from './core.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function auditRoute(db, request, user, sub) {
  if (user.role !== 'admin') return bad('سجل التدقيق للمدير العام فقط', 403);
  if (request.method !== 'GET') return bad('طريقة غير مدعومة', 405);

  if (sub === 'facets') {
    const [ents, acts, users] = await Promise.all([
      db.prepare('SELECT entity AS k, COUNT(*) AS n FROM audit WHERE entity IS NOT NULL GROUP BY entity ORDER BY n DESC').all(),
      db.prepare('SELECT action AS k, COUNT(*) AS n FROM audit WHERE action IS NOT NULL GROUP BY action ORDER BY n DESC').all(),
      db.prepare('SELECT a.user_id AS k, u.name, COUNT(*) AS n FROM audit a LEFT JOIN users u ON u.id = a.user_id GROUP BY a.user_id ORDER BY n DESC').all(),
    ]);
    return json({ entities: ents.results, actions: acts.results, users: users.results });
  }

  const p = new URL(request.url).searchParams;
  const where = []; const args = [];
  const uid = p.get('user_id');
  if (uid === 'none') where.push('a.user_id IS NULL');
  else if (uid && /^\d+$/.test(uid)) { where.push('a.user_id = ?'); args.push(Number(uid)); }
  if (p.get('entity')) { where.push('a.entity = ?'); args.push(p.get('entity')); }
  if (p.get('action')) { where.push('a.action = ?'); args.push(p.get('action')); }
  if (p.get('entity_id') && /^\d+$/.test(p.get('entity_id'))) { where.push('a.entity_id = ?'); args.push(Number(p.get('entity_id'))); }
  const from = p.get('from'); const to = p.get('to');
  if (from && DAY.test(from)) { where.push("a.at >= datetime(?, '-3 hours')"); args.push(from); }
  if (to && DAY.test(to)) { where.push("a.at < datetime(?, '+1 day', '-3 hours')"); args.push(to); }
  const q = (p.get('q') || '').trim();
  if (q) { where.push('(a.detail LIKE ? OR u.name LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }

  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const limit = Math.min(parseInt(p.get('limit') || '100', 10) || 100, 500);
  const offset = Math.max(parseInt(p.get('offset') || '0', 10) || 0, 0);
  const [rows, total] = await Promise.all([
    db.prepare(`SELECT a.id, a.user_id, u.name AS user_name, a.action, a.entity, a.entity_id, a.detail, a.at
      FROM audit a LEFT JOIN users u ON u.id = a.user_id${w} ORDER BY a.id DESC LIMIT ? OFFSET ?`).bind(...args, limit, offset).all(),
    db.prepare(`SELECT COUNT(*) AS n FROM audit a LEFT JOIN users u ON u.id = a.user_id${w}`).bind(...args).first('n'),
  ]);
  return json({ rows: rows.results, total, limit, offset });
}
