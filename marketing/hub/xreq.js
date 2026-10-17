/* منصة نُبل وابتكار للتسويق — طلبات عروض الأسعار بين القطاعات (مع منصة الدعاية والإعلان nubl-ebtikar.com)
   الوارد/الصادر، إنشاء طلب ببنود ومرفقات وسعر مقترح، وصفحة الطلب: تأكيد الاستلام، إصدار عرض السعر، الاعتذار، الإلغاء،
   قبول/رفض العرض، التعليقات، الطباعة PDF وواتساب — والتزامن مع الطرف الآخر آلي عبر الجسر الموقّع (api/_lib/xq.js) */
'use strict';

const XQ_MAX = 1_400_000; // حد الملف في المنصة (يُخزَّن في D1) — الأكبر يُرفع على Drive ويُضاف رابطه
const xqNum = (v) => String(+v || 0);
// أوقات D1 بتوقيت UTC (datetime('now')) — تُعرض بتوقيت الرياض وبصيغة 12 ساعة
const xqDt = (d) => {
  if (!d) return '—';
  const k = new Date(new Date(String(d).replace(' ', 'T') + 'Z').getTime() + 3 * 3600e3).toISOString(); const h = +k.slice(11, 13);
  return `${fdate(k.slice(0, 10))} <span class="num small muted">${h % 12 || 12}:${k.slice(14, 16)} ${h >= 12 ? 'م' : 'ص'}</span>`;
};

async function xqUpload(file) {
  let data, mime = file.type || 'application/octet-stream', name = file.name;
  if (/^image\/(jpeg|png|webp)$/.test(mime)) { data = await compressImage(file, 1800, 0.82); mime = 'image/jpeg'; name = name.replace(/\.\w+$/, '') + '.jpg'; }
  else {
    if (file.size > XQ_MAX) throw new Error(`«${file.name}» أكبر من 1.4MB — ارفعه على Drive وأضف الرابط`);
    data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
  }
  const r = await api('files', { method: 'POST', body: { name, mime, data } });
  return { id: r.id, name: file.name, mime: file.type || mime };
}
const xqPill = (s) => { const x = (S.xq?.status || {})[s] || [s, 'x']; return `<span class="pill ${x[1]}">${esc(x[0])}</span>`; };
const xqFile = (f) => `<a href="${API}xq/file/${f.id}" target="_blank" rel="noopener" class="small">📎 ${esc(f.name)}</a> <span class="small muted">${f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((f.size || 0) / 1024)) + ' KB'}${f.origin === 'peer' ? ' · من القطاع الآخر' : ''}</span>`;

async function xreqView(id) {
  if (id) return xreqDetail(+id);
  const st = (S.xqf ||= { box: 'in', status: '', q: '' });
  const qs = new URLSearchParams({ box: st.box, status: st.status, q: st.q });
  S.xq = await api('xq?' + qs);
  const d = S.xq;
  const nIn = d.counts.filter((c) => c.direction === 'in' && ['received', 'confirmed'].includes(c.status)).reduce((a, c) => a + c.n, 0);
  const tab = (k, l) => `<button class="btn ${st.box === k ? 'btn-p' : 'btn-g'} btn-s" data-box="${k}">${l}</button>`;
  V().innerHTML = `${d.ready ? '' : `<div class="notice">⚠️ الربط الآلي مع منصة الدعاية والإعلان غير مُعدّ بعد — تُحفظ الطلبات وتُرسل تلقائياً فور إعداده.${me().role === 'admin' ? ' <button class="lnk" id="xcfg">إعداد الربط</button>' : ''}</div>`}
    <div class="toolbar">${tab('in', `📥 الوارد${nIn ? ` <span class="pill o">${nIn}</span>` : ''}`)}${tab('out', '📤 الصادر')}${tab('mine', '👤 طلباتي')}${tab('all', 'الكل')}
      <div class="search">${I.search}<input class="inp" id="xq-q" style="padding-inline-start:34px" placeholder="الرقم، العميل، الموضوع…" value="${esc(st.q)}"></div>
      <select class="inp" id="xq-s" style="max-width:190px"><option value="">كل الحالات</option>${Object.entries(d.status).map(([k, v]) => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
      <span class="sp"></span>${me().role === 'admin' && d.ready ? '<button class="btn btn-g btn-s" id="xcfg">إعداد الربط</button>' : ''}
      <button class="btn btn-p" id="xq-new">＋ طلب عرض سعر من ${esc(d.sectors[d.peer])}</button></div>
    <div class="card">${d.rows.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>الرقم</th><th>الاتجاه</th><th>العميل</th><th>الموضوع</th><th>البنود</th><th>المقترح</th><th>عرض السعر</th><th>الحالة</th><th>آخر تحديث</th></tr></thead><tbody>
      ${d.rows.map((r) => `<tr style="cursor:pointer" data-go="${r.id}"><td class="num"><b>${esc(r.number)}</b></td><td>${r.direction === 'in' ? '<span class="pill b">📥 وارد</span>' : '<span class="pill o">📤 صادر</span>'}</td>
        <td>${esc(r.client_name || '')}${r.client_company ? `<div class="small muted">${esc(r.client_company)}</div>` : ''}</td>
        <td>${esc(r.title || '—')}<div class="small muted">${esc(r.direction === 'in' ? r.requester_name : (r.handler_name || r.requester_name) || '')}</div></td>
        <td class="num">${r.items}</td><td>${money(r.suggested_total)}</td><td>${r.quote_total != null ? `<b>${money(r.quote_total)}</b>` : '—'}</td>
        <td>${xqPill(r.status)}${r.unsent ? ' <span title="بانتظار الوصول للطرف الآخر">⏳</span>' : ''}</td><td class="small">${xqDt(r.updated_at)}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">لا طلبات هنا بعد</div>'}
      <p class="small muted" style="margin-top:8px">يصل الطلب فوراً إلى ${esc(d.sectors[d.peer])} مع إشعار للمسؤولين، ويعود الرد وعرض السعر إلى نفس الطلب هنا.</p></div>`;
  $$('[data-box]').forEach((b) => b.onclick = () => { st.box = b.dataset.box; xreqView(); });
  $('#xq-s').onchange = (e) => { st.status = e.target.value; xreqView(); };
  $('#xq-q').oninput = debounce((e) => { st.q = e.target.value; xreqView().then(() => { const el = $('#xq-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }); }, 350);
  $$('[data-go]').forEach((tr) => tr.onclick = () => go(`#/xreq/${tr.dataset.go}`));
  $('#xq-new').onclick = xreqNew;
  $$('#xcfg').forEach((b) => b.onclick = xreqConfig);
}

async function xreqConfig() {
  const c = await api('xq/config');
  const m = modal({ title: 'إعداد الربط مع منصة الدعاية والإعلان', body: `<div class="notice">السر المشترك نفسه مضبوط في الطرفين (هنا وفي secrets.php بمنصة الدعاية والإعلان). لا يُعرض بعد حفظه.</div>
    <form class="fgrid"><label class="f full"><span>رابط جسر الطرف الآخر</span><input class="inp" name="url" dir="ltr" value="${esc(c.url)}"></label>
    <label class="f full"><span>السر المشترك ${c.ready ? '(مضبوط — اتركه فارغاً للإبقاء عليه)' : ''}</span><input class="inp" name="secret" dir="ltr" autocomplete="off"></label></form>
    <p class="small muted">من يستلم الطلبات الواردة ويسعّرها: الأدوار <b dir="ltr">${esc(c.handler_roles)}</b> (الإعداد xq_handler_roles).</p>`,
    foot: '<button class="btn btn-p" data-s>حفظ</button><button class="btn btn-g" data-t>اختبار الاتصال</button><span class="sp"></span>' });
  $('[data-s]', m.el).onclick = async () => {
    const f = $('form', m.el); const b = { url: f.url.value.trim() }; if (f.secret.value.trim()) b.secret = f.secret.value.trim();
    try { await api('xq/config', { method: 'POST', body: b }); toast('حُفظ الإعداد'); m.close(); xreqView(); } catch (e) { toast(e.message, 1); }
  };
  $('[data-t]', m.el).onclick = async () => { try { const r = await api('xq/ping', { method: 'POST', body: {} }); toast(r.message, !r.ok); } catch (e) { toast(e.message, 1); } };
}

async function xreqNew() {
  const clients = await refs('clients').catch(() => []);
  const d = S.xq;
  let n = 0;
  const itemRow = () => `<div class="card" data-it style="padding:10px;margin-bottom:8px"><div class="fgrid">
    <label class="f full"><span>البند <i>*</i></span><input class="inp" name="title" placeholder="مثال: لوحة واجهة محل 6×1.2م مضيئة"></label>
    <label class="f"><span>الكمية</span><input class="inp" name="qty" type="number" step="0.01" min="0" value="1"></label>
    <label class="f"><span>الوحدة</span><input class="inp" name="unit" placeholder="قطعة / م² / شهر"></label>
    <label class="f"><span>السعر المقترح للوحدة</span><input class="inp" name="price" type="number" step="0.01" min="0"></label>
    <label class="f"><span>ملفات البند</span><input class="inp" name="files" type="file" multiple></label>
    <label class="f full"><span>التفاصيل والمواصفات</span><textarea class="inp" name="desc" rows="2"></textarea></label></div>
    <button type="button" class="lnk small" data-rm>حذف البند</button></div>`;
  const m = modal({ title: `📤 طلب عرض سعر من ${esc(d.sectors[d.peer])}`, wide: true,
    body: `<form class="fgrid" id="xn">
      <label class="f full"><span>موضوع الطلب</span><input class="inp" name="title" placeholder="مثال: لوحات وهوية فرع العميل الجديد"></label>
      <label class="f"><span>مطلوب قبل</span><input class="inp" type="date" name="need"></label>
      <label class="f"><span>اختر عميلاً مسجلاً (اختياري)</span><input class="inp" name="pick" list="xq-cl" placeholder="ابحث بالاسم…"><datalist id="xq-cl">${clients.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist></label>
      <label class="f"><span>اسم العميل <i>*</i></span><input class="inp" name="cname"></label><label class="f"><span>المنشأة / الجهة</span><input class="inp" name="ccomp"></label>
      <label class="f"><span>جوال العميل</span><input class="inp" name="cphone" dir="ltr"></label><label class="f"><span>بريد العميل</span><input class="inp" name="cmail" dir="ltr"></label>
      <div class="f full"><h3 style="margin:6px 0">البنود <span class="small muted">— كل خدمة/منتج في بند مستقل</span></h3><div id="xn-items">${itemRow()}</div><button type="button" class="btn btn-g btn-s" id="xn-add">＋ بند آخر</button></div>
      <label class="f full"><span>مرفقات عامة (صور، PDF، وثائق — حتى 1.4MB للملف، والأكبر عبر رابط)</span><input class="inp" type="file" name="gfiles" multiple></label>
      <label class="f full"><span>روابط (Drive، موقع العميل…) — رابط في كل سطر</span><textarea class="inp" name="links" rows="2" dir="ltr"></textarea></label>
      <label class="f full"><span>ملاحظات للقطاع الآخر</span><textarea class="inp" name="notes" rows="3" placeholder="ما يحتاجه التسعير: المقاسات، الخامات، الموقع، الكميات، الموعد…"></textarea></label>
      <label class="f"><span>السعر المقترح الإجمالي (ر.س)</span><input class="inp" name="total" type="number" step="0.01" min="0" placeholder="يُحسب من البنود"></label><div class="f small muted" id="xn-sum"></div>
    </form>`,
    foot: '<button class="btn btn-p" data-send>إرسال الطلب</button><button class="btn btn-g" data-x>إلغاء</button><span class="sp"></span><span class="small muted">يصل فوراً مع إشعار للمسؤولين</span>' });
  const f = $('#xn', m.el);
  const recalc = () => { let s = 0, any = false; $$('[data-it]', m.el).forEach((it) => { const p = parseFloat($('[name=price]', it).value); if (!isNaN(p)) { s += p * (parseFloat($('[name=qty]', it).value) || 1); any = true; } }); $('#xn-sum', m.el).textContent = any ? `مجموع البنود: ${moneyTxt(s)} ر.س` : ''; f.total.placeholder = any ? s.toFixed(2) : 'يُحسب من البنود'; };
  $('#xn-add', m.el).onclick = () => { $('#xn-items', m.el).insertAdjacentHTML('beforeend', itemRow()); n++; };
  $('#xn-items', m.el).addEventListener('input', recalc);
  $('#xn-items', m.el).addEventListener('click', (e) => { if (e.target.closest('[data-rm]') && $$('[data-it]', m.el).length > 1) { e.target.closest('[data-it]').remove(); recalc(); } });
  f.pick.oninput = () => { const c = clients.find((x) => x.name === f.pick.value); if (!c) return; f.cname.value = c.name; f.ccomp.value = c.brand || ''; f.cphone.value = c.phone || ''; f.cmail.value = c.email || ''; f.pick.dataset.id = c.id; };
  $('[data-x]', m.el).onclick = m.close;
  $('[data-send]', m.el).onclick = async (e) => {
    const btn = e.target;
    const items = []; const uploads = [];
    $$('[data-it]', m.el).forEach((it) => {
      const t = $('[name=title]', it).value.trim(); if (!t) return;
      const idx = items.length;
      items.push({ title: t, description: $('[name=desc]', it).value, qty: $('[name=qty]', it).value, unit: $('[name=unit]', it).value, suggested_price: $('[name=price]', it).value });
      [...$('[name=files]', it).files].forEach((fl) => uploads.push([fl, idx]));
    });
    if (!f.cname.value.trim()) return toast('اكتب اسم العميل', 1);
    if (!items.length) return toast('أضف بنداً واحداً على الأقل', 1);
    [...f.gfiles.files].forEach((fl) => uploads.push([fl, '']));
    btn.disabled = true; btn.textContent = 'جارٍ الرفع والإرسال…';
    try {
      const files = [];
      for (const [fl, idx] of uploads) files.push({ ...(await xqUpload(fl)), item: idx });
      const r = await api('xq', { method: 'POST', body: { title: f.title.value, needed_by: f.need.value, client_id: f.pick.dataset.id || null, client_name: f.cname.value, client_company: f.ccomp.value,
        client_phone: f.cphone.value, client_email: f.cmail.value, notes: f.notes.value, links: f.links.value, suggested_total: f.total.value, items, files } });
      m.close(); toast(r.delivered ? `أُرسل الطلب ${r.number} ووصل إلى ${d.sectors[d.peer]}` : `حُفظ الطلب ${r.number} وسيُرسل تلقائياً عند توفر الاتصال`);
      go(`#/xreq/${r.id}`);
    } catch (err) { toast(err.message, 1); btn.disabled = false; btn.textContent = 'إرسال الطلب'; }
  };
}

async function xreqDetail(id) {
  const d = await api(`xq/${id}`); S.xq = { ...(S.xq || {}), status: d.status };
  const r = d.request; const Sx = d.sectors;
  const from = r.direction === 'out' ? d.self : d.peer; const to = r.direction === 'out' ? d.peer : d.self;
  const quoted = r.quote_total != null || ['quoted', 'accepted', 'declined'].includes(r.status);
  const by = {}; r.files.forEach((f) => { const k = f.item_uid || (f.side === 'quote' ? '_q' : '_g'); (by[k] ||= []).push(f); });
  const B = {
    confirmed: '<button class="btn btn-p" data-ev="confirmed">✅ تأكيد الاستلام والبدء في التسعير</button>',
    issue_quote: '<button class="btn btn-p" data-ev="issue_quote" style="background:var(--terra)">💰 إصدار عرض السعر في «عروض الأسعار»</button>',
    send_quote: `<button class="btn btn-p" data-ev="send_quote" style="background:var(--terra)">📤 ${r.status === 'quoted' ? 'إعادة إرسال العرض (بعد تعديله)' : 'إرسال العرض'}</button>`,
    rejected: '<button class="btn btn-d" data-ev="rejected">⛔ اعتذار عن الطلب</button>',
    accepted: '<button class="btn btn-p" data-ev="accepted">🎉 قبول العرض</button>',
    declined: '<button class="btn btn-g" data-ev="declined">↩️ رفض العرض / طلب تعديل</button>',
    cancelled: '<button class="btn btn-g" data-ev="cancelled">🚫 إلغاء الطلب</button>',
    comment: '<button class="btn btn-g" data-ev="comment">💬 تعليق / مرفق</button>',
  };
  V().innerHTML = `<div class="toolbar"><a class="btn btn-g btn-s" href="#/xreq">→ كل الطلبات</a><h2 style="margin:0;font-size:18px">${r.direction === 'in' ? '📥' : '📤'} <span class="num">${esc(r.number)}</span> ${esc(r.title || '')}</h2>${xqPill(r.status)}
      <span class="sp"></span>${r.wa ? `<a class="btn btn-wa btn-s" target="_blank" rel="noopener" href="${esc(r.wa.url)}">${I.wa} ${esc(r.wa.label)}</a>` : ''}
      <button class="btn btn-g btn-s" id="xq-print">${I.print} طباعة / PDF</button>${r.peer_link ? `<a class="btn btn-g btn-s" target="_blank" rel="noopener" href="${esc(r.peer_link)}">فتحه في منصة ${esc(Sx[d.peer])} ↗</a>` : ''}</div>
    ${r.outbox ? `<div class="notice">⏳ لم يصل آخر تحديث إلى ${esc(Sx[d.peer])} بعد${r.outbox.error ? ` (${esc(r.outbox.error)})` : ''} — يُعاد الإرسال تلقائياً. <button class="lnk" id="xq-resend">إعادة المحاولة الآن</button></div>` : ''}
    <div class="grid g2"><div class="card"><h3>${I.users} الأطراف</h3>
        <p><b>من:</b> ${esc(Sx[from])} — ${esc(r.requester_name || '')} ${r.requester_phone ? `<a class="num" dir="ltr" href="tel:${esc(r.requester_phone)}">${esc(r.requester_phone)}</a>` : ''}</p>
        <p><b>إلى:</b> ${esc(Sx[to])}${r.handler_name ? ` — ${esc(r.handler_name)} ${r.handler_phone ? `<a class="num" dir="ltr" href="tel:${esc(r.handler_phone)}">${esc(r.handler_phone)}</a>` : ''}` : ''}</p>
        <p><b>تاريخ الطلب:</b> ${xqDt(r.created_at)} · <b>مطلوب قبل:</b> ${r.needed_by ? fdate(r.needed_by) : '—'}</p></div>
      <div class="card"><h3>${I.brief} العميل</h3><p><b>${esc(r.client_name || '')}</b>${r.client_company ? ` / ${esc(r.client_company)}` : ''}</p>
        <p>${r.client_phone ? `<a class="num" dir="ltr" href="tel:${esc(r.client_phone)}">${esc(r.client_phone)}</a> ` : ''}${r.client_email ? `<a dir="ltr" href="mailto:${esc(r.client_email)}">${esc(r.client_email)}</a>` : ''}${!r.client_phone && !r.client_email ? '<span class="muted">لا بيانات تواصل</span>' : ''}</p></div></div>
    <div class="card" style="margin-top:14px"><h3>${I.doc} البنود</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>#</th><th>البند</th><th>الكمية</th><th>السعر المقترح</th>${quoted ? '<th>سعر العرض</th><th>الإجمالي</th>' : ''}</tr></thead><tbody>
      ${r.items.map((it, k) => `<tr><td class="num">${k + 1}</td><td><b>${esc(it.title)}</b>${it.description ? `<div class="small" style="white-space:pre-wrap">${esc(it.description)}</div>` : ''}${by[it.uid] ? `<div>${by[it.uid].map(xqFile).join('<br>')}</div>` : ''}</td>
        <td><span class="num">${xqNum(it.qty)}</span> ${esc(it.unit || '')}</td><td>${money(it.suggested_price)}</td>${quoted ? `<td><b>${money(it.quoted_price)}</b></td><td>${it.quoted_price != null ? money(it.quoted_price * it.qty) : '—'}</td>` : ''}</tr>`).join('')}
      <tr><td colspan="3"><b>الإجمالي</b></td><td><b>${money(r.suggested_total)}</b></td>${quoted ? `<td colspan="2"><b>${money(r.quote_total)}</b> ${r.quote_vat_included ? '<span class="small muted">شامل الضريبة</span>' : ''}</td>` : ''}</tr></tbody></table></div>
      ${quoted ? `<div class="notice" style="margin-top:10px"><b>💰 عرض السعر${r.quote_number ? ' ' + esc(r.quote_number) : ''}</b> — ${money(r.quote_total)}${r.quote_valid_until ? ` · صالح حتى ${fdate(r.quote_valid_until)}` : ''}
        ${r.quote_note ? `<div style="white-space:pre-wrap;margin-top:4px">${esc(r.quote_note)}</div>` : ''}${by._q ? `<div style="margin-top:4px">${by._q.map(xqFile).join('<br>')}</div>` : ''}</div>` : ''}
      ${r.notes ? `<h3 style="margin-top:12px">ملاحظات الطلب</h3><p style="white-space:pre-wrap">${esc(r.notes)}</p>` : ''}
      ${r.links ? `<h3>روابط</h3><div dir="ltr" style="text-align:left">${r.links.split(/\n+/).map((l) => (/^https?:\/\//.test(l.trim()) ? `<a href="${esc(l.trim())}" target="_blank" rel="noopener">${esc(l.trim())}</a>` : esc(l))).join('<br>')}</div>` : ''}
      ${by._g ? `<h3>المرفقات</h3><div>${by._g.map(xqFile).join('<br>')}</div>` : ''}
      ${xreqQuoteBox(r)}
      <div class="toolbar" style="margin-top:12px">${r.can.map((c) => B[c] || '').join('')}</div></div>
    <div class="card" style="margin-top:14px"><h3>${I.clock || ''} سجل الطلب</h3>${r.events.map((e) => `<div style="padding:4px 0;border-bottom:1px dashed var(--line, #DCE5E8)${e.side === 'peer' ? ';color:var(--terra)' : ''}">
      <span class="small muted">${xqDt(e.created_at)}</span> — <b>${esc(e.by_name || '')}</b> ${esc(d.event_label[e.event] || e.event)}${e.note ? `: <span style="white-space:pre-wrap">${esc(e.note)}</span>` : ''}</div>`).join('')}</div>`;
  $$('[data-ev]').forEach((b) => b.onclick = () => (b.dataset.ev === 'issue_quote' ? xreqIssue(r) : b.dataset.ev === 'send_quote' ? (b.disabled = true, xreqSendQuote(r.id)) : xreqAct(r, b.dataset.ev)));
  const qp = $('[data-qprint]'); if (qp) qp.onclick = async () => { try { const { row } = await api(`e/quotes/${r.quote.id}`); await Promise.all([refs('clients').catch(() => []), refs('leads').catch(() => [])]); printQuote(row); } catch (e) { toast(e.message, 1); } };
  $('#xq-print').onclick = () => xreqPrint(r, d);
  const rs = $('#xq-resend'); if (rs) rs.onclick = async () => { try { const x = await api(`xq/${id}/resend`, { method: 'POST', body: {} }); toast(x.message, !x.ok); xreqDetail(id); } catch (e) { toast(e.message, 1); } };
}

// العرض المرتبط بالطلب الوارد — هو نفسه عرض في «عروض الأسعار» (ترقيمها وقالب طباعتها)
function xreqQuoteBox(r) {
  const q = r.quote; if (!q) return '';
  return `<div class="notice" style="margin-top:10px"><b>🧾 عرض السعر في «عروض الأسعار»: <span class="num">${esc(q.number)}</span></b> ${pill(q.status)} — ${money(q.total)}${q.valid_until ? ` · صالح حتى ${fdate(q.valid_until)}` : ''}
    <div style="margin-top:6px"><a class="btn btn-g btn-s" href="#/quote/${q.id}">فتح / تعديل العرض</a> <button class="btn btn-g btn-s" data-qprint>${I.print} طباعة العرض</button>
    ${r.status !== 'quoted' ? '<span class="small muted">راجع العرض ثم اضغط «إرسال العرض» ليصل للقطاع الآخر بملفه</span>' : '<span class="small muted">إن عدّلت العرض أعد إرساله ليصل التعديل</span>'}</div></div>`;
}

// إصدار العرض: يُنشأ في «عروض الأسعار» عبر مسارها نفسه (ترقيم Q-سنة-رقم، المجاميع والضريبة)
async function xreqIssue(r) {
  const [clients, leads] = await Promise.all([refs('clients').catch(() => []), refs('leads').catch(() => [])]);
  const s = S.meta.settings;
  const valid = addDays(todayStr(), Number(s.quote_validity_days || 15));
  const row = (it) => `<tr data-row><td><input class="inp" data-k="name" value="${esc(it.name)}"><textarea class="inp" data-k="desc" rows="2" style="margin-top:4px">${esc(it.desc)}</textarea></td>
    <td style="width:90px"><input class="inp" type="number" step="0.01" min="0" data-k="qty" value="${esc(it.qty)}"></td><td style="width:130px"><input class="inp" type="number" step="0.01" min="0" data-k="price" value="${esc(it.price)}"></td>
    <td><button type="button" class="lnk" data-rm>×</button></td></tr>`;
  const m = modal({ title: `💰 إصدار عرض السعر — ${esc(r.number)}`, wide: true,
    body: `<div class="notice">يُنشأ العرض في «عروض الأسعار» برقمه التسلسلي وقالب الطباعة المعتاد، ثم تراجعه وترسله ليصل للقطاع الآخر بملفه.</div>
      <form class="fgrid" id="xi">
        <label class="f full"><span>الطرف المقدَّم له العرض</span><input class="inp" name="party" list="xi-p" value="" placeholder="ابحث في العملاء والعملاء المحتملين — أو اتركه فارغاً لإضافته عميلاً محتملاً من بيانات الطلب">
          <datalist id="xi-p">${clients.map((c) => `<option value="عميل: ${esc(c.name)}">`).join('')}${leads.map((l) => `<option value="محتمل: ${esc(l.name)}${l.company ? ' — ' + esc(l.company) : ''}">`).join('')}</datalist></label>
        <div class="f full small muted" id="xi-ph">سيُضاف «${esc(r.client_name || '')}» عميلاً محتملاً (المصدر: ${esc(S.xq?.sectors?.ads || 'قطاع الدعاية والإعلان')})</div>
        <label class="f full"><span>عنوان العرض</span><input class="inp" name="title" value="${esc(r.title || '')}"></label>
        <label class="f"><span>صالح حتى</span><input class="inp" type="date" name="valid" value="${valid}"></label><label class="f"><span>الخصم (ر.س)</span><input class="inp" type="number" step="0.01" min="0" name="discount" value="0"></label>
        <div class="f full"><div class="tbl-wrap"><table class="t"><thead><tr><th>البند والوصف</th><th>الكمية</th><th>السعر</th><th></th></tr></thead><tbody id="xi-rows">
          ${r.items.map((it) => row({ name: it.title, desc: it.description || '', qty: it.qty, price: it.suggested_price ?? '' })).join('')}</tbody></table></div>
          <button type="button" class="btn btn-g btn-s" id="xi-add">＋ بند</button> <span class="small">المجموع قبل الضريبة: <b class="num" id="xi-sum">0</b> ر.س — الضريبة ${esc(s.vat_rate)}% تُحسب كما في كل العروض</span></div>
        <label class="f full"><span>ملاحظات العرض</span><textarea class="inp" name="notes" rows="2"></textarea></label></form>`,
    foot: '<button class="btn btn-p" data-ok>إنشاء العرض</button><button class="btn btn-g" data-x>إلغاء</button>' });
  const f = $('#xi', m.el);
  const sum = () => { let t = 0; $$('[data-row]', m.el).forEach((tr) => { t += (+$('[data-k=qty]', tr).value || 0) * (+$('[data-k=price]', tr).value || 0); }); $('#xi-sum', m.el).textContent = moneyTxt(t); };
  $('#xi-rows', m.el).addEventListener('input', sum);
  $('#xi-rows', m.el).addEventListener('click', (e) => { if (e.target.closest('[data-rm]') && $$('[data-row]', m.el).length > 1) { e.target.closest('tr').remove(); sum(); } });
  $('#xi-add', m.el).onclick = () => $('#xi-rows', m.el).insertAdjacentHTML('beforeend', row({ name: '', desc: '', qty: 1, price: '' }));
  const pick = () => {
    const v = f.party.value.trim();
    const c = v.startsWith('عميل: ') && clients.find((x) => `عميل: ${x.name}` === v);
    const l = v.startsWith('محتمل: ') && leads.find((x) => `محتمل: ${x.name}${x.company ? ' — ' + x.company : ''}` === v);
    $('#xi-ph', m.el).textContent = c ? 'عميل مسجّل ✓' : l ? 'عميل محتمل مسجّل ✓' : `سيُضاف «${r.client_name || ''}» عميلاً محتملاً من بيانات الطلب`;
    return { client_id: c ? c.id : null, lead_id: l ? l.id : null };
  };
  f.party.oninput = pick; sum();
  $('[data-x]', m.el).onclick = m.close;
  $('[data-ok]', m.el).onclick = async (e) => {
    const items = $$('[data-row]', m.el).map((tr) => ({ name: $('[data-k=name]', tr).value.trim(), desc: $('[data-k=desc]', tr).value, qty: $('[data-k=qty]', tr).value, price: $('[data-k=price]', tr).value })).filter((x) => x.name);
    if (!items.length) return toast('أضف بنداً واحداً على الأقل', 1);
    e.target.disabled = true;
    try {
      const x = await api(`xq/${r.id}/quote`, { method: 'POST', body: { ...pick(), title: f.title.value, valid_until: f.valid.value, discount: f.discount.value, notes: f.notes.value, items } });
      m.close(); invalidate('quotes'); invalidate('leads');
      const go2 = await confirmBox(`أُنشئ العرض <b>${esc(x.quote.number)}</b> في «عروض الأسعار» بإجمالي ${money(x.quote.total)} شامل الضريبة.<br>إرساله الآن للقطاع الآخر؟ (يمكنك مراجعته وتعديله أولاً ثم الإرسال من نافذة الطلب)`);
      if (go2) await xreqSendQuote(r.id); else xreqDetail(r.id);
    } catch (err) { toast(err.message, 1); e.target.disabled = false; }
  };
}

// إرسال العرض: ملفه هو مستند الطباعة نفسه (quoteDocHtml في views.js) من بيانات العرض المحفوظة
async function xreqSendQuote(id) {
  try {
    const d = await api(`xq/${id}`); const q0 = d.request.quote;
    if (!q0) return toast('لا يوجد عرض مرتبط', 1);
    const { row: q } = await api(`e/quotes/${q0.id}`);
    await Promise.all([refs('clients', true).catch(() => []), refs('leads', true).catch(() => [])]); // اسم الطرف في القالب
    const bytes = new TextEncoder().encode(quoteDocHtml(q)); let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
    const name = `عرض سعر ${q.number}.html`;
    const up = await api('files', { method: 'POST', body: { name, mime: 'text/html', data: btoa(bin) } });
    const x = await api(`xq/${id}/act`, { method: 'POST', body: { event: 'quoted', quote_id: q.id, files: [{ id: up.id, name, mime: 'text/html' }] } });
    toast(x.pending ? `أُرسل العرض ${q.number} — سيصل عند توفر الاتصال` : `أُرسل العرض ${q.number} إلى القطاع الآخر ✓`);
  } catch (err) { toast(err.message, 1); }
  xreqDetail(id);
}

function xreqAct(r, ev) {
  const T = { confirmed: 'تأكيد الاستلام', rejected: 'الاعتذار عن الطلب', accepted: 'قبول العرض', declined: 'رفض العرض', cancelled: 'إلغاء الطلب', comment: 'تعليق' };
  const needNote = ['rejected', 'declined', 'comment'].includes(ev);
  const body = `<form class="fgrid" id="xa"><label class="f full"><span>${needNote ? 'السبب / التعليق <i>*</i>' : 'ملاحظة (اختياري)'}</span><textarea class="inp" name="note" rows="3"></textarea></label>
      ${ev === 'comment' ? '<label class="f full"><span>مرفقات</span><input class="inp" type="file" name="files" multiple></label>' : ''}</form>`;
  const m = modal({ title: T[ev], body, foot: '<button class="btn btn-p" data-ok>تنفيذ</button><button class="btn btn-g" data-x>إلغاء</button>' });
  const f = $('#xa', m.el);
  $('[data-x]', m.el).onclick = m.close;
  $('[data-ok]', m.el).onclick = async (e) => {
    const btn = e.target; const body2 = { event: ev, note: f.note.value };
    const fl = f.files ? [...f.files.files] : [];
    if (needNote && !body2.note.trim() && !fl.length) return toast('اكتب السبب أو التعليق', 1);
    btn.disabled = true;
    try {
      body2.files = []; for (const x of fl) body2.files.push(await xqUpload(x));
      const r2 = await api(`xq/${r.id}/act`, { method: 'POST', body: body2 });
      m.close(); toast(r2.pending ? `${r2.message} — سيصل للطرف الآخر عند توفر الاتصال` : `${r2.message} ✓`); xreqDetail(r.id);
    } catch (err) { toast(err.message, 1); btn.disabled = false; }
  };
}

function xreqPrint(r, d) {
  const quoted = r.quote_total != null || ['quoted', 'accepted', 'declined'].includes(r.status);
  const from = r.direction === 'out' ? d.self : d.peer; const to = r.direction === 'out' ? d.peer : d.self;
  openDoc(docShell(`طلب عرض سعر ${r.number}`, `<div class="ttl"><h1>طلب عرض سعر</h1><div class="n">${esc(r.number)}</div></div>
  <div class="meta"><div>من: <b>${esc(d.sectors[from])}</b> — ${esc(r.requester_name || '')}</div><div>إلى: <b>${esc(d.sectors[to])}</b>${r.handler_name ? ' — ' + esc(r.handler_name) : ''}</div>
  <div>العميل: <b>${esc(r.client_name || '')}</b>${r.client_company ? ' / ' + esc(r.client_company) : ''}</div><div>تواصل العميل: <span class="n">${esc([r.client_phone, r.client_email].filter(Boolean).join('  '))}</span></div>
  <div>الموضوع: ${esc(r.title || '—')}</div><div>مطلوب قبل: <span class="n">${esc(r.needed_by || '—')}</span> · الحالة: ${esc((d.status[r.status] || [r.status])[0])}</div></div>
  <table><thead><tr><th>#</th><th>البند</th><th>الكمية</th><th>السعر المقترح</th>${quoted ? '<th>سعر العرض</th><th>الإجمالي</th>' : ''}</tr></thead><tbody>${r.items.map((it, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(it.title)}</b>${it.description ? `<br><small style="white-space:pre-wrap">${esc(it.description)}</small>` : ''}</td>
  <td class="n">${xqNum(it.qty)} ${esc(it.unit || '')}</td><td class="n">${it.suggested_price != null ? moneyTxt(it.suggested_price) : '—'}</td>${quoted ? `<td class="n">${it.quoted_price != null ? moneyTxt(it.quoted_price) : '—'}</td><td class="n">${it.quoted_price != null ? moneyTxt(it.quoted_price * it.qty) : '—'}</td>` : ''}</tr>`).join('')}</tbody></table>
  <div class="tot"><div><span>السعر المقترح</span><span class="n">${r.suggested_total != null ? moneyTxt(r.suggested_total) : '—'}</span></div>${quoted ? `<div class="g"><span>إجمالي العرض ${r.quote_vat_included ? '(شامل الضريبة)' : '(غير شامل الضريبة)'}</span><span class="n">${moneyTxt(r.quote_total)}</span></div>` : ''}</div>
  ${quoted && (r.quote_note || r.quote_valid_until) ? `<h3>شروط العرض</h3><p style="white-space:pre-wrap">${r.quote_valid_until ? 'صالح حتى ' + esc(r.quote_valid_until) + '\n' : ''}${esc(r.quote_note || '')}</p>` : ''}
  ${r.notes ? `<h3>ملاحظات الطلب</h3><p style="white-space:pre-wrap">${esc(r.notes)}</p>` : ''}
  ${r.files.length ? `<h3>المرفقات</h3><ul>${r.files.map((f) => `<li>${esc(f.name)}${f.side === 'quote' ? ' (عرض السعر)' : ''}</li>`).join('')}</ul>` : ''}
  ${r.links ? `<h3>روابط</h3><p dir="ltr" style="text-align:left;white-space:pre-wrap">${esc(r.links)}</p>` : ''}`));
}

// التسجيل في القائمة والمسارات — متاح لكل الفريق؛ التسعير للأدوار المحددة في xq_handler_roles
ROUTES.xreq = { title: 'طلبات بين القطاعات', render: xreqView };
(() => { const g = NAV.find((x) => x[0] === 'العملاء والعقود'); if (g && !g[1].some((i) => i[0] === 'xreq')) g[1].splice(2, 0, ['xreq', 'طلبات بين القطاعات', 'swap']); })();
I.swap = P('<path d="M7 7h12l-3-3M17 17H5l3 3"/>');
