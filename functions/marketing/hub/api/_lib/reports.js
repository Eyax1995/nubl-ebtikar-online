// التقارير الدورية لفريق التسويق — مرتين يومياً على الأقل (افتراضياً 8:00 ص و5:00 م بتوقيت الرياض)
// كل عضو يصله تقرير شخصي حسب مهامه ودوره، والإدارة تصلها حالة القطاع كاملة.
// القنوات: تلجرام (مجاني بالكامل، التقرير كاملاً) + واتساب (الرسالة الحرة مجانية داخل نافذة 24 ساعة،
// وخارجها قالب خدمي مختصر يدعو العضو للرد بـ«تقرير» فتنفتح النافذة ويصله التقرير كاملاً).
import { getSettings, today, addDays } from './core.js';
import { ENTITIES } from './schema.js';
import { allowed } from './sections.js';
import { tgToken, tgCall, waBridge, h as hx } from './telegram.js';

const BOSS = ['admin', 'manager', 'executive'];
const can = (u, ent, op = 'r') => allowed(u, ent, op);
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const nf = (x) => new Intl.NumberFormat('en-US').format(Math.round(Number(x) || 0));
export const ksaHour = () => (new Date().getUTCHours() + 3) % 24;
export const ksaHM = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(11, 16);

function rel(d, t) {
  if (!d) return 'بلا موعد';
  const n = Math.round((Date.parse(d) - Date.parse(t)) / 864e5);
  return n < 0 ? `متأخرة ${-n} يوم` : n === 0 ? 'اليوم' : n === 1 ? 'غداً' : `بعد ${n} أيام`;
}

// المهام التي تخص العضو: مكلّف بها أو طرف فيها
const MINE = '(t.assignee_id = ?1 OR t.id IN (SELECT task_id FROM task_people WHERE user_id = ?1))';

// يبني التقرير كأسطر محايدة: {b:true} = عنوان قسم
export async function buildReport(db, user, slot = 'am') {
  const t = today(); const tomorrow = addDays(t, 1);
  const all = async (sql, ...a) => { try { return (await db.prepare(sql).bind(...a).all()).results || []; } catch { return []; } };
  const one = async (sql, ...a) => { try { return (await db.prepare(sql).bind(...a).first()) || {}; } catch { return {}; } };
  const L = []; const sec = (x) => L.push({ b: true, t: x }); const ln = (x) => L.push({ t: x });
  const first = String(user.name || '').split(' ')[0];
  const pm = slot === 'pm';
  L.push({ t: `${pm ? 'مساء الخير' : 'صباح الخير'} ${first} ${pm ? '🌙' : '🌤️'} — ${pm ? 'تقرير نهاية اليوم' : 'تقرير الصباح'} ${t}` });

  const open = await all(`SELECT t.id, t.title, t.status, t.due_date, t.priority, c.name AS client FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
    WHERE ${MINE} AND t.status != 'منجزة' ORDER BY t.due_date IS NULL, t.due_date, t.id LIMIT 60`, user.id);
  const late = open.filter((x) => x.due_date && x.due_date < t);
  const dueToday = open.filter((x) => x.due_date === t);
  const dueTom = open.filter((x) => x.due_date === tomorrow);
  const doneToday = (await one(`SELECT COUNT(*) AS n FROM tasks t WHERE ${MINE} AND t.status = 'منجزة' AND t.done_at = ?2`, user.id, t)).n || 0;
  const review = await all(`SELECT id, title FROM tasks WHERE status = 'مراجعة' AND created_by = ? AND assignee_id != ? ORDER BY id LIMIT 10`, user.id, user.id);

  sec(`📋 مهامي — مفتوحة ${open.length}${late.length ? ` · متأخرة ${late.length}` : ''}${pm ? ` · أنجزت اليوم ${doneToday}` : ''}`);
  const show = [...late, ...dueToday, ...(pm ? dueTom : dueTom.slice(0, 3))].slice(0, 8);
  if (show.length) show.forEach((x) => ln(`• #${x.id} ${cut(x.title, 60)}${x.client ? ` · ${cut(x.client, 25)}` : ''} — ${rel(x.due_date, t)} · ${x.status}`));
  else ln(open.length ? '• لا شيء مستحق اليوم أو غداً 👌' : '• لا مهام مفتوحة عليك 👌');
  if (review.length) { sec(`👀 بانتظار مراجعتك (${review.length})`); review.slice(0, 5).forEach((x) => ln(`• #${x.id} ${cut(x.title, 60)}`)); }

  let fol = [];
  if (can(user, 'leads')) {
    fol = await all(`SELECT id, name, company, next_followup FROM leads WHERE next_followup IS NOT NULL AND next_followup <= ?
      AND status NOT IN ('محوّل لعميل','غير مهتم','غير صالح') ${BOSS.includes(user.role) ? '' : 'AND owner_id = ' + Number(user.id)} ORDER BY next_followup LIMIT 20`, pm ? tomorrow : t);
    if (fol.length) { sec(`👥 متابعات عملاء ${pm ? 'حتى الغد' : 'مستحقة'} (${fol.length})`); fol.slice(0, 6).forEach((x) => ln(`• ${cut([x.company, x.name].filter(Boolean).join(' — '), 55)} — ${rel(x.next_followup, t)}`)); }
  }
  const content = await all(`SELECT ct.title, ct.publish_date, ct.publish_time, ct.status, cl.name AS client FROM content ct LEFT JOIN clients cl ON cl.id = ct.client_id
    WHERE (ct.assignee_id = ? OR ct.designer_id = ?) AND ct.status NOT IN ('منشور','ملغي','مجدول') AND ct.publish_date <= ? ORDER BY ct.publish_date LIMIT 20`, user.id, user.id, addDays(t, 2));
  if (content.length) { sec(`🗓️ محتوى خلال يومين (${content.length})`); content.slice(0, 6).forEach((x) => ln(`• ${cut(x.client || '', 20)}: ${cut(x.title, 45)} — ${x.status} · ${rel(x.publish_date, t)}${x.publish_time ? ' ' + x.publish_time : ''}`)); }

  if (can(user, 'invoices') && ['admin', 'finance'].includes(user.role)) {
    const inv = await one(`SELECT COUNT(*) AS n, COALESCE(SUM(total - paid),0) AS v FROM invoices WHERE status IN ('مصدرة','مدفوعة جزئياً','متأخرة') AND due_date < ?`, t);
    const com = await one("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS v FROM commissions WHERE status = 'مستحقة'");
    const qr = await one('SELECT COUNT(*) AS n FROM quotes WHERE price_review = 1');
    if (inv.n || com.n || qr.n) {
      sec('💰 المالية');
      if (inv.n) ln(`• فواتير متأخرة: ${inv.n} بقيمة ${nf(inv.v)} ر.س`);
      if (com.n) ln(`• عمولات مناديب بانتظار الاعتماد: ${com.n} (${nf(com.v)} ر.س)`);
      if (qr.n) ln(`• عروض أسعار بانتظار اعتماد الأسعار: ${qr.n}`);
    }
  }

  let team = null;
  if (BOSS.includes(user.role)) {
    const tk = await one(`SELECT SUM(CASE WHEN status != 'منجزة' THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status != 'منجزة' AND due_date < ?1 THEN 1 ELSE 0 END) AS late,
      SUM(CASE WHEN status = 'مراجعة' THEN 1 ELSE 0 END) AS review, SUM(CASE WHEN status = 'منجزة' AND done_at = ?1 THEN 1 ELSE 0 END) AS done FROM tasks`, t);
    const ld = await one(`SELECT SUM(CASE WHEN substr(created_at,1,10) = ?1 THEN 1 ELSE 0 END) AS today,
      SUM(CASE WHEN next_followup < ?1 AND status NOT IN ('محوّل لعميل','غير مهتم','غير صالح') THEN 1 ELSE 0 END) AS overdue FROM leads`, t);
    const dl = await one("SELECT COALESCE(SUM(CASE WHEN stage NOT IN ('مكسوبة','خاسرة') THEN value END),0) AS pipe, SUM(CASE WHEN stage NOT IN ('مكسوبة','خاسرة') AND updated_at < datetime('now','-7 days') THEN 1 ELSE 0 END) AS stale FROM deals");
    const people = await all(`SELECT u.name, SUM(CASE WHEN t.status != 'منجزة' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN t.status != 'منجزة' AND t.due_date < ? THEN 1 ELSE 0 END) AS late FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id
      WHERE u.active = 1 GROUP BY u.id HAVING open > 0 ORDER BY late DESC, open DESC LIMIT 8`, t);
    team = tk;
    sec('🧭 حالة القطاع');
    ln(`• المهام: مفتوحة ${tk.open || 0} · متأخرة ${tk.late || 0} · للمراجعة ${tk.review || 0} · أُنجز اليوم ${tk.done || 0}`);
    ln(`• العملاء المحتملون: جديد اليوم ${ld.today || 0} · متابعات متأخرة ${ld.overdue || 0}`);
    ln(`• خط المبيعات ${nf(dl.pipe)} ر.س · صفقات راكدة +7 أيام: ${dl.stale || 0}`);
    if (people.length) ln('• الفريق (مفتوحة/متأخرة): ' + people.map((p) => `${String(p.name).split(' ')[0]} ${p.open}/${p.late}`).join(' · '));
  }
  const short = [`مفتوحة ${open.length}`, late.length && `متأخرة ${late.length}`, dueToday.length && `اليوم ${dueToday.length}`, fol.length && `متابعات ${fol.length}`,
    content.length && `محتوى ${content.length}`, team && `القطاع: متأخرة ${team.late || 0}`].filter(Boolean).join(' · ');
  return { lines: L, short, counts: { open: open.length, late: late.length, today: dueToday.length } };
}

export const toWA = (r) => r.lines.map((l) => (l.b ? `\n*${l.t}*` : l.t)).join('\n')
  + '\n\n_للتحكم بمهامك من هنا: «مهامي» · «تم 12» · «مساعدة»_';
export const toTG = (r) => r.lines.map((l) => (l.b ? `\n<b>${hx(l.t)}</b>` : hx(l.t))).join('\n');

// إرسال تقرير عضو واحد على قنواته
export async function sendReport(db, env, user, slot, { force = false } = {}) {
  const r = await buildReport(db, user, slot);
  const out = { tg: false, wa: null };
  if (user.tg_chat_id && user.notify_tg !== 0) {
    const token = await tgToken(db, env);
    if (token) out.tg = (await tgCall(env, token, 'sendMessage', { chat_id: user.tg_chat_id, text: toTG(r).slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: '📋 مهامي', callback_data: 'tl:mine' }, { text: '⚠️ المتأخرة', callback_data: 'tl:late' }]] } })).ok;
  }
  const quiet = ksaHour() >= 23 || ksaHour() < 7;
  if (user.phone && user.notify_wa !== 0 && (!quiet || force)) {
    const res = await waBridge(db, { to: user.phone, name: user.name, kind: 'report', title: slot === 'pm' ? 'تقرير نهاية اليوم' : 'تقرير الصباح',
      body: toWA(r), short: `${r.short || 'لا جديد'} — أرسل «تقرير» لعرض التفاصيل أو «مهامي» لإدارة مهامك`, link: '' });
    out.wa = res.ok ? res.mode || 'sent' : false;
  }
  return out;
}

// يُستدعى كل 10 دقائق من /wa/health: يرسل كل فترة مرة واحدة يومياً بعد موعدها
export async function maybeSendReports(db, env) {
  const s = await getSettings(db);
  if (s.reports_enabled === '0') return { skipped: 'disabled' };
  const times = String(s.report_times || '08:00,17:00').split(',').map((x) => x.trim()).filter((x) => /^\d{2}:\d{2}$/.test(x)).sort();
  const now = ksaHM(); const t = today();
  const due = times.filter((tm) => tm <= now && now < addHM(tm, 120)); // نافذة ساعتين بعد الموعد
  const done = [];
  for (const tm of due) {
    const key = `report_sent_${tm.replace(':', '')}`;
    if (s[key] === t) continue;
    // نحجز الفترة أولاً حتى لا تتكرر إن تداخلت الدورات
    await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, t).run();
    const slot = tm < '13:00' ? 'am' : 'pm';
    const { results: users } = await db.prepare('SELECT * FROM users WHERE active = 1').all();
    let tg = 0, wa = 0;
    for (const u of users) { const r = await sendReport(db, env, u, slot); if (r.tg) tg++; if (r.wa) wa++; }
    done.push({ time: tm, slot, users: users.length, tg, wa });
  }
  return { done };
}
function addHM(hm, mins) { const [h, m] = hm.split(':').map(Number); const x = h * 60 + m + mins; return `${String(Math.min(23, Math.floor(x / 60))).padStart(2, '0')}:${String(x >= 1440 ? 59 : x % 60).padStart(2, '0')}`; }
