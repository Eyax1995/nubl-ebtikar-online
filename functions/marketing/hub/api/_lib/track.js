// مسار العميل وإشعاراته (v18): كل انتقال للعرض من مرحلة لمرحلة يُسجَّل ويظهر في المنصة، ويُبلَّغ العميل (والمندوب إن وُجد) على واتساب برابط متابعة.
// - رابط المتابعة لكل عميل محتمل/عميل: https://nubl-ebtikar.online/t/<key> بلا كلمة مرور، والمفتاح موقّع HMAC بسرّ `track_secret` (لا يُخزَّن ولا يُخمَّن).
// - الأحداث في `track_events` (+ سطر في `activities` ليظهر في السجل الزمني)، والرسائل في طابور `client_msgs` (مرة واحدة لكل حدث ومستلم، لا إرسال 23:00–07:00).
// - الإرسال: نص حر داخل نافذة 24 ساعة، وخارجها قالب Utility `nubl_client_update` يُنشأ آلياً لدى Meta (يبقى الطلب منتظراً حتى يُعتمد القالب أو يراسلنا العميل، حتى 72 ساعة).
import { json, bad, audit, getSettings, today } from './core.js';
import { notifyUser, notifyRoles, h as hx } from './telegram.js';
import { quoteBlocks } from './docs.js';
import { renderHtml } from './docx.js';
import { legacyQuoteDoc, contractBlocksFor } from './studio.js';
import { sendText } from '../../../../wa/_lib/engine.js';

const SITE = 'https://nubl-ebtikar.online';
const FROM_PHONE_ID = '1368158866379375';
const WABA_ID = '1686695736383983';
const GRAPH = 'https://graph.facebook.com/v23.0';
const TPL = 'nubl_client_update';
const HOLD_H = 72;
const VISIBLE = ['مرسل', 'مقبول', 'مرفوض', 'منتهي'];
const ksaHour = () => (new Date().getUTCHours() + 3) % 24;
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const money = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const arDate = (d) => { if (!d) return ''; const [y, m, x] = String(d).slice(0, 10).split('-'); return `${+x}/${+m}/${y}`; };
// الاسم الأول للتحية: «عبد الرحمن» و«أبو أنس» كلمتان لا كلمة
const firstName = (n) => { const w = String(n || '').trim().split(/\s+/); return /^(عبد|عبدال|أبو|ابو|أم|ام|آل)$/.test(w[0]) && w[1] ? `${w[0]} ${w[1]}` : (w[0] || ''); };
const cleanPhone = (p) => { let d = String(p || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[^\d]/g, ''); if (d.startsWith('00')) d = d.slice(2); if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1); if (/^5\d{8}$/.test(d)) d = '966' + d; return /^\d{9,15}$/.test(d) ? d : null; };

// ---------- مفتاح الرابط ----------
export async function secret(db) {
  let s = await db.prepare("SELECT value FROM settings WHERE key = 'track_secret'").first('value');
  if (!s) {
    s = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('track_secret', ?)").bind(s).run();
    s = await db.prepare("SELECT value FROM settings WHERE key = 'track_secret'").first('value');
  }
  return s;
}
export async function sign(db, base) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(await secret(db)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('track:' + base));
  return [...new Uint8Array(sig)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
// العميل المحتمل هو الأصل (يبقى رابطه نفسه بعد التحويل لعميل)، والعميل المُنشأ مباشرة رابطه بحرف C
export async function subjectOf(db, { lead_id, client_id }) {
  let lead = lead_id ? await db.prepare('SELECT * FROM leads WHERE id = ?').bind(lead_id).first() : null;
  let client = client_id ? await db.prepare('SELECT * FROM clients WHERE id = ?').bind(client_id).first() : null;
  if (!lead && client?.lead_id) lead = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(client.lead_id).first();
  if (lead && !client && lead.client_id) client = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(lead.client_id).first();
  if (!lead && !client) return null;
  const base = lead ? `L${lead.id}` : `C${client.id}`;
  return { lead, client, base, lead_id: lead?.id || null, client_id: client?.id || null };
}
export async function trackLink(db, ref) {
  const s = await subjectOf(db, ref); if (!s) return null;
  return `${SITE}/t/${s.base}.${await sign(db, s.base)}`;
}
export async function subjectFromKey(db, key) {
  const m = /^([LC])(\d{1,9})\.([a-f0-9]{16})$/.exec(String(key || ''));
  if (!m) return null;
  const base = m[1] + m[2];
  if ((await sign(db, base)) !== m[3]) return null;
  return subjectOf(db, m[1] === 'L' ? { lead_id: +m[2] } : { client_id: +m[2] });
}

// ---------- المستلمون: العميل + المندوب ----------
async function recipients(db, s) {
  const out = []; const seen = new Set();
  const add = (phone, name, role) => { const p = cleanPhone(phone); if (p && !seen.has(p)) { seen.add(p); out.push({ phone: p, name: name || '', role }); } };
  const who = s.client?.contact_name || s.lead?.name || s.client?.name || '';
  add(s.client?.phone || s.lead?.phone, who, 'client');
  const repId = s.client?.rep_id || s.lead?.rep_id;
  if (repId) { const r = await db.prepare("SELECT name, phone FROM reps WHERE id = ? AND status != 'موقوف'").bind(repId).first(); if (r) add(r.phone, r.name, 'rep'); }
  return out;
}
const subjectName = (s) => s.client?.name || s.lead?.company || s.lead?.name || '';

// ---------- تسجيل حدث + إشعار ----------
// e: { lead_id, client_id, quote_id, event, title (للفريق), detail, client_text (يُرسل للعميل إن وُجد), user, via, dedupe }
export async function recordEvent(db, env, e) {
  const s = await subjectOf(db, e); if (!s) return null;
  const r = await db.prepare(`INSERT INTO track_events (lead_id, client_id, quote_id, event, title, detail, client_text, by_user, via, org)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(s.lead_id, s.client_id, e.quote_id || null, e.event, e.title, e.detail || null, e.client_text || null,
    e.user?.id || null, e.via || (e.user ? 'المنصة' : 'آلي'), s.client?.org || s.lead?.org || 'nubl').run();
  const evId = r.meta.last_row_id;
  // في السجل الزمني للعميل المحتمل/العميل
  await db.prepare(`INSERT INTO activities (kind, lead_id, client_id, subject, notes, user_id, at) VALUES ('مسار العميل', ?, ?, ?, ?, ?, datetime('now'))`)
    .bind(s.lead_id, s.client_id, e.title, e.detail || null, e.user?.id || null).run();
  let queued = 0;
  const st = await getSettings(db);
  if (e.client_text && st.client_notify !== '0') {
    const link = e.link || `${SITE}/t/${s.base}.${await sign(db, s.base)}`; // جلسات التشخيص ترسل رابط إدارة الجلسة
    for (const to of await recipients(db, s)) {
      const text = to.role === 'rep'
        ? `تحديث على عميلك «${subjectName(s)}»: ${e.client_text}`
        : e.client_text;
      const dedupe = `${e.dedupe || `${e.event}:${e.quote_id || 0}`}:${to.phone}`;
      const ins = await db.prepare(`INSERT OR IGNORE INTO client_msgs (event_id, lead_id, client_id, to_phone, to_name, role, text, link, dedupe) VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(evId, s.lead_id, s.client_id, to.phone, to.name, to.role, text, link, dedupe).run();
      queued += ins.meta.changes || 0;
    }
    if (queued) await flushOutbox(db, env, { limit: 5 }).catch((x) => console.warn('flush', x.message));
  }
  return { event_id: evId, queued };
}

// ---------- انتقال العرض بين المراحل (المصدر الوحيد للرسائل) ----------
export async function quoteMoved(db, env, q, from, to, user, via) {
  if (!q || !to || from === to) return null;
  const label = `عرض السعر ${q.number || ''}${q.title ? ` «${String(q.title).slice(0, 80)}»` : ''}`;
  const M = {
    'مسودة': { ev: 'quote_draft', title: `📝 ${label}: مسودة` },
    'مرسل': { ev: 'quote_sent', title: `📤 أُرسل ${label}`, text: `${label} جاهز للاطلاع، ويمكنك قبوله مباشرة من رابط المتابعة.${q.valid_until ? ` صالح حتى ${arDate(q.valid_until)}.` : ''}` },
    'مقبول': { ev: 'quote_accepted', title: `✅ قُبل ${label}`, text: `استلمنا موافقتك على ${label} — شكراً لثقتك. سنرسل لك العقد والفاتورة الأولى قريباً.` },
    'مرفوض': { ev: 'quote_rejected', title: `✖️ رُفض ${label}` },
    'منتهي': { ev: 'quote_expired', title: `⌛ انتهت صلاحية ${label}` },
  }[to] || { ev: 'quote_status', title: `${label}: ${to}` };
  return recordEvent(db, env, { lead_id: q.lead_id, client_id: q.client_id, quote_id: q.id, event: M.ev, title: M.title,
    detail: from ? `من «${from}» إلى «${to}»` : `الحالة «${to}»`, client_text: M.text, user, via });
}

// يُستدعى من afterSave لكل حفظ عام (e/<كيان>)
export async function trackHooks(db, env, user, entity, id, rec, before) {
  if (entity === 'quotes' && rec.status !== undefined && rec.status !== (before?.status ?? null) && (before || rec.status !== 'مسودة')) {
    const q = await db.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first();
    await quoteMoved(db, env, q, before?.status || null, rec.status, user, 'المنصة');
  }
  if (entity === 'contracts' && rec.status !== undefined && rec.status !== before?.status && ['موقّع', 'نشط'].includes(rec.status)) {
    const c = await db.prepare('SELECT id, number, client_id, title FROM contracts WHERE id = ?').bind(id).first();
    if (c?.client_id) await recordEvent(db, env, { client_id: c.client_id, event: 'contract_signed', dedupe: `contract:${c.id}`, title: `✍️ العقد ${c.number} ${rec.status}`,
      client_text: `اعتُمد عقدك ${c.number}، ونبدأ التنفيذ وفق الجدول المتفق عليه.`, user });
  }
  if (entity === 'invoices' && rec.status === 'مصدرة' && before?.status !== 'مصدرة') {
    const i = await db.prepare('SELECT id, number, client_id, total FROM invoices WHERE id = ?').bind(id).first();
    if (i?.client_id) await recordEvent(db, env, { client_id: i.client_id, event: 'invoice_issued', dedupe: `invoice:${i.id}`, title: `🧾 صدرت الفاتورة ${i.number}`,
      client_text: `صدرت فاتورتك ${i.number} بقيمة ${money(i.total)} ر.س شاملة الضريبة، وتجد تفاصيلها في رابط المتابعة.`, user });
  }
}

// طلب جديد (الموقع/إحالة مندوب/إدخال يدوي برقم جوال) — طلبات واتساب يرد عليها المساعد الآلي فلا تُكرر
export async function newRequest(db, env, leadId, source, user) {
  const l = await db.prepare('SELECT id, phone, source FROM leads WHERE id = ?').bind(leadId).first();
  if (!l) return null;
  const src = source || l.source || '';
  const wa = /واتساب/.test(src);
  return recordEvent(db, env, { lead_id: l.id, event: 'request', title: `📥 استلام طلب جديد${src ? ` (${src})` : ''}`,
    client_text: wa || !l.phone ? null : 'استلمنا طلبك، وسيتواصل معك فريقنا خلال يوم عمل لتحديد موعد جلسة التشخيص.', user });
}

// ---------- الطابور ----------
async function windowOpen(env, to) {
  if (!env.WA_DB) return false;
  try {
    const r = await env.WA_DB.prepare("SELECT at FROM wa_events WHERE wa_id = ? AND kind = 'message' ORDER BY id DESC LIMIT 1").bind(to).first();
    return !!(r && Date.now() - Date.parse(String(r.at).replace(' ', 'T') + 'Z') < 23.5 * 3600e3);
  } catch { return false; }
}
async function graph(env, path, body) {
  const r = await fetch(`${env.WA_GRAPH_URL || GRAPH}/${path}`, { method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${env.WA_TOKEN}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let d = {}; try { d = await r.json(); } catch { /* */ }
  return { ok: r.ok && !d.error, data: d };
}
const setSetting = (db, k, v) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(k, String(v)).run();
export async function templateReady(db, env, force) {
  const s = await getSettings(db);
  if (s.client_tpl === 'APPROVED') return true;
  if (!force && s.client_tpl_at && Date.now() - Date.parse(s.client_tpl_at) < 30 * 60e3) return false;
  if (!env.WA_TOKEN) return false;
  let status = 'MISSING';
  const r = await graph(env, `${WABA_ID}/message_templates?name=${TPL}&fields=name,status,language`);
  const row = (r.data.data || []).find((t) => t.name === TPL);
  if (row) status = row.status;
  else if (r.ok) {
    const c = await graph(env, `${WABA_ID}/message_templates`, {
      name: TPL, language: 'ar', category: 'UTILITY',
      components: [{ type: 'BODY', text: 'مرحباً {{1}}،\n{{2}}\n\nللتفاصيل والمتابعة: {{3}}\n\nفريق نُبل وابتكار للخدمات التسويقية',
        example: { body_text: [['محمد', 'عرض السعر Q-2026-0001 جاهز للاطلاع، ويمكنك قبوله مباشرة من رابط المتابعة.', 'https://nubl-ebtikar.online/t/L1.0123456789abcdef']] } }],
    });
    status = c.ok ? (c.data.status || 'PENDING') : 'CREATE_FAILED: ' + String(c.data?.error?.error_user_msg || c.data?.error?.message || '').slice(0, 200);
  }
  await setSetting(db, 'client_tpl', status);
  await setSetting(db, 'client_tpl_at', new Date().toISOString());
  return status === 'APPROVED';
}
export async function flushOutbox(db, env, { limit = 20 } = {}) {
  const h = ksaHour(); if (h >= 23 || h < 7) return { held: 'quiet' };
  const { results } = await db.prepare("SELECT * FROM client_msgs WHERE status = 'pending' ORDER BY id LIMIT ?").bind(limit).all();
  let sent = 0, waiting = 0, failed = 0; let tplOk = null;
  for (const m of results) {
    if (!env.WA_TOKEN) { await db.prepare("UPDATE client_msgs SET status = 'failed', error = 'واتساب غير مضبوط' WHERE id = ?").bind(m.id).run(); failed++; continue; }
    const hello = m.name ? `مرحباً ${firstName(m.name)}،` : 'مرحباً،';
    let res = null, mode = null;
    if (await windowOpen(env, m.to_phone)) {
      res = await sendText(env, env.WA_PHONE_ID || FROM_PHONE_ID, m.to_phone, `${hello}\n${m.text}\n\nللتفاصيل والمتابعة: ${m.link}\n\nفريق نُبل وابتكار للخدمات التسويقية`);
      mode = 'text';
    } else {
      if (tplOk === null) tplOk = await templateReady(db, env);
      if (tplOk) {
        res = await graph(env, `${env.WA_PHONE_ID || FROM_PHONE_ID}/messages`, { messaging_product: 'whatsapp', to: m.to_phone, type: 'template',
          // معاملات القالب لا تقبل أسطراً جديدة أو مسافات متتالية (#132018) — تُسطَّح إلى سطر واحد
          template: { name: TPL, language: { code: 'ar' }, components: [{ type: 'body', parameters: [firstName(m.name) || 'عميلنا', m.text.replace(/\s*[\r\n]+\s*/g, ' · ').replace(/\s{2,}/g, ' ').trim().slice(0, 900), m.link].map((text) => ({ type: 'text', text })) }] } });
        mode = 'template';
      }
    }
    const ok = res && res.ok && res.data?.messages?.[0];
    if (ok) {
      await db.prepare("UPDATE client_msgs SET status = 'sent', mode = ?, error = NULL, tries = tries + 1, sent_at = datetime('now') WHERE id = ?").bind(mode, m.id).run();
      try { await env.WA_DB?.prepare('INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)')
        .bind('marketing', m.to_phone, 'staff', res.data.messages[0].id, null, `${m.text}\n${m.link}`, 'sent', JSON.stringify({ by: 'إشعار آلي', event_id: m.event_id, mode })).run(); } catch { /* */ }
      sent++;
    } else if (res) {
      const err = String(res.data?.error?.message || 'تعذّر الإرسال').slice(0, 300);
      await db.prepare("UPDATE client_msgs SET status = CASE WHEN tries >= 2 THEN 'failed' ELSE 'pending' END, error = ?, tries = tries + 1 WHERE id = ?").bind(err, m.id).run();
      failed++;
    } else {
      const old = Date.now() - Date.parse(String(m.created_at).replace(' ', 'T') + 'Z') > HOLD_H * 3600e3;
      await db.prepare(`UPDATE client_msgs SET status = ?, error = ? WHERE id = ?`).bind(old ? 'failed' : 'pending',
        old ? 'لم يُعتمد قالب واتساب ولم يراسلنا العميل خلال 72 ساعة' : 'بانتظار اعتماد قالب واتساب أو رسالة من العميل', m.id).run();
      old ? failed++ : waiting++;
    }
  }
  return { sent, waiting, failed };
}

// ---------- المجدول (/wa/health كل 10 دقائق): تذكير قبل الانتهاء بيومين، وتعليم المنتهي ----------
export async function trackTick(db, env) {
  const t = today(); const in2 = new Date(Date.parse(t) + 2 * 864e5).toISOString().slice(0, 10);
  const out = { reminded: 0, expired: 0 };
  const { results: soon } = await db.prepare(`SELECT * FROM quotes WHERE status = 'مرسل' AND valid_until = ?
    AND id NOT IN (SELECT quote_id FROM track_events WHERE event = 'quote_expiring' AND quote_id IS NOT NULL)`).bind(in2).all();
  for (const q of soon) {
    await recordEvent(db, env, { lead_id: q.lead_id, client_id: q.client_id, quote_id: q.id, event: 'quote_expiring', title: `⏰ تذكير بانتهاء العرض ${q.number} بعد يومين`,
      client_text: `تذكير: عرض السعر ${q.number}${q.title ? ` «${String(q.title).slice(0, 80)}»` : ''} صالح حتى ${arDate(q.valid_until)}. يمكنك مراجعته وقبوله من رابط المتابعة.` });
    out.reminded++;
  }
  const { results: gone } = await db.prepare("SELECT * FROM quotes WHERE status = 'مرسل' AND valid_until IS NOT NULL AND valid_until < ?").bind(t).all();
  for (const q of gone) {
    await db.prepare("UPDATE quotes SET status = 'منتهي', updated_at = datetime('now') WHERE id = ? AND status = 'مرسل'").bind(q.id).run();
    await quoteMoved(db, env, q, 'مرسل', 'منتهي', null, 'آلي');
    out.expired++;
  }
  out.outbox = await flushOutbox(db, env);
  return out;
}

// ---------- المراحل كما يراها العميل ----------
const STAGES = ['استلام الطلب', 'جلسة التشخيص', 'عرض السعر', 'الموافقة', 'التعاقد', 'التنفيذ'];
async function snapshot(db, s) {
  const or = []; const args = [];
  if (s.lead_id) { or.push('lead_id = ?'); args.push(s.lead_id); }
  if (s.client_id) { or.push('client_id = ?'); args.push(s.client_id); }
  const W = `(${or.join(' OR ')})`;
  const { results: quotes } = await db.prepare(`SELECT id, number, title, status, total, valid_until, created_at, updated_at FROM quotes
    WHERE ${W} AND status IN (${VISIBLE.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 30`).bind(...args, ...VISIBLE).all();
  const cid = s.client_id;
  const contracts = cid ? (await db.prepare("SELECT id, number, title, status, start_date, total_value, (esign IS NOT NULL) AS signed FROM contracts WHERE client_id = ? AND status != 'مسودة' AND status != 'ملغي' ORDER BY id DESC LIMIT 10").bind(cid).all()).results.map((c) => ({ ...c, can_sign: c.status === 'بانتظار التوقيع' })) : [];
  const invoices = cid ? (await db.prepare("SELECT id, number, description, status, total, paid, due_date FROM invoices WHERE client_id = ? AND status NOT IN ('مسودة','ملغاة') ORDER BY id DESC LIMIT 20").bind(cid).all()).results : [];
  const projects = cid ? (await db.prepare("SELECT COUNT(*) AS n FROM projects WHERE client_id = ?").bind(cid).first('n')) : 0;
  const { results: events } = await db.prepare(`SELECT event, title, client_text, created_at FROM track_events WHERE ${W} AND client_text IS NOT NULL ORDER BY id DESC LIMIT 30`).bind(...args).all();
  const t = today();
  const done = [
    true,
    !!(quotes.length || ['جلسة تشخيص', 'مهتم', 'محوّل لعميل'].includes(s.lead?.status)),
    quotes.length > 0,
    quotes.some((q) => q.status === 'مقبول') || contracts.length > 0,
    contracts.some((c) => ['موقّع', 'نشط'].includes(c.status)),
    contracts.some((c) => c.status === 'نشط') || projects > 0 || invoices.some((i) => Number(i.paid) > 0),
  ];
  let current = done.findIndex((x) => !x); if (current < 0) current = STAGES.length;
  return {
    name: subjectName(s), contact: s.client?.contact_name || s.lead?.name || '',
    stages: STAGES.map((l, i) => ({ label: l, done: done[i] })), current,
    quotes: quotes.map((q) => ({ ...q, can_act: q.status === 'مرسل' && (!q.valid_until || q.valid_until >= t) })),
    contracts, invoices, events, today: t, wa: '966563413040',
  };
}

// ---------- العام: صفحة المتابعة (بلا دخول، بالمفتاح الموقّع) ----------
// GET public/track/<key> · GET public/track/<key>/doc/<quoteId> · POST public/track/<key>/quote/<quoteId> {action: accept|reject, note}
export async function publicTrack(db, env, request, parts) {
  const s = await subjectFromKey(db, parts[2]);
  if (!s) return bad('رابط المتابعة غير صالح — اطلب رابطاً جديداً من فريقنا', 404);
  const method = request.method.toUpperCase();
  if (!parts[3] && method === 'GET') return json(await snapshot(db, s), 200, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  if (parts[3] === 'contract') return publicContract(db, env, request, s, Number(parts[4]) || 0, parts[5], method);
  const qid = Number(parts[4]) || 0;
  const or = []; const args = [];
  if (s.lead_id) { or.push('lead_id = ?'); args.push(s.lead_id); }
  if (s.client_id) { or.push('client_id = ?'); args.push(s.client_id); }
  const q = await db.prepare(`SELECT * FROM quotes WHERE id = ? AND (${or.join(' OR ')}) AND status IN (${VISIBLE.map(() => '?').join(',')})`).bind(qid, ...args, ...VISIBLE).first();
  if (!q) return bad('العرض غير موجود', 404);
  const viewer = { id: null, name: `رابط المتابعة — ${subjectName(s)}`, role: 'client' };
  if (parts[3] === 'doc' && method === 'GET') {
    const st = await getSettings(db);
    const ctx = { settings: st, today: today(), signName: st.sign_name || 'إياد المغيرة', signTitle: st.sign_title || 'مدير قطاع التسويق' };
    const doc = parse(q.doc, null) || legacyQuoteDoc(q);
    ctx.clientName = [s.client?.contact_name || s.lead?.name, subjectName(s)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' — ');
    await audit(db, viewer, 'view', 'quotes', q.id, 'رابط المتابعة');
    return json({ title: `عرض سعر ${q.number} — ${doc.subject || q.title || ''}`, html: renderHtml(quoteBlocks(q, doc, ctx)) }, 200, { 'cache-control': 'no-store' });
  }
  if (parts[3] === 'quote' && method === 'POST') {
    let d = {}; try { d = await request.json(); } catch { /* */ }
    const note = String(d.note || '').trim().slice(0, 800);
    // «لديّ ملاحظات»: لا يغيّر حالة العرض — تصل الملاحظة للفريق وتُسجَّل في مسار العميل
    if (d.action === 'note') {
      if (!note) return bad('اكتب ملاحظاتك أولاً');
      await recordEvent(db, env, { lead_id: s.lead_id, client_id: s.client_id, quote_id: q.id, event: 'quote_feedback', title: `💬 ملاحظات العميل على ${q.number}`, detail: note, via: 'رابط المتابعة' });
      const ids = new Set([q.created_by, s.lead?.owner_id, s.client?.account_manager_id].filter(Boolean));
      const msg = `💬 ملاحظات من <b>${hx(subjectName(s))}</b> على عرض السعر <b>${hx(q.number)}</b>:
${hx(note)}
➡️ حدّث العرض وأعد إرساله`;
      if (ids.size) { for (const uid of ids) await notifyUser(db, env, uid, msg, null, { kind: 'deal', link: `#quote/${q.id}` }); }
      else await notifyRoles(db, env, ['admin', 'manager'], msg, { kind: 'deal', link: `#quote/${q.id}` });
      return json({ ok: true, status: q.status });
    }
    const action = d.action === 'accept' ? 'مقبول' : d.action === 'reject' ? 'مرفوض' : null;
    if (!action) return bad('إجراء غير معروف');
    if (q.status !== 'مرسل') return bad('لا يمكن تغيير حالة هذا العرض الآن');
    if (q.valid_until && q.valid_until < today()) return bad('انتهت صلاحية العرض — تواصل معنا لتجديده');
    await db.prepare("UPDATE quotes SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = 'مرسل'").bind(action, q.id).run();
    await quoteMoved(db, env, q, 'مرسل', action, null, 'رابط المتابعة');
    if (note) await db.prepare(`INSERT INTO activities (kind, lead_id, client_id, subject, notes, at) VALUES ('مسار العميل', ?, ?, ?, ?, datetime('now'))`)
      .bind(s.lead_id, s.client_id, `ملاحظة العميل على ${q.number}`, note).run();
    await audit(db, viewer, action === 'مقبول' ? 'accept' : 'reject', 'quotes', q.id, note || 'رابط المتابعة');
    // الفريق: منشئ العرض ومالك العميل المحتمل + الإدارة
    const msg = `${action === 'مقبول' ? '✅ قبِل' : '✖️ رفض'} العميل <b>${hx(subjectName(s))}</b> عرض السعر <b>${hx(q.number)}</b> من رابط المتابعة${note ? `\n💬 ${hx(note)}` : ''}${action === 'مقبول' ? '\n➡️ الخطوة التالية: تحويله إلى عقد وإصدار الفاتورة' : ''}`;
    const ids = new Set([q.created_by, s.lead?.owner_id, s.client?.account_manager_id].filter(Boolean));
    for (const uid of ids) await notifyUser(db, env, uid, msg, null, { kind: 'deal', link: `#quote/${q.id}` });
    if (action === 'مقبول') await notifyRoles(db, env, ['admin', 'manager'], msg, { kind: 'deal', link: `#quote/${q.id}` }, [...ids][0] || null);
    return json({ ok: true, status: action });
  }
  return bad('مسار غير معروف', 404);
}

// ---------- العقد في رابط المتابعة: عرضه وتوقيعه إلكترونياً ----------
// GET public/track/<key>/contract/<id> → {title, html, can_sign} · POST .../contract/<id>/sign {name, title, agree, sig (PNG data URL)}
// التوقيع يُحفظ في contracts.esign مع وقت التوقيع وIP والمتصفح ورمز تحقق (SHA-256 من بيانات التوقيع)، وتتحول الحالة إلى «موقّع» ويُبلَّغ الفريق.
const ksaStamp = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' بتوقيت السعودية';
async function publicContract(db, env, request, s, cid, sub, method) {
  if (!s.client_id || !cid) return bad('العقد غير موجود', 404);
  const c = await db.prepare("SELECT * FROM contracts WHERE id = ? AND client_id = ? AND status NOT IN ('مسودة','ملغي')").bind(cid, s.client_id).first();
  if (!c) return bad('العقد غير موجود', 404);
  const viewer = { id: null, name: `رابط المتابعة — ${subjectName(s)}`, role: 'client' };
  if (!sub && method === 'GET') {
    const st = await getSettings(db);
    const ctx = { settings: st, today: today(), signName: st.sign_name || 'إياد المغيرة', signTitle: st.sign_title || 'مدير قطاع التسويق' };
    await audit(db, viewer, 'view', 'contracts', c.id, 'رابط المتابعة');
    return json({ title: `عقد ${c.number} — ${c.title || ''}`, html: renderHtml(await contractBlocksFor(db, c, ctx)), status: c.status, can_sign: c.status === 'بانتظار التوقيع', signer: s.client?.contact_name || '' }, 200, { 'cache-control': 'no-store' });
  }
  if (sub === 'sign' && method === 'POST') {
    let d = {}; try { d = await request.json(); } catch { /* */ }
    if (c.status !== 'بانتظار التوقيع') return bad('هذا العقد ليس بانتظار التوقيع الآن');
    const name = String(d.name || '').trim().slice(0, 80); const title = String(d.title || '').trim().slice(0, 80); const sig = String(d.sig || '');
    if (name.length < 3) return bad('اكتب اسمك الكامل كما في الهوية');
    if (!d.agree) return bad('يلزم الإقرار بالاطلاع على العقد والموافقة على بنوده');
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]{200,}$/.test(sig) || sig.length > 150000) return bad('ارسم توقيعك داخل المربع');
    const at = ksaStamp();
    const ip = request.headers.get('cf-connecting-ip') || ''; const ua = String(request.headers.get('user-agent') || '').slice(0, 200);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${c.id}|${c.number}|${name}|${at}|${sig}`));
    const code = [...new Uint8Array(buf)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const esign = { name, title, at, ip, ua, code, sig, phone: s.client?.phone || '' };
    const r = await db.prepare("UPDATE contracts SET esign = ?, status = 'موقّع', signed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'بانتظار التوقيع'").bind(JSON.stringify(esign), c.id).run();
    if (!r.meta.changes) return bad('وُقّع العقد مسبقاً');
    await audit(db, viewer, 'esign', 'contracts', c.id, `${name} · ${code}`);
    await recordEvent(db, env, { client_id: s.client_id, event: 'contract_signed', dedupe: `contract:${c.id}`, title: `✍️ وقّع العميل العقد ${c.number} إلكترونياً — ${name}`, detail: `رمز التحقق ${code} · ${at}`,
      client_text: `شكراً لك — وُقّع العقد ${c.number} إلكترونياً باسم ${name} (رمز التحقق ${code}). نبدأ التنفيذ بعد سداد الدفعة الأولى وفق جدول العقد.`, via: 'رابط المتابعة' });
    const msg = `✍️ وقّع <b>${hx(subjectName(s))}</b> العقد <b>${hx(c.number)}</b> إلكترونياً من رابط المتابعة\nالموقّع: ${hx(name)}${title ? ' — ' + hx(title) : ''} · رمز التحقق <code>${code}</code>\n➡️ أصدر فاتورة الدفعة الأولى إن لم تُصدر، ثم فعّل العقد`;
    const ids = new Set([c.owner_id, c.created_by, s.client?.account_manager_id].filter(Boolean));
    for (const uid of ids) await notifyUser(db, env, uid, msg, null, { kind: 'deal', link: `#contract/${c.id}` });
    await notifyRoles(db, env, ['admin', 'finance'], msg, { kind: 'finance', link: `#contract/${c.id}` }, [...ids][0] || null);
    return json({ ok: true, code });
  }
  return bad('مسار غير معروف', 404);
}

// إرسال العقد للعميل لتوقيعه إلكترونياً (من صفحة العقد في المنصة): الحالة «بانتظار التوقيع» + رسالة واتساب برابط المتابعة والحساب البنكي
export async function contractSendForSign(db, env, c, user, note) {
  const s = await getSettings(db);
  const text = `عقدك ${c.number}${c.title ? ` «${String(c.title).slice(0, 80)}»` : ''} جاهز للتوقيع الإلكتروني — راجعه ووقّعه من رابط المتابعة (زر «توقيع العقد»).${note ? ` ${note}` : ''}${s.bank_line ? `\nالسداد بالتحويل إلى: ${s.bank_line}` : ''}`;
  await db.prepare("UPDATE contracts SET status = 'بانتظار التوقيع', updated_at = datetime('now') WHERE id = ?").bind(c.id).run();
  return recordEvent(db, env, { client_id: c.client_id, event: 'contract_sent', dedupe: `contract_sent:${c.id}:${Date.now()}`, title: `📨 أُرسل العقد ${c.number} للتوقيع الإلكتروني`, detail: note || null, client_text: text, user, via: 'المنصة' });
}

// ---------- للفريق: GET track/info?lead_id|client_id|quote_id · POST track/send · POST track/retry/<id> · GET track/status ----------
export async function trackRoute(db, env, request, user, sub, id, need) {
  const url = new URL(request.url); const method = request.method.toUpperCase();
  const ref = async () => {
    const q = Number(url.searchParams.get('quote_id')) || 0;
    if (q) { const r = await db.prepare('SELECT lead_id, client_id FROM quotes WHERE id = ?').bind(q).first(); return r ? { ...r, quote_id: q } : null; }
    return { lead_id: Number(url.searchParams.get('lead_id')) || null, client_id: Number(url.searchParams.get('client_id')) || null };
  };
  if (sub === 'info' && method === 'GET') {
    need(user, 'leads', 'r');
    const r = await ref(); const s = r && await subjectOf(db, r);
    if (!s) return json({ link: null, events: [], msgs: [], recipients: [] });
    const or = []; const args = [];
    if (s.lead_id) { or.push('e.lead_id = ?'); args.push(s.lead_id); }
    if (s.client_id) { or.push('e.client_id = ?'); args.push(s.client_id); }
    const qf = r.quote_id ? ' AND (e.quote_id = ? OR e.quote_id IS NULL)' : '';
    const { results: events } = await db.prepare(`SELECT e.*, u.name AS user_name FROM track_events e LEFT JOIN users u ON u.id = e.by_user
      WHERE (${or.join(' OR ')})${qf} ORDER BY e.id DESC LIMIT 60`).bind(...args, ...(r.quote_id ? [r.quote_id] : [])).all();
    const { results: msgs } = await db.prepare(`SELECT id, event_id, to_phone, to_name, role, text, status, mode, error, created_at, sent_at FROM client_msgs
      WHERE ${or.join(' OR ').replace(/e\./g, '')} ORDER BY id DESC LIMIT 60`).bind(...args).all();
    return json({ link: `${SITE}/t/${s.base}.${await sign(db, s.base)}`, events, msgs, recipients: await recipients(db, s) });
  }
  if (sub === 'send' && method === 'POST') {
    need(user, 'leads', 'w');
    let d = {}; try { d = await request.json(); } catch { /* */ }
    const s = await subjectOf(db, { lead_id: Number(d.lead_id) || null, client_id: Number(d.client_id) || null });
    if (!s) return bad('اختر العميل أولاً');
    if (!(await recipients(db, s)).length) return bad('لا يوجد رقم جوال للعميل أو مندوبه');
    const note = String(d.note || '').trim().slice(0, 600);
    const r = await recordEvent(db, env, { lead_id: s.lead_id, client_id: s.client_id, event: 'link', dedupe: `link:${Date.now()}`,
      title: '🔗 أُرسل رابط المتابعة للعميل', detail: note || null, client_text: note || 'هذا رابط متابعة طلبك لدى نُبل وابتكار: تجد فيه مراحل العمل وعروض الأسعار ويمكنك قبولها مباشرة.', user, via: 'المنصة' });
    await audit(db, user, 'send-link', 'leads', s.lead_id || null, s.base);
    return json({ ok: true, ...r });
  }
  if (sub === 'retry' && method === 'POST' && id) {
    need(user, 'leads', 'w');
    await db.prepare("UPDATE client_msgs SET status = 'pending', tries = 0, error = NULL, created_at = datetime('now') WHERE id = ? AND status = 'failed'").bind(id).run();
    return json({ ok: true, flush: await flushOutbox(db, env, { limit: 5 }) });
  }
  if (sub === 'status' && method === 'GET') {
    if (user.role !== 'admin') return bad('للمدير فقط', 403);
    if (url.searchParams.get('check')) await templateReady(db, env, true);
    const s = await getSettings(db);
    const { results } = await db.prepare('SELECT status, COUNT(*) AS n FROM client_msgs GROUP BY status').all();
    return json({ enabled: s.client_notify !== '0', template: s.client_tpl || 'لم يُفحص بعد', checked_at: s.client_tpl_at || null, counts: Object.fromEntries(results.map((r) => [r.status, r.n])) });
  }
  return bad('مسار غير معروف', 404);
}
