// بوت تلجرام لقطاع التسويق — كل عمل يبدأ من قالب ويُسجَّل في المنصة
import { today, addDays, audit, randomToken } from './core.js';
import { SECTORS } from './seed.js';
import { tgCall, tgToken, h, HUB_URL, notifyUser } from './telegram.js';
import { loadTemplate, templatesFor, tplAllowed, runTemplate, answerLabel, taskChanged, canDo, parseTpl } from './engine.js';
import { TPL_CATEGORIES } from './templates.js';

const BOSS = ['admin', 'manager'];
const ASSIGNERS = ['admin', 'manager', 'account'];
const TASK_STATUS = ['جديدة', 'قيد التنفيذ', 'مراجعة', 'تعديلات', 'منجزة'];
const B = {
  newTask: '➕ مهمة جديدة', myTasks: '📋 مهامي', lead: '👤 عميل محتمل', act: '📞 تسجيل تواصل',
  visit: '📍 زيارة ميدانية', day: '☀️ يومي', search: '🔎 بحث', board: '📊 اللوحة', help: '❓ مساعدة', cancel: '✖️ إلغاء',
};

// ---------------------------------------------------------------- أدوات
function relDays(d) {
  if (!d) return 'بلا موعد';
  const diff = Math.round((new Date(String(d).slice(0, 10)) - new Date(today())) / 864e5);
  if (diff === 0) return 'اليوم'; if (diff === 1) return 'غداً'; if (diff === -1) return 'أمس';
  return diff > 0 ? `بعد ${diff} يوم` : `⚠️ متأخر ${-diff} يوم`;
}
const cut = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const rows = (btns, per = 2) => { const out = []; for (let i = 0; i < btns.length; i += per) out.push(btns.slice(i, i + per)); return out; };
function toB64(buf) {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function parseDate(t) {
  t = String(t).trim().replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (m) { const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : today().slice(0, 4); return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  if (/^اليوم$/.test(t)) return today();
  if (/^(غدا|غداً|بكرة|بكره)$/.test(t)) return addDays(today(), 1);
  return null;
}

class Bot {
  constructor(db, env, token, origin) { this.db = db; this.env = env; this.token = token; this.origin = origin; }
  call(method, payload) { return tgCall(this.env, this.token, method, payload); }
  send(chat, text, extra = {}) {
    return this.call('sendMessage', { chat_id: chat, text: cut(text, 4000), parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
  }
  edit(chat, msgId, text, kb) {
    return this.call('editMessageText', { chat_id: chat, message_id: msgId, text: cut(text, 4000), parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: kb ? { inline_keyboard: kb } : undefined });
  }
  hub(path = '') { return HUB_URL + path; }

  menu(user) {
    const k = [[B.newTask, B.myTasks]];
    const r2 = [];
    if (canDo(user, 'leads', 'w')) r2.push(B.lead);
    if (canDo(user, 'activities', 'w')) r2.push(B.act);
    if (r2.length) k.push(r2);
    k.push(canDo(user, 'visits', 'w') ? [B.visit, B.day] : [B.day, B.search]);
    k.push(canDo(user, 'visits', 'w') ? [B.search, BOSS.includes(user.role) ? B.board : B.help] : [BOSS.includes(user.role) ? B.board : B.help]);
    return { keyboard: k, resize_keyboard: true, is_persistent: true };
  }

  // ---------------------------------------------------------------- الحالة
  async getState(chat) {
    const r = await this.db.prepare('SELECT state FROM tg_state WHERE chat_id = ?').bind(String(chat)).first('state');
    try { return JSON.parse(r || '{}') || {}; } catch { return {}; }
  }
  async setState(chat, userId, st) {
    await this.db.prepare(`INSERT INTO tg_state (chat_id, user_id, state, updated_at) VALUES (?,?,?,datetime('now'))
      ON CONFLICT(chat_id) DO UPDATE SET user_id = excluded.user_id, state = excluded.state, updated_at = excluded.updated_at`)
      .bind(String(chat), userId || null, JSON.stringify(st || {})).run();
  }
  clear(chat, userId) { return this.setState(chat, userId, {}); }

  async userByChat(chat) {
    return this.db.prepare('SELECT id, name, email, role, title, active FROM users WHERE tg_chat_id = ? AND active = 1').bind(String(chat)).first();
  }

  // ---------------------------------------------------------------- نقطة الدخول
  async handle(update) {
    if (update.callback_query) return this.onCallback(update.callback_query);
    const msg = update.message || update.edited_message;
    if (!msg || !msg.chat || msg.chat.type !== 'private') return;
    const chat = msg.chat.id;
    const text = (msg.text || '').trim();

    if (/^\/start(\s|$)/.test(text)) {
      const code = text.split(/\s+/)[1];
      if (code) return this.link(chat, msg.from, code);
    }
    const user = await this.userByChat(chat);
    if (!user) {
      return this.send(chat, `أهلاً بك في بوت <b>نُبل وابتكار للتسويق</b> 👋\n\nهذا البوت خاص بفريق القطاع. لربط حسابك:\n1) ادخل المنصة ${h(this.hub())}\n2) من القائمة الجانبية اضغط «ربط تلجرام»\n3) اضغط الرابط الذي يظهر لك — وسيُربط حسابك تلقائياً.`);
    }
    if (text === B.cancel || /^\/(cancel|الغاء)$/.test(text) || text === 'إلغاء') { await this.clear(chat, user.id); return this.send(chat, 'تم الإلغاء.', { reply_markup: this.menu(user) }); }

    const st = await this.getState(chat);
    // أثناء تعبئة قالب
    if (st.f === 'tpl') return this.onAnswerMsg(chat, user, st, msg);
    if (st.f === 'note' || st.f === 'link') return this.onTaskInput(chat, user, st, text);
    if (st.f === 'search') return this.doSearch(chat, user, text);

    switch (text) {
      case '/start': case '/menu': case B.help: case '/help': return this.welcome(chat, user);
      case B.newTask: case '/new': return this.categories(chat, user);
      case B.myTasks: case '/tasks': return this.myTasks(chat, user);
      case B.lead: case '/lead': return this.startByCode(chat, user, 'LEAD');
      case B.act: case '/log': return this.startByCode(chat, user, 'ACT');
      case B.visit: case '/visit': return this.startByCode(chat, user, 'VISIT');
      case B.day: case '/today': return this.myDay(chat, user);
      case B.board: case '/board': return this.board(chat, user);
      case B.search: case '/search': await this.setState(chat, user.id, { f: 'search' }); return this.send(chat, '🔎 اكتب اسم العميل أو المنشأة أو رقم الجوال:');
      default:
        if (text) return this.doSearch(chat, user, text, true);
        return this.welcome(chat, user);
    }
  }

  async welcome(chat, user) {
    return this.send(chat, `أهلاً ${h(user.name)} 👋\n<b>بوت نُبل وابتكار للتسويق</b> — كل ما تسجّله هنا يظهر فوراً في المنصة.\n\n`
      + `➕ <b>مهمة جديدة</b>: اختر قالباً وأجب عن أسئلته\n📋 <b>مهامي</b>: حدّث الحالة والخطوات وأضف ملاحظة أو رابطاً\n`
      + (canDo(user, 'leads', 'w') ? '👤 <b>عميل محتمل</b> · 📞 <b>تسجيل تواصل</b>\n' : '')
      + (canDo(user, 'visits', 'w') ? '📍 <b>زيارة ميدانية</b> بالموقع والصورة\n' : '')
      + `☀️ <b>يومي</b>: ما يحتاج انتباهك اليوم\n\nللإلغاء في أي لحظة: /cancel`, { reply_markup: this.menu(user) });
  }

  // ---------------------------------------------------------------- الربط
  async link(chat, from, code) {
    const row = await this.db.prepare('SELECT user_id, expires_at FROM tg_codes WHERE code = ?').bind(code).first();
    if (!row || row.expires_at < new Date().toISOString()) return this.send(chat, '⛔️ رابط الربط غير صالح أو منتهي — أنشئ رابطاً جديداً من المنصة.');
    await this.db.batch([
      this.db.prepare('UPDATE users SET tg_chat_id = NULL WHERE tg_chat_id = ?').bind(String(chat)),
      this.db.prepare('UPDATE users SET tg_chat_id = ?, tg_username = ? WHERE id = ?').bind(String(chat), from.username || null, row.user_id),
      this.db.prepare('DELETE FROM tg_codes WHERE user_id = ? OR expires_at < ?').bind(row.user_id, new Date().toISOString()),
    ]);
    const user = await this.userByChat(chat);
    if (!user) return this.send(chat, 'تعذّر الربط — الحساب غير نشط.');
    await audit(this.db, user, 'tg-link', 'users', user.id, from.username || '');
    await this.send(chat, `✅ تم ربط حسابك: <b>${h(user.name)}</b>\nستصلك هنا إشعارات المهام وملخص الصباح.`);
    return this.welcome(chat, user);
  }

  // ---------------------------------------------------------------- اختيار القالب
  async categories(chat, user, msgId) {
    const tpls = (await templatesFor(this.db, user)).filter((t) => t.kind === 'task');
    const cats = TPL_CATEGORIES.filter((c) => tpls.some((t) => t.category === c));
    const extra = tpls.filter((t) => !TPL_CATEGORIES.includes(t.category)).length ? [{ text: 'أخرى', callback_data: 'c:-' }] : [];
    const kb = [...rows(cats.map((c) => ({ text: c, callback_data: `c:${TPL_CATEGORIES.indexOf(c)}` })).concat(extra)), [{ text: B.cancel, callback_data: 'x' }]];
    const text = '➕ <b>مهمة جديدة</b>\nاختر القسم:';
    return msgId ? this.edit(chat, msgId, text, kb) : this.send(chat, text, { reply_markup: { inline_keyboard: kb } });
  }
  async templateList(chat, user, msgId, catIdx) {
    const tpls = (await templatesFor(this.db, user)).filter((t) => t.kind === 'task'
      && (catIdx === '-' ? !TPL_CATEGORIES.includes(t.category) : t.category === TPL_CATEGORIES[+catIdx]));
    const kb = [...tpls.map((t) => [{ text: `${t.emoji || '📌'} ${t.name}`, callback_data: `t:${t.id}` }]), [{ text: '→ رجوع', callback_data: 'c:back' }, { text: B.cancel, callback_data: 'x' }]];
    return this.edit(chat, msgId, `<b>${h(catIdx === '-' ? 'أخرى' : TPL_CATEGORIES[+catIdx])}</b> — اختر القالب:`, kb);
  }
  async startByCode(chat, user, code, preset) {
    const row = await this.db.prepare('SELECT * FROM templates WHERE code = ? AND active = 1').bind(code).first();
    const tpl = parseTpl(row);
    if (!tpl || !tplAllowed(user, tpl)) return this.send(chat, 'هذا القالب غير متاح لدورك.');
    return this.startTpl(chat, user, tpl, preset);
  }
  async startTpl(chat, user, tpl, preset = {}) {
    const st = { f: 'tpl', id: tpl.id, i: 0, a: { ...preset } };
    await this.send(chat, `${tpl.emoji || '📌'} <b>${h(tpl.name)}</b>${tpl.description ? `\n<i>${h(tpl.description)}</i>` : ''}${tpl.checklist?.length ? `\n\nالخطوات: ${tpl.checklist.length} · التسليم خلال ${tpl.due_days || 0} يوم` : ''}`,
      { reply_markup: { keyboard: [[B.cancel]], resize_keyboard: true } });
    return this.nextField(chat, user, tpl, st);
  }

  // هل يُتخطى السؤال تلقائياً؟
  skipField(user, tpl, f, st) {
    if (st.a[f.k] !== undefined) return true;
    if (f.t === 'user' && !ASSIGNERS.includes(user.role)) return true;
    return false;
  }
  async nextField(chat, user, tpl, st) {
    while (st.i < tpl.fields.length && this.skipField(user, tpl, tpl.fields[st.i], st)) st.i++;
    if (st.i >= tpl.fields.length) return this.summary(chat, user, tpl, st);
    await this.setState(chat, user.id, st);
    return this.askField(chat, user, tpl, st, tpl.fields[st.i]);
  }

  async askField(chat, user, tpl, st, f, page = 0, msgId) {
    const n = `(${st.i + 1}/${tpl.fields.length}) `;
    const q = `${n}<b>${h(f.l)}</b>${f.req ? '' : ' <i>(اختياري)</i>'}`;
    const skip = f.req ? [] : [{ text: '⏭️ تخطي', callback_data: 'a:_' }];
    let kb = []; let hint = '';
    switch (f.t) {
      case 'select': kb = rows(f.o.map((o, i) => ({ text: o, callback_data: `a:${i}` }))); break;
      case 'sector': kb = rows(SECTORS.map((s) => ({ text: cut(s.name, 28), callback_data: `a:${s.id}` }))); break;
      case 'date': {
        const d = [['اليوم', 0], ['غداً', 1], ['بعد 3 أيام', 3], ['بعد أسبوع', 7]];
        kb = rows(d.map(([l, x]) => ({ text: l, callback_data: `a:${x}` })), 4);
        hint = '\nأو اكتب التاريخ مثل 15/10';
        if (f.k === 'due' && tpl.due_days) skip.splice(0, 1, { text: `⏭️ تلقائي (بعد ${tpl.due_days} يوم)`, callback_data: 'a:_' });
        break;
      }
      case 'user': {
        const { results } = await this.db.prepare('SELECT id, name FROM users WHERE active = 1 ORDER BY name').all();
        kb = rows(results.map((u) => ({ text: u.id === user.id ? `أنا (${u.name})` : u.name, callback_data: `a:${u.id}` })));
        skip.splice(0, 1, { text: '⏭️ تلقائي حسب الدور', callback_data: 'a:_' });
        break;
      }
      case 'client': {
        const { results } = await this.db.prepare("SELECT id, name FROM clients WHERE status != 'منتهي' ORDER BY name LIMIT 9 OFFSET ?").bind(page * 8).all();
        kb = rows(results.slice(0, 8).map((c) => ({ text: cut(c.name, 30), callback_data: `a:${c.id}` })));
        const nav = [];
        if (page > 0) nav.push({ text: '→ السابق', callback_data: `cp:${page - 1}` });
        if (results.length > 8) nav.push({ text: 'التالي ←', callback_data: `cp:${page + 1}` });
        if (nav.length) kb.push(nav);
        hint = results.length ? '\nأو اكتب جزءاً من اسم العميل للبحث' : '\nلا يوجد عملاء مسجلون بعد في المنصة';
        break;
      }
      case 'lead': hint = '\nاكتب جزءاً من الاسم أو المنشأة أو الجوال'; break;
      case 'location':
        hint = '\nاضغط زر «📍 إرسال موقعي» بالأسفل';
        await this.send(chat, q + hint, { reply_markup: { keyboard: [[{ text: '📍 إرسال موقعي', request_location: true }], [B.cancel]], resize_keyboard: true, one_time_keyboard: true } });
        if (skip.length) await this.send(chat, 'أو:', { reply_markup: { inline_keyboard: [skip, [{ text: B.cancel, callback_data: 'x' }]] } });
        return;
      case 'photo': hint = '\nأرسل الصورة من الكاميرا أو المعرض'; break;
      case 'phone': hint = '\nمثال: 0551234567'; break;
      case 'link': hint = '\nالصق الرابط (Drive أو غيره)'; break;
      case 'number': hint = '\nاكتب رقماً'; break;
      default: hint = f.t === 'long' ? '\nاكتب بالتفصيل في رسالة واحدة' : '';
    }
    kb.push([...skip, { text: B.cancel, callback_data: 'x' }]);
    if (msgId) return this.edit(chat, msgId, q + hint, kb);
    return this.send(chat, q + hint, { reply_markup: { inline_keyboard: kb } });
  }

  // إجابة نصية/موقع/صورة
  async onAnswerMsg(chat, user, st, msg) {
    const tpl = await loadTemplate(this.db, st.id);
    if (!tpl) { await this.clear(chat, user.id); return this.send(chat, 'القالب لم يعد متاحاً.', { reply_markup: this.menu(user) }); }
    if (st.i >= tpl.fields.length) return this.send(chat, 'اضغط «✅ حفظ» أو «✖️ إلغاء» في الرسالة السابقة.');
    const f = tpl.fields[st.i];
    const text = (msg.text || '').trim();
    let v;
    switch (f.t) {
      case 'location':
        if (!msg.location) return this.send(chat, 'أرسل الموقع بزر «📍 إرسال موقعي».');
        v = { lat: msg.location.latitude, lng: msg.location.longitude, acc: msg.location.horizontal_accuracy || null };
        break;
      case 'photo': {
        if (!msg.photo?.length) return this.send(chat, 'أرسل صورة (وليس ملفاً).');
        v = await this.savePhoto(msg.photo, user);
        if (!v) return this.send(chat, 'تعذّر حفظ الصورة — أرسلها مرة أخرى أو تخطَّ.');
        break;
      }
      case 'date':
        v = parseDate(text); if (!v) return this.send(chat, 'صيغة التاريخ غير مفهومة — مثال: 15/10 أو 2026-10-15');
        break;
      case 'phone': {
        const d = text.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[^\d+]/g, '');
        if (d.replace(/\D/g, '').length < 9) return this.send(chat, 'رقم الجوال غير صحيح — مثال: 0551234567');
        v = d; break;
      }
      case 'number': {
        const x = Number(text.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[,،\s]/g, ''));
        if (!isFinite(x)) return this.send(chat, 'اكتب رقماً صحيحاً.'); v = x; break;
      }
      case 'link':
        if (!/^https?:\/\/\S+$/i.test(text)) return this.send(chat, 'الصق رابطاً يبدأ بـ https://');
        v = text; break;
      case 'client': {
        if (!text) return;
        const { results } = await this.db.prepare("SELECT id, name FROM clients WHERE name LIKE ? OR brand LIKE ? OR phone LIKE ? ORDER BY name LIMIT 8").bind(`%${text}%`, `%${text}%`, `%${text}%`).all();
        if (!results.length) return this.send(chat, 'لا يوجد عميل بهذا الاسم — جرّب كلمة أخرى أو اختر من القائمة.');
        return this.send(chat, 'اختر العميل:', { reply_markup: { inline_keyboard: [...results.map((c) => [{ text: c.name, callback_data: `a:${c.id}` }]), [{ text: B.cancel, callback_data: 'x' }]] } });
      }
      case 'lead': {
        if (!text) return;
        const own = user.role === 'sales' ? ` AND (owner_id = ${Number(user.id)} OR owner_id IS NULL)` : '';
        const p = text.replace(/\D/g, '');
        const { results } = await this.db.prepare(`SELECT id, name, company, phone FROM leads WHERE (name LIKE ?1 OR company LIKE ?1 OR (?2 != '' AND phone LIKE ?2))${own} ORDER BY id DESC LIMIT 8`)
          .bind(`%${text}%`, p.length >= 4 ? `%${p.replace(/^0/, '')}%` : '').all();
        if (!results.length) return this.send(chat, 'لا نتائج — جرّب جزءاً آخر من الاسم أو الجوال، أو سجّله أولاً من «👤 عميل محتمل».');
        return this.send(chat, 'اختر:', { reply_markup: { inline_keyboard: [...results.map((l) => [{ text: cut([l.company, l.name].filter(Boolean).join(' — ') + (l.phone ? ` · ${l.phone.slice(-4)}` : ''), 40), callback_data: `a:${l.id}` }]), [{ text: B.cancel, callback_data: 'x' }]] } });
      }
      case 'select': case 'sector': case 'user':
        return this.send(chat, 'اختر من الأزرار في الرسالة السابقة 👆');
      default:
        if (!text) return this.send(chat, 'اكتب الإجابة نصاً.');
        v = cut(text, f.t === 'long' ? 3000 : 300);
    }
    st.a[f.k] = v; st.i++;
    return this.nextField(chat, user, tpl, st);
  }

  // إجابة من الأزرار
  async onAnswerBtn(chat, user, st, msgId, val) {
    const tpl = await loadTemplate(this.db, st.id);
    if (!tpl || st.i >= tpl.fields.length) return;
    const f = tpl.fields[st.i];
    let v;
    if (val === '_') { if (f.req) return; v = null; }
    else if (f.t === 'select') v = f.o[+val];
    else if (f.t === 'date') v = addDays(today(), +val);
    else if (['client', 'lead', 'user'].includes(f.t)) v = +val;
    else v = val;
    st.a[f.k] = v; st.i++;
    const label = v == null ? '—' : await answerLabel(this.db, f, v);
    await this.edit(chat, msgId, `✓ ${h(f.l)}: <b>${h(label || '—')}</b>`);
    return this.nextField(chat, user, tpl, st);
  }

  async summary(chat, user, tpl, st) {
    st.i = tpl.fields.length;
    await this.setState(chat, user.id, st);
    const lines = [];
    for (const f of tpl.fields) {
      const v = st.a[f.k]; if (v == null || v === '') continue;
      lines.push(`• ${h(f.l)}: <b>${h(cut(await answerLabel(this.db, f, v), 200))}</b>`);
    }
    if (tpl.kind === 'task' && st.a.assignee == null) lines.push('• المكلّف: <b>تلقائي حسب الدور</b>');
    if (tpl.kind === 'task' && !st.a.due && tpl.due_days) lines.push(`• التسليم: <b>${addDays(today(), tpl.due_days)}</b>`);
    await this.send(chat, `${tpl.emoji || '📌'} <b>مراجعة قبل الحفظ — ${h(tpl.name)}</b>\n\n${lines.join('\n') || '—'}`,
      { reply_markup: { inline_keyboard: [[{ text: '✅ حفظ في المنصة', callback_data: 'ok' }, { text: '↺ من البداية', callback_data: 'rs' }], [{ text: B.cancel, callback_data: 'x' }]] } });
  }

  async confirm(chat, user, st, msgId) {
    const tpl = await loadTemplate(this.db, st.id);
    try {
      const r = await runTemplate(this.db, this.env, user, tpl, st.a, 'تلجرام');
      await this.clear(chat, user.id);
      await this.edit(chat, msgId, '✅ <b>تم الحفظ في المنصة</b>');
      let txt; let kb;
      if (r.entity === 'tasks') {
        const who = r.assignee_id === user.id ? 'لك' : `لـ ${h((await this.db.prepare('SELECT name FROM users WHERE id = ?').bind(r.assignee_id).first('name')) || '')}`;
        txt = `📌 <b>${h(r.title)}</b>\nأُسندت ${who} · التسليم ${h(r.due_date || '—')} · رقم #${r.id}`;
        kb = [[{ text: 'فتح المهمة', callback_data: `k:${r.id}` }, { text: '🌐 المنصة', url: this.hub('#/tasks') }]];
      } else if (r.entity === 'leads') {
        txt = r.duplicate ? `ℹ️ هذا الرقم مسجل مسبقاً باسم <b>${h(r.title)}</b> — أُضيفت ملاحظتك لسجله.` : `👤 أُضيف العميل المحتمل <b>${h(r.title)}</b> (#${r.id}) — موعد المتابعة في «يومي».`;
        kb = [[{ text: '📞 تسجيل تواصل معه', callback_data: `la:${r.id}` }, { text: '🌐 فتح', url: this.hub(`#/lead/${r.id}`) }]];
      } else if (r.entity === 'activities') {
        txt = `📞 سُجّل التواصل: <b>${h(r.title)}</b>`;
        kb = [[{ text: '🌐 سجل العميل', url: this.hub(`#/lead/${r.lead_id}`) }]];
      } else {
        txt = `📍 سُجّلت الزيارة: <b>${h(r.title)}</b>${r.lead_created ? '\n👤 وأُنشئ عميل محتمل تلقائياً للمتابعة.' : ''}`;
        kb = r.lead_id ? [[{ text: '🌐 العميل المحتمل', url: this.hub(`#/lead/${r.lead_id}`) }]] : [];
      }
      await this.send(chat, txt, { reply_markup: { inline_keyboard: kb } });
      return this.send(chat, 'ماذا بعد؟', { reply_markup: this.menu(user) });
    } catch (e) {
      return this.send(chat, `⛔️ ${h(e.message)}`);
    }
  }

  async savePhoto(photos, user) {
    const sorted = [...photos].sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
    const p = sorted.find((x) => (x.file_size || 0) <= 1_300_000) || sorted[sorted.length - 1];
    const f = await this.call('getFile', { file_id: p.file_id });
    if (!f.ok) return null;
    const base = this.env.TG_API || 'https://api.telegram.org';
    const r = await fetch(`${base}/file/bot${this.token}/${f.result.file_path}`);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 1_400_000) return null;
    const ins = await this.db.prepare('INSERT INTO files (name, mime, size, data, user_id) VALUES (?,?,?,?,?)')
      .bind(`telegram-${Date.now()}.jpg`, 'image/jpeg', buf.byteLength, toB64(buf), user.id).run();
    return ins.meta.last_row_id;
  }

  // ---------------------------------------------------------------- المهام
  taskScope(user) {
    if (['admin', 'manager', 'account'].includes(user.role)) return { sql: '1=1', args: [] };
    return { sql: '(t.assignee_id = ? OR t.created_by = ?)', args: [user.id, user.id] };
  }
  async myTasks(chat, user, msgId, mode = 'mine') {
    const where = mode === 'late'
      ? `t.status != 'منجزة' AND t.due_date < ? AND ${this.taskScope(user).sql}`
      : mode === 'review' ? "t.status = 'مراجعة' AND t.created_by = ?" : "t.status != 'منجزة' AND t.assignee_id = ?";
    const args = mode === 'late' ? [today(), ...this.taskScope(user).args] : [user.id];
    const { results } = await this.db.prepare(`SELECT t.id, t.title, t.status, t.due_date, t.priority, c.name AS client, u.name AS who
      FROM tasks t LEFT JOIN clients c ON c.id = t.client_id LEFT JOIN users u ON u.id = t.assignee_id
      WHERE ${where} ORDER BY t.due_date IS NULL, t.due_date, t.id LIMIT 15`).bind(...args).all();
    const title = { mine: '📋 <b>مهامي المفتوحة</b>', late: '⚠️ <b>المهام المتأخرة</b>', review: '👀 <b>بانتظار مراجعتي</b>' }[mode];
    const body = results.length ? results.map((t, i) => `${i + 1}. ${h(cut(t.title, 60))}${t.client ? ` · ${h(t.client)}` : ''}\n    ${h(t.status)} · ${relDays(t.due_date)}${mode !== 'mine' ? ` · ${h(t.who || '')}` : ''}`).join('\n')
      : (mode === 'mine' ? 'لا مهام مفتوحة عليك 👌' : 'لا شيء هنا 👌');
    const kb = rows(results.map((t, i) => ({ text: `${i + 1}`, callback_data: `k:${t.id}` })), 5);
    kb.push([{ text: 'المتأخرة', callback_data: 'tl:late' }, { text: 'بانتظار مراجعتي', callback_data: 'tl:review' }, { text: 'مهامي', callback_data: 'tl:mine' }]);
    kb.push([{ text: B.newTask, callback_data: 'c:back' }]);
    return msgId ? this.edit(chat, msgId, `${title}\n\n${body}`, kb) : this.send(chat, `${title}\n\n${body}`, { reply_markup: { inline_keyboard: kb } });
  }

  async taskRow(user, id) {
    const sc = this.taskScope(user);
    return this.db.prepare(`SELECT t.*, c.name AS client, u.name AS who, tp.name AS tpl, tp.emoji FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
      LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN templates tp ON tp.id = t.template_id WHERE t.id = ? AND ${sc.sql}`).bind(id, ...sc.args).first();
  }
  async taskCard(chat, user, id, msgId) {
    const t = await this.taskRow(user, id);
    if (!t) return this.send(chat, 'المهمة غير موجودة أو خارج صلاحيتك.');
    let cl = []; try { cl = JSON.parse(t.checklist || '[]') || []; } catch { cl = []; }
    const done = cl.filter((x) => x.d).length;
    const text = `${t.emoji || '📌'} <b>${h(t.title)}</b>  #${t.id}\n`
      + `${t.client ? `🏷️ ${h(t.client)}\n` : ''}👤 ${h(t.who || '—')} · 📅 ${h(t.due_date || '—')} (${relDays(t.due_date)})\n`
      + `الحالة: <b>${h(t.status)}</b> · الأولوية: ${h(t.priority)}${t.revisions ? ` · تعديلات: ${t.revisions}` : ''}\n`
      + (cl.length ? `الخطوات: ${done}/${cl.length}\n` : '')
      + (t.description ? `\n${h(cut(t.description, 900))}\n` : '')
      + (t.link ? `\n🔗 ${h(t.link)}` : '');
    const kb = cl.map((x, i) => [{ text: `${x.d ? '☑️' : '⬜️'} ${cut(x.t, 38)}`, callback_data: `ck:${t.id}:${i}` }]);
    const isOwner = BOSS.includes(user.role) || t.created_by === user.id;
    const st = [];
    if (t.status !== 'قيد التنفيذ' && t.status !== 'منجزة') st.push({ text: '▶️ بدء', callback_data: `s:${t.id}:1` });
    if (t.status !== 'مراجعة' && t.status !== 'منجزة') st.push({ text: '👀 للمراجعة', callback_data: `s:${t.id}:2` });
    if (isOwner && (t.status === 'مراجعة' || t.status === 'منجزة')) st.push({ text: '🔁 تعديلات', callback_data: `s:${t.id}:3` });
    if (t.status !== 'منجزة') st.push({ text: '✅ إنجاز', callback_data: `s:${t.id}:4` });
    if (st.length) kb.push(st);
    kb.push([{ text: '💬 ملاحظة', callback_data: `n:${t.id}` }, { text: '🔗 رابط', callback_data: `l:${t.id}` }, { text: '📋 مهامي', callback_data: 'tl:mine' }]);
    return msgId ? this.edit(chat, msgId, text, kb) : this.send(chat, text, { reply_markup: { inline_keyboard: kb } });
  }

  async setTaskStatus(chat, user, id, idx, msgId) {
    const before = await this.taskRow(user, id); if (!before) return;
    const status = TASK_STATUS[+idx]; if (!status || status === before.status) return this.taskCard(chat, user, id, msgId);
    const isOwner = BOSS.includes(user.role) || before.created_by === user.id;
    if (status === 'تعديلات' && !isOwner) return;
    const sets = ['status = ?']; const args = [status];
    if (status === 'منجزة') sets.push('done_at = ?'), args.push(today()); else sets.push('done_at = NULL');
    if (status === 'تعديلات') sets.push('revisions = COALESCE(revisions,0) + 1');
    await this.db.prepare(`UPDATE tasks SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...args, id).run();
    const after = await this.db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
    await audit(this.db, user, 'update', 'tasks', id, `status → ${status} (تلجرام)`);
    await taskChanged(this.db, this.env, user, before, after);
    return this.taskCard(chat, user, id, msgId);
  }
  async toggleCheck(chat, user, id, i, msgId) {
    const t = await this.taskRow(user, id); if (!t) return;
    let cl = []; try { cl = JSON.parse(t.checklist || '[]') || []; } catch { return; }
    if (!cl[+i]) return;
    cl[+i].d = cl[+i].d ? 0 : 1;
    const startNow = t.status === 'جديدة' && cl.some((x) => x.d);
    await this.db.prepare(`UPDATE tasks SET checklist = ?${startNow ? ", status = 'قيد التنفيذ'" : ''}, updated_at = datetime('now') WHERE id = ?`).bind(JSON.stringify(cl), id).run();
    return this.taskCard(chat, user, id, msgId);
  }
  async onTaskInput(chat, user, st, text) {
    const t = await this.taskRow(user, st.task);
    await this.clear(chat, user.id);
    if (!t || !text) return this.send(chat, 'تم الإلغاء.', { reply_markup: this.menu(user) });
    if (st.f === 'link') {
      if (!/^https?:\/\/\S+$/i.test(text)) { await this.setState(chat, user.id, st); return this.send(chat, 'الصق رابطاً يبدأ بـ https://'); }
      await this.db.prepare("UPDATE tasks SET link = ?, updated_at = datetime('now') WHERE id = ?").bind(text, t.id).run();
    } else {
      const stamp = `— ${today()} · ${user.name}: ${cut(text, 1500)}`;
      await this.db.prepare("UPDATE tasks SET description = TRIM(COALESCE(description,'') || char(10) || ?), updated_at = datetime('now') WHERE id = ?").bind(stamp, t.id).run();
      const other = [t.assignee_id, t.created_by].find((x) => x && x !== user.id);
      if (other) {
        await notifyUser(this.db, this.env, other, `💬 ملاحظة من ${h(user.name)} على:\n<b>${h(t.title)}</b>\n\n${h(cut(text, 800))}`, [[{ text: 'فتح المهمة', callback_data: `k:${t.id}` }]]);
      }
    }
    await audit(this.db, user, 'update', 'tasks', t.id, st.f === 'link' ? 'link (تلجرام)' : 'note (تلجرام)');
    await this.send(chat, st.f === 'link' ? '🔗 حُفظ الرابط.' : '💬 أُضيفت الملاحظة.', { reply_markup: this.menu(user) });
    return this.taskCard(chat, user, t.id);
  }

  // ---------------------------------------------------------------- يومي واللوحة والبحث
  async dayText(user) {
    const t = today(); const tomorrow = addDays(t, 1);
    const all = async (sql, ...a) => (await this.db.prepare(sql).bind(...a).all()).results;
    const tasks = await all(`SELECT t.id, t.title, t.due_date, t.status, c.name AS client FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
      WHERE t.assignee_id = ? AND t.status != 'منجزة' AND (t.due_date IS NULL OR t.due_date <= ?) ORDER BY t.due_date IS NULL, t.due_date LIMIT 15`, user.id, tomorrow);
    let out = `☀️ <b>يومك — ${t}</b>\n\n📋 <b>مهام مستحقة (${tasks.length})</b>\n` + (tasks.map((x) => `• ${h(cut(x.title, 55))} — ${relDays(x.due_date)}`).join('\n') || 'لا شيء 👌');
    if (canDo(user, 'leads', 'r')) {
      const f = await all(`SELECT name, company, next_followup FROM leads WHERE next_followup IS NOT NULL AND next_followup <= ?
        AND status NOT IN ('محوّل لعميل','غير مهتم','غير صالح') ${BOSS.includes(user.role) ? '' : 'AND owner_id = ' + Number(user.id)} ORDER BY next_followup LIMIT 10`, t);
      out += `\n\n👥 <b>متابعات مستحقة (${f.length})</b>\n` + (f.map((x) => `• ${h([x.company, x.name].filter(Boolean).join(' — '))} — ${relDays(x.next_followup)}`).join('\n') || 'لا شيء 👌');
    }
    const c = await all(`SELECT ct.title, ct.publish_date, ct.status, cl.name AS client FROM content ct LEFT JOIN clients cl ON cl.id = ct.client_id
      WHERE (ct.assignee_id = ? OR ct.designer_id = ?) AND ct.status NOT IN ('منشور','ملغي') AND ct.publish_date <= ? ORDER BY ct.publish_date LIMIT 10`, user.id, user.id, addDays(t, 3));
    if (c.length) out += `\n\n🗓️ <b>محتوى خلال 3 أيام (${c.length})</b>\n` + c.map((x) => `• ${h(x.client || '')}: ${h(cut(x.title, 45))} — ${h(x.status)} · ${relDays(x.publish_date)}`).join('\n');
    if (BOSS.includes(user.role)) {
      const late = await this.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status != 'منجزة' AND due_date < ?").bind(t).first('n');
      const rev = await this.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status = 'مراجعة'").first('n');
      out += `\n\n🧭 <b>الفريق</b>: ${late} مهمة متأخرة · ${rev} بانتظار المراجعة`;
    }
    return { text: out, count: tasks.length };
  }
  async myDay(chat, user) {
    const { text } = await this.dayText(user);
    return this.send(chat, text, { reply_markup: { inline_keyboard: [[{ text: '📋 مهامي', callback_data: 'tl:mine' }, { text: '🌐 المنصة', url: this.hub('#/myday') }]] } });
  }
  async board(chat, user) {
    if (!BOSS.includes(user.role)) return this.welcome(chat, user);
    const t = today(); const m0 = t.slice(0, 8) + '01';
    const one = (sql, ...a) => this.db.prepare(sql).bind(...a).first();
    const tk = await one(`SELECT SUM(CASE WHEN status != 'منجزة' THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status != 'منجزة' AND due_date < ?1 THEN 1 ELSE 0 END) AS late,
      SUM(CASE WHEN status = 'مراجعة' THEN 1 ELSE 0 END) AS review, SUM(CASE WHEN status = 'منجزة' AND done_at >= ?2 THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN status = 'منجزة' AND done_at >= ?2 AND (due_date IS NULL OR done_at <= due_date) THEN 1 ELSE 0 END) AS ontime FROM tasks`, t, m0);
    const ld = await one(`SELECT COUNT(*) AS total, SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END) AS month,
      SUM(CASE WHEN next_followup <= ?2 AND status NOT IN ('محوّل لعميل','غير مهتم','غير صالح') THEN 1 ELSE 0 END) AS due FROM leads`, m0, t);
    const dl = await one(`SELECT COALESCE(SUM(CASE WHEN stage NOT IN ('مكسوبة','خاسرة') THEN value END),0) AS open,
      COALESCE(SUM(CASE WHEN stage = 'مكسوبة' AND closed_at >= ? THEN value END),0) AS won FROM deals`, m0);
    const vs = await one('SELECT COUNT(*) AS n FROM visits WHERE at >= ?', m0);
    const { results: team } = await this.db.prepare(`SELECT u.name, SUM(CASE WHEN t.status != 'منجزة' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN t.status != 'منجزة' AND t.due_date < ? THEN 1 ELSE 0 END) AS late FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id
      WHERE u.active = 1 GROUP BY u.id ORDER BY late DESC, open DESC`).bind(t).all();
    const nf = (x) => new Intl.NumberFormat('en-US').format(Math.round(Number(x) || 0));
    const ot = tk.done ? Math.round(tk.ontime * 100 / tk.done) + '%' : '—';
    return this.send(chat, `📊 <b>لوحة قطاع التسويق — ${t}</b>\n\n<b>التشغيل</b>\n• مفتوحة ${tk.open || 0} · متأخرة ${tk.late || 0} · للمراجعة ${tk.review || 0}\n• أُنجز هذا الشهر ${tk.done || 0} · الالتزام بالموعد ${ot} (المستهدف ≥ 95%)\n\n`
      + `<b>المبيعات</b>\n• عملاء محتملون ${ld.total || 0} (${ld.month || 0} هذا الشهر) · متابعات مستحقة ${ld.due || 0}\n• خط المبيعات ${nf(dl.open)} ر.س · مكسوب هذا الشهر ${nf(dl.won)} ر.س\n• زيارات هذا الشهر ${vs.n || 0}\n\n`
      + `<b>الفريق</b> (مفتوحة / متأخرة)\n${team.map((u) => `• ${h(u.name)}: ${u.open || 0} / ${u.late || 0}`).join('\n')}`,
    { reply_markup: { inline_keyboard: [[{ text: '⚠️ المتأخرة', callback_data: 'tl:late' }, { text: '🌐 لوحة القيادة', url: this.hub('#/dashboard') }]] } });
  }
  async doSearch(chat, user, text, implicit) {
    await this.clear(chat, user.id);
    const q = String(text || '').trim(); if (q.length < 2) return this.send(chat, 'اكتب كلمتين على الأقل.', { reply_markup: this.menu(user) });
    const p = q.replace(/\D/g, '').replace(/^0/, '');
    const kb = [];
    if (canDo(user, 'leads', 'r')) {
      const own = user.role === 'sales' ? ` AND (owner_id = ${Number(user.id)} OR owner_id IS NULL)` : '';
      const { results } = await this.db.prepare(`SELECT id, name, company, status FROM leads WHERE (name LIKE ?1 OR company LIKE ?1 OR (?2 != '' AND phone LIKE ?2))${own} ORDER BY id DESC LIMIT 6`).bind(`%${q}%`, p.length >= 4 ? `%${p}%` : '').all();
      results.forEach((l) => kb.push([{ text: `👤 ${cut([l.company, l.name].filter(Boolean).join(' — '), 32)} · ${l.status}`, callback_data: `ld:${l.id}` }]));
    }
    if (canDo(user, 'clients', 'r')) {
      const { results } = await this.db.prepare(`SELECT id, name FROM clients WHERE name LIKE ?1 OR brand LIKE ?1 OR (?2 != '' AND phone LIKE ?2) LIMIT 5`).bind(`%${q}%`, p.length >= 4 ? `%${p}%` : '').all();
      results.forEach((c) => kb.push([{ text: `🏷️ ${cut(c.name, 36)}`, url: this.hub(`#/client/${c.id}`) }]));
    }
    const { results: tk } = await this.db.prepare(`SELECT t.id, t.title FROM tasks t WHERE t.title LIKE ? AND t.status != 'منجزة' AND ${this.taskScope(user).sql} LIMIT 5`).bind(`%${q}%`, ...this.taskScope(user).args).all();
    tk.forEach((t) => kb.push([{ text: `📌 ${cut(t.title, 38)}`, callback_data: `k:${t.id}` }]));
    if (!kb.length) return this.send(chat, implicit ? `لم أجد «${h(q)}». استخدم الأزرار بالأسفل 👇` : 'لا نتائج.', { reply_markup: this.menu(user) });
    return this.send(chat, `🔎 نتائج «${h(q)}»:`, { reply_markup: { inline_keyboard: kb } });
  }
  async leadCard(chat, user, id) {
    const own = user.role === 'sales' ? ` AND (owner_id = ${Number(user.id)} OR owner_id IS NULL)` : '';
    const l = await this.db.prepare(`SELECT * FROM leads WHERE id = ?${own}`).bind(id).first();
    if (!l) return this.send(chat, 'غير موجود أو خارج صلاحيتك.');
    const { results: acts } = await this.db.prepare('SELECT kind, outcome, at FROM activities WHERE lead_id = ? ORDER BY at DESC LIMIT 3').bind(id).all();
    const kb = [];
    if (l.phone) kb.push([{ text: '💬 واتساب', url: `https://wa.me/${l.phone}` }]);
    if (canDo(user, 'activities', 'w')) kb[0] ? kb[0].push({ text: '📞 تسجيل تواصل', callback_data: `la:${l.id}` }) : kb.push([{ text: '📞 تسجيل تواصل', callback_data: `la:${l.id}` }]);
    kb.push([{ text: '🌐 فتح في المنصة', url: this.hub(`#/lead/${l.id}`) }]);
    return this.send(chat, `👤 <b>${h([l.company, l.name].filter(Boolean).join(' — '))}</b>\n📱 ${h(l.phone || '—')} · ${h(l.city || '')}\nالحالة: <b>${h(l.status)}</b>${l.interest ? ` · ${h(l.interest)}` : ''}\nالمتابعة: ${relDays(l.next_followup)}${l.notes ? `\n\n${h(cut(l.notes, 400))}` : ''}`
      + (acts.length ? `\n\n<b>آخر تواصل</b>\n${acts.map((a) => `• ${h(a.kind)} — ${h(a.outcome || '')} (${h(String(a.at).slice(0, 10))})`).join('\n')}` : ''), { reply_markup: { inline_keyboard: kb } });
  }

  // ---------------------------------------------------------------- الأزرار
  async onCallback(cq) {
    const chat = cq.message?.chat?.id; const msgId = cq.message?.message_id; const data = cq.data || '';
    await this.call('answerCallbackQuery', { callback_query_id: cq.id });
    if (!chat) return;
    const user = await this.userByChat(chat);
    if (!user) return this.send(chat, 'اربط حسابك أولاً من المنصة.');
    const [k, a1, a2] = data.split(':');
    const st = await this.getState(chat);
    switch (k) {
      case 'x': await this.clear(chat, user.id); await this.edit(chat, msgId, 'تم الإلغاء.'); return this.send(chat, '…', { reply_markup: this.menu(user) });
      case 'c': return a1 === 'back' ? this.categories(chat, user, msgId) : this.templateList(chat, user, msgId, a1);
      case 't': {
        const tpl = await loadTemplate(this.db, a1);
        if (!tplAllowed(user, tpl)) return this.send(chat, 'هذا القالب غير متاح لدورك.');
        await this.edit(chat, msgId, `${tpl.emoji || '📌'} ${h(tpl.name)}`);
        return this.startTpl(chat, user, tpl);
      }
      case 'a': if (st.f !== 'tpl') return; return this.onAnswerBtn(chat, user, st, msgId, data.slice(2));
      case 'cp': {
        if (st.f !== 'tpl') return; const tpl = await loadTemplate(this.db, st.id);
        return this.askField(chat, user, tpl, st, tpl.fields[st.i], +a1, msgId);
      }
      case 'ok': if (st.f !== 'tpl') return; return this.confirm(chat, user, st, msgId);
      case 'rs': {
        if (st.f !== 'tpl') return; const tpl = await loadTemplate(this.db, st.id);
        await this.edit(chat, msgId, '↺ من البداية'); return this.startTpl(chat, user, tpl);
      }
      case 'la': return this.startByCode(chat, user, 'ACT', { lead: +a1 });
      case 'ld': return this.leadCard(chat, user, +a1);
      case 'tl': return this.myTasks(chat, user, msgId, a1);
      case 'k': return this.taskCard(chat, user, +a1);
      case 's': return this.setTaskStatus(chat, user, +a1, a2, msgId);
      case 'ck': return this.toggleCheck(chat, user, +a1, a2, msgId);
      case 'n': case 'l': {
        const t = await this.taskRow(user, +a1); if (!t) return;
        await this.setState(chat, user.id, { f: k === 'n' ? 'note' : 'link', task: t.id });
        return this.send(chat, k === 'n' ? `💬 اكتب ملاحظتك على «${h(t.title)}»:` : `🔗 الصق رابط الملف لـ «${h(t.title)}»:`, { reply_markup: { keyboard: [[B.cancel]], resize_keyboard: true } });
      }
      default: return;
    }
  }
}

// ---------------------------------------------------------------- واجهات تُستدعى من الموجّه
export async function handleUpdate(db, env, update, origin) {
  const token = await tgToken(db, env); if (!token) return;
  const bot = new Bot(db, env, token, origin);
  try { await bot.handle(update); } catch (e) {
    console.error('bot', e);
    const chat = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    if (chat) await bot.send(chat, '⚠️ حدث خطأ غير متوقع — جرّب مرة أخرى أو استخدم المنصة.').catch(() => {});
  }
}

// ملخص الصباح لكل عضو مرتبط
export async function dailyDigest(db, env) {
  const token = await tgToken(db, env); if (!token) return { sent: 0 };
  const bot = new Bot(db, env, token);
  const { results } = await db.prepare('SELECT id, name, role, email, title, active FROM users WHERE active = 1 AND tg_chat_id IS NOT NULL').all();
  let sent = 0;
  for (const u of results) {
    const chat = (await db.prepare('SELECT tg_chat_id FROM users WHERE id = ?').bind(u.id).first('tg_chat_id'));
    const { text } = await bot.dayText(u);
    const r = await bot.send(chat, `صباح الخير ${h(u.name.split(' ')[0])} 🌤️\n\n${text}`, { reply_markup: { inline_keyboard: [[{ text: '📋 مهامي', callback_data: 'tl:mine' }]] } });
    if (r.ok) sent++;
  }
  return { sent, users: results.length };
}

export function newLinkCode() { return randomToken(6).toUpperCase(); }
