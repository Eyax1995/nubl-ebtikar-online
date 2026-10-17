// فحص صحة منظومة واتساب والمنصة — https://nubl-ebtikar.online/wa/health?key=<tg_cron_key>
// يستدعيه عامل الجدولة nubl-scheduler كل 10 دقائق. عند وجود خلل يُنبَّه مدير النظام (واتساب ثم تلجرام ومركز الإشعارات)،
// مرة واحدة لكل خلل جديد، وتذكير كل 3 ساعات إن استمر، وإشعار عند عودة الوضع لطبيعته.
import { getSettings, ensureDb } from '../marketing/hub/api/_lib/core.js';
import { processReminders } from '../marketing/hub/api/_lib/ops.js';
import { maybeSendReports } from '../marketing/hub/api/_lib/reports.js';
import { notifyRoles } from '../marketing/hub/api/_lib/telegram.js';

const PHONE_ID = '1368158866379375';
const REMIND_MS = 3 * 3600e3;

async function count(db, sql, ...args) {
  try { return (await db.prepare(sql).bind(...args).first('n')) || 0; } catch { return -1; }
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ ok: false, error: 'no DB' }, { status: 503 });
  const s = await getSettings(env.DB);
  const key = new URL(request.url).searchParams.get('key') || request.headers.get('x-cron-key');
  if (!s.tg_cron_key || key !== s.tg_cron_key) return Response.json({ ok: false }, { status: 403 });

  // التذكيرات المستحقة (المرحلة 2) — تُرسل في كل دورة قبل فحص الصحة
  let reminders = null;
  try { await ensureDb(env.DB); reminders = await processReminders(env.DB, env); } catch (e) { reminders = { error: e.message }; }
  // التقارير الدورية (صباحاً ومساءً) لكل عضو على واتساب وتلجرام
  let reports = null;
  try { reports = await maybeSendReports(env.DB, env); } catch (e) { reports = { error: e.message }; }

  const issues = [];
  // 1) رقم واتساب على Meta
  if (!env.WA_TOKEN) issues.push('توكن واتساب غير مضبوط في إعدادات الموقع');
  else {
    try {
      const r = await fetch(`https://graph.facebook.com/v23.0/${PHONE_ID}?fields=status,quality_rating,code_verification_status`, { headers: { authorization: 'Bearer ' + env.WA_TOKEN } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) issues.push('تعذّر الوصول لرقم واتساب على Meta: ' + ((d.error && d.error.message) || r.status));
      else {
        if (d.status && d.status !== 'CONNECTED') issues.push(`حالة رقم التسويق على Meta: ${d.status}`);
        if (d.quality_rating && d.quality_rating !== 'GREEN' && d.quality_rating !== 'UNKNOWN') issues.push(`جودة رقم التسويق انخفضت إلى ${d.quality_rating}`);
      }
    } catch (e) { issues.push('فشل الاتصال بـ Meta: ' + e.message); }
  }
  // 2) أخطاء المحرك وفشل الإرسال
  if (env.WA_DB) {
    const errs = await count(env.WA_DB, "SELECT COUNT(*) AS n FROM wa_events WHERE kind = 'error' AND at >= datetime('now','-30 minutes')");
    if (errs >= 3) issues.push(`${errs} أخطاء في الرد الآلي خلال آخر 30 دقيقة`);
    const fails = await count(env.WA_DB, "SELECT COUNT(*) AS n FROM wa_events WHERE status = 'send_failed' AND at >= datetime('now','-1 hour')");
    if (fails >= 3) issues.push(`${fails} رسائل لم تُرسل خلال آخر ساعة`);
    if (errs < 0) issues.push('قاعدة بيانات واتساب لا تستجيب');
  } else issues.push('قاعدة بيانات واتساب غير مربوطة');
  // 3) قاعدة المنصة
  const users = await count(env.DB, 'SELECT COUNT(*) AS n FROM users WHERE active = 1');
  if (users < 0) issues.push('قاعدة بيانات المنصة لا تستجيب');

  // التنبيه مع منع التكرار
  const sig = issues.map((x) => x.replace(/\d+/g, '#')).join(' | '); // التوقيع بلا أرقام حتى لا يتكرر التنبيه لمجرد تغيّر العدد
  let prev = {}; try { prev = JSON.parse(s.health_alert || '{}'); } catch { /* */ }
  const now = Date.now();
  let alerted = false;
  if (sig && (sig !== prev.sig || now - (prev.at || 0) > REMIND_MS)) {
    await notifyRoles(env.DB, env, 'admin', `⚠️ تنبيه تشغيلي — منظومة نُبل وابتكار للتسويق\n${issues.map((x) => '• ' + x).join('\n')}`, { kind: 'system', title: 'تنبيه تشغيلي: خلل في المنظومة' });
    alerted = true;
  } else if (!sig && prev.sig) {
    await notifyRoles(env.DB, env, 'admin', '✅ عادت منظومة واتساب والمنصة للعمل بشكل طبيعي.', { kind: 'system', title: 'عودة المنظومة للعمل' });
    alerted = true;
  }
  if (alerted || sig !== (prev.sig || '')) {
    await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind('health_alert', JSON.stringify(sig ? { sig, at: alerted ? now : prev.at || now } : {})).run();
  }
  return Response.json({ ok: !sig, issues, alerted, reminders, reports, time: new Date().toISOString() }, { headers: { 'cache-control': 'no-store' } });
}
