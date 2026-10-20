/* أدوات المدير العام (المرحلة 2 — الخطوة 6)
   (أ) النسخ الاحتياطية اليومية: بطاقة في الإعدادات تعرض آخر 30 نسخة مع التنزيل و«نسخة الآن» — للمدير فقط. */
(() => {
  const kb = (n) => { n = Number(n) || 0; return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; };
  const KIND = { daily: 'يومية', manual: 'يدوية' };
  const STATUS = { ok: ['تمت', 't'], running: ['جارية', 'o'], failed: ['فشلت', 'r'] };

  async function backupsCard() {
    if (me().role !== 'admin' || $('#bk-card')) return;
    const c = document.createElement('div'); c.className = 'card'; c.id = 'bk-card'; c.style.marginTop = '14px';
    const host = $('#view .grid.g2 > div:last-child') || $('#view');
    host.prepend(c);
    const draw = async () => {
      let d; try { d = await api('backups'); } catch (e) { c.innerHTML = `<h3>النسخ الاحتياطية اليومية</h3><div class="small" style="color:var(--red)">${esc(e.message)}</div>`; return; }
      const rows = d.rows || [];
      c.innerHTML = `<h3>${I.upload || ''} النسخ الاحتياطية اليومية</h3>
        <p class="muted small" style="margin-bottom:10px">نسخة كاملة من كل الجداول تُنشأ آلياً كل يوم بعد <span class="num">${esc(d.run_after)}</span> بتوقيت الرياض، مضغوطة (gzip)، بلا كلمات مرور ولا جلسات ولا أسرار. تُحفظ آخر <span class="num">${d.keep}</span> نسخة.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn btn-p btn-s" id="bk-now">نسخة الآن</button></div>
        ${rows.length ? `<div class="tbl-wrap" style="max-height:380px;overflow:auto"><table class="t"><thead><tr><th>التاريخ</th><th>النوع</th><th>الحالة</th><th>السجلات</th><th>الحجم</th><th></th></tr></thead><tbody>${rows.map((b) => {
          const st = STATUS[b.status] || [b.status, 'x'];
          return `<tr><td style="white-space:nowrap">${fdate(b.day)}<div class="small muted num" dir="ltr">${esc(String(b.created_at || '').slice(11, 16))} UTC</div></td>
            <td>${KIND[b.kind] || esc(b.kind)}${b.user_name ? `<div class="small muted">${esc(b.user_name)}</div>` : ''}</td>
            <td><span class="pill ${st[1]}">${st[0]}</span>${b.error ? `<div class="small" style="color:var(--red)">${esc(b.error)}</div>` : ''}</td>
            <td class="num">${b.status === 'ok' ? Number(b.rows).toLocaleString('en') : '—'}</td>
            <td class="num" dir="ltr" style="white-space:nowrap">${b.status === 'ok' ? kb(b.size) : '—'}</td>
            <td>${b.status === 'ok' ? `<a class="btn btn-g btn-s" href="${API}backups/${b.id}" download>تنزيل</a>` : ''}</td></tr>`;
        }).join('')}</tbody></table></div>` : '<div class="empty">لا توجد نسخ بعد — أول نسخة يومية بعد الموعد، أو اضغط «نسخة الآن».</div>'}`;
      $('#bk-now', c).onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true; b.textContent = 'جارٍ إنشاء النسخة…';
        try { const r = await api('backups', { method: 'POST' }); toast(`تمت النسخة: ${Number(r.row.rows).toLocaleString('en')} سجل · ${kb(r.row.size)}`); await draw(); }
        catch (err) { toast(err.message, 1); b.disabled = false; b.textContent = 'نسخة الآن'; }
      };
    };
    await draw();
  }

  const sr = ROUTES.settings;
  if (sr) { const base = sr.render; sr.render = async (...a) => { await base(...a); await backupsCard(); }; }

  // إن سبق الإقلاعُ تحميلَ هذه الوحدة (الإعدادات معروضة بلا البطاقة): أعد رسم الصفحة
  if (S.meta && $('.side')) rerender();
})();
