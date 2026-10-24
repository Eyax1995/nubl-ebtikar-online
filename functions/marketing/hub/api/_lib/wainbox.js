// صندوق ردود واتساب داخل منصة hub — خطّان: «نُبل وابتكار للتسويق» و«مروج الحجاز» (wa/_lib/lines.js)
// يقرأ المحادثات من قاعدة المساعد (WA_DB) ويرسل ردود الموظفين من رقم خط المحادثة بتوكنه عبر Cloud API.
// معرّف المحادثة: رقم العميل لخط التسويق، و«morooj.<الرقم>» لخط مروج. القائمة تتبع الجهة المختارة (رأس x-org)، وما لا محادثة له يأخذ خطه من ?line=
// المسارات: GET wa/threads · GET wa/thread/<wa_id> · POST wa/send/<wa_id> {text} · POST wa/bot/<wa_id> {on}
// GET wa/templates · POST wa/start {to,name,template,lang,params} · GET|POST wa/profile · POST wa/photo {data,type}
// POST wa/upload (multipart file) · GET wa/media/<media_id>?name=&mime=&dl=1 (باسم الملف وصيغته الأصليين) · POST wa/ai/<wa_id> {mode,draft,hint}
// POST wa/mark/<wa_id> {event_id,kind:pin|star|del|clr,on} · GET wa/starred
// الحذف من صندوق المنصة فقط (إخفاء قابل للاسترجاع في wa_marks): del = رسالة، clr = كل المحادثة حتى رسالة معيّنة.
// واتساب Cloud API لا يتيح حذف رسالة من جوال العميل.
// wa/send يقبل: نص · وسائط (صورة/فيديو/صوت/ملف) · موقع · جهات اتصال · أزرار رد سريع · تفاعل (إيموجي) · رد على رسالة محددة
import { json, bad } from './core.js';
import { askAI } from '../../../../wa/_lib/engine.js';
import { COMMON, KB } from '../../../../wa/_lib/kb.js';
import { MARKETING_EXTRA } from '../../../../wa/_lib/marketing.js';
import { MOROOJ_FULL, moroojWording } from '../../../../wa/_lib/morooj.js';
import { LINES, lineOf, parseThread, threadKey, deptsForOrg } from '../../../../wa/_lib/lines.js';
import { ensureCwTables } from '../../../../wa/import/chatwoot.js';
const CONV_ST = ['open', 'pending', 'resolved'];
let cwReady = false;
const convOf = async (db, dept, waId) => {
  const c = await db.prepare('SELECT status, labels, assignee FROM wa_conv WHERE dept = ? AND wa_id = ?').bind(dept, waId).first();
  let labels = []; try { labels = JSON.parse((c && c.labels) || '[]'); } catch { /* */ }
  return { status: (c && c.status) || 'open', labels, assignee: (c && c.assignee) || '' };
};

const GRAPH = 'https://graph.facebook.com/v23.0';
const ROLES_OK = ['admin', 'manager', 'sales', 'account'];
const ROLES_ADMIN = ['admin', 'manager'];       // إعدادات الملف التجاري
const VERTICALS = ['PROF_SERVICES', 'OTHER', 'RETAIL', 'EDU', 'EVENT_PLAN', 'FINANCE', 'APPAREL', 'BEAUTY', 'ENTERTAIN', 'GROCERY', 'HEALTH', 'HOTEL', 'NONPROFIT', 'RESTAURANT', 'TRAVEL', 'AUTO'];
const STAFF_PAUSE_H = 12;   // بعد رد الموظف يصمت الرد الآلي لهذه المحادثة
const MANUAL_OFF_D = 30;    // إيقاف يدوي للرد الآلي

const cleanId = (s) => String(s || '').replace(/\D/g, '').slice(0, 20);
// 05xxxxxxxx أو 5xxxxxxxx أو 9665… أو رقم دولي → صيغة واتساب
function normPhone(s) {
  let p = String(s || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1); else if (p.startsWith('00')) p = p.slice(2);
  if (/^05\d{8}$/.test(p)) p = '966' + p.slice(1);
  else if (/^5\d{8}$/.test(p)) p = '966' + p;
  return /^\d{10,15}$/.test(p) ? p : '';
}
// L: خط واتساب (يحدد التوكن)
const graph = (env, path, opts = {}, L = LINES.marketing) => fetch(`${GRAPH}/${path}`, {
  ...opts, headers: { authorization: 'Bearer ' + L.token(env), ...(opts.body && typeof opts.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) },
}).then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }));
const gErr = (r) => (r.data && r.data.error && (r.data.error.error_user_msg || r.data.error.message)) || `HTTP ${r.status}`;

// اسم ملف سليم بامتداده الصحيح حسب نوعه
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/3gpp': '3gp', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt', 'text/csv': 'csv', 'application/zip': 'zip', 'application/x-rar-compressed': 'rar', 'application/vnd.rar': 'rar' };
function fileName(name, mime, mid) {
  const ext = EXT[mime] || (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin';
  let n = String(name || '').trim();
  if (!n) n = `واتساب-${new Date().toISOString().slice(0, 10)}-${String(mid).slice(-6)}`;
  if (!/\.[A-Za-z0-9]{2,5}$/.test(n)) n += '.' + ext;
  return n;
}
let marksReady = false;
async function ensureMarks(db) {
  if (marksReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS wa_marks (dept TEXT NOT NULL, wa_id TEXT NOT NULL, event_id INTEGER NOT NULL, kind TEXT NOT NULL, by_name TEXT, at TEXT, PRIMARY KEY (event_id, kind))`).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS wa_marks_thread ON wa_marks (dept, wa_id)').run();
  marksReady = true;
}

// المحذوف من الصندوق: مفتاح clr «القسم:الرقم» لأن الرقم نفسه قد يراسل الخطين
async function hiddenOf(db, depts, waId) {
  await ensureMarks(db);
  const q = depts.map(() => '?').join(',');
  const rows = (await db.prepare(`SELECT dept, wa_id, event_id, kind FROM wa_marks WHERE dept IN (${q}) AND kind IN ('del','clr')` + (waId ? ' AND wa_id = ?' : '')).bind(...depts, ...(waId ? [waId] : [])).all()).results || [];
  const del = new Set(); const clr = {};
  rows.forEach((r) => { const k = r.dept + ':' + r.wa_id; if (r.kind === 'del') del.add(r.event_id); else clr[k] = Math.max(clr[k] || 0, r.event_id); });
  return { del, clr, hidden: (dept, wa, id) => del.has(id) || id <= (clr[dept + ':' + wa] || 0) };
}

export async function waInboxRoute(env, request, user, sub, id) {
  if (!ROLES_OK.includes(user.role)) return bad('لا تملك صلاحية صندوق واتساب', 403);
  if (!env.WA_DB) return bad('قاعدة واتساب غير مربوطة (WA_DB)', 503);
  const db = env.WA_DB;
  const method = request.method.toUpperCase();
  const org = request.headers.get('x-org') || 'all';
  const depts = deptsForOrg(org);
  // خط العمليات التي لا محادثة لها (القوالب، بدء محادثة، الملف التجاري، الرفع)
  const qLine = new URL(request.url).searchParams.get('line');
  const L0 = lineOf(LINES[qLine] ? qLine : org === 'morooj' ? 'morooj' : 'marketing');
  if (!cwReady) { await ensureCwTables(db); cwReady = true; }
  const noToken = (L) => bad(`توكن واتساب «${L.label}» غير مضبوط${L.dept === 'morooj' ? ' (MOROOJ_WA_TOKEN في أسرار Cloudflare)' : ''}`, 503);

  if (sub === 'threads' && method === 'GET') {
    const H = await hiddenOf(db, depts);
    const rows = (await db.prepare(
      `SELECT e.dept, e.wa_id, MAX(e.id) AS last_id, MAX(e.at) AS last_at,
              SUM(CASE WHEN e.kind='message' THEN 1 ELSE 0 END) AS n_in
         FROM wa_events e WHERE e.dept IN (${depts.map(() => '?').join(',')}) AND e.wa_id IS NOT NULL AND e.wa_id <> ''
        GROUP BY e.dept, e.wa_id ORDER BY last_at DESC, last_id DESC LIMIT 200`).bind(...depts).all()).results || [];
    const out = [];
    for (const r of rows) {
      const DEPT = r.dept;
      const clr = H.clr[DEPT + ':' + r.wa_id] || 0;
      // آخر رسالة ظاهرة (بعد استبعاد المحذوف وما قبل مسح المحادثة)
      const lastRows = (await db.prepare(`SELECT id, kind, text, reply, at FROM wa_events WHERE dept=? AND wa_id=? AND id > ? AND kind IN ('message','reply','staff','echo') ORDER BY at DESC, id DESC LIMIT 25`).bind(DEPT, r.wa_id, clr).all()).results || [];
      const last = lastRows.find((x) => !H.del.has(x.id));
      if (clr && !last) continue; // محادثة ممسوحة بلا رسائل جديدة
      const s = await db.prepare('SELECT customer_name, handoff_until FROM wa_sessions WHERE session_key = ?').bind(DEPT + ':' + r.wa_id).first();
      const lastIn = await db.prepare(`SELECT at FROM wa_events WHERE dept=? AND wa_id=? AND kind='message' ORDER BY at DESC, id DESC LIMIT 1`).bind(DEPT, r.wa_id).first();
      const cv = await convOf(db, DEPT, r.wa_id);
      out.push({
        key: threadKey(DEPT, r.wa_id), line: DEPT, line_label: lineOf(DEPT).label, status: cv.status, labels: cv.labels, assignee: cv.assignee,
        wa_id: r.wa_id, name: (s && s.customer_name) || '', last_at: clr && last ? last.at : r.last_at, n_in: r.n_in,
        last_kind: last && last.kind, last_text: last ? (last.kind === 'reply' || last.kind === 'staff' ? (last.reply || last.text) : last.text) : '',
        last_customer_at: lastIn ? lastIn.at : null,
        bot_paused_until: (s && s.handoff_until) || '',
      });
    }
    return json({ threads: out, lines: depts, now: new Date().toISOString() });
  }

  if (sub === 'meta' && method === 'GET') {
    const labels = (await db.prepare('SELECT title, color, description FROM wa_labels WHERE dept = ? ORDER BY title').bind(L0.dept).all()).results || [];
    const quick = (await db.prepare('SELECT id, short_code, content FROM wa_quick WHERE dept = ? ORDER BY id').bind(L0.dept).all()).results || [];
    return json({ line: L0.dept, line_label: L0.label, labels, quick, can_edit: ROLES_ADMIN.includes(user.role) ? 1 : 0 });
  }
  if ((sub === 'quick' || sub === 'labels') && method === 'POST') {
    if (!ROLES_ADMIN.includes(user.role)) return bad('تعديل الردود الجاهزة والوسوم للمدير فقط', 403);
    let b = {}; try { b = await request.json(); } catch { /* */ }
    if (sub === 'quick') {
      if (b.del) await db.prepare('DELETE FROM wa_quick WHERE id = ? AND dept = ?').bind(Number(b.del) || 0, L0.dept).run();
      else {
        const content = String(b.content || '').trim().slice(0, 2000); if (!content) return bad('اكتب نص الرد', 400);
        await db.prepare('INSERT INTO wa_quick (dept, short_code, content) VALUES (?,?,?)').bind(L0.dept, String(b.short_code || '').trim().slice(0, 40), content).run();
      }
    } else if (b.del) await db.prepare('DELETE FROM wa_labels WHERE dept = ? AND title = ?').bind(L0.dept, String(b.del)).run();
    else {
      const title = String(b.title || '').trim().replace(/\s+/g, '_').slice(0, 40); if (!title) return bad('اكتب اسم الوسم', 400);
      await db.prepare('INSERT OR REPLACE INTO wa_labels (dept, title, color, description) VALUES (?,?,?,?)').bind(L0.dept, title, /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#18566D', String(b.description || '').slice(0, 120)).run();
    }
    return json({ ok: true });
  }

  if (sub === 'templates' && method === 'GET') {
    if (!L0.token(env)) return noToken(L0);
    if (!L0.waba(env)) return bad(`معرّف حساب واتساب «${L0.label}» غير مضبوط (MOROOJ_WABA_ID)`, 503);
    const r = await graph(env, `${L0.waba(env)}/message_templates?fields=name,status,category,language,components&limit=100`, {}, L0);
    if (!r.ok) return bad('تعذّر جلب القوالب: ' + gErr(r), 502);
    const all = (r.data.data || []).map((t) => {
      const body = (t.components || []).find((c) => c.type === 'BODY') || {};
      const btns = ((t.components || []).find((c) => c.type === 'BUTTONS') || {}).buttons || [];
      const n = Math.max(0, ...[...String(body.text || '').matchAll(/\{\{(\d+)\}\}/g)].map((m) => +m[1]));
      return { name: t.name, status: t.status, category: t.category, lang: t.language, text: body.text || '', params: n, buttons: btns.map((b) => b.text) };
    });
    return json({ templates: all.filter((t) => t.status === 'APPROVED'), pending: all.filter((t) => t.status !== 'APPROVED').map((t) => ({ name: t.name, status: t.status })) });
  }

  if (sub === 'start' && method === 'POST') {
    if (!L0.token(env)) return noToken(L0);
    const DEPT = L0.dept;
    let b = {}; try { b = await request.json(); } catch { /* */ }
    const to = normPhone(b.to);
    if (!to) return bad('رقم الجوال غير صالح — اكتبه مثل 05XXXXXXXX أو بالصيغة الدولية', 400);
    const tpl = String(b.template || '').replace(/[^a-z0-9_]/g, '');
    if (!tpl) return bad('اختر قالباً معتمداً', 400);
    const lang = String(b.lang || 'ar').replace(/[^A-Za-z_]/g, '') || 'ar';
    const params = (Array.isArray(b.params) ? b.params : []).map((x) => String(x || '').replace(/[\n\t]+/g, ' ').replace(/ {5,}/g, '    ').trim().slice(0, 900));
    if (params.some((x) => !x)) return bad('املأ كل حقول القالب', 400);
    const msg = { messaging_product: 'whatsapp', to, type: 'template', template: { name: tpl, language: { code: lang } } };
    if (params.length) msg.template.components = [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }];
    const r = await graph(env, `${L0.phoneId(env)}/messages`, { method: 'POST', body: JSON.stringify(msg) }, L0);
    const ok = r.ok && r.data.messages && r.data.messages[0];
    const rendered = String(b.preview || '').slice(0, 4000) || `[قالب ${tpl}] ${params.join(' · ')}`;
    await db.prepare(`INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(DEPT, to, 'staff', ok ? r.data.messages[0].id : null, null, rendered, ok ? 'sent' : 'send_failed',
        JSON.stringify({ by: user.name, template: tpl, error: ok ? null : gErr(r) }).slice(0, 1500)).run();
    if (!ok) return bad('تعذّر الإرسال: ' + gErr(r), 502);
    const name = String(b.name || '').trim().slice(0, 80);
    await mergeIntoSession(db, DEPT + ':' + to, to, { r: 'staff', t: rendered, at: new Date().toISOString() },
      new Date(Date.now() + STAFF_PAUSE_H * 3600e3).toISOString(), true, name, DEPT);
    return json({ ok: true, wa_id: to, key: threadKey(DEPT, to) });
  }

  if (sub === 'profile' || sub === 'photo') {
    if (!ROLES_ADMIN.includes(user.role)) return bad('إعدادات واتساب للمدير فقط', 403);
    if (!L0.token(env)) return noToken(L0);
    const phoneId = L0.phoneId(env);
    if (sub === 'profile' && method === 'GET') {
      const [p, n] = await Promise.all([
        graph(env, `${phoneId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`, {}, L0),
        graph(env, `${phoneId}?fields=verified_name,name_status,display_phone_number,quality_rating,messaging_limit_tier`, {}, L0),
      ]);
      if (!p.ok) return bad('تعذّر جلب الملف التجاري: ' + gErr(p), 502);
      return json({ profile: (p.data.data || [])[0] || {}, phone: n.data || {}, verticals: VERTICALS, line: L0.dept, line_label: L0.label });
    }
    if (sub === 'profile' && method === 'POST') {
      let b = {}; try { b = await request.json(); } catch { /* */ }
      const body = { messaging_product: 'whatsapp' };
      const lim = { about: 139, description: 512, address: 256, email: 128 };
      for (const k of Object.keys(lim)) if (b[k] !== undefined) body[k] = String(b[k] || '').trim().slice(0, lim[k]);
      if (body.about === '') return bad('«النبذة» لا يمكن أن تكون فارغة', 400);
      if (b.websites !== undefined) body.websites = (Array.isArray(b.websites) ? b.websites : []).map((x) => String(x).trim()).filter((x) => /^https?:\/\//.test(x)).slice(0, 2);
      if (b.vertical !== undefined) { if (!VERTICALS.includes(b.vertical)) return bad('تصنيف غير معروف', 400); body.vertical = b.vertical; }
      const r = await graph(env, `${phoneId}/whatsapp_business_profile`, { method: 'POST', body: JSON.stringify(body) }, L0);
      if (!r.ok) return bad('لم يُحفظ: ' + gErr(r), 502);
      return json({ ok: true });
    }
    if (sub === 'photo' && method === 'POST') {
      let b = {}; try { b = await request.json(); } catch { /* */ }
      const type = b.type === 'image/png' ? 'image/png' : b.type === 'image/jpeg' ? 'image/jpeg' : '';
      if (!type) return bad('الصورة يجب أن تكون JPG أو PNG', 400);
      let bytes; try { bytes = Uint8Array.from(atob(String(b.data || '')), (c) => c.charCodeAt(0)); } catch { return bad('ملف غير صالح', 400); }
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) return bad('حجم الصورة يجب ألا يتجاوز 5 ميجابايت', 400);
      if (!L0.appId(env)) return bad(`معرّف تطبيق Meta لخط «${L0.label}» غير مضبوط (MOROOJ_APP_ID)`, 503);
      const s1 = await graph(env, `${L0.appId(env)}/uploads?file_name=profile.${type === 'image/png' ? 'png' : 'jpg'}&file_length=${bytes.length}&file_type=${encodeURIComponent(type)}`, { method: 'POST' }, L0);
      if (!s1.ok || !s1.data.id) return bad('تعذّر بدء الرفع: ' + gErr(s1), 502);
      const up = await fetch(`${GRAPH}/${s1.data.id}`, { method: 'POST', headers: { authorization: 'OAuth ' + L0.token(env), file_offset: '0' }, body: bytes });
      const ud = await up.json().catch(() => ({}));
      if (!up.ok || !ud.h) return bad('تعذّر رفع الصورة: ' + ((ud.error && ud.error.message) || up.status), 502);
      const r = await graph(env, `${phoneId}/whatsapp_business_profile`, { method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: ud.h }) }, L0);
      if (!r.ok) return bad('لم تُعتمد الصورة: ' + gErr(r), 502);
      return json({ ok: true });
    }
  }


  // ---------- رفع ملف إلى Meta لإرساله (يُحفظ نسخة في R2 إن كان مربوطاً) ----------
  if (sub === 'upload' && method === 'POST') {
    if (!L0.token(env)) return noToken(L0);
    let form; try { form = await request.formData(); } catch { return bad('ملف غير صالح', 400); }
    const file = form.get('file');
    if (!file || typeof file === 'string') return bad('أرفق ملفاً', 400);
    const mime = (file.type || 'application/octet-stream').toLowerCase();
    const kind = waKind(mime);
    const lim = { image: 5, video: 16, audio: 16, sticker: 0.5, document: 100 }[kind] * 1024 * 1024;
    if (file.size > lim) return bad(`الحد الأقصى لهذا النوع في واتساب ${Math.round(lim / 1048576)} ميجابايت`, 413);
    const fd = new FormData();
    fd.append('messaging_product', 'whatsapp'); fd.append('type', mime);
    fd.append('file', file, file.name || 'file');
    const r = await fetch(`${GRAPH}/${L0.phoneId(env)}/media`, { method: 'POST', headers: { authorization: 'Bearer ' + L0.token(env) }, body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id) return bad('تعذّر رفع الملف إلى واتساب: ' + ((d.error && (d.error.error_user_msg || d.error.message)) || r.status), 502);
    if (env.FILES) { try { await env.FILES.put('wa/' + d.id, file.stream ? file.stream() : await file.arrayBuffer(), { httpMetadata: { contentType: mime }, customMetadata: { name: file.name || '' } }); } catch { /* */ } }
    return json({ id: d.id, kind, mime, name: file.name || '', size: file.size });
  }

  // ---------- عرض وسائط المحادثة (من R2 إن وُجدت، وإلا من Meta ثم تُحفظ) ----------
  if (sub === 'media' && method === 'GET') {
    // يحافظ على اسم الملف وصيغته الأصليين، ويُنزَّل مباشرة عند ?dl=1
    const mid = String(id || '').replace(/[^\w.-]/g, '').slice(0, 64);
    if (!mid) return bad('معرّف غير صالح', 400);
    const q = new URL(request.url).searchParams;
    const dl = q.get('dl');
    const wantName = String(q.get('name') || '').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').trim().slice(0, 120);
    const hdrs = (type, stored) => {
      const mime = String(type || q.get('mime') || 'application/octet-stream').split(';')[0].trim();
      const name = fileName(wantName || stored, mime, mid);
      const ascii = name.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '');
      return { 'content-type': type || mime, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff',
        'content-disposition': `${dl ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}` };
    };
    if (env.FILES) {
      const o = await env.FILES.get('wa/' + mid);
      if (o) return new Response(o.body, { headers: hdrs(o.httpMetadata && o.httpMetadata.contentType, o.customMetadata && o.customMetadata.name) });
    }
    // توكن خط الوسائط: المحدد بـ ?line=، وإلا يُجرَّب كل خط
    const cands = (LINES[qLine] ? [LINES[qLine]] : [L0, ...Object.values(LINES).filter((x) => x !== L0)]).filter((x) => x.token(env));
    if (!cands.length) return noToken(L0);
    let meta = null, ML = null;
    for (const x of cands) { const m = await graph(env, mid, {}, x); if (m.ok && m.data.url) { meta = m; ML = x; break; } }
    if (!meta) return bad('الوسائط غير متاحة (تنتهي صلاحيتها لدى واتساب بعد 30 يوماً)', 404);
    const f = await fetch(meta.data.url, { headers: { authorization: 'Bearer ' + ML.token(env) } });
    if (!f.ok) return bad('تعذّر تنزيل الوسائط', 502);
    const buf = await f.arrayBuffer();
    const mt = meta.data.mime_type || f.headers.get('content-type') || '';
    if (env.FILES) { try { await env.FILES.put('wa/' + mid, buf, { httpMetadata: { contentType: mt }, customMetadata: wantName ? { name: wantName } : {} }); } catch { /* */ } }
    return new Response(buf, { headers: hdrs(mt) });
  }

  // نسخ وسائط من خط إلى خط (للمدير): ملف وصل على رقم التسويق يُرسل من رقم مروج — POST wa/copy {from, to, ids:[media_id]} → {map:{old:new}}
  if (sub === 'copy' && method === 'POST') {
    if (user.role !== 'admin') return bad('للمدير العام فقط', 403);
    let b = {}; try { b = await request.json(); } catch { /* */ }
    const F = lineOf(b.from), T = lineOf(b.to);
    if (F === T || !F.token(env) || !T.token(env)) return bad('خطان مختلفان مضبوطان مطلوبان', 400);
    const map = {};
    for (const mid of (Array.isArray(b.ids) ? b.ids : []).map((x) => String(x).replace(/\D/g, '')).filter(Boolean).slice(0, 30)) {
      try {
        const meta = await graph(env, mid, {}, F);
        if (!meta.ok || !meta.data.url) { map[mid] = { error: 'غير متاح' }; continue; }
        const f = await fetch(meta.data.url, { headers: { authorization: 'Bearer ' + F.token(env) } });
        const mime = meta.data.mime_type || f.headers.get('content-type') || 'application/octet-stream';
        const fd = new FormData(); fd.append('messaging_product', 'whatsapp'); fd.append('type', mime);
        fd.append('file', new Blob([await f.arrayBuffer()], { type: mime }), 'file');
        const up = await fetch(`${GRAPH}/${T.phoneId(env)}/media`, { method: 'POST', headers: { authorization: 'Bearer ' + T.token(env) }, body: fd });
        const ud = await up.json().catch(() => ({}));
        map[mid] = ud.id ? { id: ud.id, mime } : { error: (ud.error && ud.error.message) || up.status };
      } catch (e) { map[mid] = { error: e.message }; }
    }
    return json({ map });
  }

  // الرسائل المميزة بنجمة في كل المحادثات
  if (sub === 'starred' && method === 'GET') {
    await ensureMarks(db);
    let rows = (await db.prepare(
      `SELECT k.event_id, k.dept, k.wa_id, k.at AS marked_at, k.by_name, e.at, e.kind, e.text, e.reply, e.detail
         FROM wa_marks k JOIN wa_events e ON e.id = k.event_id
        WHERE k.dept IN (${depts.map(() => '?').join(',')}) AND k.kind = 'star' ORDER BY k.at DESC LIMIT 200`).bind(...depts).all()).results || [];
    const HS = await hiddenOf(db, depts); rows = rows.filter((r) => !HS.hidden(r.dept, r.wa_id, r.event_id));
    const names = {};
    for (const r of rows) { const nk = r.dept + ':' + r.wa_id; if (!(nk in names)) { const x = await db.prepare('SELECT customer_name FROM wa_sessions WHERE session_key = ?').bind(nk).first(); names[nk] = (x && x.customer_name) || ''; } }
    return json({ items: rows.map((r) => { let dt = {}; try { dt = JSON.parse(r.detail || '{}') || {}; } catch { /* */ }
      return { id: r.event_id, wa_id: threadKey(r.dept, r.wa_id), line: r.dept, name: names[r.dept + ':' + r.wa_id], at: r.at, marked_at: r.marked_at, by: r.by_name || '',
        from: r.kind === 'message' ? 'customer' : r.kind === 'reply' ? 'bot' : 'staff', text: r.kind === 'reply' || r.kind === 'staff' ? (r.reply || r.text || '') : (r.text || ''), media: dt.m || null }; }) });
  }

  const T = parseThread(id);
  const waId = cleanId(T.waId);
  if (!waId) return bad('رقم غير صالح', 400);
  const L = lineOf(T.dept); const DEPT = L.dept;
  const key = DEPT + ':' + waId;

  if (sub === 'thread' && method === 'GET') {
    const ev = (await db.prepare(
      `SELECT id, at, kind, msg_id, text, reply, status, detail FROM wa_events WHERE dept = ? AND wa_id = ? ORDER BY at DESC, id DESC LIMIT 300`)
      .bind(DEPT, waId).all()).results || [];
    const all = ev.reverse();
    const reacts = {};
    for (const e of all) if (e.kind === 'reaction_out') { try { const x = JSON.parse(e.detail || '{}'); if (x.target) reacts[x.target] = x.emoji || ''; } catch { /* */ } }
    const msgs = all.filter((e) => ['message', 'reply', 'staff', 'echo', 'note'].includes(e.kind)).map((e) => {
      let dt = {}; try { dt = JSON.parse(e.detail || '{}') || {}; } catch { /* */ }
      if (e.kind === 'reply' && dt.wamid && !e.msg_id) e.msg_id = dt.wamid;
      return {
        id: e.id, at: e.at, from: e.kind === 'message' ? 'customer' : e.kind === 'reply' ? 'bot' : e.kind === 'note' ? 'note' : 'staff',
        text: e.kind === 'reply' || e.kind === 'staff' || e.kind === 'note' ? (e.reply || e.text || '') : (e.text || ''),
        status: e.status, by: e.kind === 'staff' || e.kind === 'note' ? (dt.by || '') : e.kind === 'echo' ? 'من تطبيق الجوال' : '', src: dt.src || '', err: dt.error || '',
        msg_id: e.msg_id || null, media: dt.m || null, react: (e.msg_id && reacts[e.msg_id]) || '',
        del_ok: ROLES_ADMIN.includes(user.role) || (e.kind === 'staff' && dt.by === user.name) ? 1 : 0,
      };
    });
    const HT = await hiddenOf(db, [DEPT], waId);
    for (let i = msgs.length - 1; i >= 0; i--) if (HT.hidden(DEPT, waId, msgs[i].id)) msgs.splice(i, 1);
    const byWamid = {}; msgs.forEach((m) => { if (m.msg_id) byWamid[m.msg_id] = m; });
    msgs.forEach((m) => { const c = m.media && m.media.ctx && byWamid[m.media.ctx]; if (c) m.quote = { from: c.from, text: String(c.text || '').slice(0, 140) }; });
    await ensureMarks(db);
    const mk = (await db.prepare('SELECT event_id, kind FROM wa_marks WHERE dept = ? AND wa_id = ?').bind(DEPT, waId).all()).results || [];
    const pinned = new Set(mk.filter((x) => x.kind === 'pin').map((x) => x.event_id)); const starred = new Set(mk.filter((x) => x.kind === 'star').map((x) => x.event_id));
    msgs.forEach((m) => { if (pinned.has(m.id)) m.pin = 1; if (starred.has(m.id)) m.star = 1; });
    const s = await db.prepare('SELECT customer_name, handoff_until FROM wa_sessions WHERE session_key = ?').bind(key).first();
    const lastIn = [...msgs].reverse().find((m) => m.from === 'customer');
    return json({
      conv: await convOf(db, DEPT, waId),
      wa_id: waId, key: threadKey(DEPT, waId), line: DEPT, line_label: L.label, name: (s && s.customer_name) || '', bot_paused_until: (s && s.handoff_until) || '',
      window_open: !!(lastIn && Date.now() - Date.parse(lastIn.at.replace(' ', 'T') + 'Z') < 24 * 3600e3),
      can_clear: ROLES_ADMIN.includes(user.role) ? 1 : 0,
      messages: msgs,
    });
  }

  // تثبيت رسالة (حتى 3 لكل محادثة) أو تمييزها بنجمة — {event_id, kind:'pin'|'star', on}
  if (sub === 'mark' && method === 'POST') {
    await ensureMarks(db);
    const b = await request.json().catch(() => ({}));
    let eid = Number(b.event_id) || 0; const kind = ['pin', 'star', 'del', 'clr'].includes(b.kind) ? b.kind : '';
    if (kind === 'clr') {
      if (!ROLES_ADMIN.includes(user.role)) return bad('حذف المحادثة للمدير فقط', 403);
      const mx = await db.prepare('SELECT MAX(id) AS m FROM wa_events WHERE dept = ? AND wa_id = ?').bind(DEPT, waId).first();
      eid = (mx && mx.m) || 0;
      if (!eid) return bad('لا رسائل في المحادثة', 404);
      if (!b.on) { await db.prepare("DELETE FROM wa_marks WHERE dept=? AND wa_id=? AND kind='clr'").bind(DEPT, waId).run(); return json({ ok: true }); }
    }
    if (!eid || !kind) return bad('بيانات ناقصة', 400);
    const ev = await db.prepare('SELECT id, kind, detail FROM wa_events WHERE id = ? AND dept = ? AND wa_id = ?').bind(eid, DEPT, waId).first();
    if (!ev) return bad('الرسالة غير موجودة', 404);
    if (kind === 'del' && !ROLES_ADMIN.includes(user.role)) {
      let dt = {}; try { dt = JSON.parse(ev.detail || '{}') || {}; } catch { /* */ }
      if (!(ev.kind === 'staff' && dt.by === user.name)) return bad('يمكنك حذف رسائلك فقط؛ حذف رسائل العملاء والرد الآلي للمدير', 403);
    }
    if (b.on) {
      if (kind === 'pin') {
        const n = (await db.prepare("SELECT COUNT(*) AS n FROM wa_marks WHERE dept=? AND wa_id=? AND kind='pin'").bind(DEPT, waId).first()).n;
        if (n >= 3) await db.prepare("DELETE FROM wa_marks WHERE rowid = (SELECT rowid FROM wa_marks WHERE dept=? AND wa_id=? AND kind='pin' ORDER BY at ASC LIMIT 1)").bind(DEPT, waId).run();
      }
      await db.prepare("INSERT OR REPLACE INTO wa_marks (dept, wa_id, event_id, kind, by_name, at) VALUES (?,?,?,?,?, datetime('now'))").bind(DEPT, waId, eid, kind, user.name || '').run();
    } else await db.prepare('DELETE FROM wa_marks WHERE event_id = ? AND kind = ?').bind(eid, kind).run();
    return json({ ok: true });
  }

  if (sub === 'send' && method === 'POST') {
    let b = {}; try { b = await request.json(); } catch { /* */ }
    if (!L.token(env)) return noToken(L);
    const lastIn = await db.prepare(`SELECT at FROM wa_events WHERE dept=? AND wa_id=? AND kind='message' ORDER BY at DESC, id DESC LIMIT 1`).bind(DEPT, waId).first();
    if (!lastIn || Date.now() - Date.parse(String(lastIn.at).replace(' ', 'T') + 'Z') >= 24 * 3600e3) {
      return bad('مرّ أكثر من 24 ساعة على آخر رسالة من العميل — واتساب لا يسمح بالرد الحر؛ يلزم قالب معتمد.', 409);
    }
    const built = buildMessage(b);
    if (built.error) return bad(built.error, 400);
    const msg = { messaging_product: 'whatsapp', recipient_type: 'individual', to: waId, ...built.msg };
    const ctx = String(b.reply_to || '').slice(0, 200);
    if (ctx && built.msg.type !== 'reaction') msg.context = { message_id: ctx };
    const r = await graph(env, `${L.phoneId(env)}/messages`, { method: 'POST', body: JSON.stringify(msg) }, L);
    const ok = r.ok && r.data.messages && r.data.messages[0];
    const wamid = ok ? r.data.messages[0].id : null;
    if (built.msg.type === 'reaction') {
      await db.prepare(`INSERT INTO wa_events (dept, wa_id, kind, msg_id, status, detail) VALUES (?,?,?,?,?,?)`)
        .bind(DEPT, waId, 'reaction_out', wamid, ok ? 'sent' : 'send_failed', JSON.stringify({ by: user.name, target: built.msg.reaction.message_id, emoji: built.msg.reaction.emoji })).run();
      if (!ok) return bad('تعذّر الإرسال: ' + gErr(r), 502);
      return json({ ok: true });
    }
    const m = built.media ? { ...built.media } : null;
    if (ctx) (m ? m : (built.media = {})).ctx = ctx;
    const det = { by: user.name, error: ok ? null : gErr(r) }; if (m || built.media) det.m = m || built.media;
    await db.prepare(`INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(DEPT, waId, 'staff', wamid, null, built.label, ok ? 'sent' : 'send_failed', JSON.stringify(det).slice(0, 1500)).run();
    if (!ok) return bad('تعذّر الإرسال: ' + gErr(r), 502);
    await mergeIntoSession(db, key, waId, { r: 'staff', t: built.label, at: new Date().toISOString() },
      new Date(Date.now() + STAFF_PAUSE_H * 3600e3).toISOString(), true, '', DEPT);
    return json({ ok: true, wamid });
  }

  // ---------- ذكاء نُبل: مسودة رد / تحسين / ترجمة / متابعة / ملخص ----------
  if (sub === 'ai' && method === 'POST') {
    let b = {}; try { b = await request.json(); } catch { /* */ }
    const mode = String(b.mode || 'reply');
    const draft = String(b.draft || '').slice(0, 3000);
    const hint = String(b.hint || '').slice(0, 500);
    const ev = ((await db.prepare(`SELECT kind, text, reply, detail FROM wa_events WHERE dept=? AND wa_id=? AND kind IN ('message','reply','staff','echo') ORDER BY id DESC LIMIT 30`)
      .bind(DEPT, waId).all()).results || []).reverse();
    const s = await db.prepare('SELECT customer_name FROM wa_sessions WHERE session_key = ?').bind(key).first();
    const LBL = { message: 'العميل', reply: 'الرد الآلي', staff: 'الموظف', echo: 'الموظف' };
    const transcript = ev.map((e) => `${LBL[e.kind]}: ${e.kind === 'message' || e.kind === 'echo' ? (e.text || '') : (e.reply || e.text || '')}`).join('\n') || '(لا رسائل بعد)';
    const TASK = {
      reply: 'اكتب أفضل رد مقترح على آخر رسالة من العميل.',
      improve: 'حسّن مسودة الموظف التالية لغةً وإقناعاً دون تغيير معناها أو إضافة وعود أو أسعار غير مذكورة.',
      shorter: 'اختصر مسودة الموظف التالية إلى سطرين أو ثلاثة مع الحفاظ على المعنى.',
      formal: 'أعد صياغة مسودة الموظف بفصحى مهنية مهذبة تناسب جهة رسمية أو شركة.',
      friendly: 'أعد صياغة مسودة الموظف بلهجة سعودية ودودة قريبة.',
      english: 'Translate/rewrite the staff draft (or, if empty, a reply to the last customer message) into polished, friendly professional English.',
      followup: 'اكتب رسالة متابعة لطيفة لعميل لم يرد منذ مدة، تذكّره بآخر ما دار وتنتهي بسؤال واحد واضح يدفع للخطوة التالية.',
      close: 'اكتب رسالة تدفع العميل بلطف لاتخاذ القرار (حجز جلسة التشخيص المجانية أو اعتماد العرض) دون ضغط مزعج.',
      summary: 'لخّص المحادثة للموظف (ليست رسالة للعميل): من العميل، ماذا يريد، ما الذي وُعد به، والخطوة التالية المقترحة — في 4 نقاط قصيرة.',
    }[mode];
    if (!TASK) return bad('نوع غير معروف', 400);
    // معرفة خط المحادثة: مروج لها معرفتها الكاملة، والتسويق معرفة نُبل
    const KNOW = DEPT === 'morooj' ? MOROOJ_FULL : `${COMMON}\n\n${KB.marketing || ''}${MARKETING_EXTRA}`;
    const system = `${KNOW}\n\n# مهمتك الآن
أنت لا ترد على العميل مباشرة؛ أنت «ذكاء نُبل» تساعد موظف فريق ${L.label} (${user.name}) في صياغة رسالة يراجعها ثم يرسلها بنفسه من رقم ${L.brand}.${DEPT === 'morooj' ? '\n- لا تُفتِ في المسائل الشرعية، وفي «الإغلاق» ادعُ لإتمام الطلب من المتجر لا لجلسة تشخيص.' : ''}
- لا تخترع سعراً أو موعداً أو خدمة غير مكتوبة في المعرفة أعلاه.
- اكتب النص النهائي فقط بلا مقدمات ولا علامات اقتباس ولا شرح${mode === 'summary' ? '' : '، بصيغة رسالة واتساب جاهزة للإرسال'}.`;
    const userMsg = `اسم العميل: ${(s && s.customer_name) || 'غير معروف'}\n\nالمحادثة (الأقدم أولاً):\n${transcript}\n\n${draft ? `مسودة الموظف:\n${draft}\n\n` : ''}${hint ? `توجيه الموظف: ${hint}\n\n` : ''}المطلوب: ${TASK}`;
    const r = await askAI(env, system, userMsg, true);
    if (!r.ok) return bad('تعذّر التوليد الآن: ' + String(r.error || '').slice(0, 200), 502);
    const out = r.text.replace(/^["«]|["»]$/g, '').trim();
    return json({ text: DEPT === 'morooj' && mode !== 'summary' ? moroojWording(out) : out, engine: r.engine });
  }

  // الحالة (open|pending|resolved) والوسوم والمسؤول — {status?, labels?, assignee?}
  if (sub === 'conv' && method === 'POST') {
    let b = {}; try { b = await request.json(); } catch { /* */ }
    const cur = await convOf(db, DEPT, waId);
    const status = CONV_ST.includes(b.status) ? b.status : cur.status;
    const labels = Array.isArray(b.labels) ? [...new Set(b.labels.map((x) => String(x).slice(0, 40)).filter(Boolean))].slice(0, 12) : cur.labels;
    const assignee = b.assignee !== undefined ? String(b.assignee || '').slice(0, 80) : cur.assignee;
    await db.prepare(`INSERT INTO wa_conv (dept, wa_id, status, labels, assignee, updated_at) VALUES (?,?,?,?,?,datetime('now'))
      ON CONFLICT(dept, wa_id) DO UPDATE SET status=excluded.status, labels=excluded.labels, assignee=excluded.assignee, updated_at=datetime('now')`).bind(DEPT, waId, status, JSON.stringify(labels), assignee || null).run();
    return json({ ok: true, conv: { status, labels, assignee } });
  }
  // ملاحظة داخلية للفريق — لا تُرسل للعميل
  if (sub === 'note' && method === 'POST') {
    let b = {}; try { b = await request.json(); } catch { /* */ }
    const text = String(b.text || '').trim().slice(0, 2000); if (!text) return bad('اكتب الملاحظة', 400);
    await db.prepare('INSERT INTO wa_events (dept, wa_id, kind, reply, status, detail) VALUES (?,?,?,?,?,?)').bind(DEPT, waId, 'note', text, 'note', JSON.stringify({ by: user.name })).run();
    return json({ ok: true });
  }

  if (sub === 'bot' && method === 'POST') {
    let b = {}; try { b = await request.json(); } catch { /* */ }
    const until = b.on ? '' : new Date(Date.now() + MANUAL_OFF_D * 864e5).toISOString();
    await mergeIntoSession(db, key, waId, null, until, false, '', DEPT);
    return json({ ok: true, bot_paused_until: until });
  }

  return bad('مسار غير معروف', 404);
}

// نوع وسائط واتساب من نوع الملف
function waKind(mime) {
  if (/^image\/(jpeg|png)$/.test(mime)) return 'image';
  if (mime === 'image/webp') return 'sticker';
  if (/^video\/(mp4|3gpp)$/.test(mime)) return 'video';
  if (/^audio\/(aac|mp4|mpeg|amr|ogg|opus)/.test(mime)) return 'audio';
  return 'document';
}

// بناء رسالة واتساب من طلب الواجهة — يعيد {msg, label, media} أو {error}
function buildMessage(b) {
  const t = String(b.type || 'text');
  const cap = String(b.caption || b.text || '').trim().slice(0, 1024);
  if (t === 'text') {
    const text = String(b.text || '').trim().slice(0, 4096);
    if (!text) return { error: 'اكتب نص الرد' };
    return { msg: { type: 'text', text: { body: text, preview_url: true } }, label: text };
  }
  if (['image', 'video', 'audio', 'document', 'sticker'].includes(t)) {
    const mid = String(b.media_id || '').replace(/\D/g, '');
    if (!mid) return { error: 'ارفع الملف أولاً' };
    const body = { id: mid };
    if (cap && ['image', 'video', 'document'].includes(t)) body.caption = cap;
    if (t === 'document') body.filename = String(b.filename || 'ملف').slice(0, 240);
    const AR = { image: 'صورة', video: 'فيديو', audio: 'رسالة صوتية', document: 'ملف', sticker: 'ملصق' };
    return { msg: { type: t, [t]: body }, label: `[${AR[t]}${t === 'document' ? ': ' + body.filename : ''}]${cap ? ' ' + cap : ''}`,
      media: { t, id: mid, mime: String(b.mime || ''), fn: body.filename || String(b.filename || ''), cap } };
  }
  if (t === 'location') {
    const lat = Number(b.lat), lng = Number(b.lng);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: 'إحداثيات الموقع غير صالحة' };
    const loc = { latitude: lat, longitude: lng };
    if (b.name) loc.name = String(b.name).slice(0, 100);
    if (b.address) loc.address = String(b.address).slice(0, 250);
    return { msg: { type: 'location', location: loc }, label: `[موقع${loc.name ? ': ' + loc.name : ''}]`,
      media: { t: 'location', loc: { lat, lng, name: loc.name || '', addr: loc.address || '' } } };
  }
  if (t === 'contacts') {
    const list = (Array.isArray(b.contacts) ? b.contacts : []).slice(0, 5).map((c) => {
      const p = normPhone(c.phone); const n = String(c.name || '').trim().slice(0, 80);
      if (!p || !n) return null;
      const parts = n.split(/\s+/);
      const o = { name: { formatted_name: n, first_name: parts[0], ...(parts.length > 1 ? { last_name: parts.slice(1).join(' ') } : {}) }, phones: [{ phone: '+' + p, type: 'WORK', wa_id: p }] };
      if (c.org) o.org = { company: String(c.org).slice(0, 80), ...(c.title ? { title: String(c.title).slice(0, 80) } : {}) };
      if (c.email) o.emails = [{ email: String(c.email).slice(0, 120), type: 'WORK' }];
      return o;
    }).filter(Boolean);
    if (!list.length) return { error: 'اختر جهة اتصال واحدة على الأقل برقم صالح' };
    return { msg: { type: 'contacts', contacts: list }, label: `[جهة اتصال: ${list.map((c) => c.name.formatted_name).join('، ')}]`,
      media: { t: 'contacts', ct: list.map((c) => ({ n: c.name.formatted_name, p: c.phones[0].phone, w: c.phones[0].wa_id })) } };
  }
  if (t === 'buttons') {
    const body = String(b.text || '').trim().slice(0, 1024);
    const btns = (Array.isArray(b.buttons) ? b.buttons : []).map((x) => String(x || '').trim().slice(0, 20)).filter(Boolean).slice(0, 3);
    if (!body || !btns.length) return { error: 'اكتب نص الرسالة وزراً واحداً على الأقل (حتى 3 أزرار، 20 حرفاً لكل زر)' };
    const msg = { type: 'interactive', interactive: { type: 'button', body: { text: body }, action: { buttons: btns.map((title, i) => ({ type: 'reply', reply: { id: 'b' + (i + 1), title } })) } } };
    if (b.footer) msg.interactive.footer = { text: String(b.footer).slice(0, 60) };
    return { msg, label: `${body}\n[أزرار: ${btns.join(' | ')}]`, media: { t: 'buttons', btns } };
  }
  if (t === 'reaction') {
    const target = String(b.message_id || '').slice(0, 200);
    if (!target) return { error: 'رسالة غير محددة' };
    return { msg: { type: 'reaction', reaction: { message_id: target, emoji: String(b.emoji || '').slice(0, 8) } }, label: '' };
  }
  return { error: 'نوع رسالة غير معروف' };
}

// تحديث جلسة المساعد: إضافة رد الموظف لسياق المحادثة وضبط إيقاف الرد الآلي
async function mergeIntoSession(db, key, waId, turn, handoffUntil, onlyExtend, name, dept = 'marketing') {
  const row = await db.prepare('SELECT * FROM wa_sessions WHERE session_key = ?').bind(key).first();
  let history = []; try { history = JSON.parse((row && row.history) || '[]'); } catch { /* */ }
  if (turn) history.push(turn);
  history = history.slice(-20);
  let until = handoffUntil;
  if (onlyExtend && row && row.handoff_until && Date.parse(row.handoff_until) > Date.parse(handoffUntil)) until = row.handoff_until;
  await db.prepare(`INSERT INTO wa_sessions (session_key, dept, wa_id, customer_name, handoff_until, history, waiting_alert_at, updated_at)
      VALUES (?,?,?,?,?,?,NULL,datetime('now'))
      ON CONFLICT(session_key) DO UPDATE SET customer_name=excluded.customer_name, handoff_until=excluded.handoff_until, history=excluded.history, updated_at=datetime('now')`)
    .bind(key, dept, waId, (row && row.customer_name) || name || '', until, JSON.stringify(history)).run();
}
