/* التعاميد (28 أكتوبر 2026): خطابات الاعتماد المرفوعة للرئيس التنفيذي — مستند رسمي يُطّلع عليه ويُطبع ويُحمَّل Word ويُعتمد بنداً بنداً.
   #/tamims القائمة · #/tamim/<id> التعميد: معاينة على الورق الرسمي، طباعة/PDF، Word، المرفقات، قرار الرئيس التنفيذي، رفع النسخة الموقّعة */
(() => {
  Object.assign(PILL, { 'بانتظار الاعتماد': 'o', 'معتمد': 't', 'معتمد جزئياً': 'g', 'غير معتمد': 'r' });
  const ROLES_OK = ['admin', 'manager', 'executive', 'finance'];
  const g = NAV.find((x) => x[0] === 'الإدارة');
  if (g && !g[1].some((i) => i[0] === 'tamims')) g[1].unshift(['tamims', 'التعاميد', 'sign', '#reports', 'tamim']);

  const fileLink = (f, dl) => `${API}files/${f.id}${dl ? '?dl=1' : ''}`;
  const fileIcon = (f) => (/pdf/.test(f.mime || f.name) ? '📕' : /word|docx?$/.test(f.mime || f.name) ? '📘' : /sheet|xlsx?$/.test(f.mime || f.name) ? '📗' : '🖼️');

  ROUTES.tamims = { title: 'التعاميد', render: async () => {
    if (!ROLES_OK.includes(me().role)) { V().innerHTML = '<div class="empty">لا تملك صلاحية التعاميد</div>'; return; }
    const d = await api('tamim');
    V().innerHTML = `<div class="card"><h3>🖋️ التعاميد المرفوعة للرئيس التنفيذي</h3>
      ${d.rows.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>الرقم</th><th>العنوان</th><th>البنود</th><th>الحالة</th><th>تاريخ الرفع</th><th>القرار</th></tr></thead><tbody>
      ${d.rows.map((r) => { const it = parseJ(r.items, []); return `<tr class="click" data-go="#/tamim/${r.id}"><td class="num">${esc(r.number)}</td><td><b>${esc(r.title)}</b>${r.subject ? `<div class="small muted">${esc(r.subject)}</div>` : ''}</td><td class="num">${it.length}</td><td>${pill(r.status)}</td><td>${fdate(r.created_at)}</td><td>${r.decided_at ? fdate(r.decided_at) : '—'}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="empty">لا تعاميد بعد</div>'}</div>`;
    $$('[data-go]').forEach((tr) => tr.onclick = () => go(tr.dataset.go));
  } };

  ROUTES.tamim = { title: 'تعميد', render: async (id, sub, seq) => {
    const d = await api('tamim/' + id); if (seq !== S.renderSeq) return;
    const t = d.row; const items = t.items; const dec = t.decisions || {};
    $('#ptitle').textContent = `${t.number} — ${t.title}`;
    const canAttach = ['admin', 'manager'].includes(me().role);
    V().innerHTML = `<div class="toolbar"><a class="btn btn-g btn-s" href="#/tamims">→ التعاميد</a><span class="sp"></span>
        <button class="btn btn-p" id="tm-print">🖨️ طباعة / PDF</button><a class="btn btn-g" href="${API}studio/doc/tamim/${t.id}">📘 تنزيل Word</a></div>
      <div class="grid g2" style="align-items:start">
        <div>
          <div class="card"><h3>${esc(t.title)} ${pill(t.status)}</h3>
            <div class="small muted" style="margin-bottom:8px"><span class="num">${esc(t.number)}</span> · رفعه ${esc(t.created_by_name || '')} · ${fdate(t.created_at)}${t.decided_at ? ` · القرار ${fdate(t.decided_at)} — ${esc(t.decided_by_name)}` : ''}</div>
            ${t.subject ? `<p style="margin:0 0 8px">${esc(t.subject)}</p>` : ''}
            <h3 style="margin-top:10px">📎 المرفقات</h3>
            ${t.attachments.length ? t.attachments.map((f) => `<div class="list-i"><div class="g"><b>${fileIcon(f)} ${esc(f.name || 'ملف')}</b><span class="small muted">${esc(f.by || '')}</span></div><a class="btn btn-g btn-s" href="${fileLink(f)}" target="_blank" rel="noopener">عرض</a><a class="btn btn-g btn-s" href="${fileLink(f, 1)}">تنزيل</a></div>`).join('') : '<div class="small muted">لا مرفقات</div>'}
            ${canAttach ? '<label class="btn btn-g btn-s" style="margin-top:8px">📎 إرفاق ملف (PDF / Word / صورة)<input type="file" id="tm-att" accept=".pdf,.docx,.xlsx,image/*" hidden></label>' : ''}
            <h3 style="margin-top:14px">✍️ النسخة الموقّعة</h3>
            ${t.signed_files.length ? t.signed_files.map((f) => `<div class="list-i"><div class="g"><b>${fileIcon(f)} ${esc(f.name || 'نسخة موقّعة')}</b><span class="small muted">${esc(f.by || '')} · ${fdate(f.at)}</span></div><a class="btn btn-g btn-s" href="${fileLink(f)}" target="_blank" rel="noopener">عرض</a><a class="btn btn-g btn-s" href="${fileLink(f, 1)}">تنزيل</a></div>`).join('') : '<div class="small muted">لم تُرفع بعد — اطبع التعميد، وقّعه، ثم صوّره وارفعه هنا</div>'}
            <label class="btn btn-g btn-s" style="margin-top:8px">📷 رفع النسخة الموقّعة<input type="file" id="tm-signed" accept=".pdf,image/*" hidden></label>
          </div>
          <div class="card" style="margin-top:14px"><h3>🖋️ قرار الرئيس التنفيذي</h3>
            ${d.can_decide ? `<form id="tm-form">${items.map((it, i) => `<div class="list-i" style="flex-wrap:wrap;gap:6px"><div class="g" style="min-width:220px"><b>${esc(it)}</b></div>
                <div style="display:flex;gap:10px;flex-wrap:wrap">${d.options.map((o) => `<label class="chk"><input type="radio" name="d${i}" value="${esc(o)}" ${dec[it] === o ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div></div>`).join('')}
              <div style="display:flex;gap:6px;margin:8px 0"><button type="button" class="btn btn-g btn-s" id="tm-all">✅ اعتماد الكل</button></div>
              <textarea class="inp" name="notes" rows="3" placeholder="الملاحظات (مثل: تعديل مبلغ، استثناء بند برقمه)">${esc(t.notes || '')}</textarea>
              <button class="btn btn-p" style="margin-top:8px">🖋️ ${t.decided_at ? 'تحديث القرار' : 'اعتماد القرار'}</button></form>`
            : `${items.map((it) => `<div class="list-i"><div class="g"><b>${esc(it)}</b></div>${dec[it] ? pill(dec[it]) : '<span class="pill o">بانتظار القرار</span>'}</div>`).join('')}${t.notes ? `<div class="notice" style="margin-top:8px">💬 ${esc(t.notes)}</div>` : ''}`}
          </div>
        </div>
        <div class="card" style="padding:0;overflow:hidden"><iframe id="tm-doc" title="التعميد" style="width:100%;height:80vh;border:0;background:#fff"></iframe></div>
      </div>`;
    // معاينة على الأوراق الرسمية — نفس محتوى الطباعة وWord
    api(`studio/doc/tamim/${t.id}?format=html`).then((r) => { const f = $('#tm-doc'); if (f) f.srcdoc = docShell(r.title, r.html, { official: true, org: r.org }); }).catch((e) => toast(e.message, 1));
    $('#tm-print').onclick = () => (window.nublPrintOfficial ? window.nublPrintOfficial('tamim', t.id) : $('#tm-doc').contentWindow.print());
    const up = async (inp, signed) => { const file = inp.files[0]; inp.value = ''; if (!file) return;
      try { toast('جارٍ الرفع…'); const it = await uploadFile(file); await api(`tamim/${t.id}/attach`, { method: 'POST', body: { file: it, signed } }); toast(signed ? 'رُفعت النسخة الموقّعة ✓' : 'أُرفق الملف ✓'); rerender(); } catch (e) { toast(e.message, 1); } };
    const a1 = $('#tm-att'); if (a1) a1.onchange = () => up(a1, false);
    const a2 = $('#tm-signed'); if (a2) a2.onchange = () => up(a2, true);
    const form = $('#tm-form');
    if (form) {
      $('#tm-all').onclick = () => $$('input[type=radio][value="معتمد"]', form).forEach((r) => { r.checked = true; });
      form.onsubmit = async (e) => {
        e.preventDefault();
        const decisions = {}; items.forEach((it, i) => { const r = form.querySelector(`input[name="d${i}"]:checked`); if (r) decisions[it] = r.value; });
        if (Object.keys(decisions).length < items.length) return toast('حدّد قراراً لكل بند', 1);
        if (!(await confirmBox('اعتماد القرار على هذا التعميد؟<br><small>يُسجَّل باسمكم ووقته، ويصل الإدارة والمالية فوراً، ويظهر في النسخة المطبوعة وWord.</small>'))) return;
        try { const r = await api(`tamim/${t.id}/decide`, { method: 'POST', body: { decisions, notes: form.notes.value } }); toast('اعتُمد القرار: ' + r.status); rerender(); } catch (err) { toast(err.message, 1); }
      };
    }
  } };

  if (S.meta && $('.side')) { renderShell(); rerender(); }
})();
