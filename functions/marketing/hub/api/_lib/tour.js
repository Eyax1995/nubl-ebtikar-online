// الجولة التدريبية داخل المنصة (v31 — 29 أكتوبر 2026): تقدّم كل عضو يُحفظ في الخادم فيُستأنف من أي جهاز، والإدارة ترى من أكملها ودرجته.
//   GET  tour                         جولتي حسب دوري + حالتي + الوصف الوظيفي المعتمد (DESIGNER_JD) لجولة المصمم
//   POST tour/progress {tour, step, total}       حفظ الخطوة الحالية (جارية)
//   POST tour/snooze   {tour}                    «لاحقاً» — لا تُعرض آلياً قبل الغد (ما لم تُسنَد من الإدارة)
//   POST tour/complete {tour, score, of, answers, total}  إكمال + درجة الاختبار الذاتي، وإشعار المدير العام (admin فقط) عند أول إكمال أو بعد إسناد
//   GET  tour/status                  حالة كل الأعضاء (admin/manager)
//   POST tour/assign   {user_id, tour?}           إسناد/إعادة الجولة لعضو (admin/manager): تُصفَّر الخطوة وتُحفظ المحاولة السابقة في history — لا حذف
// المعاينة: المدير يعرض جولة أي دور بـ preview في الواجهة ولا يُحفظ لها تقدّم ولا يُرسل إشعار.
import { json, bad, HttpError, audit } from './core.js';
import { notifyRoles } from './telegram.js';
import { DESIGNER_JD } from './hiring.js';

export const TOURS = { designer: 'جولة المصمم/ة', general: 'جولة المنصة' };
export const tourFor = (role) => (role === 'designer' ? 'designer' : 'general');
const BOSS = ['admin', 'manager'];
const nowIso = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const parse = (v, d) => { try { const x = JSON.parse(v); return x ?? d; } catch { return d; } };
const tid = (v) => (Object.prototype.hasOwnProperty.call(TOURS, v) ? v : null);

async function row(db, uid, tour) {
  return db.prepare('SELECT * FROM user_tours WHERE user_id = ? AND tour = ?').bind(uid, tour).first();
}
function pub(r) {
  if (!r) return { status: 'لم تبدأ', step: 0 };
  return { status: r.status, step: r.step || 0, total: r.total || null, score: r.score, of: r.score_of, started_at: r.started_at, completed_at: r.completed_at,
    answers: parse(r.answers, []), snoozed_at: r.snoozed_at, assigned_at: r.assigned_at, assigned_by: r.assigned_by, attempts: parse(r.history, []).length };
}
async function upsert(db, uid, tour, set) {
  const cur = await row(db, uid, tour);
  const t = nowIso();
  if (!cur) {
    await db.prepare(`INSERT INTO user_tours (user_id, tour, step, total, status, started_at, updated_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(uid, tour, set.step || 0, set.total || null, set.status || 'جارية', t, t).run();
  }
  const keys = Object.keys(set);
  if (keys.length) await db.prepare(`UPDATE user_tours SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE user_id = ? AND tour = ?`)
    .bind(...keys.map((k) => set[k]), t, uid, tour).run();
  return row(db, uid, tour);
}

export async function tourRoute(db, env, request, user, a) {
  if (user.via === 'token') return bad('الجولة التدريبية متاحة من داخل المنصة فقط', 403);
  const m = request.method.toUpperCase();
  const body = async () => { try { return await request.json(); } catch { throw new HttpError(400, 'بيانات غير صالحة'); } };
  const mine = tourFor(user.role);

  if (!a && m === 'GET') {
    const { results } = await db.prepare('SELECT * FROM user_tours WHERE user_id = ?').bind(user.id).all();
    const states = {}; for (const r of results) states[r.tour] = pub(r);
    const out = { tour: mine, tours: TOURS, state: states[mine] || pub(null), states };
    if (mine === 'designer' || BOSS.includes(user.role)) out.jd = DESIGNER_JD;
    return json(out);
  }
  if (a === 'progress' && m === 'POST') {
    const d = await body(); const tour = tid(d.tour); if (!tour) return bad('جولة غير معروفة');
    const cur = await row(db, user.id, tour);
    const set = { step: Math.max(0, Math.min(500, Number(d.step) || 0)) };
    if (d.total) set.total = Math.min(500, Number(d.total) || 0);
    if (Array.isArray(d.answers)) set.answers = JSON.stringify(d.answers.slice(0, 50).map((x) => (x == null ? null : Number(x))));
    if (!cur || cur.status !== 'مكتملة') set.status = 'جارية';
    return json({ ok: true, state: pub(await upsert(db, user.id, tour, set)) });
  }
  if (a === 'snooze' && m === 'POST') {
    const d = await body(); const tour = tid(d.tour); if (!tour) return bad('جولة غير معروفة');
    const cur = await row(db, user.id, tour);
    const set = { snoozed_at: nowIso() }; if (!cur) set.status = 'لم تبدأ';
    return json({ ok: true, state: pub(await upsert(db, user.id, tour, set)) });
  }
  if (a === 'complete' && m === 'POST') {
    const d = await body(); const tour = tid(d.tour); if (!tour) return bad('جولة غير معروفة');
    const cur = await row(db, user.id, tour);
    const of = Math.max(0, Math.min(50, Number(d.of) || 0));
    const score = Math.max(0, Math.min(of, Number(d.score) || 0));
    const answers = JSON.stringify(Array.isArray(d.answers) ? d.answers.slice(0, 50).map((x) => Number(x)) : []);
    const firstTime = !cur?.completed_at; // أول إكمال، أو أول إكمال بعد إسناد الإدارة (الإسناد يصفّر completed_at)
    // إعادة الجولة بعد إكمالها (بلا إسناد) لا تغيّر الدرجة الرسمية — تُسجَّل في history فقط
    const set = firstTime ? { status: 'مكتملة', completed_at: nowIso(), score, score_of: of, answers }
      : { history: JSON.stringify([...parse(cur.history, []), { replay: 1, score, of, at: nowIso() }].slice(-20)) };
    if (d.total) set.total = Math.min(500, Number(d.total) || 0);
    const r = await upsert(db, user.id, tour, set);
    let notified = 0;
    if (firstTime && user.role !== 'admin') {
      notified = await notifyRoles(db, env, ['admin'], `🎓 الجولة التدريبية مكتملة: ${user.name}\n«${TOURS[tour]}»${of ? ` — درجة الاختبار الذاتي ${score} من ${of}` : ''}`,
        { kind: 'general', title: `🎓 الجولة التدريبية مكتملة: ${user.name}${of ? ` (${score}/${of})` : ''}`, link: '#/team' }, user.id);
    }
    await audit(db, user, 'tour', 'users', user.id, `${tour} ${score}/${of}`);
    return json({ ok: true, notified, state: pub(r) });
  }
  if (a === 'status' && m === 'GET') {
    if (!BOSS.includes(user.role)) return bad('للإدارة فقط', 403);
    const { results: us } = await db.prepare('SELECT id, name, role, title, active, last_login FROM users WHERE active = 1 ORDER BY name').all();
    const { results: ts } = await db.prepare('SELECT * FROM user_tours').all();
    return json({ tours: TOURS, rows: us.map((u) => { const t = tourFor(u.role); return { ...u, tour: t, state: pub(ts.find((x) => x.user_id === u.id && x.tour === t)) }; }) });
  }
  if (a === 'assign' && m === 'POST') {
    if (!BOSS.includes(user.role)) return bad('للإدارة فقط', 403);
    const d = await body();
    const u = await db.prepare('SELECT id, name, role FROM users WHERE id = ? AND active = 1').bind(Number(d.user_id) || 0).first();
    if (!u) return bad('العضو غير موجود', 404);
    const tour = tid(d.tour) || tourFor(u.role);
    const cur = await row(db, u.id, tour);
    const hist = parse(cur?.history, []);
    if (cur && (cur.started_at || cur.completed_at)) hist.push({ status: cur.status, step: cur.step, score: cur.score, of: cur.score_of, completed_at: cur.completed_at, at: nowIso() });
    const r = await upsert(db, u.id, tour, { status: 'مسندة', step: 0, completed_at: null, score: null, answers: null, snoozed_at: null, assigned_by: user.id, assigned_at: nowIso(), history: JSON.stringify(hist.slice(-20)) });
    await audit(db, user, 'tour_assign', 'users', u.id, tour);
    return json({ ok: true, state: pub(r) });
  }
  return bad('مسار غير معروف', 404);
}
