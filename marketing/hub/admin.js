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

  /* ---------- (ب) سجل التدقيق #/audit — للمدير فقط ---------- */
  const ACT = { create: 'إنشاء', update: 'تعديل', delete: 'حذف', login: 'دخول', password: 'تغيير كلمة المرور', reset: 'كلمة مرور مؤقتة', settings: 'الإعدادات',
    import: 'استيراد', convert: 'تحويل لعميل', pay: 'سداد', 'to-contract': 'تحويل لعقد', renew: 'تجديد', schedule: 'جدولة', print: 'طباعة', docx: 'ملف Word',
    'edit-doc': 'تعديل المستند', template: 'تشغيل قالب', duplicate: 'نسخ قالب', revoke: 'إلغاء مفتاح', mcp: 'وكيل ذكاء (MCP)', portal: 'رابط المندوب', payout: 'صرف عمولات',
    void: 'إلغاء', 'payroll-run': 'إعداد الرواتب', prefs: 'تفضيلات', backup: 'نسخة احتياطية', download: 'تنزيل', sections: 'صلاحيات الأقسام',
    'tg-setup': 'ربط تلجرام', 'tg-unlink': 'فك تلجرام', 'tg-disconnect': 'فصل تلجرام', bridge: 'جسر واتساب', xq_config: 'إعداد الطلبات بين القطاعات' };
  const ENT_AR = { users: 'المستخدمون', settings: 'الإعدادات', backups: 'النسخ الاحتياطية', morooj: 'دمج مروج', api_tokens: 'مفاتيح API', rep_payouts: 'صرف العمولات',
    commissions: 'العمولات', xq_requests: 'طلبات القطاعات', reports: 'التقارير', doc: 'مستند', quote: 'عرض سعر', contract: 'عقد', plan: 'خطة' };
  const entLabel = (e) => ENT_AR[e] || ENT[e]?.title || e || '—';
  const actLabel = (a) => ACT[a] || a || '—';
  const DETAIL = { leads: 'lead', clients: 'client', quotes: 'quote', contracts: 'contract', invoices: 'invoice' };
  const ksa = (at) => { if (!at) return '—'; const d = new Date(String(at).replace(' ', 'T') + 'Z'); const k = new Date(d.getTime() + 3 * 3600e3).toISOString(); return `${fdate(k.slice(0, 10))} <span class="num small muted" dir="ltr">${k.slice(11, 16)}</span>`; };
  const ACT_PILL = { delete: 'r', void: 'r', revoke: 'r', create: 't', login: 'x', update: 'b', pay: 'g' };

  async function auditView() {
    if (me().role !== 'admin') { V().innerHTML = '<div class="empty">سجل التدقيق للمدير العام فقط</div>'; return; }
    const f = { user_id: '', entity: '', action: '', from: addDays(todayStr(), -30), to: todayStr(), q: '' };
    let rows = [], total = 0;
    const fc = await api('audit/facets');
    V().innerHTML = `<div class="card"><div class="toolbar" id="au-f" style="flex-wrap:wrap;gap:8px">
        <select class="inp" name="user_id" style="max-width:190px"><option value="">كل المستخدمين</option>${fc.users.map((u) => `<option value="${u.k == null ? 'none' : u.k}">${esc(u.name || (u.k == null ? 'النظام / آلي' : '#' + u.k))} (${u.n})</option>`).join('')}</select>
        <select class="inp" name="entity" style="max-width:190px"><option value="">كل الكيانات</option>${fc.entities.map((e) => `<option value="${esc(e.k)}">${esc(entLabel(e.k))} (${e.n})</option>`).join('')}</select>
        <select class="inp" name="action" style="max-width:170px"><option value="">كل الإجراءات</option>${fc.actions.map((a) => `<option value="${esc(a.k)}">${esc(actLabel(a.k))} (${a.n})</option>`).join('')}</select>
        <label class="small muted" style="display:flex;align-items:center;gap:4px">من <input class="inp" type="date" name="from" value="${f.from}"></label>
        <label class="small muted" style="display:flex;align-items:center;gap:4px">إلى <input class="inp" type="date" name="to" value="${f.to}"></label>
        <input class="inp" name="q" placeholder="بحث في التفاصيل…" style="max-width:200px">
      </div><div class="small muted" id="au-n" style="margin:8px 0"></div><div id="au-t"></div><div style="text-align:center;margin-top:10px"><button class="btn btn-g btn-s" id="au-more" hidden>تحميل المزيد</button></div></div>`;
    const qs = (offset) => { const p = new URLSearchParams({ limit: 100, offset }); Object.entries(f).forEach(([k, v]) => v && p.set(k, v)); return p.toString(); };
    const draw = () => {
      $('#au-n').innerHTML = `<span class="num">${total.toLocaleString('en')}</span> حدث — يُعرض <span class="num">${rows.length.toLocaleString('en')}</span>`;
      $('#au-t').innerHTML = rows.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>الوقت (الرياض)</th><th>المستخدم</th><th>الإجراء</th><th>الكيان</th><th>السجل</th><th>التفاصيل</th></tr></thead><tbody>${rows.map((r) => {
        const det = DETAIL[r.entity]; const idc = r.entity_id ? (det && r.action !== 'delete' ? `<a href="#/${det}/${r.entity_id}" class="num">#${r.entity_id}</a>` : `<span class="num">#${r.entity_id}</span>`) : '—';
        return `<tr><td style="white-space:nowrap">${ksa(r.at)}</td><td>${esc(r.user_name || (r.user_id ? '#' + r.user_id : 'النظام / آلي'))}</td>
          <td><span class="pill ${ACT_PILL[r.action] || 'x'}">${esc(actLabel(r.action))}</span></td><td>${esc(entLabel(r.entity))}</td><td>${idc}</td>
          <td class="small" style="max-width:340px;overflow-wrap:anywhere">${esc(r.detail || '')}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="empty">لا أحداث تطابق التصفية</div>';
      $('#au-more').hidden = rows.length >= total;
    };
    const load = async (more) => {
      const seq = S.renderSeq;
      const d = await api('audit?' + qs(more ? rows.length : 0));
      if (seq !== S.renderSeq || !$('#au-t')) return;
      rows = more ? rows.concat(d.rows) : d.rows; total = d.total; draw();
    };
    const fe = $('#au-f');
    const onF = debounce(() => { fe.querySelectorAll('[name]').forEach((el) => { f[el.name] = el.value.trim(); }); load(false).catch((e) => toast(e.message, 1)); }, 250);
    fe.addEventListener('change', onF); fe.addEventListener('input', (e) => e.target.name === 'q' && onF());
    $('#au-more').onclick = () => load(true).catch((e) => toast(e.message, 1));
    await load(false);
  }
  ROUTES.audit = { title: 'سجل التدقيق', render: auditView };

  /* ---------- (ج) صلاحيات الأقسام لكل مستخدم — فوق صلاحيات الأدوار ----------
     الخادم يحجب الكيانات ومساراتها (sections.js)، وS.meta.perms تصل مصفّاة فتختفي عناصر القائمة تلقائياً.
     عناصر القائمة التي لا تحمل كياناً (متاحة لكل الأدوار) تُربط بقسمها فقط بعلامة «§قسم» — لا بصلاحية كيان، حتى لا تختفي عن أدوار كانت تراها. */
  const secOk = (sec) => { const u = me(); return u.role === 'admin' || u.sections == null || u.sections.includes(sec); };
  const LINK = { debts: 'finance', studio: 'clients', xreq: 'clients' };
  NAV.forEach(([, items]) => items.forEach((i) => { if (LINK[i[0]] && !i[3]) i[3] = '§' + LINK[i[0]]; }));
  const navBase = navAllowed;
  navAllowed = (perm) => (typeof perm === 'string' && perm[0] === '§' ? secOk(perm.slice(1))
    : perm === '#reports' ? navBase(perm) && secOk('finance') // التقارير (الإيراد والتحصيل) تتبع قسم المالية فوق الدور
      : navBase(perm));

  async function sectionsCard() {
    if (me().role !== 'admin' || $('#sec-card')) return;
    const SEC = S.meta.sections || {}; const keys = Object.keys(SEC);
    const c = document.createElement('div'); c.className = 'card'; c.id = 'sec-card'; c.style.marginTop = '14px';
    $('#view').appendChild(c);
    const { rows } = await api('e/users');
    const list = (u) => (u.sections == null ? null : String(u.sections).split(',').filter(Boolean));
    const draw = () => {
      const us = rows.filter((u) => u.role !== 'admin');
      c.innerHTML = `<h3>صلاحيات الأقسام</h3>
        <p class="muted small" style="margin-bottom:10px">تُضاف فوق صلاحيات الدور ولا تستبدلها: إلغاء قسم يُخفيه من القائمة ويمنع بياناته في الخادم (403) حتى لو كان الدور يسمح بها. «كل الأقسام» هو الوضع الافتراضي. المدير العام يملك كل الأقسام دائماً.</p>
        ${us.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>العضو</th>${keys.map((k) => `<th style="white-space:nowrap">${esc(SEC[k])}</th>`).join('')}<th></th></tr></thead><tbody>${us.map((u) => {
          const l = list(u);
          return `<tr data-u="${u.id}"><td><b>${esc(u.name)}</b><div class="small muted">${esc(S.meta.roles[u.role] || u.role)}${u.active ? '' : ' · موقوف'}</div>
            <div class="small">${l == null ? '<span class="pill t">كل الأقسام</span>' : `<span class="pill o">${l.length ? `${l.length} من ${keys.length}` : 'بلا أقسام'}</span>`}</div></td>
            ${keys.map((k) => `<td style="text-align:center"><input type="checkbox" data-s="${k}" aria-label="${esc(SEC[k])}" ${l == null || l.includes(k) ? 'checked' : ''}></td>`).join('')}
            <td>${l == null ? '' : `<button class="btn btn-g btn-s" data-all="${u.id}">كل الأقسام</button>`}</td></tr>`;
        }).join('')}</tbody></table></div>` : '<div class="empty">لا أعضاء غير المدير العام</div>'}`;
      const save = async (u, sections) => {
        try { const r = await api(`users/${u.id}/sections`, { method: 'PUT', body: { sections } }); u.sections = r.sections == null ? null : r.sections.join(','); toast(`تم تحديث أقسام ${u.name}`); }
        catch (e) { toast(e.message, 1); }
        draw();
      };
      c.querySelectorAll('tr[data-u]').forEach((tr) => {
        const u = rows.find((x) => x.id == tr.dataset.u);
        tr.querySelectorAll('[data-s]').forEach((cb) => cb.onchange = () => save(u, [...tr.querySelectorAll('[data-s]:checked')].map((x) => x.dataset.s)));
        const all = tr.querySelector('[data-all]'); if (all) all.onclick = () => save(u, null);
      });
    };
    draw();
  }
  const tr0 = ROUTES.team;
  if (tr0) { const base = tr0.render; tr0.render = async (...a) => { await base(...a); await sectionsCard(); }; }
  const adm = NAV.find((x) => x[0] === 'الإدارة');
  if (adm && !adm[1].some((i) => i[0] === 'audit')) adm[1].splice(adm[1].length - 1, 0, ['audit', 'سجل التدقيق', 'doc', '#admin']);

  // إن سبق الإقلاعُ تحميلَ هذه الوحدة: أعد بناء القائمة (بند سجل التدقيق) والصفحة (بطاقة النسخ)
  if (S.meta && $('.side')) { renderShell(); rerender(); }
})();
