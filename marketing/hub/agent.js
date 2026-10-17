/* منصة نُبل وابتكار للتسويق — ربط وكلاء الذكاء الاصطناعي (مفاتيح API + خادم MCP) */
'use strict';
(function agentLink() {
  const css = `
  .ak-row{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #E9EFF1}
  .ak-row:last-child{border-bottom:0}
  .ak-row .tx{flex:1;min-width:0}.ak-row .tx b{display:block;color:var(--deep)}
  .ak-row.off{opacity:.55}
  .ak-code{position:relative;margin:6px 0 12px}
  .ak-code pre{background:#123F50;color:#E8EEF0;border-radius:10px;padding:12px 14px 12px 64px;font-size:12px;line-height:1.6;overflow:auto;direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,Consolas,monospace}
  .ak-code button{position:absolute;top:6px;left:6px;background:#ffffff1f;color:#fff;border:0;border-radius:7px;padding:3px 9px;font-size:11.5px;cursor:pointer}
  .ak-warn{background:#F3D8CA;color:#8A3A15;border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:10px}
  .ak-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}
  .ak-tabs button{border:1px solid var(--line);background:#fff;border-radius:99px;padding:4px 12px;font-size:12.5px;cursor:pointer}
  .ak-tabs button.on{background:var(--navy);color:#fff;border-color:var(--navy)}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const BASE = location.origin + '/marketing/hub/api';
  const copyBtn = (id) => `<button type="button" data-copy="${id}">نسخ</button>`;
  function wireCopy(el) {
    $$('[data-copy]', el).forEach((b) => b.onclick = async () => {
      const t = $('#' + b.dataset.copy, el).textContent;
      try { await navigator.clipboard.writeText(t); b.textContent = 'تم ✓'; setTimeout(() => (b.textContent = 'نسخ'), 1500); } catch { toast('انسخ يدوياً', 1); }
    });
  }
  const ago = (d) => (d ? fdate(String(d).slice(0, 10)) : '—');

  function snippets(token) {
    const s = {
      claude: { label: 'Claude (الويب وسطح المكتب)', note: 'في Claude: الإعدادات ← Connectors ← Add custom connector، والصق الرابط (يحمل المفتاح، فلا تشاركه):', code: `${BASE}/mcp/${token}` },
      code: { label: 'Claude Code', note: 'نفّذ في الطرفية:', code: `claude mcp add --transport http nubl-hub ${BASE}/mcp --header "Authorization: Bearer ${token}"` },
      desktop: { label: 'Cursor / VS Code', note: 'أضف إلى ملف إعدادات MCP (mcp.json):', code: JSON.stringify({ mcpServers: { 'nubl-hub': { type: 'http', url: `${BASE}/mcp`, headers: { Authorization: `Bearer ${token}` } } } }, null, 2) },
      chatgpt: { label: 'ChatGPT / وكلاء آخرون', note: 'أي عميل MCP يدعم Streamable HTTP — رابط الخادم:', code: `${BASE}/mcp/${token}` },
      api: { label: 'REST API', note: 'كل مسارات المنصة بالمفتاح نفسه، مثال:', code: `curl -H "Authorization: Bearer ${token}" "${BASE}/e/leads?limit=5"\ncurl -H "Authorization: Bearer ${token}" "${BASE}/myday"` },
      n8n: { label: 'n8n', note: 'في عقدة HTTP Request: Header Auth باسم Authorization وقيمة:', code: `Bearer ${token}` },
    };
    return `<div class="ak-tabs">${Object.entries(s).map(([k, v], i) => `<button type="button" data-tab="${k}" class="${i ? '' : 'on'}">${v.label}</button>`).join('')}</div>
      ${Object.entries(s).map(([k, v], i) => `<div data-pane="${k}" class="${i ? 'hidden' : ''}"><p class="small muted">${v.note}</p><div class="ak-code">${copyBtn('ak-' + k)}<pre id="ak-${k}">${esc(v.code)}</pre></div></div>`).join('')}`;
  }
  function wireTabs(el) {
    $$('[data-tab]', el).forEach((b) => b.onclick = () => {
      $$('[data-tab]', el).forEach((x) => x.classList.toggle('on', x === b));
      $$('[data-pane]', el).forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== b.dataset.tab));
    });
  }

  async function agentModal() {
    const m = modal({ title: 'ربط وكيل ذكاء اصطناعي (API / MCP)', wide: true, body: '<div id="akb"><div class="empty">جارٍ التحميل…</div></div>' });
    const box = $('#akb', m.el);
    const load = async () => {
      const { rows } = await api('tokens');
      box.innerHTML = `<p class="muted small" style="margin-bottom:10px">أنشئ مفتاحاً شخصياً ليتصل وكيل الذكاء الاصطناعي (Claude، ChatGPT، n8n…) بالمنصة. <b>يعمل المفتاح بصلاحياتك أنت فقط</b> — لا يرى إلا ما تراه، وكل ما يفعله يُسجَّل باسمك.</p>
        <form id="akf" class="fgrid" style="align-items:end">
          <label class="f"><span>اسم الاستخدام</span><input class="inp" name="name" placeholder="مثال: Claude على جهازي" maxlength="60"></label>
          <label class="f"><span>الصلاحية</span><select class="inp" name="scope"><option value="read">قراءة فقط (موصى به)</option>${can('activities', 'w') || can('leads', 'w') ? '<option value="write">قراءة وكتابة</option>' : ''}</select></label>
          <label class="f"><span>الصلاحية الزمنية</span><select class="inp" name="days"><option value="30">30 يوماً</option><option value="90" selected>90 يوماً</option><option value="365">سنة</option><option value="0">بلا انتهاء</option></select></label>
          <button class="btn btn-p">إنشاء مفتاح</button></form>
        <div id="aknew"></div>
        <h4 style="margin:16px 0 4px">مفاتيحي</h4>
        ${rows.length ? rows.map((t) => `<div class="ak-row ${t.revoked_at ? 'off' : ''}"><div class="tx"><b>${esc(t.name || 'مفتاح')}</b>
          <span class="small muted"><span dir="ltr">${esc(t.prefix)}…</span> · ${t.scope === 'write' ? 'قراءة وكتابة' : 'قراءة فقط'} · أُنشئ ${ago(t.created_at)}
          · آخر استخدام ${t.last_used_at ? ago(t.last_used_at) : 'لم يُستخدم'}${t.expires_at ? ' · ينتهي ' + ago(t.expires_at) : ''}${t.revoked_at ? ' · <b>ملغى</b>' : ''}</span></div>
          ${t.revoked_at ? '' : `<button class="btn btn-g btn-s" data-rv="${t.id}">إلغاء</button>`}</div>`).join('') : '<p class="muted small">لا توجد مفاتيح بعد.</p>'}
        <details style="margin-top:14px"><summary class="small" style="cursor:pointer">ماذا يستطيع الوكيل أن يفعل؟</summary>
          <ul class="small muted" style="margin:8px 18px 0;line-height:1.9">
            <li>قراءة لوحة القيادة ويومي والإشعارات، والبحث والاطلاع على العملاء والصفقات والعقود والفواتير والمهام — حسب صلاحيات دورك.</li>
            <li>بمفتاح «قراءة وكتابة»: إضافة عميل محتمل، تسجيل تواصل أو ملاحظة، تعديل حالة سجل، وإنشاء مهمة من قالب.</li>
            <li>لا يستطيع: الحذف، إدارة المستخدمين، الإعدادات، تغيير كلمة المرور، أو إنشاء مفاتيح أخرى.</li>
          </ul></details>`;
      $('#akf', box).onsubmit = async (e) => {
        e.preventDefault(); const f = e.target; const b = $('button', f); b.disabled = true;
        try {
          const r = await api('tokens', { method: 'POST', body: { name: f.name.value.trim(), scope: f.scope.value, days: f.days.value } });
          await load();
          const nw = $('#aknew', box);
          nw.innerHTML = `<div class="card" style="margin-top:12px;border-color:var(--gold)"><div class="ak-warn">⚠️ انسخ المفتاح الآن — لن يُعرض مرة أخرى. لا تشاركه مع أحد ولا تضعه في ملف عام؛ من يملكه يدخل المنصة بصلاحياتك.</div>
            <div class="ak-code">${copyBtn('aktok')}<pre id="aktok">${esc(r.token)}</pre></div>
            <h4 style="margin:6px 0 2px">طريقة الربط</h4>${snippets(r.token)}</div>`;
          wireCopy(nw); wireTabs(nw); nw.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) { toast(err.message, 1); b.disabled = false; }
      };
      $$('[data-rv]', box).forEach((b) => b.onclick = async () => {
        if (!(await confirmBox('إلغاء هذا المفتاح؟ سيتوقف أي وكيل يستخدمه فوراً.'))) return;
        try { await api('tokens/' + b.dataset.rv, { method: 'DELETE' }); toast('أُلغي المفتاح'); load(); } catch (e) { toast(e.message, 1); }
      });
    };
    try { await load(); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  window.agentModal = agentModal;

  const baseShell = renderShell;
  renderShell = function () {
    baseShell();
    const tg = $('#tglink');
    if (tg && !$('#aglink')) tg.insertAdjacentHTML('beforebegin', '<button id="aglink">ربط الذكاء الاصطناعي</button> · ');
    $('#aglink') && ($('#aglink').onclick = agentModal);
  };
})();
