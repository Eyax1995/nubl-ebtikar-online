// التوظيف (v16): صفحة «انضم إلينا» العامة /marketing/careers + إدارة الطلبات في المنصة
// عام:  GET public/jobs (الوظائف المفتوحة) · POST public/apply (طلب تقديم مع سيرة PDF/صورة/Word حتى 5MB أو رابط)
// داخلي: GET applications/:id/cv (تنزيل السيرة المرفوعة) — يتبع صلاحية applications وقسم الموارد البشرية
// الحماية: فخ الروبوتات (website) + زمن تعبئة لا يقل عن 5 ثوانٍ + 6 طلبات للساعة لكل IP. تكرار التقديم بنفس الجوال للوظيفة نفسها يحدّث الطلب ولا يكرره.
import { json, bad, HttpError, audit, nextNumber, getSettings } from './core.js';
import { notifyRoles, h as hx } from './telegram.js';
import { secret, templateReady } from './track.js';
import { sendText } from '../../../../wa/_lib/engine.js';
import { upsertEvent, googleReady } from './google.js';
import { renderHtml } from './docx.js';
import { offerBlocks } from './docs.js';
import { notifyUser } from './telegram.js';
import { today as todayStr } from './core.js';

export const EXPERIENCE = ['أقل من سنة', 'من سنة إلى سنتين', 'من 3 إلى 5 سنوات', 'أكثر من 5 سنوات'];
export const START_WHEN = ['خلال أسبوع', 'خلال أسبوعين', 'خلال شهر', 'أكثر من شهر'];
export const APP_STATUS = ['جديد', 'قيد الفرز', 'مقابلة', 'عرض وظيفي', 'مقبول', 'معتذر عنه', 'انسحب'];
const DEFAULT_MODES = ['حضوري في جدة']; // الوظائف حضورية افتراضياً — أضف «عن بُعد» أو «مرن» للوظيفة من المنصة عند الحاجة
const MAX_CV = 5 * 1024 * 1024;
const CHUNK = 1_200_000; // محارف base64 لكل صف (حد صف D1 ≈ 2MB)
const CV_MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };

const arr = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };
const s = (v, n = 300) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const isUrl = (v) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v);

// أرقام عربية/فارسية ← لاتينية، ثم صيغة 9665XXXXXXXX للأرقام السعودية
export function cleanPhone(p) {
  let d = String(p || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
  d = d.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1);
  if (/^5\d{8}$/.test(d)) d = '966' + d;
  return d;
}

const publicJob = (j) => ({ id: j.id, slug: j.slug, title: j.title, summary: j.summary, details: j.details, location: j.location,
  modes: arr(j.modes).length ? arr(j.modes) : DEFAULT_MODES, skills: arr(j.skills), tools: arr(j.tools), extra_q: j.extra_q || '',
  date_posted: (j.created_at || '').slice(0, 10) }); // لبيانات JobPosting المنظّمة في صفحة التوظيف

export async function publicJobs(db) {
  const { results } = await db.prepare("SELECT * FROM jobs WHERE status = 'مفتوحة' ORDER BY sort, id DESC").all();
  return json({ jobs: results.map(publicJob), experience: EXPERIENCE, start_when: START_WHEN },
    200, { 'cache-control': 'public, max-age=60' });
}

async function ipHash(request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nubl-apply:' + ip));
  return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function publicApply(db, env, request) {
  let d; try { d = await request.json(); } catch { return bad('بيانات غير صالحة'); }
  if (d.website) return json({ ok: true, number: '—' }); // فخ الروبوتات
  if (Number(d.elapsed) > 0 && Number(d.elapsed) < 5000) return bad('أرسلت النموذج بسرعة كبيرة — راجع بياناتك ثم أعد الإرسال');

  const job = await db.prepare("SELECT * FROM jobs WHERE (id = ? OR slug = ?) AND status = 'مفتوحة'").bind(Number(d.job_id) || 0, s(d.job, 60)).first();
  if (!job) return bad('هذه الوظيفة لم تعد متاحة للتقديم', 404);
  const J = publicJob(job);

  // التحقق — رسالة واضحة لكل حقل (الواجهة تعرضها بجانبه)
  const errs = {};
  const rec = {
    name: s(d.name, 120), phone: cleanPhone(d.phone), email: s(d.email, 160).toLowerCase(), city: s(d.city, 120),
    experience: s(d.experience, 40), portfolio: s(d.portfolio, 500), cv_link: s(d.cv_link, 500), mode: s(d.mode, 40),
    salary: s(d.salary, 40), start_when: s(d.start_when, 40), answer: s(d.answer, 1200),
    skills: JSON.stringify(arr(JSON.stringify(d.skills || [])).filter((x) => J.skills.includes(x))),
    tools: JSON.stringify(arr(JSON.stringify(d.tools || [])).filter((x) => J.tools.includes(x))),
  };
  if (rec.name.split(/\s+/).filter(Boolean).length < 2) errs.name = 'اكتب الاسم الثنائي على الأقل';
  if (!/^\d{9,15}$/.test(rec.phone)) errs.phone = 'رقم الجوال غير صحيح — مثال: 05XXXXXXXX';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rec.email)) errs.email = 'البريد الإلكتروني غير صحيح';
  if (rec.city.length < 2) errs.city = 'اكتب المدينة والحي';
  if (!EXPERIENCE.includes(rec.experience)) errs.experience = 'اختر سنوات الخبرة';
  if (!isUrl(rec.portfolio)) errs.portfolio = 'أضف رابط معرض الأعمال كاملاً (يبدأ بـ https://)';
  if (!J.modes.includes(rec.mode)) errs.mode = 'اختر نوع الدوام';
  if (!/\d/.test(rec.salary.replace(/[٠-٩]/g, '1'))) errs.salary = 'اكتب الراتب المتوقع بالأرقام';
  if (!START_WHEN.includes(rec.start_when)) errs.start_when = 'اختر موعد المباشرة';
  if (!d.consent) errs.consent = 'الموافقة مطلوبة لإرسال الطلب';
  if (rec.cv_link && !isUrl(rec.cv_link)) errs.cv = 'رابط السيرة الذاتية غير صحيح';

  // السيرة المرفوعة (base64)
  let cv = null;
  if (d.cv && d.cv.data) {
    const data = String(d.cv.data).replace(/^data:[^,]*,/, '');
    const size = Math.floor(data.length * 3 / 4);
    const mime = CV_MIME[d.cv.mime] ? d.cv.mime : null;
    if (!/^[A-Za-z0-9+/=]+$/.test(data) || !mime) errs.cv = 'صيغة الملف غير مدعومة — PDF أو Word أو صورة';
    else if (size > MAX_CV) errs.cv = 'حجم الملف أكبر من 5MB — ضع رابطاً بدلاً منه';
    else cv = { data, mime, size, name: s(d.cv.name, 120) || 'cv.' + CV_MIME[mime] };
  }
  if (!cv && !rec.cv_link && !errs.cv) errs.cv = 'ارفع السيرة الذاتية أو ضع رابطها';
  if (Object.keys(errs).length) return json({ error: 'راجع الحقول المحددة', fields: errs }, 400);

  const ih = await ipHash(request);
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM applications WHERE ip_hash = ? AND COALESCE(updated_at, created_at) >= datetime('now','-1 hour')").bind(ih).first('n');
  if (recent >= 6) return bad('وصلنا عدد كبير من الطلبات من جهازك — حاول بعد ساعة', 429);

  // نفس الجوال لنفس الوظيفة = تحديث الطلب السابق بدل تكراره
  const prev = await db.prepare('SELECT id, number, status FROM applications WHERE phone = ? AND job_id = ? ORDER BY id DESC LIMIT 1').bind(rec.phone, job.id).first();
  const cols = ['name', 'phone', 'email', 'city', 'experience', 'skills', 'tools', 'portfolio', 'cv_link', 'mode', 'salary', 'start_when', 'answer'];
  let id, number, updated = false;
  if (prev) {
    id = prev.id; number = prev.number; updated = true;
    await db.prepare(`UPDATE applications SET ${cols.map((c) => c + ' = ?').join(', ')}, ip_hash = ?, submits = submits + 1, updated_at = datetime('now') WHERE id = ?`)
      .bind(...cols.map((c) => rec[c] || null), ih, id).run();
  } else {
    number = await nextNumber(db, 'applications', 'JOB', job.org || 'nubl');
    const r = await db.prepare(`INSERT INTO applications (number, job_id, job_title, org, ip_hash, ${cols.join(', ')}) VALUES (?,?,?,?,?,${cols.map(() => '?').join(',')})`)
      .bind(number, job.id, job.title, job.org || 'nubl', ih, ...cols.map((c) => rec[c] || null)).run();
    id = r.meta.last_row_id;
  }
  if (cv) {
    const parts = []; for (let i = 0; i < cv.data.length; i += CHUNK) parts.push(cv.data.slice(i, i + CHUNK));
    await db.prepare('DELETE FROM app_files WHERE app_id = ?').bind(id).run();
    for (let i = 0; i < parts.length; i++) await db.prepare('INSERT INTO app_files (app_id, seq, data) VALUES (?, ?, ?)').bind(id, i, parts[i]).run();
    await db.prepare('UPDATE applications SET cv_name = ?, cv_mime = ?, cv_size = ?, cv_chunks = ? WHERE id = ?').bind(cv.name, cv.mime, cv.size, parts.length, id).run();
  }
  await audit(db, null, updated ? 'update' : 'create', 'applications', id, `${rec.name} — ${job.title} (من الموقع)`);

  const msg = `${updated ? '🔁 تحديث طلب توظيف' : '📝 طلب توظيف جديد'} — ${job.title}\n${rec.name} · ${rec.city}\nالخبرة: ${rec.experience} · ${rec.mode} · الراتب المتوقع: ${rec.salary}\nالرقم: ${number}`;
  await notifyRoles(db, env, 'admin,manager', msg, { kind: 'hr', title: `${updated ? '🔁 تحديث طلب توظيف' : '📝 طلب توظيف جديد'} — ${rec.name}`, link: `#/application/${id}` });
  return json({ ok: true, number, updated }, updated ? 200 : 201);
}

// ---------- دعوة المقابلة الشخصية وتأكيدها (25 أكتوبر 2026) ----------
// الفريق: POST applications/<id>/invite {at: 'YYYY-MM-DD HH:MM', mode: 'حضوري'|'فيديو', note?} → رسالة واتساب للمتقدم برابط موقّع
//   (نص حر إن كانت نافذة 24 ساعة مفتوحة، وإلا قالب nubl_client_update) + الحالة interview_status = «مدعو».
// المتقدم: GET public/interview/<key> (تفاصيل الموعد) · POST public/interview/<key> {action: confirm|note, note} → «مؤكد» أو «ملاحظات» + تنبيه فريق التوظيف.
// الرابط القصير /i/<key> ← /marketing/careers/interview/?k=<key>، والمفتاح A<id>.<HMAC من سرّ track_secret> فلا يُخمَّن.
const SITE = 'https://nubl-ebtikar.online';
const FROM_PHONE_ID = '1368158866379375';
const OFFICE = { place: 'مكتب نُبل وابتكار للخدمات التسويقية — جدة، حي الحمدانية', maps: 'https://www.google.com/maps/search/%D9%86%D8%A8%D9%84+%D9%88%D8%A7%D8%A8%D8%AA%D9%83%D8%A7%D8%B1+%D9%84%D9%84%D8%AF%D8%B9%D8%A7%D9%8A%D8%A9+%D9%88%D8%A7%D9%84%D8%A7%D8%B9%D9%84%D8%A7%D9%86+%D8%AC%D8%AF%D8%A9' };
const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const firstName = (n) => { const w = String(n || '').trim().split(/\s+/); return /^(عبد|عبدال|أبو|ابو|أم|ام|آل)$/.test(w[0]) && w[1] ? `${w[0]} ${w[1]}` : (w[0] || ''); };
// «الإثنين 26 أكتوبر 2026 الساعة 4:00 م»
export function whenAr(at) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(at || '')); if (!m) return String(at || '');
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); let h = +m[4]; const ap = h >= 12 ? 'م' : 'ص'; h = h % 12 || 12;
  return `${DAYS[d.getUTCDay()]} ${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]} الساعة ${h}:${m[5]} ${ap}`;
}
async function isign(db, base) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(await secret(db)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('interview:' + base));
  return [...new Uint8Array(sig)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function interviewLink(db, id) { return `${SITE}/i/A${id}.${await isign(db, 'A' + id)}`; }
async function graph(env, path, body) {
  const r = await fetch(`${env.WA_GRAPH_URL || 'https://graph.facebook.com/v23.0'}/${path}`, { method: 'POST', headers: { authorization: `Bearer ${env.WA_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let d = {}; try { d = await r.json(); } catch { /* */ }
  return { ok: r.ok && !d.error, data: d };
}
const inviteText = (a, note) => `ندعوك لمقابلة ${a.interview_mode === 'فيديو' ? 'عبر اتصال فيديو (واتساب)' : 'شخصية في ' + OFFICE.place} لوظيفة «${a.job_title || ''}» ${whenAr(a.interview_at)}. يلزم تأكيد الموعد من الرابط، ومن لديه ملاحظات أو يرغب بتغيير الموعد يرسلها من الرابط نفسه عبر طلبه في النظام.${note ? ' ' + note : ''}`;

export async function inviteInterview(db, env, user, id, d) {
  try { return await inviteInterview0(db, env, user, id, d); }
  catch (e) { console.error('invite', e); return bad('تعذّر إرسال الدعوة (خطأ داخلي): ' + String(e && e.message || e).slice(0, 200), 500); }
}
async function inviteInterview0(db, env, user, id, d) {
  const a = await db.prepare('SELECT * FROM applications WHERE id = ?').bind(id).first();
  if (!a) return bad('الطلب غير موجود', 404);
  const at = String(d.at || a.interview_at || '').trim().replace('T', ' ').slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(at)) return bad('حدد تاريخ المقابلة ووقتها');
  const mode = d.mode === 'فيديو' ? 'فيديو' : 'حضوري';
  const note = s(d.note, 300);
  const to = cleanPhone(a.phone);
  if (!/^\d{9,15}$/.test(to)) return bad(`رقم الجوال غير صالح (${a.phone || '—'}) — صحّحه في الطلب أولاً`);
  if (!env.WA_TOKEN) return bad('واتساب غير مضبوط');
  await db.prepare("UPDATE applications SET interview_at = ?, interview_mode = ?, status = 'مقابلة', updated_at = datetime('now') WHERE id = ?").bind(at, mode, id).run();
  const A = { ...a, interview_at: at, interview_mode: mode };
  const text = inviteText(A, note); const link = await interviewLink(db, id); const hello = `مرحباً ${firstName(a.name)}،`;
  // نافذة 24 ساعة مفتوحة؟ نص حر، وإلا القالب المعتمد
  let open = false;
  try { const r = env.WA_DB && await env.WA_DB.prepare("SELECT at FROM wa_events WHERE wa_id = ? AND kind = 'message' ORDER BY id DESC LIMIT 1").bind(to).first(); open = !!(r && Date.now() - Date.parse(String(r.at).replace(' ', 'T') + 'Z') < 23.5 * 3600e3); } catch { /* */ }
  let res, mode_;
  const phoneId = env.WA_PHONE_ID || FROM_PHONE_ID;
  if (open) { res = await sendText(env, phoneId, to, `${hello}\n${text}\n\nللتفاصيل والمتابعة: ${link}\n\nفريق نُبل وابتكار للخدمات التسويقية`); mode_ = 'text'; }
  else {
    if (!(await templateReady(db, env))) return bad('قالب واتساب غير معتمد بعد — لا يمكن مراسلة رقم لم يراسلنا خلال 24 ساعة');
    res = await graph(env, `${phoneId}/messages`, { messaging_product: 'whatsapp', to, type: 'template',
      template: { name: 'nubl_client_update', language: { code: 'ar' }, components: [{ type: 'body', parameters: [firstName(a.name) || 'مرشحنا', text.replace(/\s*[\r\n]+\s*/g, ' · ').replace(/\s{2,}/g, ' ').slice(0, 900), link].map((t) => ({ type: 'text', text: t })) }] } });
    mode_ = 'template';
  }
  const ok = res && res.ok && res.data?.messages?.[0];
  const err = ok ? null : String(res?.data?.error?.message || res?.error || 'تعذّر الإرسال').slice(0, 300);
  try { await env.WA_DB?.prepare('INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)')
    .bind('marketing', to, 'staff', ok ? res.data.messages[0].id : null, null, `${hello}\n${text}\n${link}`, ok ? 'sent' : 'send_failed', JSON.stringify({ by: user?.name || 'دعوة مقابلة', mode: mode_, error: err, interview: id })).run(); } catch { /* */ }
  if (!ok) return bad('تعذّر إرسال الدعوة: ' + err, 409); // لا 502: Cloudflare تستبدل صفحة 5xx بصفحتها فتضيع الرسالة
  await db.prepare("UPDATE applications SET interview_status = 'مدعو', interview_sent_at = datetime('now'), interview_note = NULL, interview_replied_at = NULL WHERE id = ?").bind(id).run();
  await audit(db, user, 'invite', 'applications', id, `${at} ${mode}${note ? ' — ' + note : ''}`);
  return json({ ok: true, at, mode, link, via: mode_ });
}

// ---------- جدولة المقابلة المؤكدة: حدث في تقويم Google (+ رابط Meet للفيديو) + رسالة واتساب بالرابط + مهمة متابعة ----------
// تُستدعى عند تأكيد المتقدم من رابط الدعوة، أو يدوياً POST applications/<id>/schedule (لمن أكّد قبل هذه الميزة أو عند تغيير الموعد)
const addMin = (at, m) => { const d = new Date(at.replace(' ', 'T') + ':00Z'); d.setUTCMinutes(d.getUTCMinutes() + m); return d.toISOString().slice(0, 16).replace('T', ' '); };
async function sendWa(db, env, a, text, link, tag) {
  const to = cleanPhone(a.phone); if (!/^\d{9,15}$/.test(to) || !env.WA_TOKEN) return { ok: false, error: 'رقم غير صالح أو واتساب غير مضبوط' };
  const hello = `مرحباً ${firstName(a.name)}،`; const phoneId = env.WA_PHONE_ID || FROM_PHONE_ID;
  let open = false;
  try { const r = env.WA_DB && await env.WA_DB.prepare("SELECT at FROM wa_events WHERE wa_id = ? AND kind = 'message' ORDER BY id DESC LIMIT 1").bind(to).first(); open = !!(r && Date.now() - Date.parse(String(r.at).replace(' ', 'T') + 'Z') < 23.5 * 3600e3); } catch { /* */ }
  let res, mode_;
  if (open) { res = await sendText(env, phoneId, to, `${hello}\n${text}\n\n${link}\n\nفريق نُبل وابتكار للخدمات التسويقية`); mode_ = 'text'; }
  else {
    if (!(await templateReady(db, env))) return { ok: false, error: 'قالب واتساب غير معتمد' };
    res = await graph(env, `${phoneId}/messages`, { messaging_product: 'whatsapp', to, type: 'template',
      template: { name: 'nubl_client_update', language: { code: 'ar' }, components: [{ type: 'body', parameters: [firstName(a.name) || 'مرشحنا', text.replace(/\s*[\r\n]+\s*/g, ' · ').slice(0, 900), link].map((t) => ({ type: 'text', text: t })) }] } });
    mode_ = 'template';
  }
  const ok = res && res.ok && res.data?.messages?.[0];
  const err = ok ? null : String(res?.data?.error?.message || res?.error || 'تعذّر الإرسال').slice(0, 300);
  try { await env.WA_DB?.prepare('INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)')
    .bind('marketing', to, 'staff', ok ? res.data.messages[0].id : null, null, `${hello}\n${text}\n${link}`, ok ? 'sent' : 'send_failed', JSON.stringify({ by: tag, mode: mode_, error: err, app: a.id })).run(); } catch { /* */ }
  return { ok: !!ok, error: err, via: mode_ };
}
export async function scheduleInterview(db, env, user, id) {
  const a = await db.prepare('SELECT * FROM applications WHERE id = ?').bind(id).first();
  if (!a) return bad('الطلب غير موجود', 404);
  if (!a.interview_at) return bad('لا موعد مقابلة لهذا الطلب');
  const video = a.interview_mode === 'فيديو';
  const out = { calendar: null, meet: a.meet_link || null, wa: null, task: null };
  const s = await getSettings(db);
  const link = `${SITE}/marketing/hub/#/application/${a.id}`;
  // 1) حدث التقويم (+Meet للفيديو) — يُحدَّث إن وُجد
  if (googleReady(env, s)) {
    const r = await upsertEvent(db, env, { id: 'iv' + a.id }, { start: a.interview_at, end: addMin(a.interview_at, 30), eventId: a.gcal_id || undefined, meet: video,
      title: `مقابلة توظيف — ${a.name} (${a.job_title || ''})${video ? ' — فيديو' : ''}`,
      description: `مقابلة ${video ? 'عبر Google Meet' : 'حضورية في مكتب الحمدانية'} لوظيفة ${a.job_title || ''}.\nالمتقدم: ${a.name} · ${a.city || ''} · الجوال ${a.phone || '—'}${a.portfolio ? `\nمعرض الأعمال: ${a.portfolio}` : ''}\nملف الطلب: ${link}`,
      attendees: a.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email) ? [a.email] : [] });
    out.calendar = r.ok ? 'ok' : r.error;
    if (r.ok) { out.meet = video ? (r.link || a.meet_link || null) : null; await db.prepare('UPDATE applications SET gcal_id = ?, meet_link = COALESCE(?, meet_link) WHERE id = ?').bind(r.id, out.meet, a.id).run(); }
  } else out.calendar = 'Google غير مربوط';
  // 2) رسالة التأكيد للمتقدم: رابط Meet للفيديو، أو موقع المكتب للحضوري
  const when = whenAr(a.interview_at);
  const text = video
    ? (out.meet ? `تم تأكيد موعد مقابلتك ${when}. المقابلة عبر Google Meet — ادخل من الرابط في الموعد (نحو 30 دقيقة) وجهّز ملف أعمالك على الشاشة.` : `تم تأكيد موعد مقابلتك ${when}. سنرسل لك رابط اتصال الفيديو قبل الموعد.`)
    : `تم تأكيد موعد مقابلتك ${when} في ${OFFICE.place}. احضر قبل الموعد بعشر دقائق ومعك ملف أعمالك.`;
  const w = await sendWa(db, env, a, text, video && out.meet ? out.meet : (video ? await interviewLink(db, a.id) : OFFICE.maps), 'تأكيد المقابلة');
  out.wa = w.ok ? w.via : w.error;
  // 3) مهمة متابعة للمسؤول (مرة واحدة)
  if (!a.followup_task_id) {
    const owner = a.owner_id || user?.id || (await db.prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1 ORDER BY id LIMIT 1").first('id')) || null;
    const r = await db.prepare(`INSERT INTO tasks (title, assignee_id, status, priority, due_date, est_hours, description, link, created_by) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(`مقابلة توظيف: ${a.name} — ${a.interview_at.slice(11)} ${video ? 'فيديو' : 'حضوري'}`, owner, 'جديدة', 'عالية', a.interview_at.slice(0, 10), 0.5,
        `${a.job_title || ''} · ${a.city || ''} · ${a.phone || ''}${out.meet ? `\nرابط Meet: ${out.meet}` : ''}${a.portfolio ? `\nمعرض الأعمال: ${a.portfolio}` : ''}\nبعد المقابلة: سجّل التقييم والملاحظات في ملف الطلب وحدّث المرحلة (عرض وظيفي / معتذر عنه).`, `#/application/${a.id}`, user?.id || null).run();
    out.task = r.meta.last_row_id;
    await db.prepare('UPDATE applications SET followup_task_id = ? WHERE id = ?').bind(out.task, a.id).run();
  } else out.task = a.followup_task_id;
  await audit(db, user || { id: null, name: 'جدولة المقابلة', role: 'system' }, 'schedule', 'applications', a.id, JSON.stringify(out).slice(0, 300));
  return json({ ok: true, ...out });
}

// ---------- المجدول (/wa/health كل 10 دقائق): تذكير الساعة 8 صباحاً يوم المقابلة لمن دُعي ولم يرد ----------
export async function hiringTick(db, env) {
  const ksa = new Date(Date.now() + 3 * 3600e3); const today = ksa.toISOString().slice(0, 10); const hour = ksa.getUTCHours();
  if (hour < 8 || hour >= 12) return { skipped: 'خارج 08:00–12:00' };
  const { results } = await db.prepare(`SELECT * FROM applications WHERE status = 'مقابلة' AND interview_status = 'مدعو' AND interview_at LIKE ? AND interview_reminded_at IS NULL
    AND interview_at > ? ORDER BY interview_at LIMIT 25`).bind(today + '%', today + ' ' + String(hour).padStart(2, '0') + ':30').all();
  let sent = 0, failed = 0;
  for (const a of results) {
    await db.prepare("UPDATE applications SET interview_reminded_at = datetime('now') WHERE id = ?").bind(a.id).run(); // لا تكرار حتى عند الفشل
    const video = a.interview_mode === 'فيديو';
    const text = `تذكير: مقابلتك لوظيفة «${a.job_title || ''}» اليوم ${whenAr(a.interview_at).replace(/^.*?\d{4} /, '')} ${video ? 'عبر اتصال فيديو' : 'في ' + OFFICE.place}. لم يصلنا تأكيدك بعد — نرجو تأكيد الحضور من الرابط، أو إرسال ملاحظاتك إن كان الموعد لا يناسبك.`;
    const r = await sendWa(db, env, a, text, await interviewLink(db, a.id), 'تذكير المقابلة');
    r.ok ? sent++ : failed++;
  }
  return { sent, failed };
}

// ---------- العرض الوظيفي: مسودة → اعتماد مدير التسويق (admin/manager) → اعتماد الرئيس التنفيذي (executive/admin) → إرسال للمرشح برابط موقّع → قبول/رفض ----------
// الفريق: GET/POST applications/<id>/offer · POST .../offer/submit|approve|reject|send · المرشح: GET/POST public/offer/O<id>.<sig>
const OFFER_FLOW = ['مسودة', 'بانتظار مدير التسويق', 'بانتظار الرئيس التنفيذي', 'معتمد', 'مرسل', 'مقبول', 'مرفوض'];
const ksaStamp = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' بتوقيت السعودية';
const DEF_DUTIES = ['تصميم منشورات وسائل التواصل الاجتماعي وفق هوية كل عميل وخطته الشهرية.', 'مونتاج مقاطع الفيديو والريلز للعملاء والقطاع.', 'كتابة المحتوى العربي للمنشورات والإعلانات ومراجعته لغوياً.', 'تصميم المطبوعات (بروشورات، أغلفة، لوحات، هدايا) بالتنسيق مع قطاع الإنتاج.', 'إعداد الموشن جرافيك والهويات البصرية عند الحاجة.', 'الالتزام بالجدول الزمني واعتمادات العملاء ورفع الأعمال على منصة القطاع.'];
const DEF_BENEFITS = ['التأمينات الاجتماعية والتأمين الطبي وفق النظام بعد التثبيت.', 'إجازة سنوية وإجازات رسمية وفق نظام العمل السعودي.', 'بيئة عمل في فريق تسويق متكامل مع فرص تدريب وتطوير.'];
// الوصف الوظيفي المعتمد (ملف إياد «الوصف الوظيفي — مصمم جرافيك ومونتاج وكتابة محتوى — 20 أكتوبر 2026») — يُضمَّن كاملاً في كل عرض وظيفي للمصمم/ة
export const DESIGNER_JD = {
  title: 'مصمم/ة جرافيك ومونتاج وكتابة محتوى', title_en: 'Graphic Designer, Video Editor & Content Writer',
  intro: 'هذا هو الوصف الوظيفي المعتمد لوظيفتكم في نُبل وابتكار للتسويق، وهو المرجع لإعلان التوظيف والمقابلة وعقد العمل، ولمهامكم ومؤشرات أدائكم بعد المباشرة. الوظيفة هي الحلقة الإنتاجية للقطاع: ما يُخطَّط مع العميل يتحوّل عبرها إلى تصميم وفيديو ونص منشور في موعده وبهوية صاحبه.',
  card: [['الجهة', 'نُبل وابتكار للتسويق — مؤسسة نبل وإبتكار للأعمال التجارية'], ['الارتباط الإداري', 'مدير قطاع التسويق'], ['التنسيق التشغيلي اليومي', 'مدير المشاريع والعلاقات (فيصل النهدي): استلام المهام والمواعيد والملاحظات'],
    ['أدوات العمل', 'Adobe Creative Cloud · Metricool · منصة القطاع · الدرايف المشترك · أدوات الذكاء الاصطناعي المعتمدة لدى القطاع']],
  objective: 'إنتاج كل المواد البصرية والمرئية والنصية لعملاء القطاع ولحسابات الكيان — تصميماً ومونتاجاً وكتابةً — وفق هوية كل عميل المعتمدة وتقويم محتواه الشهري، وبجودة تُسلَّم من أول مرة أو بجولتي تعديل على الأكثر، في موعدها، وبطاقة مخططة تبلغ 12 عقداً شهرياً إلى جانب حسابات الكيان.',
  sections: [
    { h: 'التصميم الجرافيكي', items: ['تصميم منشورات وقصص وكاروسيل منصات التواصل لكل عميل وفق تقويم محتواه المعتمد وبمقاس كل منصة.', 'تصميم الإعلانات الرقمية والحملات الممولة بنسخ متعددة للاختبار.', 'تصميم المطبوعات والبوسترات والبنرات والمواد الدعائية، وتجهيز ملفات الطباعة بمواصفات المطبعة قبل الموسم بأربعة أسابيع.', 'بناء قوالب تصميمية لكل عميل دائم لتسريع الإنتاج وثبات الهوية.', 'معالجة الصور وتجهيزها، وإخراج الملفات بالصيغ والمقاسات الصحيحة.'] },
    { h: 'المونتاج والفيديو', items: ['مونتاج الريلز وفيديوهات تيك توك والقصص والسبوتلايت من المادة الخام (تصوير قطاع الإنتاج، أو مواد العميل، أو التصوير بالهاتف)، بمقاس كل منصة، مع ترجمة نصية عربية مضبوطة.', 'فيديوهات قصيرة بنصوص متحركة وقوالب خفيفة؛ أما التصوير والموشن المتقدم فمن قطاع الإنتاج بطلب داخلي عبر المنصة.', 'الالتزام بالهوية في الفيديو: الشعار الأصلي، والخطوط، والألوان، وبطاقة الختام.', 'أرشفة المادة الخام والمشاريع والنسخ النهائية في مجلد العميل بالدرايف.'] },
    { h: 'كتابة المحتوى والجدولة', items: ['كتابة نصوص المنشورات والتعليقات والسيناريوهات القصيرة بعربية سليمة وبنبرة كل علامة، ولكل منشور إجراء واحد واضح.', 'المشاركة مع مدير المشاريع والعلاقات في بناء تقويم المحتوى الشهري لكل عميل قبل بداية الشهر بسبعة أيام لاعتماده.', 'جدولة المواد المعتمدة على Metricool في مواعيدها، وتسليم الملفات والروابط في المنصة.', 'لا رقم لا يمكن إثباته، ولا وعد بمبيعات أو متابعين، ولا ذكر لاسم عميل أو أرقامه دون موافقة مكتوبة.'] },
    { h: 'الجودة والهوية والالتزام', items: ['قائمة الفحص قبل كل تسليم: الهوية، والإملاء، والأسعار، والمقاسات، وموافقة العميل.', 'لا يُسلَّم أي نص عربي مولّد بالذكاء الاصطناعي داخل صورة أو فيديو؛ يُركَّب النص دائماً في برامج التصميم.', 'أدوات الذكاء الاصطناعي المعتمدة تُستخدم لتسريع الإنتاج، مع مراجعة بشرية لكل مخرج قبل تسليمه.', 'تسجيل كل مهمة وحالتها في المنصة يومياً، وتنفيذ التعديلات ضمن الجولتين المعتمدتين.', 'سرية ملفات المؤسسة والعملاء، وتسليم أصول كل عميل كاملة عند انتهاء التعاقد.', 'تطوير المهارات ومتابعة اتجاهات التصميم والمنصات.'] },
  ],
  skills: ['إجادة Photoshop وIllustrator، وPremiere Pro أو ما يعادله، مع أساسيات After Effects.', 'إتقان الطباعة العربية (Arabic Typography) واتجاه RTL، وحسّ بصري يميّز الجيد من المتوسط.', 'كتابة عربية سليمة بنبرة تسويقية، وإنجليزية تكفي للعمل على الأدوات.', 'معرفة بمقاسات ومتطلبات المنصات وما تكافئه خوارزمياتها.', 'أساسيات الطباعة وتجهيز ملفاتها.', 'تنظيم يسمح بإدارة عدة عملاء في وقت واحد ضمن تقويم شهري، وتقبّل الملاحظات وسرعة التنفيذ.', 'ملف أعمال (Portfolio) يثبت ما سبق في التصميم والفيديو معاً.'],
  kpis: [['التسليم في الموعد', '95% فأكثر', 'شهري من المنصة'], ['جولات التعديل لكل مادة', '2 كحد أقصى', 'شهري'], ['المواد المنجزة مقابل تقويم المحتوى المعتمد', '100%', 'شهري'], ['أخطاء لغوية أو فنية تصل إلى العميل', 'لا شيء', 'شهري'],
    ['الالتزام بهوية كل عميل وهوية الكيان (فحص عشوائي)', '100%', 'شهري'], ['جاهزية ملفات الطباعة قبل الموسم بأربعة أسابيع', '100%', 'موسمي'], ['الجدولة على Metricool في مواعيدها', '100%', 'أسبوعي']],
  capacity: 'الطاقة المخططة للوظيفة 12 عقداً شهرياً إلى جانب حسابات الكيان. ما يتجاوزها يُحال إلى مستقلين عند الذروة أو يُدرج في قائمة الانتظار بقرار مدير القطاع، ولا يُقبل عمل يفوق الطاقة على حساب عميل قائم. التصوير والموشن المتقدم من اختصاص قطاع الإنتاج.',
  probation: 'تُقاس المؤشرات نفسها شهرياً خلال فترة التجربة المنصوص عليها في عقد العمل، ويُعدّ في نهايتها تقييم مكتوب يُبنى عليه التثبيت، ثم مراجعة ربع سنوية. ويُحدَّث هذا الوصف عند تعيين الأخصائي الثاني أو أي تغيير في الهيكل تعتمده الإدارة.',
  source: 'الوصف الوظيفي المعتمد — 20 أكتوبر 2026',
};
const olink = async (db, id) => `${SITE}/o/O${id}.${await isign(db, 'O' + id)}`;
const parseAp = (o) => { try { return JSON.parse(o.approvals || '[]'); } catch { return []; } };
async function offerOf(db, appId) { return db.prepare('SELECT * FROM job_offers WHERE application_id = ? ORDER BY id DESC LIMIT 1').bind(appId).first(); }
export async function offerRoute(db, env, request, user, appId, sub, need) {
  const method = request.method.toUpperCase();
  need(user, 'applications', method === 'GET' ? 'r' : 'w');
  const a = await db.prepare('SELECT * FROM applications WHERE id = ?').bind(appId).first();
  if (!a) return bad('الطلب غير موجود', 404);
  let o = await offerOf(db, appId);
  const isMgr = ['admin', 'manager'].includes(user.role); const isCeo = ['admin', 'executive'].includes(user.role);
  const view = async () => json({ offer: o ? { ...o, link: o.status === 'مرسل' || o.status === 'مقبول' || o.status === 'مرفوض' ? await olink(db, o.id) : null } : null,
    can: { edit: !o || o.status === 'مسودة', submit: !!o && o.status === 'مسودة', approve_mgr: !!o && o.status === 'بانتظار مدير التسويق' && isMgr, approve_ceo: !!o && o.status === 'بانتظار الرئيس التنفيذي' && isCeo, send: !!o && ['معتمد', 'مرسل'].includes(o.status), reject: !!o && ['بانتظار مدير التسويق', 'بانتظار الرئيس التنفيذي', 'معتمد'].includes(o.status) && (isMgr || isCeo) }, flow: OFFER_FLOW });
  if (method === 'GET' && !sub) return view();
  let d = {}; try { d = await request.json(); } catch { /* */ }
  if (method === 'POST' && !sub) { // حفظ المسودة (إنشاء أو تعديل)
    if (o && o.status !== 'مسودة' && user.role !== 'admin') return bad('العرض خرج من المسودة — لا يُعدَّل إلا بإعادته للمسودة');
    const salary = Math.round(Number(d.salary) || 0); if (!(salary > 0)) return bad('أدخل الراتب');
    const lines = (v, def) => { const arr = Array.isArray(v) ? v : String(v || '').split('\n'); const out = arr.map((x) => s(x, 300)).filter(Boolean); return JSON.stringify(out.length ? out : def); };
    const JD_DUTIES = DESIGNER_JD.sections.flatMap((sec) => sec.items.map((x) => `${sec.h}: ${x}`)); // المهام من الوصف المعتمد (افتراضياً)
    const vals = [salary, s(d.salary_note, 160) || null, /^\d{4}-\d{2}-\d{2}$/.test(d.start_date || '') ? d.start_date : null, Math.min(180, Math.max(0, Number(d.probation_days) || 90)), s(d.hours, 120) || 'دوام كامل حضوري — 8 ساعات يومياً، 5 أيام أسبوعياً', s(d.location, 160) || 'جدة — حي الحمدانية', lines(d.duties, JD_DUTIES), lines(d.benefits, DEF_BENEFITS), Math.min(30, Math.max(1, Number(d.valid_days) || 5))];
    if (!o) {
      const number = await nextNumber(db, 'job_offers', 'OFR', a.org || 'nubl');
      const r = await db.prepare(`INSERT INTO job_offers (number, application_id, name, job_title, salary, salary_note, start_date, probation_days, hours, location, duties, benefits, valid_days, status, approvals, org, created_by, jd)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'مسودة','[]',?,?,?)`).bind(number, a.id, a.name, a.job_title, ...vals, a.org || 'nubl', user.id, JSON.stringify(DESIGNER_JD)).run();
      o = await db.prepare('SELECT * FROM job_offers WHERE id = ?').bind(r.meta.last_row_id).first();
      await audit(db, user, 'create', 'job_offers', o.id, `${number} ${a.name} ${salary}`);
    } else {
      await db.prepare(`UPDATE job_offers SET salary=?, salary_note=?, start_date=?, probation_days=?, hours=?, location=?, duties=?, benefits=?, valid_days=?, status='مسودة', updated_at=datetime('now') WHERE id=?`).bind(...vals, o.id).run();
      o = await db.prepare('SELECT * FROM job_offers WHERE id = ?').bind(o.id).first();
      await audit(db, user, 'update', 'job_offers', o.id, `${salary}`);
    }
    if (a.status !== 'عرض وظيفي' && a.status !== 'مقبول') await db.prepare("UPDATE applications SET status = 'عرض وظيفي', updated_at = datetime('now') WHERE id = ?").bind(a.id).run();
    return view();
  }
  if (!o) return bad('أنشئ العرض أولاً');
  const ap = parseAp(o); const push = (step, note) => { ap.push({ step, by: user.name, user_id: user.id, at: new Date().toISOString(), note: note || null }); return JSON.stringify(ap); };
  const setStatus = (st, step, note) => db.prepare("UPDATE job_offers SET status = ?, approvals = ?, updated_at = datetime('now') WHERE id = ?").bind(st, push(step, note), o.id).run();
  const link = `#/application/${a.id}`;
  const title = `${o.number} — ${a.name} (${Number(o.salary).toLocaleString('en-US')} ر.س)`;
  if (sub === 'jd' && method === 'POST') { // تضمين/تحديث الوصف الوظيفي المعتمد في العرض (للمدير)
    if (user.role !== 'admin') return bad('للمدير العام فقط', 403);
    // تضمين الوصف + ضمّ مهامه كاملة في حقل «المهام» ليظهرا في بطاقة العرض والخطاب
    const duties = DESIGNER_JD.sections.flatMap((sec) => sec.items.map((x) => `${sec.h}: ${x}`));
    await db.prepare("UPDATE job_offers SET jd = ?, duties = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(DESIGNER_JD), JSON.stringify(duties), o.id).run();
    await audit(db, user, 'jd', 'job_offers', o.id, DESIGNER_JD.source);
    o = await db.prepare('SELECT * FROM job_offers WHERE id = ?').bind(o.id).first();
    return view();
  }
  if (sub === 'submit' && method === 'POST') {
    if (o.status !== 'مسودة') return bad('العرض ليس مسودة');
    await setStatus('بانتظار مدير التسويق', 'submit', s(d.note, 300));
    await notifyRoles(db, env, ['admin', 'manager'], `📝 عرض وظيفي بانتظار اعتماد مدير التسويق\n<b>${hx(title)}</b>\nمباشرة ${hx(o.start_date || '—')} · تجربة ${o.probation_days} يوماً\nأعدّه ${hx(user.name)} ➡️ راجعه واعتمده من ملف المتقدم`, { kind: 'hr', title: `📝 اعتماد عرض وظيفي — ${a.name}`, link }, user.id);
    await audit(db, user, 'submit', 'job_offers', o.id, '');
  } else if (sub === 'approve' && method === 'POST') {
    if (o.status === 'بانتظار مدير التسويق') {
      if (!isMgr) return bad('اعتماد هذه المرحلة لمدير التسويق', 403);
      await setStatus('بانتظار الرئيس التنفيذي', 'manager', s(d.note, 300));
      const execs = (await db.prepare("SELECT id FROM users WHERE role = 'executive' AND active = 1").all()).results || [];
      for (const u of execs) await notifyUser(db, env, u.id, `✅ اعتمد مدير التسويق العرض الوظيفي <b>${hx(title)}</b> — بانتظار اعتمادك كرئيس تنفيذي\nمباشرة ${hx(o.start_date || '—')} · تجربة ${o.probation_days} يوماً · ${hx(o.job_title || '')}\n➡️ افتح ملف المتقدم واضغط «اعتماد الرئيس التنفيذي»`, null, { kind: 'hr', title: `🖋️ اعتماد الرئيس التنفيذي — ${a.name}`, link, urgent: true });
      if (!execs.length) await notifyRoles(db, env, ['admin'], `⚠️ لا يوجد مستخدم بدور «الرئيس التنفيذي» لاعتماد العرض ${hx(o.number)} — يعتمده المدير العام`, { kind: 'hr', link }, user.id);
    } else if (o.status === 'بانتظار الرئيس التنفيذي') {
      if (!isCeo) return bad('اعتماد هذه المرحلة للرئيس التنفيذي', 403);
      await setStatus('معتمد', 'ceo', s(d.note, 300));
      await notifyRoles(db, env, ['admin', 'manager'], `🖋️ اعتمد الرئيس التنفيذي ${hx(user.name)} العرض الوظيفي <b>${hx(title)}</b>\n➡️ أرسله للمرشحة من ملف المتقدم`, { kind: 'hr', title: `✅ العرض معتمد — ${a.name}`, link }, user.id);
    } else return bad(`العرض «${o.status}» — لا اعتماد مطلوب الآن`);
    await audit(db, user, 'approve', 'job_offers', o.id, o.status);
  } else if (sub === 'reject' && method === 'POST') {
    if (!(isMgr || isCeo)) return bad('غير مصرّح', 403);
    await setStatus('مسودة', 'return', s(d.note, 300) || 'أُعيد للمسودة');
    if (o.created_by) await notifyUser(db, env, o.created_by, `↩️ أُعيد العرض الوظيفي <b>${hx(title)}</b> إلى المسودة بواسطة ${hx(user.name)}${d.note ? `\n💬 ${hx(s(d.note, 300))}` : ''}`, null, { kind: 'hr', link });
    await audit(db, user, 'return', 'job_offers', o.id, s(d.note, 200));
  } else if (sub === 'send' && method === 'POST') {
    if (!['معتمد', 'مرسل'].includes(o.status)) return bad('يُرسل العرض بعد اعتماده');
    const L = await olink(db, o.id);
    const text = `يسعدنا إبلاغك بقبولك للعمل معنا في وظيفة «${o.job_title || ''}» بعد المقابلة. تجد تفاصيل العرض الوظيفي (المهام، الراتب ${Number(o.salary).toLocaleString('en-US')} ر.س، المباشرة ${o.start_date ? whenAr(o.start_date + ' 00:00').replace(/ الساعة.*$/, '') : ''}، فترة التجربة) في الرابط، ويمكنك قبوله أو إرسال استفسارك منه. العرض ساري ${o.valid_days || 5} أيام.${d.note ? ' ' + s(d.note, 300) : ''}`;
    const w = await sendWa(db, env, a, text, L, 'عرض وظيفي');
    if (!w.ok) return bad('تعذّر الإرسال: ' + w.error, 409);
    await db.prepare("UPDATE job_offers SET status = 'مرسل', sent_at = COALESCE(sent_at, datetime('now')), approvals = ?, updated_at = datetime('now') WHERE id = ?").bind(push('send'), o.id).run();
    await audit(db, user, 'send', 'job_offers', o.id, w.via);
  } else return bad('مسار غير معروف', 404);
  o = await db.prepare('SELECT * FROM job_offers WHERE id = ?').bind(o.id).first();
  return view();
}
export async function publicOffer(db, env, request, key) {
  const m = /^O(\d{1,9})\.([a-f0-9]{16})$/.exec(String(key || '')); if (!m || (await isign(db, 'O' + m[1])) !== m[2]) return bad('رابط العرض غير صالح — تواصل معنا على واتساب', 404);
  const o = await db.prepare('SELECT * FROM job_offers WHERE id = ?').bind(+m[1]).first();
  if (!o || !['مرسل', 'مقبول', 'مرفوض'].includes(o.status)) return bad('العرض غير متاح حالياً', 404);
  const st = await getSettings(db);
  const ctx = { settings: st, today: todayStr(), signName: st.sign_name || 'إياد المغيرة', signTitle: st.sign_title || 'مدير قطاع التسويق' };
  const method = request.method.toUpperCase();
  const expired = o.sent_at && Date.now() - Date.parse(String(o.sent_at).replace(' ', 'T') + 'Z') > (o.valid_days || 5) * 864e5;
  const view = () => ({ number: o.number, name: o.name, job: o.job_title, status: o.status, note: o.response_note || '', html: renderHtml(offerBlocks(o, ctx)), can_act: o.status === 'مرسل' && !expired, expired: !!expired && o.status === 'مرسل', wa: '966563413040' });
  if (method === 'GET') return json(view(), 200, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  if (method !== 'POST') return bad('مسار غير معروف', 404);
  let d = {}; try { d = await request.json(); } catch { /* */ }
  const note = s(d.note, 800); const a = await db.prepare('SELECT id, name, phone, status FROM applications WHERE id = ?').bind(o.application_id).first();
  const viewer = { id: null, name: `رابط العرض — ${o.name}`, role: 'applicant' };
  if (d.action === 'note') {
    if (!note) return bad('اكتب استفسارك أولاً');
    await db.prepare("UPDATE job_offers SET response_note = ?, updated_at = datetime('now') WHERE id = ?").bind(note, o.id).run();
    await notifyRoles(db, env, ['admin', 'manager'], `💬 استفسار من <b>${hx(o.name)}</b> على العرض الوظيفي ${hx(o.number)}:\n${hx(note)}`, { kind: 'hr', title: `💬 استفسار على العرض — ${o.name}`, link: `#/application/${o.application_id}` });
    o.response_note = note; return json({ ok: true, ...view() });
  }
  if (o.status !== 'مرسل') return bad('سبق الرد على هذا العرض');
  if (expired) return bad('انتهت مدة العرض — تواصل معنا على واتساب لتجديده');
  if (d.action === 'accept') {
    const name = s(d.name, 80); if (name.length < 3) return bad('اكتب اسمك الكامل');
    if (!d.agree) return bad('يلزم الإقرار بالاطلاع على العرض والموافقة عليه');
    const at = ksaStamp();
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`offer|${o.id}|${o.number}|${name}|${at}`));
    const code = [...new Uint8Array(buf)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const sig = /^data:image\/png;base64,[A-Za-z0-9+/=]{200,}$/.test(String(d.sig || '')) && String(d.sig).length <= 150000 ? d.sig : null;
    await db.prepare("UPDATE job_offers SET status = 'مقبول', response = 'مقبول', response_note = ?, responded_at = datetime('now'), esign = ?, updated_at = datetime('now') WHERE id = ? AND status = 'مرسل'")
      .bind(note || null, JSON.stringify({ name, title: 'قبول العرض', at, code, sig, ip: request.headers.get('cf-connecting-ip') || '', phone: a?.phone || '' }), o.id).run();
    await db.prepare("UPDATE applications SET status = 'مقبول', updated_at = datetime('now') WHERE id = ?").bind(o.application_id).run();
    await audit(db, viewer, 'accept', 'job_offers', o.id, `${name} · ${code}`);
    await notifyRoles(db, env, ['admin', 'manager', 'executive', 'finance'], `🎉 قبِل <b>${hx(o.name)}</b> العرض الوظيفي ${hx(o.number)} (${Number(o.salary).toLocaleString('en-US')} ر.س، مباشرة ${hx(o.start_date || '—')})\nالموقّع: ${hx(name)} · رمز التحقق <code>${code}</code>${note ? `\n💬 ${hx(note)}` : ''}\n➡️ جهّز عقد العمل وملف الموظف`, { kind: 'hr', title: `🎉 قبول العرض — ${o.name}`, link: `#/application/${o.application_id}`, urgent: true });
    o.status = 'مقبول'; o.esign = JSON.stringify({ name, at, code, sig }); return json({ ok: true, code, ...view() });
  }
  if (d.action === 'decline') {
    await db.prepare("UPDATE job_offers SET status = 'مرفوض', response = 'مرفوض', response_note = ?, responded_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'مرسل'").bind(note || null, o.id).run();
    await audit(db, viewer, 'decline', 'job_offers', o.id, note);
    await notifyRoles(db, env, ['admin', 'manager', 'executive'], `✖️ اعتذر <b>${hx(o.name)}</b> عن قبول العرض الوظيفي ${hx(o.number)}${note ? `\n💬 ${hx(note)}` : ''}`, { kind: 'hr', title: `✖️ رفض العرض — ${o.name}`, link: `#/application/${o.application_id}` });
    o.status = 'مرفوض'; return json({ ok: true, ...view() });
  }
  return bad('إجراء غير معروف');
}

// رسالة اعتذار لطيفة للمستبعد: نحتفظ ببياناته لأي احتياج أو توظيف مستقبلي — POST applications/<id>/regret
const REGRET_LINK = `${SITE}/marketing/careers`;
export async function regretApplicant(db, env, user, id) {
  try {
    const a = await db.prepare('SELECT * FROM applications WHERE id = ?').bind(id).first();
    if (!a) return bad('الطلب غير موجود', 404);
    if (a.status !== 'معتذر عنه') return bad('الطلب ليس في مرحلة «معتذر عنه»');
    const to = cleanPhone(a.phone);
    if (!/^\d{9,15}$/.test(to)) return bad(`رقم الجوال غير صالح (${a.phone || '—'})`);
    if (!env.WA_TOKEN) return bad('واتساب غير مضبوط');
    const text = `نشكر لك اهتمامك بالتقديم لوظيفة «${a.job_title || ''}» لدى نُبل وابتكار للخدمات التسويقية. بعد مراجعة الطلبات لم يقع الاختيار عليك في هذه المرحلة، وسنحتفظ ببياناتك وملف أعمالك في قاعدة مرشحينا لأي احتياج أو وظيفة مستقبلية، وسنتواصل معك عند توفر ما يناسبك. نتمنى لك كل التوفيق.`;
    const hello = `مرحباً ${firstName(a.name)}،`;
    let open = false;
    try { const r = env.WA_DB && await env.WA_DB.prepare("SELECT at FROM wa_events WHERE wa_id = ? AND kind = 'message' ORDER BY id DESC LIMIT 1").bind(to).first(); open = !!(r && Date.now() - Date.parse(String(r.at).replace(' ', 'T') + 'Z') < 23.5 * 3600e3); } catch { /* */ }
    const phoneId = env.WA_PHONE_ID || FROM_PHONE_ID; let res, mode_;
    if (open) { res = await sendText(env, phoneId, to, `${hello}\n${text}\n\nوظائفنا الجديدة تُنشر هنا: ${REGRET_LINK}\n\nفريق نُبل وابتكار للخدمات التسويقية`); mode_ = 'text'; }
    else {
      if (!(await templateReady(db, env))) return bad('قالب واتساب غير معتمد بعد');
      res = await graph(env, `${phoneId}/messages`, { messaging_product: 'whatsapp', to, type: 'template',
        template: { name: 'nubl_client_update', language: { code: 'ar' }, components: [{ type: 'body', parameters: [firstName(a.name) || 'مرشحنا', text, REGRET_LINK].map((t) => ({ type: 'text', text: t })) }] } });
      mode_ = 'template';
    }
    const ok = res && res.ok && res.data?.messages?.[0];
    const err = ok ? null : String(res?.data?.error?.message || res?.error || 'تعذّر الإرسال').slice(0, 300);
    try { await env.WA_DB?.prepare('INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)')
      .bind('marketing', to, 'staff', ok ? res.data.messages[0].id : null, null, `${hello}\n${text}\n${REGRET_LINK}`, ok ? 'sent' : 'send_failed', JSON.stringify({ by: user?.name || 'اعتذار', mode: mode_, error: err, regret: id })).run(); } catch { /* */ }
    if (!ok) return bad('تعذّر الإرسال: ' + err, 409);
    await db.prepare("UPDATE applications SET regret_sent_at = datetime('now') WHERE id = ?").bind(id).run();
    await audit(db, user, 'regret', 'applications', id, mode_);
    return json({ ok: true, via: mode_ });
  } catch (e) { console.error('regret', e); return bad('خطأ داخلي: ' + String(e && e.message || e).slice(0, 200), 500); }
}

async function fromKey(db, key) {
  const m = /^A(\d{1,9})\.([a-f0-9]{16})$/.exec(String(key || '')); if (!m) return null;
  if ((await isign(db, 'A' + m[1])) !== m[2]) return null;
  return db.prepare('SELECT id, number, name, job_title, status, interview_at, interview_mode, interview_status, interview_note, interview_replied_at FROM applications WHERE id = ?').bind(+m[1]).first();
}
export async function publicInterview(db, env, request, key) {
  const a = await fromKey(db, key);
  if (!a || !a.interview_at) return bad('رابط الدعوة غير صالح — تواصل معنا على واتساب', 404);
  const method = request.method.toUpperCase();
  const view = () => ({ name: a.name, job: a.job_title, at: a.interview_at, when: whenAr(a.interview_at), mode: a.interview_mode || 'حضوري',
    place: a.interview_mode === 'فيديو' ? 'اتصال فيديو عبر واتساب على رقمك المسجل' : OFFICE.place, maps: a.interview_mode === 'فيديو' ? '' : OFFICE.maps,
    status: a.interview_status || 'مدعو', note: a.interview_note || '', replied_at: a.interview_replied_at, wa: '966563413040', closed: !['مقابلة'].includes(a.status) });
  if (method === 'GET') return json(view(), 200, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  if (method !== 'POST') return bad('مسار غير معروف', 404);
  let d = {}; try { d = await request.json(); } catch { /* */ }
  const note = s(d.note, 800);
  const st = d.action === 'confirm' ? 'مؤكد' : d.action === 'note' ? 'ملاحظات' : null;
  if (!st) return bad('إجراء غير معروف');
  if (st === 'ملاحظات' && !note) return bad('اكتب ملاحظاتك أولاً');
  if (a.status !== 'مقابلة') return bad('هذه الدعوة لم تعد نشطة — تواصل معنا على واتساب');
  const keep = note || (st === 'مؤكد' ? a.interview_note : '') || null; // التأكيد بلا ملاحظة جديدة يحتفظ بالملاحظة السابقة
  await db.prepare("UPDATE applications SET interview_status = ?, interview_note = ?, interview_replied_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(st, keep, a.id).run();
  await audit(db, { id: null, name: `رابط الدعوة — ${a.name}`, role: 'applicant' }, st === 'مؤكد' ? 'confirm' : 'note', 'applications', a.id, note || whenAr(a.interview_at));
  const msg = st === 'مؤكد'
    ? `✅ أكّد <b>${hx(a.name)}</b> حضور المقابلة ${hx(whenAr(a.interview_at))}${note ? `\n💬 ${hx(note)}` : ''}`
    : `💬 ملاحظات من <b>${hx(a.name)}</b> على موعد المقابلة (${hx(whenAr(a.interview_at))}):\n${hx(note)}\n➡️ راجع الطلب وعدّل الموعد إن لزم`;
  await notifyRoles(db, env, 'admin,manager', msg, { kind: 'hr', title: st === 'مؤكد' ? `✅ تأكيد مقابلة — ${a.name}` : `💬 ملاحظات مقابلة — ${a.name}`, link: `#/application/${a.id}` });
  // التأكيد يجدول المقابلة: حدث التقويم (+Meet) ورسالة بالرابط ومهمة متابعة
  if (st === 'مؤكد') { try { await scheduleInterview(db, env, null, a.id); } catch (e) { console.warn('schedule', e.message); } }
  a.interview_status = st; a.interview_note = note || ''; a.interview_replied_at = new Date().toISOString();
  return json({ ok: true, ...view() });
}

// تنزيل السيرة المرفوعة — الصلاحية (الدور + القسم) تُفحص في الموجّه قبل الاستدعاء
export async function applicationCv(db, user, id) {
  const a = await db.prepare('SELECT id, number, name, cv_name, cv_mime, cv_chunks FROM applications WHERE id = ?').bind(id).first();
  if (!a || !a.cv_chunks) throw new HttpError(404, 'لا توجد سيرة مرفوعة لهذا الطلب');
  const { results } = await db.prepare('SELECT data FROM app_files WHERE app_id = ? ORDER BY seq').bind(id).all();
  const bin = Uint8Array.from(atob(results.map((r) => r.data).join('')), (c) => c.charCodeAt(0));
  await audit(db, user, 'download', 'applications', a.id, a.cv_name);
  const fname = encodeURIComponent(`${a.number || 'JOB'} - ${a.name} - ${a.cv_name || 'cv'}`);
  return new Response(bin, { headers: { 'content-type': a.cv_mime || 'application/octet-stream', 'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff', 'content-disposition': `inline; filename*=UTF-8''${fname}` } });
}
