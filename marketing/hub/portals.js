/* منصة نُبل وابتكار للتسويق — طلبات بوابتي المندوب والعميل + دعوة الطرف للبوابة
   • الشاشة #portals: ما يرفعه الشركاء (طلبات صرف، تحديث بنكي، إثباتات سداد، طلبات وردود العملاء) مع «تمت المعالجة».
   • زر «دعوة للبوابة» في صفحة العميل ولوحة المناديب يرسل الرابط على واتساب. */
'use strict';
(function nublPortals() {
  const ROLES = ['admin', 'manager', 'finance', 'account', 'sales'];
  const ok = () => ROLES.includes(me().role);
  Object.assign(PILL, { 'تمت المعالجة': 't', 'مرفوض': 'x' });
  I.portal = P('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M9 14l2 2 4-4"/>');
  const st = { f: 'new' };

  async function view() {
    if (!ok()) { V().innerHTML = '<div class="empty">لا تملك صلاحية هذه الشاشة</div>'; return; }
    const d = await api('portals');
    const rows = d.rows.filter((r) => st.f === 'all' || r.status === 'جديد');
    const fresh = d.rows.filter((r) => r.status === 'جديد').length;
    V().innerHTML = `<div class="toolbar"><div class="ak-tabs"><button data-f="new" class="${st.f === 'new' ? 'on' : ''}">الجديدة (${fresh})</button><button data-f="all" class="${st.f === 'all' ? 'on' : ''}">الكل (${d.rows.length})</button></div><span class="sp"></span>
      <a class="btn btn-g btn-s" href="/marketing/client/" target="_blank" rel="noopener">بوابة العميل ↗</a><a class="btn btn-g btn-s" href="/marketing/rep/" target="_blank" rel="noopener">بوابة المندوب ↗</a></div>
      <div class="card"><div class="muted small">جلسات نشطة: عملاء <b>${d.active.client || 0}</b> · مناديب <b>${d.active.rep || 0}</b> · قالب رمز الدخول لدى Meta: <b>${esc(d.otp_template)}</b>${d.otp_template === 'APPROVED' ? '' : ' (إلى أن يُعتمد يصل الرمز عبر قالب الإشعارات)'}</div></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>التاريخ</th><th>الطرف</th><th>النوع</th><th>الموضوع</th><th>التفاصيل</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${fdate(r.created_at)}</td><td>${r.kind === 'rep' ? '🤝 ' : '🏢 '}${r.kind === 'client' ? `<a href="#client/${r.ref_id}">${esc(r.party || '')}</a>` : esc(r.party || '')}</td>
        <td>${esc(r.type)}</td><td>${esc(r.subject || '')}${r.entity === 'invoices' ? ` <a href="#invoice/${r.entity_id}">الفاتورة</a>` : r.entity === 'quotes' ? ` <a href="#quote/${r.entity_id}">العرض</a>` : ''}</td>
        <td class="small" style="white-space:pre-wrap;max-width:320px">${esc(r.body || '')}${r.file_id ? `<br><a href="api/files/${r.file_id}" target="_blank" rel="noopener">📎 الإثبات المرفق</a>` : ''}</td>
        <td>${pill(r.status)}${r.handler ? `<div class="muted small">${esc(r.handler)}</div>` : ''}</td>
        <td>${r.status === 'جديد' ? `<button class="btn btn-n btn-s" data-h="${r.id}">تمت المعالجة</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${st.f === 'new' ? 'لا طلبات جديدة ✓' : 'لا طلبات بعد'}</div>`}`;
    V().querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { st.f = b.dataset.f; view(); }; });
    V().querySelectorAll('[data-h]').forEach((b) => { b.onclick = () => handle(Number(b.dataset.h)); });
  }

  function handle(id) {
    const m = modal({ title: 'إغلاق الطلب', body: `<form><label class="f"><span>ملاحظة داخلية (اختياري)</span><textarea class="inp" name="note" rows="3"></textarea></label>
      <label class="f"><span>الحالة</span><select class="inp" name="status"><option>تمت المعالجة</option><option>مرفوض</option></select></label></form>`,
      foot: '<button class="btn btn-p" data-go>حفظ</button><button class="btn btn-g" data-x>إلغاء</button>' });
    $('[data-x]', m.el).onclick = m.close;
    $('[data-go]', m.el).onclick = async (e) => {
      const f = $('form', m.el); e.target.disabled = true;
      try { await api('portals/handle/' + id, { method: 'POST', body: { status: f.status.value, note: f.note.value.trim() } }); toast('تم'); m.close(); view(); }
      catch (er) { toast(er.message, 1); e.target.disabled = false; }
    };
  }

  async function invite(kind, id, btn) {
    btn.disabled = true;
    try { await api('portals/invite', { method: 'POST', body: { kind, id } }); toast('أُرسلت دعوة البوابة على واتساب'); }
    catch (er) { toast(er.message, 1); } finally { btn.disabled = false; }
  }

  // زر الدعوة في صفحة العميل (يُضاف بعد رسمها دون تعديل views.js)
  const baseClient = ROUTES.client && ROUTES.client.render;
  if (baseClient) {
    ROUTES.client.render = async function (id, sub, seq) {
      await baseClient.apply(this, arguments);
      if (!['admin', 'manager', 'account', 'sales'].includes(me().role)) return;
      const bar = V().querySelector('.toolbar'); if (!bar || bar.querySelector('#pinv')) return;
      const b = document.createElement('button'); b.className = 'btn btn-g'; b.id = 'pinv'; b.innerHTML = `${I.portal} دعوة للبوابة`;
      b.title = 'يرسل للعميل رابط بوابته على واتساب (يدخل برقم جواله المسجّل)';
      b.onclick = () => invite('client', Number(id), b);
      bar.appendChild(b);
    };
  }
  // زر الدعوة لكل مندوب في لوحة المناديب — اللوحة تعيد رسم نفسها عند تبديل التبويبات، فنراقبها
  function repButtons() {
    if (S.route !== 'commissions' || !['admin', 'manager', 'finance'].includes(me().role)) return;
    V().querySelectorAll('.cm-rep').forEach((card) => {
      const acts = card.querySelector('.cm-acts'); const rid = Number(card.querySelector('[data-st]')?.dataset.st);
      if (!rid || !acts || acts.querySelector('.pinv')) return;
      const b = document.createElement('button'); b.className = 'btn btn-g btn-s pinv'; b.innerHTML = `${I.portal} دعوة للبوابة`;
      b.onclick = () => invite('rep', rid, b); acts.appendChild(b);
    });
  }
  let mo = null;
  const baseComm = ROUTES.commissions && ROUTES.commissions.render;
  if (baseComm) {
    ROUTES.commissions.render = async function () {
      await baseComm.apply(this, arguments);
      // #view يُعاد إنشاؤه مع renderShell، فنعيد ربط المراقب إن تغيّر
      if (V() && (!mo || mo.target !== V())) { mo?.disconnect(); mo = new MutationObserver(repButtons); mo.target = V(); mo.observe(V(), { childList: true, subtree: true }); }
      repButtons();
    };
  }

  ROUTES.portals = { title: 'طلبات البوابات', render: view };
  const baseShell = renderShell;
  renderShell = function () {
    const g = NAV.find((x) => x[0] === 'العملاء والعقود');
    if (g && ok() && !g[1].some((i) => i[0] === 'portals')) g[1].push(['portals', 'طلبات البوابات', 'portal']);
    baseShell();
  };
})();
