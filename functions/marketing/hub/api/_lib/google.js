// ربط حساب Google للتسويق (v19): إنشاء روابط Google Meet وأحداث التقويم لجلسات التشخيص، وفحص الأوقات المشغولة.
// الإعداد مرة واحدة: سرّا Cloudflare GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET (عميل OAuth «تطبيق ويب» في Google Cloud مع تفعيل Google Calendar API،
// ورابط التحويل https://nubl-ebtikar.online/marketing/hub/api/google/callback)، ثم زر «ربط Google» في الإعدادات (للمدير) والدخول بحساب التسويق.
// رمز التحديث يُحفظ في settings.google_refresh (ضمن SECRET_SETTINGS) ولا يُرسل للواجهة أبداً.
import { json, bad, getSettings, audit } from './core.js';

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const CAL = 'https://www.googleapis.com/calendar/v3';
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy';
const redirectUri = (request) => `${new URL(request.url).origin}/marketing/hub/api/google/callback`;
const setSetting = (db, k, v) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(k, v == null ? '' : String(v)).run();
export const googleReady = (env, s) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && s?.google_refresh);

let cached = null; // رمز وصول لكل نسخة من العامل (ساعة تقريباً)
async function accessToken(db, env) {
  if (cached && cached.exp > Date.now() + 60e3) return cached.token;
  const s = await getSettings(db);
  if (!googleReady(env, s)) return null;
  const r = await fetch(TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: s.google_refresh, grant_type: 'refresh_token' }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) { await setSetting(db, 'google_error', String(d.error_description || d.error || r.status).slice(0, 200)); return null; }
  cached = { token: d.access_token, exp: Date.now() + (Number(d.expires_in) || 3000) * 1000 };
  return cached.token;
}
async function gcal(db, env, method, path, body) {
  const t = await accessToken(db, env); if (!t) return { ok: false, error: 'حساب Google غير مربوط' };
  const r = await fetch(CAL + path, { method, headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204) return { ok: true, data: {} };
  const d = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, data: d } : { ok: false, error: String(d.error?.message || r.status).slice(0, 300) };
}

// الأوقات المشغولة في تقويم الحساب (لا تُعرض للحجز). from/to بتوقيت الرياض «YYYY-MM-DD HH:MM»
export async function busyTimes(db, env, from, to) {
  const z = (x) => x.replace(' ', 'T') + ':00+03:00';
  const r = await gcal(db, env, 'POST', '/freeBusy', { timeMin: z(from), timeMax: z(to), timeZone: 'Asia/Riyadh', items: [{ id: 'primary' }] });
  if (!r.ok) return null;
  return (r.data.calendars?.primary?.busy || []).map((b) => [Date.parse(b.start), Date.parse(b.end)]);
}

// حدث تقويم (+ Google Meet للمرئية). start/end بتوقيت الرياض
export async function upsertEvent(db, env, ses, { start, end, title, description, attendees, meet, eventId }) {
  const dt = (x) => ({ dateTime: x.replace(' ', 'T') + ':00', timeZone: 'Asia/Riyadh' });
  const body = { summary: title, description, start: dt(start), end: dt(end), attendees: (attendees || []).filter(Boolean).map((email) => ({ email })),
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 10 }] } };
  if (meet && !eventId) body.conferenceData = { createRequest: { requestId: `nubl-ds-${ses.id}-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
  const r = eventId
    ? await gcal(db, env, 'PATCH', `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, body)
    : await gcal(db, env, 'POST', `/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, body);
  if (!r.ok) return r;
  const link = r.data.hangoutLink || r.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri || null;
  return { ok: true, id: r.data.id, link, html: r.data.htmlLink };
}
export async function deleteEvent(db, env, eventId) {
  if (!eventId) return { ok: true };
  return gcal(db, env, 'DELETE', `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`);
}

// GET google/status · GET google/connect (تحويل لـ Google) · GET google/callback · POST google/disconnect — للمدير فقط
export async function googleRoute(db, env, request, user, sub) {
  if (user.role !== 'admin') return bad('ربط Google للمدير العام فقط', 403);
  const s = await getSettings(db);
  if (sub === 'status') return json({ configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), connected: googleReady(env, s), email: s.google_email || null, error: s.google_error || null, redirect: redirectUri(request) });
  if (sub === 'connect') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return bad('أضف GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET في إعدادات Cloudflare Pages أولاً', 400);
    const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await setSetting(db, 'google_state', `${state}:${Date.now()}`);
    const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(request), response_type: 'code', scope: SCOPES,
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state, login_hint: 'marketing@nublandebtikar.com' });
    return Response.redirect(`${AUTH}?${q}`, 302);
  }
  if (sub === 'callback') {
    const u = new URL(request.url); const [st, ts] = String(s.google_state || '').split(':');
    const back = (msg) => Response.redirect(`${u.origin}/marketing/hub/#/settings/google=${encodeURIComponent(msg)}`, 302);
    if (u.searchParams.get('error')) return back('أُلغي الربط: ' + u.searchParams.get('error'));
    if (!st || st !== u.searchParams.get('state') || Date.now() - Number(ts) > 15 * 60e3) return back('انتهت صلاحية طلب الربط — أعد المحاولة');
    const r = await fetch(TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: u.searchParams.get('code') || '', client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(request), grant_type: 'authorization_code' }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.refresh_token) return back('تعذّر الربط: ' + String(d.error_description || d.error || 'لم يُمنح رمز دائم').slice(0, 120));
    let email = null; try { email = JSON.parse(atob(String(d.id_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email; } catch { /* */ }
    await db.batch([
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('google_refresh', ?)").bind(d.refresh_token),
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('google_email', ?)").bind(email || ''),
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('google_error', '')"),
      db.prepare("DELETE FROM settings WHERE key = 'google_state'"),
    ]);
    cached = null;
    await audit(db, user, 'google-connect', 'settings', null, email || '');
    return back('ok');
  }
  if (sub === 'disconnect' && request.method === 'POST') {
    await db.prepare("DELETE FROM settings WHERE key IN ('google_refresh','google_email','google_error')").run();
    cached = null;
    await audit(db, user, 'google-disconnect', 'settings', null, s.google_email || '');
    return json({ ok: true });
  }
  return bad('مسار غير معروف', 404);
}
