/* منصة نُبل وابتكار للتسويق — صندوق ردود واتساب (رقم التسويق 0563413040) */
'use strict';

const WA_ROLES = ['admin', 'manager', 'sales', 'account'];
let waTimer = null;

function waTime(at) {
  if (!at) return '';
  const d = new Date(String(at).replace(' ', 'T') + (String(at).includes('Z') || String(at).includes('+') ? '' : 'Z'));
  const ksa = new Date(d.getTime() + 3 * 3600e3);
  const same = ksa.toISOString().slice(0, 10) === todayStr();
  const hm = ksa.toISOString().slice(11, 16);
  return same ? `<span class="num">${hm}</span>` : `${fdate(ksa.toISOString().slice(0, 10))} <span class="num">${hm}</span>`;
}
const waPhone = (id) => (String(id).startsWith('966') ? '0' + String(id).slice(3) : '+' + id);
const waBotOn = (until) => !until || Date.parse(until) <= Date.now();

async function waView(id) {
  clearInterval(waTimer);
  if (!WA_ROLES.includes(me().role)) { V().innerHTML = '<div class="empty">لا تملك صلاحية صندوق واتساب</div>'; return; }
  V().innerHTML = `<div class="wa-box ${id ? 'has-thread' : ''}"><div class="wa-list card"><div class="wa-lh"><b>${I.wa} محادثات رقم التسويق</b>
      <span class="small muted num" dir="ltr">0563413040</span></div><div id="wa-threads" class="wa-threads"><div class="empty">جارٍ التحميل…</div></div></div>
    <div class="wa-thread card" id="wa-thread">${id ? '<div class="empty">جارٍ التحميل…</div>' : '<div class="empty">اختر محادثة من القائمة</div>'}</div></div>`;
  await waLoadThreads(id);
  if (id) await waLoadThread(id);
  waTimer = setInterval(async () => {
    if (S.route !== 'wa') { clearInterval(waTimer); return; }
    await waLoadThreads(id, true).catch(() => {});
    if (id && !($('#wa-text') && $('#wa-text').value)) await waLoadThread(id, true).catch(() => {});
  }, 15000);
}

async function waLoadThreads(active, quiet) {
  const d = await api('wa/threads');
  const el = $('#wa-threads'); if (!el) return;
  el.innerHTML = d.threads.length ? d.threads.map((t) => {
    const who = t.last_kind === 'message' ? '' : t.last_kind === 'reply' ? '🤖 ' : '👤 ';
    return `<a class="wa-ti ${t.wa_id === active ? 'on' : ''}" href="#/wa/${esc(t.wa_id)}">
      <div class="wa-tn"><b>${esc(t.name || waPhone(t.wa_id))}</b><span class="small muted">${waTime(t.last_at)}</span></div>
      <div class="wa-tp small muted">${who}${esc(String(t.last_text || '').slice(0, 80))}</div>
      <div class="wa-tf">${t.name ? `<span class="small muted num" dir="ltr">${esc(waPhone(t.wa_id))}</span>` : '<span></span>'}
        ${waBotOn(t.bot_paused_until) ? '<span class="pill t">الرد الآلي يعمل</span>' : '<span class="pill o">موظف يتولى</span>'}</div></a>`;
  }).join('') : '<div class="empty">لا توجد محادثات بعد</div>';
}

async function waLoadThread(id, quiet) {
  const d = await api('wa/thread/' + encodeURIComponent(id));
  const el = $('#wa-thread'); if (!el) return;
  const on = waBotOn(d.bot_paused_until);
  const draft = $('#wa-text') ? $('#wa-text').value : '';
  el.innerHTML = `<div class="wa-th"><a class="btn btn-g btn-s wa-back" href="#/wa">→ المحادثات</a>
      <div><b>${esc(d.name || waPhone(d.wa_id))}</b><div class="small muted num" dir="ltr">${esc(waPhone(d.wa_id))}</div></div><span class="sp"></span>
      <button class="btn btn-s ${on ? 'btn-g' : 'btn-p'}" id="wa-bot">${on ? 'إيقاف الرد الآلي' : 'تشغيل الرد الآلي'}</button>
      <a class="btn btn-wa btn-s" href="tel:${esc(waPhone(d.wa_id))}">اتصال</a></div>
    <div class="small ${on ? 'muted' : ''}" style="padding:6px 14px;${on ? '' : 'color:var(--terra)'}">${on ? 'الرد الآلي يعمل لهذه المحادثة.' : `الرد الآلي متوقف لهذه المحادثة حتى ${waTime(d.bot_paused_until)} — أنت من يرد.`}</div>
    <div class="wa-msgs" id="wa-msgs">${d.messages.map((m) => `<div class="wa-m ${m.from}"><div class="wa-b">${esc(m.text).replace(/\n/g, '<br>')}</div>
      <div class="wa-meta small muted">${m.from === 'bot' ? '🤖 الرد الآلي · ' : m.from === 'staff' ? `👤 ${esc(m.by || 'موظف')} · ` : ''}${waTime(m.at)}${m.status === 'send_failed' ? ' · <b style="color:var(--red)">لم يُرسل</b>' : ''}</div></div>`).join('') || '<div class="empty">لا رسائل</div>'}</div>
    ${d.window_open ? `<form class="wa-compose" id="wa-form"><textarea class="inp" id="wa-text" rows="2" placeholder="اكتب ردك للعميل… (Enter للإرسال، Shift+Enter لسطر جديد)">${esc(draft)}</textarea>
      <button class="btn btn-wa">${I.wa} إرسال</button></form>
      <div class="small muted" style="padding:0 14px 10px">إرسال ردك يوقف الرد الآلي لهذه المحادثة 12 ساعة تلقائياً.</div>`
    : '<div class="wa-closed small">مرّ أكثر من 24 ساعة على آخر رسالة من العميل — واتساب لا يسمح بالرد الحر الآن. اتصل بالعميل أو انتظر رسالته التالية (القوالب المعتمدة تُضاف لاحقاً).</div>'}`;
  const box = $('#wa-msgs'); if (box) box.scrollTop = box.scrollHeight;
  $('#wa-bot').onclick = async () => {
    try { await api('wa/bot/' + encodeURIComponent(id), { method: 'POST', body: { on: !on } }); toast(on ? 'أُوقف الرد الآلي لهذه المحادثة' : 'عاد الرد الآلي للعمل'); waLoadThread(id); waLoadThreads(id); }
    catch (e) { toast(e.message, 1); }
  };
  const f = $('#wa-form');
  if (f) {
    const ta = $('#wa-text');
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
    f.onsubmit = async (e) => {
      e.preventDefault(); const text = ta.value.trim(); if (!text) return;
      const b = $('button', f); b.disabled = true;
      try { await api('wa/send/' + encodeURIComponent(id), { method: 'POST', body: { text } }); ta.value = ''; toast('أُرسل الرد'); await waLoadThread(id); waLoadThreads(id); }
      catch (err) { toast(err.message, 1); b.disabled = false; }
    };
    if (!quiet) ta.focus();
  }
}

// التسجيل في القائمة والمسارات
ROUTES.wa = { title: 'صندوق واتساب', render: waView };
(() => {
  const g = NAV.find((x) => x[0] === 'المبيعات و CRM');
  if (g && !g[1].some((i) => i[0] === 'wa')) g[1].unshift(['wa', 'صندوق واتساب', 'wa', '#wa']);
  const orig = navAllowed;
  // eslint-disable-next-line no-global-assign
  navAllowed = (perm) => (perm === '#wa' ? WA_ROLES.includes(me().role) : orig(perm));
})();

(() => {
  const css = `.wa-box{display:grid;grid-template-columns:340px 1fr;gap:14px;height:calc(100vh - 120px);min-height:480px}
  .wa-list,.wa-thread{padding:0;display:flex;flex-direction:column;overflow:hidden}
  .wa-lh{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line)}
  .wa-lh svg{width:16px;height:16px;color:#1FA855;vertical-align:-3px}
  .wa-threads{overflow:auto;flex:1}
  .wa-ti{display:block;padding:10px 14px;border-bottom:1px solid var(--line);color:inherit}
  .wa-ti:hover{background:var(--soft)}.wa-ti.on{background:#E3F2F1}
  .wa-tn,.wa-tf{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .wa-tp{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:2px 0}
  .wa-th{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line)}
  .wa-th .sp{flex:1}.wa-back{display:none}
  .wa-msgs{flex:1;overflow:auto;padding:14px;background:#EFE9DE;display:flex;flex-direction:column;gap:8px}
  .wa-m{max-width:78%;display:flex;flex-direction:column}
  .wa-m.customer{align-self:flex-start}.wa-m.bot,.wa-m.staff{align-self:flex-end}
  .wa-b{padding:8px 12px;border-radius:12px;background:#fff;box-shadow:0 1px 1px rgba(0,0,0,.06);white-space:normal;word-break:break-word}
  .wa-m.bot .wa-b{background:#DCF5E3}.wa-m.staff .wa-b{background:#D7ECF4}
  .wa-meta{padding:2px 6px}
  .wa-compose{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--line);align-items:flex-end}
  .wa-compose textarea{flex:1;resize:vertical;min-height:44px}
  .wa-closed{padding:12px 14px;border-top:1px solid var(--line);background:#FBEEE8;color:#A04A1F}
  @media(max-width:860px){.wa-box{grid-template-columns:1fr;height:auto}.wa-box.has-thread .wa-list{display:none}
    .wa-box:not(.has-thread) .wa-thread{display:none}.wa-back{display:inline-flex}.wa-msgs{max-height:60vh}}`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();
