// التوظيف (v16): صفحة «انضم إلينا» العامة /marketing/careers + إدارة الطلبات في المنصة
// عام:  GET public/jobs (الوظائف المفتوحة) · POST public/apply (طلب تقديم مع سيرة PDF/صورة/Word حتى 5MB أو رابط)
// داخلي: GET applications/:id/cv (تنزيل السيرة المرفوعة) — يتبع صلاحية applications وقسم الموارد البشرية
// الحماية: فخ الروبوتات (website) + زمن تعبئة لا يقل عن 5 ثوانٍ + 6 طلبات للساعة لكل IP. تكرار التقديم بنفس الجوال للوظيفة نفسها يحدّث الطلب ولا يكرره.
import { json, bad, HttpError, audit, nextNumber } from './core.js';
import { notifyRoles } from './telegram.js';

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
  modes: arr(j.modes).length ? arr(j.modes) : DEFAULT_MODES, skills: arr(j.skills), tools: arr(j.tools), extra_q: j.extra_q || '' });

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
