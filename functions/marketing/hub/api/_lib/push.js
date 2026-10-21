// إشعارات الدفع لأجهزة الفريق (v18): تطبيق الجوال المثبّت (PWA) وسطح المكتب حتى والمنصة مغلقة.
// تصميم «الإيقاظ»: الخادم يرسل دفعة فارغة موقّعة VAPID، وعامل الخدمة (marketing/hub/sw.js) يجلب آخر إشعار من GET push/latest بجلسة المستخدم نفسه —
// فلا يُشفَّر محتوى على الخادم ولا يخرج نص الإشعار إلى خوادم الدفع (Google/Apple/Mozilla).
// مفاتيح VAPID تُولَّد مرة واحدة وتُحفظ في الإعدادات (الخاص ضمن SECRET_SETTINGS).
import { json, bad, getSettings } from './core.js';

const SUBJECT = 'mailto:marketing@nublandebtikar.com';
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const txt = (s) => new TextEncoder().encode(s);

export async function vapidKeys(db) {
  const s = await getSettings(db);
  if (s.vapid_public && s.vapid_private) return { pub: s.vapid_public, jwk: JSON.parse(s.vapid_private) };
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  // INSERT OR IGNORE: إن ولّدت طلبان متزامنان مفتاحين يفوز الأول ويُقرأ من القاعدة
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('vapid_public', ?)").bind(pub),
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('vapid_private', ?)").bind(JSON.stringify(jwk)),
  ]);
  const again = await getSettings(db);
  return { pub: again.vapid_public, jwk: JSON.parse(again.vapid_private) };
}

async function vapidAuth(db, endpoint) {
  const { pub, jwk } = await vapidKeys(db);
  const aud = new URL(endpoint).origin;
  const head = b64u(txt(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(txt(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })));
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, txt(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${pub}`;
}

// يُستدعى من notifyUser بعد حفظ الإشعار — لا يرمي أخطاء
export async function sendPush(db, env, userId) {
  try {
    const { results } = await db.prepare('SELECT id, endpoint FROM push_subs WHERE user_id = ?').bind(userId).all();
    let sent = 0;
    for (const s of results) {
      try {
        const r = await fetch(s.endpoint, { method: 'POST', headers: { authorization: await vapidAuth(db, s.endpoint), ttl: '86400', urgency: 'high', 'content-length': '0' } });
        if (r.status === 404 || r.status === 410) await db.prepare('DELETE FROM push_subs WHERE id = ?').bind(s.id).run(); // اشتراك منتهٍ أو أُلغي من الجهاز
        else if (r.ok) { sent++; await db.prepare("UPDATE push_subs SET fails = 0, last_ok = datetime('now') WHERE id = ?").bind(s.id).run(); }
        else await db.prepare('UPDATE push_subs SET fails = fails + 1 WHERE id = ?').bind(s.id).run();
      } catch { /* جهاز واحد لا يوقف البقية */ }
    }
    await db.prepare('DELETE FROM push_subs WHERE fails >= 20').run();
    return sent;
  } catch (e) { console.warn('push', e.message); return 0; }
}

// GET push/key · POST push/subscribe {endpoint, keys:{p256dh, auth}} · POST push/unsubscribe {endpoint} · GET push/latest · POST push/test
export async function pushRoute(db, env, request, user, sub) {
  const method = request.method.toUpperCase();
  if (sub === 'key' && method === 'GET') return json({ key: (await vapidKeys(db)).pub });
  if (sub === 'subscribe' && method === 'POST') {
    let d = {}; try { d = await request.json(); } catch { /* */ }
    const ep = String(d.endpoint || ''); const k = d.keys || {};
    if (!/^https:\/\/[^\s]+$/.test(ep) || !k.p256dh || !k.auth) return bad('اشتراك غير صالح');
    const ua = (request.headers.get('user-agent') || '').slice(0, 200);
    await db.prepare(`INSERT INTO push_subs (user_id, endpoint, p256dh, auth, ua) VALUES (?,?,?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, fails = 0`)
      .bind(user.id, ep, String(k.p256dh).slice(0, 200), String(k.auth).slice(0, 100), ua).run();
    const n = await db.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE user_id = ?').bind(user.id).first('n');
    return json({ ok: true, devices: n });
  }
  if (sub === 'unsubscribe' && method === 'POST') {
    let d = {}; try { d = await request.json(); } catch { /* */ }
    await db.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').bind(String(d.endpoint || ''), user.id).run();
    return json({ ok: true });
  }
  if (sub === 'latest' && method === 'GET') {
    const n = await db.prepare(`SELECT id, kind, title, body, link FROM notifications WHERE user_id = ? AND read_at IS NULL
      AND created_at >= datetime('now', '-30 minutes') ORDER BY id DESC LIMIT 1`).bind(user.id).first();
    const unread = await db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(user.id).first('n');
    return json({ n: n || null, unread }, 200, { 'cache-control': 'no-store' });
  }
  if (sub === 'test' && method === 'POST') {
    await db.prepare("INSERT INTO notifications (user_id, kind, title, body, link, channels) VALUES (?, 'general', ?, ?, '#/dashboard', 'app,push')")
      .bind(user.id, '🔔 تجربة الإشعارات', 'وصل الإشعار إلى هذا الجهاز — كل تنبيهات المنصة ستصلك هكذا.').run();
    return json({ ok: true, sent: await sendPush(db, env, user.id) });
  }
  if (sub === 'devices' && method === 'GET') {
    const { results } = await db.prepare('SELECT id, ua, created_at, last_ok FROM push_subs WHERE user_id = ? ORDER BY id DESC').bind(user.id).all();
    return json({ rows: results });
  }
  return bad('مسار غير معروف', 404);
}
