/* منصة نُبل وابتكار للتسويق — مركز الإشعارات + تفضيلات القنوات (واتساب/تلجرام) + إعداد جسر واتساب */
'use strict';
(function notifications() {
  const css = `
  .login{min-height:100vh}
  .bell{position:relative;display:inline-grid;place-items:center;width:40px;height:40px;border-radius:12px;border:1px solid var(--line);background:#fff;cursor:pointer;color:var(--navy-d);flex:none}
  .bell:hover{border-color:var(--navy);color:var(--navy)}
  .bell svg{width:20px;height:20px}
  .bell .bdg{position:absolute;top:-5px;inset-inline-end:-5px;min-width:19px;height:19px;padding:0 5px;border-radius:99px;background:var(--terra);color:#fff;font-size:11px;font-weight:700;line-height:19px;text-align:center;font-family:"IBM Plex Sans",sans-serif}
  .bell .bdg:empty{display:none}
  .npanel{position:fixed;top:66px;inset-inline-end:16px;width:min(390px,calc(100vw - 32px));max-height:min(560px,calc(100vh - 90px));display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:0 18px 50px rgba(8,42,55,.18);z-index:80;overflow:hidden}
  .npanel header{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line);background:var(--soft)}
  .npanel header b{flex:1;color:var(--deep)}
  .npanel header button{background:none;border:0;color:var(--navy);cursor:pointer;font-size:12.5px}
  .npanel .nl{overflow:auto;flex:1}
  .ni{display:flex;gap:10px;padding:11px 14px;border-bottom:1px solid #F1EBE0;cursor:pointer;align-items:flex-start}
  .ni:hover{background:var(--paper)}
  .ni.u{background:#FFFBF4}
  .ni .dot{width:8px;height:8px;border-radius:50%;margin-top:8px;flex:none;background:transparent}
  .ni.u .dot{background:var(--terra)}
  .ni .tx{flex:1;min-width:0}
  .ni .tx b{display:block;font-size:13.5px;color:var(--deep);font-weight:600}
  .ni .tx p{font-size:12.5px;color:var(--muted);white-space:pre-line;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .ni .tm{font-size:11.5px;color:var(--muted);margin-top:3px;display:flex;gap:6px;align-items:center}
  .ni .ch{display:inline-flex;gap:3px}.ni .ch svg{width:12px;height:12px}
  .npanel .empty{padding:36px 16px;text-align:center;color:var(--muted)}
  .sw{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #F1EBE0}
  .sw:last-of-type{border-bottom:0}
  .sw input{width:20px;height:20px;accent-color:var(--navy)}
  .sw svg,.card h3 svg.wai{width:18px;height:18px;vertical-align:-4px;margin-inline-end:4px;color:var(--teal)}
  .sw>span{flex:1}
  .chk-ok{color:var(--green)}.chk-no{color:var(--muted)}
  @media (max-width:700px){.npanel{top:58px;inset-inline-end:8px;width:calc(100vw - 16px)}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const BELL = P('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/>');
  let timer = null; let panel = null;

  const ago = (ts) => {
    if (!ts) return '';
    const d = new Date(String(ts).replace(' ', 'T') + 'Z'); const s = Math.max(0, (Date.now() - d) / 1000);
    if (s < 60) return 'الآن'; if (s < 3600) return `قبل ${Math.round(s / 60)} د`; if (s < 86400) return `قبل ${Math.round(s / 3600)} س`;
    return fdate(new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 10));
  };
  const chIcons = (c) => String(c || '').split(',').map((x) => (x === 'wa' ? I.wa : x === 'tg' ? I.tg : '')).join('');

  async function refreshCount() {
    if (!S.meta || !$('#bell')) return;
    try { const { unread } = await api('notifications?count=1', { noAuthRedirect: true }); $('#bell .bdg').textContent = unread ? (unread > 99 ? '99+' : unread) : ''; } catch { /* */ }
  }

  function closePanel() { if (panel) { panel.remove(); panel = null; document.removeEventListener('mousedown', outside); } }
  function outside(e) { if (panel && !panel.contains(e.target) && !$('#bell').contains(e.target)) closePanel(); }

  async function openTarget(link) {
    if (!link) return;
    const m = /^#\/?tasks\/(\d+)/.exec(link);
    if (m) {
      go('#/tasks');
      try { const { row } = await api(`e/tasks/${m[1]}`); if (row) openForm('tasks', row, {}, () => rerender()); } catch (e) { toast(e.message, 1); }
      return;
    }
    go(link.startsWith('#/') ? link : '#/' + link.replace(/^#/, ''));
  }

  async function openPanel() {
    if (panel) return closePanel();
    panel = document.createElement('div'); panel.className = 'npanel';
    panel.innerHTML = `<header><b>الإشعارات</b><button id="nall">تحديد الكل كمقروء</button><button id="nprefs">التفضيلات</button></header><div class="nl"><div class="empty">جارٍ التحميل…</div></div>`;
    document.body.appendChild(panel);
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
    $('#nprefs', panel).onclick = () => { closePanel(); prefsModal(); };
    $('#nall', panel).onclick = async () => { await api('notifications/read', { method: 'POST', body: {} }); closePanel(); refreshCount(); };
    try {
      const { rows } = await api('notifications');
      const nl = $('.nl', panel); if (!panel) return;
      nl.innerHTML = rows.length ? rows.map((n) => `<div class="ni ${n.read_at ? '' : 'u'}" data-id="${n.id}" data-link="${esc(n.link || '')}"><i class="dot"></i>
        <div class="tx"><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}<div class="tm"><span>${ago(n.created_at)}</span><span class="ch">${chIcons(n.channels)}</span></div></div></div>`).join('')
        : '<div class="empty">لا توجد إشعارات بعد.<br><span class="small">ستصلك هنا إسنادات المهام والعملاء وملاحظات الإدارة والتحديثات المالية.</span></div>';
      $$('.ni', nl).forEach((el) => el.onclick = async () => {
        api('notifications/read', { method: 'POST', body: { id: el.dataset.id } }).then(refreshCount).catch(() => {});
        closePanel(); openTarget(el.dataset.link);
      });
    } catch (e) { $('.nl', panel).innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function prefsModal() {
    const p = await api('notifications/prefs');
    const m = modal({
      title: 'الإشعارات والقنوات',
      body: `<form id="npf"><p class="muted small" style="margin-bottom:10px">كل الإشعارات تُحفظ في مركز الإشعارات داخل المنصة. فعّل القنوات التي تريد أن تصلك عليها أيضاً.</p>
        <label class="f"><span>رقم الجوال (واتساب)</span><input class="inp" name="phone" dir="ltr" placeholder="05xxxxxxxx" value="${esc(p.phone)}"></label>
        <label class="sw"><span>${I.wa} إشعارات واتساب ${p.wa_ready ? '' : '<span class="pill x">قيد التفعيل</span>'}<br><span class="muted small">إسناد مهمة أو عميل، ملاحظة إدارية، تحديث مالي — لا تُرسل ليلاً (11م–7ص)</span></span><input type="checkbox" name="notify_wa" ${p.notify_wa ? 'checked' : ''}></label>
        <label class="sw"><span>${I.tg} إشعارات تلجرام<br><span class="muted small">${p.tg_linked ? '<span class="chk-ok">✓ حسابك مربوط</span>' : 'اربط حسابك من «ربط تلجرام» أسفل القائمة'}</span></span><input type="checkbox" name="notify_tg" ${p.notify_tg ? 'checked' : ''}></label></form>`,
      foot: '<button class="btn btn-g" id="ntest">إرسال إشعار تجريبي</button><span class="sp" style="flex:1"></span><button class="btn btn-p" id="nsave">حفظ</button>',
    });
    const f = $('#npf', m.el);
    const save = async () => api('notifications/prefs', { method: 'PUT', body: { phone: f.phone.value.trim(), notify_wa: f.notify_wa.checked, notify_tg: f.notify_tg.checked } });
    $('#nsave', m.el).onclick = async () => { try { await save(); toast('تم حفظ التفضيلات'); m.close(); } catch (e) { toast(e.message, 1); } };
    $('#ntest', m.el).onclick = async (e) => {
      e.target.disabled = true;
      try {
        await save(); const r = await api('notifications/test', { method: 'POST' });
        const names = { app: 'المنصة', tg: 'تلجرام', wa: 'واتساب' };
        toast('وصل الإشعار عبر: ' + r.channels.map((c) => names[c] || c).join('، ')); refreshCount();
      } catch (err) { toast(err.message, 1); } finally { e.target.disabled = false; }
    };
  }

  // ---------- غلاف الواجهة: الجرس + رابط التفضيلات ----------
  const baseShell = renderShell;
  renderShell = function () {
    baseShell();
    const top = $('.top'); const search = $('#gsearch');
    if (top && !$('#bell')) {
      const b = document.createElement('button'); b.className = 'bell'; b.id = 'bell'; b.type = 'button'; b.setAttribute('aria-label', 'الإشعارات');
      b.innerHTML = `${BELL}<span class="bdg"></span>`; b.onclick = openPanel;
      search ? top.insertBefore(b, search.nextSibling) : top.appendChild(b);
    }
    const tg = $('#tglink');
    if (tg && !$('#nprefsl')) tg.insertAdjacentHTML('beforebegin', '<button id="nprefsl">الإشعارات</button> · ');
    $('#nprefsl') && ($('#nprefsl').onclick = prefsModal);
    clearInterval(timer); refreshCount(); timer = setInterval(refreshCount, 60000);
  };
  window.addEventListener('hashchange', () => { closePanel(); refreshCount(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshCount(); });

  // ---------- الإعدادات (المدير): جسر واتساب ومفتاح الربط مع n8n ----------
  async function bridgeCard() {
    if (me().role !== 'admin' || !$('#view .grid')) return;
    const b = await api('notifications/bridge');
    const card = document.createElement('div'); card.className = 'card'; card.style.marginTop = '14px';
    card.innerHTML = `<h3>${I.wa} إشعارات واتساب (جسر n8n)</h3>
      <p class="muted small" style="margin-bottom:10px">ترسل المنصة إشعارات الفريق عبر سير عمل في n8n يستخدم رقم واتساب الأعمال للكيان. المفتاح السري لا يُعرض بعد حفظه.</p>
      <label class="f"><span>رابط الجسر (Webhook)</span><input class="inp" id="bu" dir="ltr" value="${esc(b.url)}" placeholder="https://…/webhook/nubl-hub-wa"></label>
      <label class="f"><span>مفتاح الجسر ${b.token_set ? '<span class="chk-ok small">✓ محفوظ</span>' : '<span class="chk-no small">غير مضبوط</span>'}</span><input class="inp" id="bt" dir="ltr" type="password" placeholder="${b.token_set ? 'اتركه فارغاً للإبقاء عليه' : 'X-Nubl-Token'}"></label>
      <div class="toolbar" style="gap:8px;flex-wrap:wrap"><button class="btn btn-p btn-s" id="bsave">حفظ</button>
        <input class="inp" id="bph" dir="ltr" placeholder="05xxxxxxxx" style="width:150px"><button class="btn btn-g btn-s" id="btest">اختبار الإرسال</button></div>
      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
      <p class="small"><b>مفتاح نقاط الربط (hook_token)</b> — يستخدمه n8n لتسجيل عملاء مساعد واتساب وسحب النسخة الاحتياطية: ${b.hook_set ? '<span class="chk-ok">✓ مضبوط</span>' : '<span class="chk-no">غير مضبوط</span>'}</p>
      <button class="btn btn-g btn-s" id="bhook" style="margin-top:8px">${b.hook_set ? 'توليد مفتاح جديد (يلغي القديم)' : 'توليد مفتاح'}</button><pre id="bhk" class="hidden" dir="ltr" style="margin-top:8px;font-size:12px;overflow:auto"></pre>`;
    const col = $('#view .grid > div:last-child'); (col || $('#view')).appendChild(card);
    $('#bsave', card).onclick = async () => { try { const body = { url: $('#bu', card).value.trim() }; if ($('#bt', card).value.trim()) body.token = $('#bt', card).value.trim(); await api('notifications/bridge', { method: 'POST', body }); toast('تم حفظ إعدادات الجسر'); } catch (e) { toast(e.message, 1); } };
    $('#btest', card).onclick = async () => { try { await api('notifications/bridge-test', { method: 'POST', body: { phone: $('#bph', card).value } }); toast('أُرسلت رسالة الاختبار عبر واتساب'); } catch (e) { toast(e.message, 1); } };
    $('#bhook', card).onclick = async () => {
      if (b.hook_set && !(await confirmBox('توليد مفتاح جديد يوقف سير عمل n8n حتى تحدّثه بالمفتاح الجديد. متابعة؟'))) return;
      const r = await api('notifications/bridge', { method: 'POST', body: { new_hook_token: true } });
      const pre = $('#bhk', card); pre.textContent = r.hook_token + '\n\nانسخه الآن — لن يُعرض مرة أخرى.'; pre.classList.remove('hidden');
    };
  }
  if (typeof settingsView === 'function') {
    const baseSettings = settingsView;
    settingsView = async function () { await baseSettings(); await bridgeCard().catch((e) => console.warn(e)); };
  }
})();
