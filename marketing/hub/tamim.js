/* الاعتمادات (28–29 أكتوبر 2026): خطابات الاعتماد المرفوعة للرئيس التنفيذي — مستند رسمي يُطّلع عليه ويُطبع ويُحمَّل Word ويُعتمد بنداً بنداً ويوقَّع.
   #/tamims الأرشيف (بانتظار الاعتماد / المعتمدة الموقّعة / الكل) · #/tamim/<id> التعميد: معاينة على الورق الرسمي، طباعة/PDF، Word، المرفقات،
   قرار الرئيس التنفيذي بتوقيعه على الشاشة، رفع النسخة الموقّعة يدوياً، تذكير الرئيس التنفيذي. المعتمد يبقى هنا بنسخته الموقّعة. */
(() => {
  Object.assign(PILL, { 'بانتظار الاعتماد': 'o', 'معتمد': 't', 'معتمد جزئياً': 'g', 'غير معتمد': 'r' });
  const ROLES_OK = ['admin', 'manager', 'executive', 'finance'];
  const g = NAV.find((x) => x[0] === 'الإدارة');
  if (g && !g[1].some((i) => i[0] === 'tamims')) g[1].unshift(['tamims', 'الاعتمادات', 'sign', '#reports', 'tamim']);

  const fileLink = (f, dl) => `${API}files/${f.id}${dl ? '?dl=1' : ''}`;
  const fileIcon = (f) => (/pdf/.test(f.mime || f.name) ? '📕' : /word|docx?$/.test(f.mime || f.name) ? '📘' : /sheet|xlsx?$/.test(f.mime || f.name) ? '📗' : '🖼️');
  const TABS = [['pending', '⏳ بانتظار الاعتماد'], ['done', '✅ المعتمدة والموقّعة'], ['all', 'الكل']];
  let tab = 'pending';

  ROUTES.tamims = { title: 'الاعتمادات', render: async () => {
    if (!ROLES_OK.includes(me().role)) { V().innerHTML = '<div class="empty">لا تملك صلاحية الاعتمادات</div>'; return; }
    const d = await api('tamim');
    const pend = d.rows.filter((r) => !r.decided_at); const done = d.rows.filter((r) => r.decided_at);
    const rows = tab === 'pending' ? pend : tab === 'done' ? done : d.rows;
    V().innerHTML = `<div class="grid g4" style="margin-bottom:14px">
        <div class="card kpi"><div class="small muted">بانتظار الاعتماد</div><b class="num" style="font-size:24px">${pend.length}</b></div>
        <div class="card kpi"><div class="small muted">معتمدة</div><b class="num" style="font-size:24px">${done.length}</b></div>
        <div class="card kpi"><div class="small muted">موقّعة إلكترونياً</div><b class="num" style="font-size:24px">${done.filter((r) => r.esigned).length}</b></div>
        <div class="card kpi"><div class="small muted">نسخ موقّعة مرفوعة</div><b class="num" style="font-size:24px">${d.rows.reduce((a, r) => a + (r.signed_n || 0), 0)}</b></div></div>
      <div class="card"><div class="toolbar" style="margin-bottom:8px"><h3 style="margin:0">🖋️ الاعتمادات المرفوعة للرئيس التنفيذي</h3><span class="sp"></span>
        ${TABS.map(([k, l]) => `<button class="btn btn-s ${tab === k ? 'btn-p' : 'btn-g'}" data-tab="${k}">${l}</button>`).join('')}</div>
      ${rows.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>الرقم</th><th>العنوان</th><th>البنود</th><th>الحالة</th><th>رُفع</th><th>القرار</th><th>التوقيع</th></tr></thead><tbody>
      ${rows.map((r) => { const it = parseJ(r.items, []); return `<tr class="click" data-go="#/tamim/${r.id}"><td class="num">${esc(r.number)}</td><td><b>${esc(r.title)}</b>${r.subject ? `<div class="small muted">${esc(r.subject)}</div>` : ''}</td><td class="num">${it.length}</td><td>${pill(r.status)}</td><td>${fdate(r.created_at)}${r.reminded_at ? `<div class="small muted">ذُكّر ${fdate(r.reminded_at)}</div>` : ''}</td><td>${r.decided_at ? fdate(r.decided_at) : '—'}</td><td>${r.esigned ? '✍️ إلكتروني' : ''}${r.signed_n ? ` 📎 ${r.signed_n}` : ''}${!r.esigned && !r.signed_n ? '—' : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="empty">${tab === 'pending' ? 'لا شيء بانتظار الاعتماد' : 'لا اعتمادات بعد'}</div>`}</div>`;
    $$('[data-go]').forEach((tr) => tr.onclick = () => go(tr.dataset.go));
    $$('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; rerender(); });
  } };

  // لوحة توقيع بالإصبع أو الفأرة — تُخرج PNG شفافاً
  function sigPad(cv) {
    const ctx = cv.getContext('2d'); let drawing = false; let marks = 0;
    const fit = () => { const r = cv.getBoundingClientRect(); cv.width = r.width * 2; cv.height = r.height * 2; ctx.scale(2, 2); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#18566D'; };
    fit();
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.onpointerdown = (e) => { drawing = true; cv.setPointerCapture(e.pointerId); const [x, y] = pt(e); ctx.beginPath(); ctx.moveTo(x, y); };
    cv.onpointermove = (e) => { if (!drawing) return; const [x, y] = pt(e); ctx.lineTo(x, y); ctx.stroke(); marks++; };
    cv.onpointerup = cv.onpointercancel = () => { drawing = false; };
    return { empty: () => marks < 12, clear: () => { ctx.clearRect(0, 0, cv.width, cv.height); marks = 0; }, png: () => cv.toDataURL('image/png') };
  }

  ROUTES.tamim = { title: 'اعتماد', render: async (id, sub, seq) => {
    const d = await api('tamim/' + id); if (seq !== S.renderSeq) return;
    const t = d.row; const items = t.items; const dec = t.decisions || {};
    $('#ptitle').textContent = `${t.number} — ${t.title}`;
    const canAttach = ['admin', 'manager'].includes(me().role);
    const es = t.esign;
    V().innerHTML = `<div class="toolbar"><a class="btn btn-g btn-s" href="#/tamims">→ الاعتمادات</a><span class="sp"></span>
        ${d.can_remind && !t.decided_at ? '<button class="btn btn-g" id="tm-remind">⏰ تذكير الرئيس التنفيذي</button>' : ''}
        <button class="btn btn-p" id="tm-print">🖨️ ${t.decided_at ? 'النسخة المعتمدة — طباعة / PDF' : 'طباعة / PDF'}</button><a class="btn btn-g" href="${API}studio/doc/tamim/${t.id}">📘 تنزيل Word</a></div>
      ${t.decided_at ? `<div class="notice" style="margin:10px 0;border-inline-start:5px solid #338C89">✅ <b>${esc(t.status)}</b> — ${esc(t.decided_by_name)} · ${fdate(t.decided_at)}${es ? ` · وُقّع إلكترونياً، رمز التحقق <span class="num">${esc(es.code)}</span>` : ''}. النسخة المعتمدة الموقّعة محفوظة هنا وتظهر في منصة القيادة.</div>` : t.reminded_at ? `<div class="small muted" style="margin:6px 0">آخر تذكير: ${fdate(t.reminded_at)}</div>` : ''}
      <div class="grid g2" style="align-items:start">
        <div>
          <div class="card"><h3>${esc(t.title)} ${pill(t.status)}</h3>
            <div class="small muted" style="margin-bottom:8px"><span class="num">${esc(t.number)}</span> · رفعه ${esc(t.created_by_name || '')} · ${fdate(t.created_at)}${t.decided_at ? ` · القرار ${fdate(t.decided_at)} — ${esc(t.decided_by_name)}` : ''}</div>
            ${t.subject ? `<p style="margin:0 0 8px">${esc(t.subject)}</p>` : ''}
            <h3 style="margin-top:10px">📎 المرفقات</h3>
            ${t.attachments.length ? t.attachments.map((f) => `<div class="list-i"><div class="g"><b>${fileIcon(f)} ${esc(f.name || 'ملف')}</b><span class="small muted">${esc(f.by || '')}</span></div><a class="btn btn-g btn-s" href="${fileLink(f)}" target="_blank" rel="noopener">عرض</a><a class="btn btn-g btn-s" href="${fileLink(f, 1)}">تنزيل</a></div>`).join('') : '<div class="small muted">لا مرفقات</div>'}
            ${canAttach ? '<label class="btn btn-g btn-s" style="margin-top:8px">📎 إرفاق ملف (PDF / Word / صورة)<input type="file" id="tm-att" accept=".pdf,.docx,.xlsx,image/*" hidden></label>' : ''}
            <h3 style="margin-top:14px">✍️ النسخة الموقّعة</h3>
            ${es ? `<div class="list-i"><div class="g"><b>✍️ التوقيع الإلكتروني — ${esc(es.name)}</b><span class="small muted">${esc(es.at)} · رمز <span class="num">${esc(es.code)}</span></span></div><img src="${es.sig}" alt="التوقيع" style="height:48px;background:#fff;border-radius:6px"></div>` : ''}
            ${t.signed_files.length ? t.signed_files.map((f) => `<div class="list-i"><div class="g"><b>${fileIcon(f)} ${esc(f.name || 'نسخة موقّعة')}</b><span class="small muted">${esc(f.by || '')} · ${fdate(f.at)}</span></div><a class="btn btn-g btn-s" href="${fileLink(f)}" target="_blank" rel="noopener">عرض</a><a class="btn btn-g btn-s" href="${fileLink(f, 1)}">تنزيل</a></div>`).join('') : es ? '' : '<div class="small muted">لم يُوقَّع بعد — يعتمد الرئيس التنفيذي ويوقّع أدناه، أو يطبع التعميد ويوقّعه ثم تُرفع صورته هنا</div>'}
            <label class="btn btn-g btn-s" style="margin-top:8px">📷 رفع نسخة موقّعة باليد<input type="file" id="tm-signed" accept=".pdf,image/*" hidden></label>
          </div>
          <div class="card" style="margin-top:14px"><h3>🖋️ قرار الرئيس التنفيذي</h3>
            ${d.can_decide ? `<form id="tm-form">${items.map((it, i) => `<div class="list-i" style="flex-wrap:wrap;gap:6px"><div class="g" style="min-width:220px"><b>${esc(it)}</b></div>
                <div style="display:flex;gap:10px;flex-wrap:wrap">${d.options.map((o) => `<label class="chk"><input type="radio" name="d${i}" value="${esc(o)}" ${dec[it] === o ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div></div>`).join('')}
              <div style="display:flex;gap:6px;margin:8px 0"><button type="button" class="btn btn-g btn-s" id="tm-all">✅ اعتماد الكل</button></div>
              <textarea class="inp" name="notes" rows="3" placeholder="الملاحظات (مثل: تعديل مبلغ، استثناء بند برقمه)">${esc(t.notes || '')}</textarea>
              <div style="margin-top:10px"><b>✍️ التوقيع</b> <span class="small muted">— وقّع بإصبعك أو بالفأرة داخل الإطار</span>
                <canvas id="tm-sig" style="display:block;width:100%;height:140px;margin-top:6px;border:1.5px dashed #9FB9C2;border-radius:10px;background:#fff;touch-action:none"></canvas>
                <button type="button" class="btn btn-g btn-s" id="tm-sig-clear" style="margin-top:6px">مسح التوقيع</button></div>
              <button class="btn btn-p" style="margin-top:10px">🖋️ ${t.decided_at ? 'تحديث القرار والتوقيع' : 'اعتماد القرار وتوقيعه'}</button></form>`
            : `${items.map((it) => `<div class="list-i"><div class="g"><b>${esc(it)}</b></div>${dec[it] ? pill(dec[it]) : '<span class="pill o">بانتظار القرار</span>'}</div>`).join('')}${t.notes ? `<div class="notice" style="margin-top:8px">💬 ${esc(t.notes)}</div>` : ''}`}
          </div>
        </div>
        <div class="card" style="padding:0;overflow:hidden"><iframe id="tm-doc" title="التعميد" style="width:100%;height:80vh;border:0;background:#fff"></iframe></div>
      </div>`;
    // معاينة على الأوراق الرسمية — نفس محتوى الطباعة وWord (بالقرار والتوقيع)
    api(`studio/doc/tamim/${t.id}?format=html`).then((r) => { const f = $('#tm-doc'); if (f) f.srcdoc = docShell(r.title, r.html, { official: true, org: r.org }); }).catch((e) => toast(e.message, 1));
    $('#tm-print').onclick = () => (window.nublPrintOfficial ? window.nublPrintOfficial('tamim', t.id) : $('#tm-doc').contentWindow.print());
    const rb = $('#tm-remind');
    if (rb) rb.onclick = async () => {
      if (!(await confirmBox('إرسال تذكير للرئيس التنفيذي بهذا التعميد؟<br><small>يصله تنبيه عاجل في المنصة وعلى تيليجرام/واتساب حسب قنواته.</small>'))) return;
      try { const r = await api(`tamim/${t.id}/remind`, { method: 'POST', body: {} }); toast(r.sent ? 'أُرسل التذكير ✓' : 'سُجّل التذكير في المنصة'); rerender(); } catch (e) { toast(e.message, 1); }
    };
    const up = async (inp, signed) => { const file = inp.files[0]; inp.value = ''; if (!file) return;
      try { toast('جارٍ الرفع…'); const it = await uploadFile(file); await api(`tamim/${t.id}/attach`, { method: 'POST', body: { file: it, signed } }); toast(signed ? 'رُفعت النسخة الموقّعة ✓' : 'أُرفق الملف ✓'); rerender(); } catch (e) { toast(e.message, 1); } };
    const a1 = $('#tm-att'); if (a1) a1.onchange = () => up(a1, false);
    const a2 = $('#tm-signed'); if (a2) a2.onchange = () => up(a2, true);
    const form = $('#tm-form');
    if (form) {
      const pad = sigPad($('#tm-sig'));
      $('#tm-sig-clear').onclick = () => pad.clear();
      $('#tm-all').onclick = () => $$('input[type=radio][value="معتمد"]', form).forEach((r) => { r.checked = true; });
      form.onsubmit = async (e) => {
        e.preventDefault();
        const decisions = {}; items.forEach((it, i) => { const r = form.querySelector(`input[name="d${i}"]:checked`); if (r) decisions[it] = r.value; });
        if (Object.keys(decisions).length < items.length) return toast('حدّد قراراً لكل بند', 1);
        if (pad.empty()) return toast('وقّع في خانة التوقيع قبل الاعتماد', 1);
        if (!(await confirmBox('اعتماد القرار وتوقيعه على هذا التعميد؟<br><small>يُسجَّل باسمكم ووقته برمز تحقق، ويصل الإدارة والمالية فوراً، ويظهر توقيعكم في النسخة المطبوعة وWord وفي منصة القيادة.</small>'))) return;
        try { const r = await api(`tamim/${t.id}/decide`, { method: 'POST', body: { decisions, notes: form.notes.value, sig: pad.png() } }); toast(`اعتُمد القرار: ${r.status} · رمز ${r.code}`); rerender(); } catch (err) { toast(err.message, 1); }
      };
    }
  } };

  if (S.meta && $('.side')) { renderShell(); rerender(); }
})();
