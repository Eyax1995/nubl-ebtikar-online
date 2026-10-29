// التعاميد / الاعتمادات (28–29 أكتوبر 2026): خطابات الاعتماد المرفوعة للرئيس التنفيذي — مستند رسمي لا مهمة.
// كل تعميد: نص الخطاب كتلاً (docs/docx) + بنود قرار + مرفقات (files) → الرئيس التنفيذي يعتمد كل بند إلكترونياً
// (معتمد / معتمد مع التعديل / غير معتمد) مع ملاحظات وتوقيعه بخط يده على الشاشة (ceo_sign: صورة + رمز تحقق)،
// أو يطبع ويوقّع ويرفع النسخة الموقّعة. الطباعة وWord عبر studio/doc/tamim/<id>، وتظهر فيهما التواقيع والقرار.
// GET tamim · GET tamim/<id> · POST tamim (إنشاء، admin/manager) · POST tamim/<id>/decide {decisions, notes, sig}
// POST tamim/<id>/attach {file:{id,name,mime}, signed?} · POST tamim/<id>/remind (تذكير الرئيس التنفيذي، admin/manager)
// منصة القيادة (nubl-ebtikar.com/hub) تقرأ الاعتمادات عبر جسر xq الموقّع: approvals.list · approval.doc · approval.file
import { json, bad, audit, nextNumber } from './core.js';
import { notifyUser, notifyRoles, h as hx } from './telegram.js';
import { buildDocx } from './docx.js';
import { sign } from './track.js';

const DECIDERS = ['admin', 'executive'];
const OPTIONS = ['معتمد', 'معتمد مع التعديل', 'غير معتمد'];
const J = (v, d) => { try { const x = JSON.parse(v || ''); return x ?? d; } catch { return d; } };
const s = (v, n = 500) => String(v ?? '').trim().slice(0, n);
const ksaStamp = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' بتوقيت السعودية';
const SIG_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

export const TAMIM_DDL = [
  `CREATE TABLE IF NOT EXISTS tamims (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, title TEXT NOT NULL, subject TEXT, blocks TEXT, items TEXT, decisions TEXT,
    attachments TEXT, signed_files TEXT, status TEXT DEFAULT 'بانتظار الاعتماد', notes TEXT, to_user_id INTEGER, cfo_user_id INTEGER, decided_by INTEGER, decided_at TEXT,
    cfo_seen_at TEXT, org TEXT DEFAULT 'nubl', created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT, ceo_sign TEXT, reminded_at TEXT)`,
];

// كتل المستند كاملة: نص الخطاب + صندوق القرار (يُملأ ☑ بعد القرار) + التواقيع (والتوقيع الإلكتروني بصورته)
export function tamimBlocks(t, users = {}) {
  const items = J(t.items, []); const dec = J(t.decisions, {}); const es = J(t.ceo_sign, null);
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
      [{ text: 'الرئيس التنفيذي: أ. صهيب القاضي', bold: true }, es ? `وُقّع إلكترونياً — ${es.name}` : t.decided_by ? `اعتُمد إلكترونياً — ${who(t.decided_by)}` : '....................', es?.at || decided || '..... / ..... / 2026م'],
      [{ text: 'اطلاع المدير المالي: أ. محمود مهدي', bold: true }, t.cfo_seen_at ? 'اطّلع إلكترونياً' : '....................', t.cfo_seen_at ? String(t.cfo_seen_at).slice(0, 16) : '..... / ..... / 2026م']] },
    es && { t: 'esign', label: `وُقّع إلكترونياً من الرئيس التنفيذي — القرار: ${t.status}`, name: es.name, title: es.title, at: es.at, code: es.code, img: es.sig },
  ].filter(Boolean);
}

async function userMap(db) {
  const { results } = await db.prepare('SELECT id, name FROM users').all();
  return Object.fromEntries((results || []).map((u) => [u.id, u.name]));
}
// الرئيس التنفيذي: صاحب دور executive أو من مسماه «التنفيذي»
async function ceoIds(db) {
  const { results } = await db.prepare("SELECT id FROM users WHERE active = 1 AND (role = 'executive' OR title LIKE '%التنفيذي%') ORDER BY id").all();
  return (results || []).map((r) => r.id);
}
const fileMeta = (arr) => arr.map((f) => ({ id: f.id, name: f.name, mime: f.mime, by: f.by, at: f.at }));
const docName = (t) => `${t.title} — ${t.number}`;

export async function tamimRoute(db, env, request, user, id, sub) {
  const method = request.method.toUpperCase();
  const canRead = ['admin', 'manager', 'executive', 'finance'].includes(user.role);
  if (!canRead) return bad('لا تملك صلاحية الاعتمادات', 403);
  const isDecider = DECIDERS.includes(user.role) || (await ceoIds(db)).includes(user.id);
  const link = (tid) => `#/tamim/${tid}`;

  if (!id && method === 'GET') {
    const { results } = await db.prepare('SELECT id, number, title, subject, status, items, decisions, created_at, decided_at, to_user_id, signed_files, reminded_at, ceo_sign IS NOT NULL AS esigned FROM tamims ORDER BY id DESC LIMIT 200').all();
    return json({ rows: (results || []).map((r) => ({ ...r, signed_n: J(r.signed_files, []).length, signed_files: undefined })), can_decide: isDecider, can_create: ['admin', 'manager'].includes(user.role) });
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
      const msg = `🖋️ تعميد جديد بانتظار اعتمادكم — <b>${hx(number)}</b>\n${hx(title)}\nالبنود: ${items.length}${d.attachments?.length ? ` · المرفقات: ${d.attachments.length}` : ''}\nرفعه ${hx(user.name)}\n➡️ افتحه من «الاعتمادات» في المنصة: اطّلع، اطبع أو حمّل Word، واعتمد كل بند ووقّع`;
      for (const uid of await ceoIds(db)) await notifyUser(db, env, uid, msg, null, { kind: 'approval', title: `🖋️ تعميد ${number} — ${title}`, link: link(tid), urgent: true });
    }
    return json({ ok: true, id: tid, number }, 201);
  }

  const t = await db.prepare('SELECT * FROM tamims WHERE id = ?').bind(id).first();
  if (!t) return bad('التعميد غير موجود', 404);

  if (!sub && method === 'GET') {
    const users = await userMap(db);
    if (user.role === 'finance' && !t.cfo_seen_at) await db.prepare("UPDATE tamims SET cfo_seen_at = datetime('now'), cfo_user_id = ? WHERE id = ?").bind(user.id, t.id).run();
    const es = J(t.ceo_sign, null);
    return json({ row: { ...t, ceo_sign: undefined, esign: es && { name: es.name, at: es.at, code: es.code, sig: es.sig }, items: J(t.items, []), decisions: J(t.decisions, {}), attachments: J(t.attachments, []), signed_files: J(t.signed_files, []),
      decided_by_name: users[t.decided_by] || '', created_by_name: users[t.created_by] || '' }, can_decide: isDecider, can_remind: ['admin', 'manager'].includes(user.role), options: OPTIONS });
  }
  if (sub === 'decide' && method === 'POST') {
    if (!isDecider) return bad('الاعتماد للرئيس التنفيذي', 403);
    let d = {}; try { d = await request.json(); } catch { /* */ }
    const items = J(t.items, []); const dec = {};
    for (const it of items) { const v = d.decisions?.[it]; if (v && !OPTIONS.includes(v)) return bad('قرار غير صالح'); if (v) dec[it] = v; }
    if (Object.keys(dec).length < items.length) return bad('حدّد قراراً لكل بند');
    const sig = String(d.sig || '');
    if (!SIG_RE.test(sig) || sig.length < 1500) return bad('وقّع في خانة التوقيع قبل الاعتماد');
    if (sig.length > 400_000) return bad('صورة التوقيع كبيرة');
    const vals = Object.values(dec);
    const status = vals.every((v) => v === 'معتمد') ? 'معتمد' : vals.every((v) => v === 'غير معتمد') ? 'غير معتمد' : 'معتمد جزئياً';
    const at = ksaStamp();
    const code = (await sign(db, `tamim:${t.id}:${at}`)).slice(0, 10).toUpperCase();
    const esign = { sig, name: user.name, title: 'الرئيس التنفيذي', at, code, by: user.id };
    await db.prepare("UPDATE tamims SET decisions = ?, notes = ?, status = ?, decided_by = ?, decided_at = datetime('now'), ceo_sign = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(JSON.stringify(dec), s(d.notes, 2000) || null, status, user.id, JSON.stringify(esign), t.id).run();
    await audit(db, user, 'decide', 'tamims', t.id, `${status} · توقيع ${code}`);
    const lines = items.map((it) => `${dec[it] === 'معتمد' ? '✅' : dec[it] === 'غير معتمد' ? '✖️' : '✏️'} ${hx(it)} — ${dec[it]}`).join('\n');
    const msg = `🖋️ قرار الرئيس التنفيذي على التعميد <b>${hx(t.number)}</b> — ${hx(status)} (موقّع إلكترونياً)\n${hx(t.title)}\n${lines}${d.notes ? `\n💬 ${hx(s(d.notes, 600))}` : ''}`;
    await notifyRoles(db, env, ['admin', 'manager', 'finance'], msg, { kind: 'approval', title: `🖋️ ${t.number}: ${status}`, link: link(t.id), urgent: true }, user.id);
    return json({ ok: true, status, code });
  }
  if (sub === 'remind' && method === 'POST') {
    if (!['admin', 'manager'].includes(user.role)) return bad('التذكير للإدارة', 403);
    if (t.decided_at) return bad('اعتُمد هذا التعميد — لا حاجة للتذكير');
    const items = J(t.items, []);
    const msg = `⏰ تذكير: التعميد <b>${hx(t.number)}</b> ما زال بانتظار اعتمادكم\n${hx(t.title)}\nالبنود: ${items.length} · رُفع ${hx(String(t.created_at || '').slice(0, 10))}\nيُفتح من «الاعتمادات» في المنصة: اطّلع، واعتمد كل بند، ووقّع إلكترونياً — أو اطبعه ووقّعه وارفع النسخة الموقّعة.\nأرسل التذكير ${hx(user.name)}`;
    let n = 0;
    for (const uid of await ceoIds(db)) if (await notifyUser(db, env, uid, msg, null, { kind: 'approval', title: `⏰ تذكير: تعميد ${t.number} بانتظار اعتمادكم`, link: link(t.id), urgent: true })) n++;
    await db.prepare("UPDATE tamims SET reminded_at = datetime('now') WHERE id = ?").bind(t.id).run();
    await audit(db, user, 'remind', 'tamims', t.id, t.number);
    return json({ ok: true, sent: n });
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

// ---------- جسر منصة القيادة (يُستدعى من xqBridge بعد التحقق من التوقيع المشترك) ----------
export async function approvalsFeed(db) {
  const users = await userMap(db);
  const { results } = await db.prepare('SELECT * FROM tamims ORDER BY id DESC LIMIT 100').all();
  return { rows: (results || []).map((t) => {
    const es = J(t.ceo_sign, null);
    return { id: t.id, number: t.number, title: t.title, subject: t.subject, status: t.status, org: t.org, items: J(t.items, []), decisions: J(t.decisions, {}), notes: t.notes || '',
      created_at: t.created_at, created_by: users[t.created_by] || '', decided_at: t.decided_at, decided_by: users[t.decided_by] || '', reminded_at: t.reminded_at,
      cfo_seen_at: t.cfo_seen_at, esign: es && { name: es.name, at: es.at, code: es.code }, attachments: fileMeta(J(t.attachments, [])), signed_files: fileMeta(J(t.signed_files, [])),
      url: `https://nubl-ebtikar.online/marketing/hub/#/tamim/${t.id}` };
  }), at: new Date().toISOString() };
}
// النسخة الرسمية (Word) بالقرار والتوقيع الإلكتروني
export async function approvalDoc(db, d) {
  const t = await db.prepare('SELECT * FROM tamims WHERE id = ?').bind(+d.id || 0).first();
  if (!t) return json({ ok: false, error: 'التعميد غير موجود' }, 404);
  const bytes = await buildDocx(tamimBlocks(t, await userMap(db)), { title: docName(t), org: t.org || 'nubl' });
  return new Response(bytes, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x-file-name': encodeURIComponent(docName(t).replace(/[\\/:*?"<>|]+/g, ' ') + '.docx'), 'cache-control': 'no-store' } });
}
// المرفق أو النسخة الموقّعة — فقط ما ينتمي لهذا التعميد
export async function approvalFile(db, d) {
  const t = await db.prepare('SELECT attachments, signed_files FROM tamims WHERE id = ?').bind(+d.id || 0).first();
  const ok = t && [...J(t.attachments, []), ...J(t.signed_files, [])].some((f) => +f.id === +d.file);
  if (!ok) return json({ ok: false, error: 'الملف غير موجود' }, 404);
  const f = await db.prepare('SELECT name, mime, data FROM files WHERE id = ?').bind(+d.file).first();
  if (!f) return json({ ok: false, error: 'الملف غير موجود' }, 404);
  const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
  return new Response(bin, { headers: { 'content-type': f.mime || 'application/octet-stream', 'x-file-name': encodeURIComponent(f.name || 'file'), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
