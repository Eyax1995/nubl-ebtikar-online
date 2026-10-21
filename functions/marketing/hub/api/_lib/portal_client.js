// بوابة العميل — /marketing/client/ (الجلسة من portal.js، ses.ref_id = رقم العميل)
// GET  portal/client                    الملخص: الفواتير والمدفوعات والعروض والعقود والمشاريع والمحتوى والطلبات
// GET  portal/client/doc/quote/:id      نص عرض السعر للطباعة (HTML) · doc/contract/:id للعقد
// POST portal/client/quote/:id          {action: accept|reject, note} على العروض المرسلة فقط
// POST portal/client/content/:id        {action: approve|revise, note} على المنشورات «بانتظار اعتماد العميل» فقط
// POST portal/client/request            {type, subject, body, project_id} طلب أو ملاحظة لفريق الحساب
// POST portal/client/proof              {invoice_id, name, mime, data(base64), note} إثبات تحويل لفاتورة
import { json, bad, audit, getSettings, today } from './core.js';
import { notifyUser, notifyRoles, h as hx } from './telegram.js';
import { quoteBlocks, contractBlocks, quoteTotals } from './docs.js';
import { renderHtml } from './docx.js';
import { legacyQuoteDoc } from './studio.js';
import { pbody, clip, addRequest } from './portal.js';
import { quoteMoved } from './track.js';

const parse = (s, d) => { try { return typeof s === 'string' ? JSON.parse(s) : s || d; } catch { return d; } };
const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const CONTENT_SHOWN = ['بانتظار اعتماد العميل', 'تعديلات', 'معتمد', 'مجدول', 'منشور'];
const REQ_TYPES = ['طلب جديد', 'ملاحظة', 'استفسار', 'شكوى'];

// من يُبلَّغ بأي حركة من العميل: مدير حسابه، وإلا إدارة الحسابات والمدير
async function tellTeam(db, env, client, text, link, extra = []) {
  const ids = new Set([client.account_manager_id, ...extra].filter(Boolean));
  if (ids.size) { for (const id of ids) await notifyUser(db, env, id, text, null, { kind: 'client', link }); }
  else await notifyRoles(db, env, ['manager', 'account'], text, { kind: 'client', link });
}
async function logActivity(db, clientId, subject, notes) {
  try {
    await db.prepare("INSERT INTO activities (kind, client_id, subject, notes, at) VALUES ('بوابة العميل', ?, ?, ?, datetime('now'))").bind(clientId, subject, notes || null).run();
  } catch (e) { console.warn('portal activity', e.message); }
}
const who = (c) => ({ id: null, name: 'بوابة العميل: ' + c.name });

export async function clientPortalRoute(db, env, request, ses, sub) {
  const method = request.method.toUpperCase();
  const [a, b, c] = sub;
  const client = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(ses.ref_id).first();
  if (!client) return bad('الحساب غير موجود', 404);

  if (!a && method === 'GET') {
    const q = (sql, ...args) => db.prepare(sql).bind(...args).all().then((r) => r.results);
    const [invoices, payments, quotes, contracts, projects, content, requests] = await Promise.all([
      q(`SELECT id, number, issue_date, due_date, description, subtotal, vat, total, paid, status, tax_ref FROM invoices
         WHERE client_id = ? AND status NOT IN ('مسودة','ملغاة') ORDER BY COALESCE(issue_date, created_at) DESC LIMIT 200`, client.id),
      q(`SELECT p.number, p.amount, p.method, p.paid_at, i.number AS invoice FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id
         WHERE p.client_id = ? AND COALESCE(p.status,'مرحّل') != 'ملغى' ORDER BY p.paid_at DESC, p.id DESC LIMIT 200`, client.id),
      q(`SELECT id, number, title, total, valid_until, status, created_at FROM quotes WHERE client_id = ? AND status IN ('مرسل','مقبول','مرفوض','منتهي')
         ORDER BY id DESC LIMIT 50`, client.id),
      q(`SELECT id, number, title, package, start_date, end_date, months, monthly_value, total_value, status, file_link FROM contracts
         WHERE client_id = ? AND status != 'مسودة' ORDER BY COALESCE(start_date, created_at) DESC LIMIT 50`, client.id),
      q(`SELECT p.id, p.name, p.type, p.status, p.start_date, p.due_date,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS tasks,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'منجزة') AS done
         FROM projects p WHERE p.client_id = ? AND p.status != 'ملغي' ORDER BY p.status = 'نشط' DESC, p.id DESC LIMIT 30`, client.id),
      q(`SELECT id, publish_date, publish_time, platform, format, title, caption, hashtags, cta, status, asset_link FROM content
         WHERE client_id = ? AND status IN (${CONTENT_SHOWN.map(() => '?').join(',')}) AND (publish_date IS NULL OR publish_date >= date('now','-45 days'))
         ORDER BY status = 'بانتظار اعتماد العميل' DESC, publish_date, id LIMIT 150`, client.id, ...CONTENT_SHOWN),
      q("SELECT id, type, subject, status, created_at FROM portal_requests WHERE kind = 'client' AND ref_id = ? ORDER BY id DESC LIMIT 40", client.id),
    ]);
    // آخر ما أُنجز في كل مشروع (عناوين المهام المنجزة فقط — لا تظهر الملاحظات الداخلية)
    for (const p of projects) {
      p.recent = (await q("SELECT title, done_at FROM tasks WHERE project_id = ? AND status = 'منجزة' ORDER BY COALESCE(done_at, updated_at) DESC LIMIT 3", p.id));
    }
    const am = client.account_manager_id ? await db.prepare('SELECT name, title FROM users WHERE id = ?').bind(client.account_manager_id).first() : null;
    const s = await getSettings(db);
    const due = invoices.filter((i) => ['مصدرة', 'مدفوعة جزئياً'].includes(i.status));
    const t = today();
    return json({
      company: s.company_name || 'نُبل وابتكار للتسويق', today: t, wa: '966563413040',
      bank_line: s.bank_line || '',
      client: { id: client.id, name: client.name, brand: client.brand, contact_name: client.contact_name, package: client.package, start_date: client.start_date, renewal_date: client.renewal_date },
      manager: am ? { name: am.name, title: am.title } : null,
      accounts: ses.accounts,
      totals: {
        invoiced: invoices.reduce((x, i) => x + Number(i.total || 0), 0),
        paid: invoices.reduce((x, i) => x + Number(i.paid || 0), 0),
        due: due.reduce((x, i) => x + Math.max(0, Number(i.total || 0) - Number(i.paid || 0)), 0),
        overdue: due.filter((i) => i.due_date && i.due_date < t).length,
        awaiting: content.filter((x) => x.status === 'بانتظار اعتماد العميل').length,
        quotes_open: quotes.filter((x) => x.status === 'مرسل' && !(x.valid_until && x.valid_until < t)).length,
      },
      invoices, payments, quotes, contracts, projects, content, requests, req_types: REQ_TYPES,
    });
  }

  // ---------- عرض المستندات ----------
  if (a === 'doc' && method === 'GET' && (b === 'quote' || b === 'contract')) {
    const s = await getSettings(db);
    const ctx = { settings: s, today: today(), signName: s.sign_name || 'إياد المغيرة', signTitle: s.sign_title || 'مدير قطاع التسويق' };
    if (b === 'quote') {
      const qt = await db.prepare("SELECT * FROM quotes WHERE id = ? AND client_id = ? AND status IN ('مرسل','مقبول','مرفوض','منتهي')").bind(c, client.id).first();
      if (!qt) return bad('غير موجود', 404);
      const doc = parse(qt.doc, null) || legacyQuoteDoc(qt);
      ctx.clientName = [client.contact_name && client.contact_name !== client.name ? client.contact_name : null, client.name, client.city].filter(Boolean).join(' — ');
      await audit(db, who(client), 'view', 'quotes', qt.id, 'بوابة العميل');
      return json({ title: `عرض سعر ${qt.number} — ${doc.subject || qt.title || ''}`, html: renderHtml(quoteBlocks(qt, doc, ctx)) });
    }
    const ct = await db.prepare("SELECT * FROM contracts WHERE id = ? AND client_id = ? AND status != 'مسودة'").bind(c, client.id).first();
    if (!ct) return bad('غير موجود', 404);
    let doc = parse(ct.doc, null);
    if (!doc) {
      const qt = ct.quote_id ? await db.prepare('SELECT * FROM quotes WHERE id = ?').bind(ct.quote_id).first() : null;
      const qd = qt ? (parse(qt.doc, null) || legacyQuoteDoc(qt)) : { pricing: { setup: { items: [] }, monthly: { min_months: ct.months, items: [{ name: ct.package || ct.title, price: ct.monthly_value }] }, addons: { items: [] } } };
      doc = { subject: ct.title, scope: String(ct.package || '').split('\n').filter(Boolean).map((l) => ({ item: l.replace(/^•\s*/, '').split(':')[0], details: l.split(':').slice(1).join(':').trim() })), totals: quoteTotals(qd, s.vat_rate || 15), quote_number: qt?.number };
    }
    ctx.client = client; ctx.quoteNumber = doc.quote_number;
    await audit(db, who(client), 'view', 'contracts', ct.id, 'بوابة العميل');
    return json({ title: `عقد ${ct.number} — ${client.name}`, html: renderHtml(contractBlocks(ct, doc, ctx)) });
  }

  // ---------- الرد على عرض سعر ----------
  if (a === 'quote' && b && method === 'POST') {
    const d = await pbody(request);
    const qt = await db.prepare('SELECT * FROM quotes WHERE id = ? AND client_id = ?').bind(b, client.id).first();
    if (!qt) return bad('غير موجود', 404);
    if (qt.status !== 'مرسل') return bad('تم الرد على هذا العرض مسبقاً');
    if (qt.valid_until && qt.valid_until < today()) return bad('انتهت صلاحية هذا العرض — اطلب تحديثه من فريقنا');
    const accept = d.action === 'accept'; const note = clip(d.note, 1000);
    if (!accept && d.action !== 'reject') return bad('إجراء غير معروف');
    // لا يُكتب في notes لأنها تُطبع داخل مستند العرض — الرد محفوظ في نشاط العميل وطلبات البوابة
    await db.prepare("UPDATE quotes SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(accept ? 'مقبول' : 'مرفوض', qt.id).run();
    await addRequest(db, ses, { type: accept ? 'قبول عرض' : 'رفض عرض', subject: `${qt.number} — ${qt.title || ''}`, body: note, entity: 'quotes', entity_id: qt.id });
    await logActivity(db, client.id, `${accept ? '✅ قبول' : '❌ رفض'} عرض السعر ${qt.number}`, note);
    await audit(db, who(client), accept ? 'accept' : 'reject', 'quotes', qt.id, 'بوابة العميل');
    try { await quoteMoved(db, env, qt, 'مرسل', accept ? 'مقبول' : 'مرفوض', null, 'بوابة العميل'); } catch (e) { console.warn('track', e.message); }
    await tellTeam(db, env, client, `${accept ? '✅' : '❌'} العميل <b>${hx(client.name)}</b> ${accept ? 'قبل' : 'رفض'} عرض السعر ${hx(qt.number)} (${fmt(qt.total)} ر.س) من البوابة${note ? `\n«${hx(note.slice(0, 300))}»` : ''}`,
      `#quote/${qt.id}`, [qt.created_by]);
    if (accept) await notifyRoles(db, env, ['admin', 'manager', 'sales'], `🎉 قبول عرض ${hx(qt.number)} من <b>${hx(client.name)}</b> عبر البوابة — حوّله لعقد`, { kind: 'deal', link: `#quote/${qt.id}` }, client.account_manager_id);
    return json({ ok: true, status: accept ? 'مقبول' : 'مرفوض' });
  }

  // ---------- اعتماد المحتوى ----------
  if (a === 'content' && b && method === 'POST') {
    const d = await pbody(request);
    const ct = await db.prepare('SELECT * FROM content WHERE id = ? AND client_id = ?').bind(b, client.id).first();
    if (!ct) return bad('غير موجود', 404);
    if (ct.status !== 'بانتظار اعتماد العميل') return bad('هذا المنشور ليس بانتظار اعتمادك الآن');
    const ok = d.action === 'approve'; const note = clip(d.note, 1500);
    if (!ok && d.action !== 'revise') return bad('إجراء غير معروف');
    if (!ok && !note) return bad('اكتب التعديلات المطلوبة');
    await db.prepare(`UPDATE content SET status = ?, revisions = COALESCE(revisions,0) + ?, notes = COALESCE(notes,'') || ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(ok ? 'معتمد' : 'تعديلات', ok ? 0 : 1, `\n[${today()}] ${ok ? 'اعتمده العميل' : 'تعديلات العميل'}${note ? ': ' + note : ''}`, ct.id).run();
    await addRequest(db, ses, { type: ok ? 'اعتماد منشور' : 'تعديل منشور', subject: ct.title || `${ct.platform || ''} ${ct.publish_date || ''}`.trim(), body: note, entity: 'content', entity_id: ct.id });
    await audit(db, who(client), ok ? 'approve' : 'revise', 'content', ct.id, 'بوابة العميل');
    await tellTeam(db, env, client, `${ok ? '👍 اعتمد' : '✏️ طلب تعديل على'} العميل <b>${hx(client.name)}</b> منشور «${hx(ct.title || ct.platform || '')}»${ct.publish_date ? ' (' + ct.publish_date + ')' : ''}${note ? `\n«${hx(note.slice(0, 400))}»` : ''}`,
      '#content', [ct.assignee_id, ct.designer_id]);
    return json({ ok: true, status: ok ? 'معتمد' : 'تعديلات' });
  }

  // ---------- طلب / ملاحظة ----------
  if (a === 'request' && method === 'POST') {
    const d = await pbody(request);
    const type = REQ_TYPES.includes(d.type) ? d.type : 'طلب جديد';
    const subject = clip(d.subject, 150); const text = clip(d.body, 3000);
    if (!subject && !text) return bad('اكتب طلبك');
    const pid = Number(d.project_id) || null;
    const proj = pid ? await db.prepare('SELECT id, name, owner_id FROM projects WHERE id = ? AND client_id = ?').bind(pid, client.id).first() : null;
    await addRequest(db, ses, { type, subject: subject || text.slice(0, 80), body: text, entity: proj ? 'projects' : null, entity_id: proj?.id });
    await logActivity(db, client.id, `${type} من البوابة: ${subject || text.slice(0, 80)}${proj ? ' — ' + proj.name : ''}`, text);
    await tellTeam(db, env, client, `📩 ${hx(type)} من العميل <b>${hx(client.name)}</b>${proj ? ` (${hx(proj.name)})` : ''}\n<b>${hx(subject)}</b>${text ? `\n${hx(text.slice(0, 500))}` : ''}`,
      `#client/${client.id}`, [proj?.owner_id]);
    return json({ ok: true }, 201);
  }

  // ---------- إثبات سداد ----------
  if (a === 'proof' && method === 'POST') {
    const d = await pbody(request);
    const inv = await db.prepare("SELECT id, number, total, paid FROM invoices WHERE id = ? AND client_id = ? AND status NOT IN ('مسودة','ملغاة')").bind(d.invoice_id, client.id).first();
    if (!inv) return bad('اختر الفاتورة');
    if (!d.data || !/^[A-Za-z0-9+/=]+$/.test(d.data)) return bad('أرفق صورة أو ملف PDF للتحويل');
    const size = Math.floor(d.data.length * 3 / 4);
    if (size > 1_400_000) return bad('حجم الملف أكبر من المسموح (1.4MB) — صوّر الإيصال بدقة أقل');
    if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(d.mime)) return bad('الصيغ المقبولة: صورة أو PDF');
    const recent = await db.prepare("SELECT COUNT(*) AS n FROM portal_requests WHERE kind = 'client' AND ref_id = ? AND type = 'إثبات سداد' AND created_at >= datetime('now','-1 day')").bind(client.id).first('n');
    if (recent >= 10) return bad('وصل الحد اليومي لرفع الإثباتات — تواصل مع فريقنا');
    const f = await db.prepare('INSERT INTO files (name, mime, size, data, user_id) VALUES (?,?,?,?,NULL)').bind(clip(d.name, 120) || `إثبات-${inv.number}`, d.mime, size, d.data).run();
    const fileId = f.meta.last_row_id;
    const note = clip(d.note, 600);
    await addRequest(db, ses, { type: 'إثبات سداد', subject: `فاتورة ${inv.number}`, body: note, entity: 'invoices', entity_id: inv.id, file_id: fileId });
    await logActivity(db, client.id, `إثبات سداد للفاتورة ${inv.number} من البوابة`, note);
    await notifyRoles(db, env, ['finance', 'admin'], `🧾 إثبات سداد من <b>${hx(client.name)}</b> للفاتورة ${hx(inv.number)} (المتبقي ${fmt(Number(inv.total) - Number(inv.paid))} ر.س)${note ? `\n${hx(note)}` : ''}\nالملف: /marketing/hub/api/files/${fileId}\nسجّل الدفعة بعد التحقق من وصول المبلغ.`,
      { kind: 'finance', link: `#invoice/${inv.id}` });
    return json({ ok: true }, 201);
  }

  return bad('إجراء غير معروف', 404);
}
