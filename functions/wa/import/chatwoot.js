// استيراد بيانات Chatwoot «مروج الحجاز» إلى خط مروج في صندوق واتساب (24 أكتوبر 2026)
// يُرسَل التصدير من صفحة Chatwoot المفتوحة نفسها (جلسة المستخدم) — POST /wa/import/chatwoot?k=<مفتاح لمرة واحدة>
// المفتاح في WA_DB wa_config.cw_import_key ويُحذف بعد النجاح. يقبل نطاق Chatwoot فقط (CORS). آمن للتكرار: لا تُكرر رسالة سبق استيرادها.
const ORIGIN = 'https://chat.31-97-72-148.sslip.io';
const DEPT = 'morooj';
const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const phoneOf = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1); return d; };
const sqlTime = (unix) => new Date((Number(unix) || 0) * 1000).toISOString().slice(0, 19).replace('T', ' ');

export async function ensureCwTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS wa_labels (dept TEXT NOT NULL, title TEXT NOT NULL, color TEXT, description TEXT, PRIMARY KEY (dept, title))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS wa_quick (id INTEGER PRIMARY KEY AUTOINCREMENT, dept TEXT NOT NULL, short_code TEXT, content TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS wa_conv (dept TEXT NOT NULL, wa_id TEXT NOT NULL, status TEXT DEFAULT 'open', labels TEXT DEFAULT '[]', assignee TEXT, updated_at TEXT, PRIMARY KEY (dept, wa_id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS wa_contacts (dept TEXT NOT NULL, wa_id TEXT NOT NULL, name TEXT, email TEXT, attrs TEXT, source TEXT, updated_at TEXT, PRIMARY KEY (dept, wa_id))`),
  ]);
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: cors }); }

export async function onRequestPost({ request, env }) {
  if (request.headers.get('origin') !== ORIGIN) return J({ error: 'origin' }, 403);
  const db = env.WA_DB; if (!db) return J({ error: 'not configured' }, 503);
  const k = new URL(request.url).searchParams.get('k') || '';
  const want = await db.prepare("SELECT value FROM wa_config WHERE key = 'cw_import_key'").first('value').catch(() => null);
  if (!want || k !== want) return J({ error: 'key' }, 403);
  let d; try { d = await request.json(); } catch { return J({ error: 'json' }, 400); }
  await ensureCwTables(db);
  const st = { messages: 0, skipped: 0, notes: 0, convs: 0, contacts: 0, labels: 0, quick: 0 };

  // الوسوم والردود الجاهزة لخط مروج
  for (const l of d.labels || []) { await db.prepare('INSERT OR REPLACE INTO wa_labels (dept, title, color, description) VALUES (?,?,?,?)').bind(DEPT, String(l.title).slice(0, 60), l.color || null, l.description || null).run(); st.labels++; }
  for (const c of d.canned || []) {
    const ex = await db.prepare('SELECT id FROM wa_quick WHERE dept = ? AND short_code = ?').bind(DEPT, c.short_code || '').first();
    if (!ex) { await db.prepare('INSERT INTO wa_quick (dept, short_code, content) VALUES (?,?,?)').bind(DEPT, String(c.short_code || '').slice(0, 40), String(c.content || '').slice(0, 2000)).run(); st.quick++; }
  }
  // جهات الاتصال
  for (const c of d.contacts || []) {
    const wa = phoneOf(c.phone); if (!wa) continue;
    await db.prepare(`INSERT INTO wa_contacts (dept, wa_id, name, email, attrs, source, updated_at) VALUES (?,?,?,?,?,'chatwoot',datetime('now'))
      ON CONFLICT(dept, wa_id) DO UPDATE SET name=COALESCE(NULLIF(excluded.name,''),wa_contacts.name), email=COALESCE(excluded.email,wa_contacts.email), attrs=excluded.attrs, updated_at=datetime('now')`)
      .bind(DEPT, wa, c.name || '', c.email || null, JSON.stringify({ ...(c.attrs || {}), ...(c.add || {}) }).slice(0, 2000)).run();
    st.contacts++;
  }
  // المحادثات والرسائل
  for (const cv of d.conversations || []) {
    const wa = phoneOf(cv.contact && cv.contact.phone); if (!wa) continue;
    st.convs++;
    await db.prepare(`INSERT INTO wa_conv (dept, wa_id, status, labels, assignee, updated_at) VALUES (?,?,?,?,?,datetime('now'))
      ON CONFLICT(dept, wa_id) DO UPDATE SET labels=excluded.labels, assignee=COALESCE(excluded.assignee, wa_conv.assignee), updated_at=datetime('now')`)
      .bind(DEPT, wa, cv.status === 'resolved' ? 'resolved' : cv.status === 'pending' ? 'pending' : 'open', JSON.stringify(cv.labels || []), cv.assignee || null).run();
    const turns = [];
    for (const m of cv.messages || []) {
      if (m.t === 2 || (!m.content && !(m.atts || []).length)) continue; // أحداث النظام
      const mid = m.source_id || `cw:${m.id}`;
      if (await db.prepare('SELECT 1 FROM wa_events WHERE msg_id = ? OR detail LIKE ?').bind(mid, `%"cw_id":${m.id},%`).first()) { st.skipped++; continue; }
      const kind = m.private ? 'note' : m.t === 0 ? 'message' : 'staff';
      const text = String(m.content || '') + ((m.atts || []).length ? `\n[مرفق: ${m.atts.map((a) => a.type).join('، ')}]` : '');
      const det = { src: 'chatwoot', cw_id: m.id, by: kind === 'message' ? undefined : (m.by || 'Chatwoot'), tpl: m.tpl || undefined };
      await db.prepare('INSERT INTO wa_events (at, dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(sqlTime(m.created_at), DEPT, wa, kind, kind === 'note' ? null : mid, kind === 'message' ? text : null, kind === 'message' ? null : text, kind === 'message' ? 'received' : 'sent', JSON.stringify(det).slice(0, 1500)).run();
      if (kind === 'note') st.notes++; else { st.messages++; turns.push({ r: kind === 'message' ? 'customer' : 'staff', t: text.slice(0, 600), at: new Date(m.created_at * 1000).toISOString() }); }
    }
    // جلسة المساعد: الاسم وآخر السياق (بلا إيقاف للرد الآلي)
    const key = `${DEPT}:${wa}`;
    const row = await db.prepare('SELECT history, customer_name FROM wa_sessions WHERE session_key = ?').bind(key).first();
    let h = []; try { h = JSON.parse((row && row.history) || '[]'); } catch { /* */ }
    const merged = [...turns, ...h].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-20);
    await db.prepare(`INSERT INTO wa_sessions (session_key, dept, wa_id, customer_name, handoff_until, history, updated_at) VALUES (?,?,?,?,'',?,datetime('now'))
      ON CONFLICT(session_key) DO UPDATE SET customer_name=COALESCE(NULLIF(wa_sessions.customer_name,''), excluded.customer_name), history=excluded.history, updated_at=datetime('now')`)
      .bind(key, DEPT, wa, (cv.contact && cv.contact.name) || '', JSON.stringify(merged)).run();
  }
  await db.prepare("DELETE FROM wa_config WHERE key = 'cw_import_key'").run(); // مرة واحدة
  await db.prepare("INSERT OR REPLACE INTO wa_config (key, value) VALUES ('cw_import_last', ?)").bind(JSON.stringify({ at: new Date().toISOString(), ...st })).run();
  return J({ ok: true, ...st });
}
