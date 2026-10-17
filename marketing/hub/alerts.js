/* منصة نُبل وابتكار للتسويق — الإشعارات المنبثقة (Pop-up) + إشعارات سطح المكتب + التقارير الدورية وأوامر واتساب
   • كل 20 ثانية تُجلب الإشعارات الجديدة وتظهر بطاقات منبثقة بنغمة خفيفة، وإن كانت الصفحة في الخلفية يظهر إشعار النظام (بعد السماح).
   • «تقاريري»: مواعيد التقرير الصباحي والمسائي، إرسال تقريري الآن، ودليل إدارة المهام من واتساب. */
'use strict';
(function nublAlerts() {
  const POLL = 20000;
  const ICON = { task_assigned: '📌', task_done: '✅', note: '💬', lead: '👤', finance: '💰', reminder: '⏰', system: '⚙️', report: '📊' };
  let last = 0; let timer = null; let box = null; let audioCtx = null;
  const KEY = 'nubl_alert_sound';
  const soundOn = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };

  const css = document.createElement('style');
  css.textContent = `
  .pops{position:fixed;bottom:18px;inset-inline-end:18px;z-index:120;display:flex;flex-direction:column-reverse;gap:10px;width:min(370px,calc(100vw - 24px));pointer-events:none}
  .pop{pointer-events:auto;background:#fff;border:1px solid var(--line);border-inline-start:5px solid var(--gold,#DC9C47);border-radius:14px;box-shadow:0 14px 40px rgba(8,42,55,.22);
    padding:12px 14px;display:flex;gap:10px;align-items:flex-start;animation:popIn .35s cubic-bezier(.2,.9,.3,1.2);cursor:pointer}
  .pop.out{animation:popOut .25s forwards}
  .pop .ic{font-size:22px;line-height:1}.pop .tx{flex:1;min-width:0}.pop b{display:block;color:var(--deep);font-size:13.5px}
  .pop p{margin:2px 0 0;font-size:12.5px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}
  .pop .x{background:none;border:0;font-size:18px;color:var(--muted);cursor:pointer;line-height:1;padding:0 2px}
  .pop.ask{border-inline-start-color:var(--teal,#308D8B);cursor:default}.pop.ask .acts{display:flex;gap:6px;margin-top:8px}
  .pop.k-finance{border-inline-start-color:var(--teal,#308D8B)}.pop.k-reminder,.pop.k-system{border-inline-start-color:var(--terra,#D2652A)}
  @keyframes popIn{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:none}}
  @keyframes popOut{to{opacity:0;transform:translateX(-30px)}}
  .rp-cmd{background:var(--soft,#F4EDE1);border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.9}
  .rp-cmd code{background:#fff;border:1px solid var(--line);border-radius:6px;padding:0 6px;font-family:inherit}
  .rp-prev{white-space:pre-wrap;background:#0C2A35;color:#E9F3F5;border-radius:10px;padding:12px;font-size:12.5px;max-height:260px;overflow:auto;margin-top:10px}
  @media(max-width:700px){.pops{bottom:auto;top:62px;inset-inline-end:12px}}`;
  document.head.appendChild(css);

  function chime() {
    if (!soundOn()) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(880, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12);
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
      o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.4);
    } catch { /* المتصفح يمنع الصوت قبل أول تفاعل */ }
  }
  const container = () => { if (!box || !document.body.contains(box)) { box = document.createElement('div'); box.className = 'pops'; document.body.appendChild(box); } return box; };
  function dismiss(el) { el.classList.add('out'); setTimeout(() => el.remove(), 260); }

  function openLink(link) {
    if (!link) return;
    const m = /^#\/?tasks\/(\d+)/.exec(link);
    if (m) { go('#/tasks'); api(`e/tasks/${m[1]}`).then(({ row }) => row && openForm('tasks', row, {}, () => rerender())).catch(() => {}); return; }
    go(link.startsWith('#/') ? link : '#/' + link.replace(/^#/, ''));
  }

  function show(n) {
    const c = container();
    while (c.children.length >= 4) c.firstElementChild.remove();
    const el = document.createElement('div'); el.className = `pop k-${n.kind || 'x'}`;
    el.innerHTML = `<span class="ic">${ICON[n.kind] || '🔔'}</span><div class="tx"><b>${esc(n.title || 'إشعار')}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}</div><button class="x" aria-label="إغلاق">×</button>`;
    el.onclick = (e) => {
      if (e.target.classList.contains('x')) { dismiss(el); return; }
      api('notifications/read', { method: 'POST', body: { id: n.id } }).catch(() => {});
      dismiss(el); openLink(n.link);
    };
    c.appendChild(el);
    setTimeout(() => el.isConnected && dismiss(el), 14000);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const sys = new Notification(n.title || 'منصة نُبل وابتكار', { body: n.body || '', icon: '../logo.png', tag: 'nubl-' + n.id, lang: 'ar', dir: 'rtl' });
        sys.onclick = () => { window.focus(); openLink(n.link); sys.close(); };
      } catch { /* */ }
    }
  }

  function askDesktop() {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    try { if (localStorage.getItem('nubl_notif_asked')) return; localStorage.setItem('nubl_notif_asked', '1'); } catch { return; }
    const c = container(); const el = document.createElement('div'); el.className = 'pop ask';
    el.innerHTML = `<span class="ic">🔔</span><div class="tx"><b>فعّل إشعارات سطح المكتب</b><p>لتصلك المهام والتنبيهات حتى لو كانت المنصة في تبويب آخر.</p>
      <div class="acts"><button class="btn btn-p btn-s" data-y>تفعيل</button><button class="btn btn-g btn-s" data-n>لاحقاً</button></div></div>`;
    $('[data-y]', el).onclick = async () => { dismiss(el); try { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'فُعّلت إشعارات سطح المكتب' : 'لم تُفعَّل — يمكنك السماح من إعدادات المتصفح'); } catch { /* */ } };
    $('[data-n]', el).onclick = () => dismiss(el);
    c.appendChild(el);
  }

  async function poll(first) {
    if (!S.meta || !$('#bell')) return;
    try {
      const r = await api(`notifications?count=1&since=${first ? 0 : last}`, { noAuthRedirect: true });
      const b = $('#bell .bdg'); if (b) b.textContent = r.unread ? (r.unread > 99 ? '99+' : r.unread) : '';
      if (!first && r.fresh?.length) { r.fresh.forEach(show); chime(); }
      last = Math.max(last, Number(r.latest) || 0);
    } catch { /* */ }
  }

  // ---------- تقاريري + أوامر واتساب ----------
  async function reportsModal() {
    const r = await api('notifications/reports');
    const admin = me().role === 'admin';
    const m = modal({ title: 'التقارير الدورية وإدارة المهام من واتساب', wide: true, body: `
      <p class="small muted">يصلك تقرير شخصي ${r.enabled ? 'مرتين يومياً على الأقل' : '(متوقف حالياً)'} في <b dir="ltr">${esc(r.times.split(',').join(' · '))}</b> بتوقيت الرياض على واتساب وتلجرام: مهامك المتأخرة والمستحقة، متابعات العملاء، المحتوى القريب${['admin', 'manager', 'executive'].includes(me().role) ? '، وحالة القطاع والفريق' : ''}.
      تأكد من رقم جوالك وتفعيل القنوات من «الإشعارات».</p>
      ${admin ? `<form class="fgrid" id="rpf" style="margin:10px 0"><label class="f"><span>مواعيد التقارير (مفصولة بفاصلة)</span><input class="inp" name="times" dir="ltr" value="${esc(r.times)}" placeholder="08:00,13:00,17:00"></label>
        <label class="sw"><span>التقارير مفعّلة</span><input type="checkbox" name="enabled" ${r.enabled ? 'checked' : ''}></label></form>` : ''}
      <h4 style="margin:12px 0 6px">إدارة مهامك من واتساب — راسل رقم الكيان <b dir="ltr">${esc(r.wa_number)}</b> من جوالك المسجّل</h4>
      <div class="rp-cmd"><code>مهامي</code> قائمة مهامك واختيار أي مهمة لتعديلها بالأزرار · <code>المتأخرة</code> · <code>تقرير</code><br>
        <code>تم 12</code> · <code>بدء 12</code> · <code>مراجعة 12</code> · <code>تأجيل 12 غداً</code> · <code>ملاحظة 12 النص</code> · <code>رابط 12 https://…</code><br>
        <code>مهمة جديدة تصميم بوستر لسدن موعدها الخميس</code> — يفهمها الذكاء وينشئها من القالب المناسب<br>
        ويمكنك الكتابة بأسلوبك: «خلصت مهمة شمس لاين» أو «أجّل تقرير BBR لبكرة».</div>
      <p class="small muted" style="margin-top:8px">💡 واتساب يسمح بالرسائل المجانية الكاملة خلال 24 ساعة من آخر رسالة منك؛ لذلك إن وصلك ملخص قصير فقط، ردّ بكلمة «تقرير» ليصلك كاملاً.</p>
      <div id="rpo"></div>`,
    foot: `<button class="btn btn-p" data-now>أرسل تقريري الآن</button>${admin ? '<button class="btn btn-g" data-sv>حفظ المواعيد</button>' : ''}
      <label class="small" style="display:flex;gap:6px;align-items:center;margin-inline-start:auto"><input type="checkbox" id="snd" ${soundOn() ? 'checked' : ''}> نغمة الإشعارات</label>` });
    $('#snd', m.el).onchange = (e) => { try { localStorage.setItem(KEY, e.target.checked ? '1' : '0'); } catch { /* */ } };
    $('[data-sv]', m.el) && ($('[data-sv]', m.el).onclick = async () => {
      const f = $('#rpf', m.el);
      try { await api('notifications/reports', { method: 'PUT', body: { times: f.times.value, enabled: f.enabled.checked } }); toast('حُفظت المواعيد'); m.close(); } catch (e) { toast(e.message, 1); }
    });
    $('[data-now]', m.el).onclick = async (e) => {
      e.target.disabled = true;
      try {
        const x = await api('notifications/reports', { method: 'POST' });
        const ch = [x.tg && 'تلجرام', x.wa && (x.wa === 'template' ? 'واتساب (ملخص — ردّ بـ«تقرير» للتفاصيل)' : 'واتساب')].filter(Boolean);
        toast(ch.length ? 'أُرسل عبر: ' + ch.join('، ') : 'لم يُرسل: أضف رقم جوالك أو اربط تلجرام من «الإشعارات»', !ch.length);
        $('#rpo', m.el).innerHTML = `<div class="rp-prev">${esc(x.preview || '')}</div>`;
      } catch (er) { toast(er.message, 1); } finally { e.target.disabled = false; }
    };
  }
  window.reportsModal = reportsModal;

  const baseShell = renderShell;
  renderShell = function () {
    baseShell();
    const anchor = $('#nprefsl') || $('#tglink');
    if (anchor && !$('#rplink')) anchor.insertAdjacentHTML('beforebegin', '<button id="rplink">تقاريري وواتساب</button> · ');
    $('#rplink') && ($('#rplink').onclick = reportsModal);
    clearInterval(timer); poll(true).then(() => setTimeout(askDesktop, 4000)); timer = setInterval(() => poll(false), POLL);
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(false); });
})();
