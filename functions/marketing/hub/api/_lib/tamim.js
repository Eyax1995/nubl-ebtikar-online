// التعاميد (28 أكتوبر 2026): خطابات الاعتماد المرفوعة للرئيس التنفيذي — مستند رسمي لا مهمة.
// كل تعميد: نص الخطاب كتلاً (docs/docx) + بنود قرار + مرفقات (files) → الرئيس التنفيذي يعتمد كل بند إلكترونياً
// (معتمد / معتمد مع التعديل / غير معتمد) مع ملاحظات، أو يطبع ويوقّع ويرفع النسخة الموقّعة. الطباعة وWord عبر studio/doc/tamim/<id>.
// GET tamim · GET tamim/<id> · POST tamim (إنشاء، admin/manager) · POST tamim/<id>/decide · POST tamim/<id>/attach {file:{id,name,mime}, signed?}
import { json, bad, audit, nextNumber } from './core.js';
import { notifyUser, notifyRoles, h as hx } from './telegram.js';

const DECIDERS = ['admin', 'executive'];
const OPTIONS = ['معتمد', 'معتمد مع التعديل', 'غير معتمد'];
const J = (v, d) => { try { const x = JSON.parse(v || ''); return x ?? d; } catch { return d; } };
const s = (v, n = 500) => String(v ?? '').trim().slice(0, n);

export const TAMIM_DDL = [
  `CREATE TABLE IF NOT EXISTS tamims (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, title TEXT NOT NULL, subject TEXT, blocks TEXT, items TEXT, decisions TEXT,
    attachments TEXT, signed_files TEXT, status TEXT DEFAULT 'بانتظار الاعتماد', notes TEXT, to_user_id INTEGER, cfo_user_id INTEGER, decided_by INTEGER, decided_at TEXT,
    cfo_seen_at TEXT, org TEXT DEFAULT 'nubl', created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,
];

// كتل المستند كاملة: نص الخطاب + صندوق القرار (يُملأ ☑ بعد القرار) + التواقيع
export function tamimBlocks(t, users = {}) {
  const items = J(t.items, []); const dec = J(t.decisions, {});
  const box = (it, opt) => (dec[it] === opt ? '☑' : '☐');
  const who = (id) => (users[id] || '');
  const decided = t.decided_at ? `${String(t.decided_at).slice(0, 16).replace('T', ' ')}` : '';
  return [
    ...J(t.blocks, []),
    { t: 'h1', text: 'قرار الرئيس التنفيذي' },
    { t: 'table', cols: [{ label: 'البند', w: 4.6 }, ...OPTIONS.map((o) => ({ label: o, w: 1.25, align: 'center' }))],
      rows: items.map((it) => [it, ...OPTIONS.map((o) => ({ text: box(it, o), align: 'center' }))]) },
    { t: 'table', cols: [{ label: 'الملاحظات', w: 8.3 }], rows: [[t.notes || ' \n \n ']] },
    { t: 'table', cols: [{ label: 'الصفة', w: 3.4 }, { label: 'التوقيع', w: 2.6 }, { label: 'التاريخ', w: 2.3 }], rows: [
      [{ text: 'الرئيس التنفيذي: أ. صهيب القاضي', bold: true }, t.decided_by ? `اعتُمد إلكترونياً — ${who(t.decided_by)}` : '....................', decided || '..... / ..... / 2026م'],
      [{ text: 'اطلاع المدير المالي: أ. محمود مهدي', bold: true }, t.cfo_seen_at ? 'اطّلع إلكترونياً' : '....................', t.cfo_seen_at ? String(t.cfo_seen_at).slice(0, 16) : '..... / ..... / 2026م']] },
  ];
}

async function userMap(db) {
  const { results } = await db.prepare('SELECT id, name FROM users').all();
  return Object.fromEntries((results || []).map((u) => [u.id, u.name]));
}
// الرئيس التنفيذي: صاحب دور executive أو من مسماه «التنفيذي»، وإلا المدير العام
async function ceoIds(db) {
  const { results } = await db.prepare("SELECT id FROM users WHERE active = 1 AND (role = 'executive' OR title LIKE '%التنفيذي%') ORDER BY id").all();
  return (results || []).map((r) => r.id);
}

export async function tamimRoute(db, env, request, user, id, sub) {
  const method = request.method.toUpperCase();
  const canRead = ['admin', 'manager', 'executive', 'finance'].includes(user.role);
  if (!canRead) return bad('لا تملك صلاحية التعاميد', 403);
  const isDecider = DECIDERS.includes(user.role) || (await ceoIds(db)).includes(user.id);
  const link = (tid) => `#/tamim/${tid}`;

  if (!id && method === 'GET') {
    const { results } = await db.prepare('SELECT id, number, title, subject, status, items, decisions, created_at, decided_at, to_user_id FROM tamims ORDER BY id DESC LIMIT 200').all();
    return json({ rows: results || [], can_decide: isDecider, can_create: ['admin', 'manager'].includes(user.role) });
  }
  if (!id && method === 'POST') {
    if (!['admin', 'manager'].includes(user.role)) return bad('إنشاء التعاميد للإدارة', 403);
    let d = {}; try { d = await request.json(); } catch { /* */ }
    const title = s(d.title, 200); if (!title) return bad('اكتب عنوان التعميد');
    const items = (Array.isArray(d.items) ? d.items : []).map((x) => s(x, 200)).filter(Boolean);
    if (!items.length) return bad('أضف بنود القرار');
    const number = await nextNumber(db, 'tamims', 'TAM');
    const to = (await ceoIds(db))[0] || null;
    const r = await db.prepare(`INSERT INTO tamims (number, title, subject, blocks, items, decisions, attachments, signed_files, status, to_user_id, created_by) VALUES (?,?,?,?,?,'{}',?,'[]','بانتظار الاعتماد',?,?)`)
      .bind(number, title, s(d.subject, 300), JSON.stringify(Array.isArray(d.blocks) ? d.blocks : []), JSON.stringify(items), JSON.stringify(Array.isArray(d.attachments) ? d.attachments : []), to, user.id).run();
    const tid = r.meta.last_row_id;
    await audit(db, user, 'create', 'tamims', tid, `${number} ${title}`);
    if (d.notify !== false) {
      const msg = `🖋️ تعميد جديد بانتظار اعتمادكم — <b>${hx(number)}</b>\n${hx(title)}\nالبنود: ${items.length}${d.attachments?.length ? ` · المرفقات: ${d.attachments.length}` : ''}\nرفعه ${hx(user.name)}\n➡️ افتحه من «التعاميد» في المنصة: اطّلع، اطبع أو حمّل Word، واعتمد كل بند`;
      for (const uid of await ceoIds(db)) await notifyUser(db, env, uid, msg, null, { kind: 'approval', title: `🖋️ تعميد ${number} — ${title}`, link: link(tid), urgent: true });
    }
    return json({ ok: true, id: tid, number }, 201);
  }

  const t = await db.prepare('SELECT * FROM tamims WHERE id = ?').bind(id).first();
  if (!t) return bad('التعميد غير موجود', 404);

  if (!sub && method === 'GET') {
    const users = await userMap(db);
    if (user.role === 'finance' && !t.cfo_seen_at) await db.prepare("UPDATE tamims SET cfo_seen_at = datetime('now'), cfo_user_id = ? WHERE id = ?").bind(user.id, t.id).run();
    return json({ row: { ...t, items: J(t.items, []), decisions: J(t.decisions, {}), attachments: J(t.attachments, []), signed_files: J(t.signed_files, []),
      decided_by_name: users[t.decided_by] || '', created_by_name: users[t.created_by] || '' }, can_decide: isDecider, options: OPTIONS });
  }
  if (sub === 'decide' && method === 'POST') {
    if (!isDecider) return bad('الاعتماد للرئيس التنفيذي', 403);
    let d = {}; try { d = await request.json(); } catch { /* */ }
    const items = J(t.items, []); const dec = {};
    for (const it of items) { const v = d.decisions?.[it]; if (v && !OPTIONS.includes(v)) return bad('قرار غير صالح'); if (v) dec[it] = v; }
    if (Object.keys(dec).length < items.length) return bad('حدّد قراراً لكل بند');
    const vals = Object.values(dec);
    const status = vals.every((v) => v === 'معتمد') ? 'معتمد' : vals.every((v) => v === 'غير معتمد') ? 'غير معتمد' : 'معتمد جزئياً';
    await db.prepare("UPDATE tamims SET decisions = ?, notes = ?, status = ?, decided_by = ?, decided_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
      .bind(JSON.stringify(dec), s(d.notes, 2000) || null, status, user.id, t.id).run();
    await audit(db, user, 'decide', 'tamims', t.id, status);
    const lines = items.map((it) => `${dec[it] === 'معتمد' ? '✅' : dec[it] === 'غير معتمد' ? '✖️' : '✏️'} ${hx(it)} — ${dec[it]}`).join('\n');
    const msg = `🖋️ قرار الرئيس التنفيذي على التعميد <b>${hx(t.number)}</b> — ${hx(status)}\n${hx(t.title)}\n${lines}${d.notes ? `\n💬 ${hx(s(d.notes, 600))}` : ''}`;
    await notifyRoles(db, env, ['admin', 'manager', 'finance'], msg, { kind: 'approval', title: `🖋️ ${t.number}: ${status}`, link: link(t.id), urgent: true }, user.id);
    return json({ ok: true, status });
  }
  if (sub === 'attach' && method === 'POST') {
    let d = {}; try { d = await request.json(); } catch { /* */ }
    const f = d.file || {}; if (!(Number(f.id) > 0)) return bad('ملف غير صالح');
    const it = { id: Number(f.id), name: s(f.name, 160), mime: s(f.mime, 100), by: user.name, at: new Date().toISOString() };
    const col = d.signed ? 'signed_files' : 'attachments';
    if (!d.signed && !['admin', 'manager'].includes(user.role)) return bad('إرفاق المستندات للإدارة', 403);
    const arr = [...J(t[col], []), it];
    await db.prepare(`UPDATE tamims SET ${col} = ?, updated_at = datetime('now') WHERE id = ?`).bind(JSON.stringify(arr), t.id).run();
    await audit(db, user, d.signed ? 'signed' : 'attach', 'tamims', t.id, it.name);
    if (d.signed) await notifyRoles(db, env, ['admin', 'manager', 'finance'], `📎 رُفعت النسخة الموقّعة من التعميد <b>${hx(t.number)}</b> بواسطة ${hx(user.name)}`, { kind: 'approval', link: link(t.id) }, user.id);
    return json({ ok: true });
  }
  return bad('مسار غير معروف', 404);
}
