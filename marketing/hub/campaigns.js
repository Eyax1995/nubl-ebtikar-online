/* الحملات الإعلانية + لوحة مؤشراتها (المرحلة 2 — الخطوة 5، v12)
   الأرقام الخام تُسجَّل في الحملة (الميزانية، الصرف، الظهور، النقرات، العملاء المحتملون، التحويلات، الإيراد)،
   والمؤشرات تُحسب هنا: CTR = النقرات ÷ الظهور · CPL = الصرف ÷ العملاء المحتملين · CPA = الصرف ÷ التحويلات
   · ROAS = الإيراد ÷ الصرف · نسبة الصرف = الصرف ÷ الميزانية. حملات مروج تُستورد من أرشيف الدمج (finishLegacy). */
(() => {
  const PLATFORMS = ['Snapchat', 'TikTok', 'Instagram', 'X', 'Facebook', 'Google', 'YouTube', 'أخرى'];
  const OBJECTIVES = ['الوعي والوصول', 'الزيارات', 'التفاعل', 'الرسائل / العملاء المحتملون', 'المبيعات', 'تثبيت التطبيق'];
  const STATUSES = ['مخطط', 'نشطة', 'متوقفة', 'منتهية'];
  Object.assign(PILL, { 'مخطط': 'x', 'نشطة': 't', 'متوقفة': 'o', 'منتهية': 'b' });
  const ICO = () => I.mega || I.chart;

  ENT.campaigns = {
    title: 'الحملات الإعلانية', one: 'حملة', icon: 'mega',
    fields: [
      F('name', 'اسم الحملة', 'text', { list: 1, req: 1, w: 'full' }), F('platform', 'المنصة', 'select', { o: PLATFORMS, list: 1, filter: 1 }),
      F('client_id', 'العميل / الحساب', 'ref', { ref: 'clients', list: 1 }), F('objective', 'الهدف', 'select', { o: OBJECTIVES }),
      F('status', 'الحالة', 'select', { o: STATUSES, list: 1, filter: 1, def: 'مخطط' }), F('start_date', 'البداية', 'date', { list: 1, def: todayStr }), F('end_date', 'النهاية', 'date'),
      F('budget', 'الميزانية', 'money'), F('spend', 'الصرف الفعلي', 'money', { list: 1 }), F('impressions', 'مرات الظهور', 'number'), F('clicks', 'النقرات', 'number'),
      F('leads', 'العملاء المحتملون / المحادثات', 'number'), F('conversions', 'الطلبات / التحويلات', 'number', { list: 1 }), F('revenue', 'الإيراد المحقق', 'money', { list: 1 }),
      F('owner_id', 'المسؤول', 'ref', { ref: 'users' }), F('notes', 'ملاحظات وتعلّمات', 'textarea', { w: 'full' }),
      F('org', 'الجهة', 'select', { o: Object.entries(ORGS_UI).map(([k, o]) => [k, `${o.short} — ${o.sector}`]), list: 1, def: () => S.org || 'nubl', hint: 'تتبع جهة العميل تلقائياً' }),
    ],
  };

  // القائمة الجانبية: مجموعة «التسويق» بعد التشغيل
  if (!NAV.some((x) => x[0] === 'التسويق')) {
    const at = NAV.findIndex((x) => x[0] === 'التشغيل') + 1 || NAV.length;
    NAV.splice(at, 0, ['التسويق', [['camp', 'لوحة الحملات', 'chart', 'campaigns'], ['campaigns', 'الحملات الإعلانية', 'mega', 'campaigns']]]);
  }

  /* ---------- المؤشرات ---------- */
  const n = (x) => Number(x) || 0;
  const kpis = (list) => {
    const s = (k) => list.reduce((a, c) => a + n(c[k]), 0);
    const budget = s('budget'), spend = s('spend'), im = s('impressions'), cl = s('clicks'), ld = s('leads'), cv = s('conversions'), rv = s('revenue');
    return { n: list.length, budget, spend, im, cl, ld, cv, rv,
      ctr: im ? (cl / im) * 100 : 0, cpl: ld ? spend / ld : 0, cpa: cv ? spend / cv : 0, roas: spend ? rv / spend : 0, used: budget ? (spend / budget) * 100 : 0 };
  };
  // كل قيمة في عنصر واحد كي لا تفصل خلية البطاقة على الجوال (flex) الرقم عن وحدته
  const pct = (x) => `<span><span class="num">${x.toFixed(x >= 10 ? 1 : 2)}</span>%</span>`;
  const ratio = (x) => (x ? `<span><span class="num">${x.toFixed(2)}</span>×</span>` : '—');
  const sar = (x) => (x ? `<span><span class="num">${moneyTxt(Math.round(x * 100) / 100)}</span> <small>ر.س</small></span>` : '—');
  const css = document.createElement('style');
  css.textContent = '@media (max-width:860px){.grid.g3.cp-k{grid-template-columns:repeat(2,minmax(0,1fr))}}';
  document.head.appendChild(css);
  const roasCls = (k) => (!k.spend ? '' : k.roas >= 3 ? 'good' : k.roas < 1 ? 'warn' : '');
  const bar = (used) => `<span class="prog" title="${Math.round(used)}%"><i style="width:${Math.min(100, used)}%;${used > 100 ? 'background:var(--red)' : used >= 90 ? 'background:var(--gold,#DC9C47)' : ''}"></i></span>`;

  // تداخل الحملة مع الفترة: بدأت قبل نهاية الفترة ولم تنتهِ قبل بدايتها
  const inRange = (c, st) => (!st.to || !c.start_date || c.start_date <= st.to) && (!st.from || !c.end_date || c.end_date >= st.from);

  async function campView(_id, _sub, seq) {
    const st = (S.camp ||= { from: '', to: '', client: '', platform: '' });
    const [d] = await Promise.all([api('e/campaigns?limit=2000'), refs('clients')]);
    if (seq && seq !== S.renderSeq) return;
    const all = d.rows;
    const clients = [...new Set(all.map((c) => c.client_id).filter(Boolean))].map((id) => [id, refLabel('clients', id)]).sort((a, b) => a[1].localeCompare(b[1], 'ar'));
    const opt = (arr, v, l) => `<option value="">${l}: الكل</option>${arr.map(([k, t]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${esc(t)}</option>`).join('')}`;
    const v = $('#view');
    v.innerHTML = `<div class="toolbar"><a class="btn btn-g btn-s" href="#/campaigns">${ICO()} الحملات الإعلانية</a>
      <select class="inp" id="cpc">${opt(clients, st.client, 'العميل')}</select><select class="inp" id="cpp">${opt(PLATFORMS.map((p) => [p, p]), st.platform, 'المنصة')}</select>
      <label class="small">من <input class="inp" type="date" id="cpf" value="${st.from}"></label><label class="small">إلى <input class="inp" type="date" id="cpt" value="${st.to}"></label>
      <span class="sp"></span>${can('campaigns', 'w') ? `<button class="btn btn-p" id="cpadd">${I.plus} حملة جديدة</button>` : ''}</div><div id="cpbody"></div>`;
    const paint = () => {
      const list = all.filter((c) => inRange(c, st) && (!st.client || String(c.client_id) === String(st.client)) && (!st.platform || c.platform === st.platform));
      const k = kpis(list);
      if (!list.length) { $('#cpbody').innerHTML = `<div class="tbl-wrap"><div class="empty">لا توجد حملات${all.length ? ' مطابقة للتصفية' : ' بعد'}</div></div>`; return; }
      const tiles = [
        kpi('الصرف', sar(k.spend), k.budget ? `${Math.round(k.used)}% من ميزانية ${moneyTxt(k.budget)} ر.س` : 'بلا ميزانية مسجلة', k.used > 100 ? 'warn' : ''),
        kpi('الإيراد · ROAS', sar(k.rv), `العائد على الإنفاق ${ratio(k.roas)}`, roasCls(k)),
        kpi('النقرات · CTR', `<span class="num">${nf.format(k.cl)}</span>`, `${k.im ? pct(k.ctr) : '—'} من ${nf.format(k.im)} ظهور`),
        kpi('تكلفة العميل المحتمل · CPL', sar(k.cpl), `${nf.format(k.ld)} عميل محتمل / محادثة`),
        kpi('تكلفة التحويل · CPA', sar(k.cpa), `${nf.format(k.cv)} طلب / تحويل`),
        kpi('الحملات', `<span class="num">${k.n}</span>`, `${list.filter((c) => c.status === 'نشطة').length} نشطة الآن`),
      ];
      const rows = list.map((c) => {
        const x = kpis([c]);
        return `<tr data-id="${c.id}"><td><b>${esc(c.name)}</b>${c.client_id ? `<br><span class="small muted">${esc(refLabel('clients', c.client_id))}</span>` : ''}</td>
          <td>${esc(c.platform || '—')}</td><td>${pill(c.status)}</td><td class="n">${x.budget ? bar(x.used) : ''} <span class="small num">${moneyTxt(x.spend)} / ${x.budget ? moneyTxt(x.budget) : '—'}</span></td>
          <td>${x.im ? pct(x.ctr) : '—'}</td><td>${sar(x.cpl)}</td><td>${sar(x.cpa)}</td><td><b>${ratio(x.roas)}</b></td></tr>`;
      }).join('');
      const byP = Object.entries(list.reduce((a, c) => ((a[c.platform || 'أخرى'] ||= []).push(c), a), {})).map(([p, cs]) => [p, kpis(cs)]).sort((a, b) => b[1].spend - a[1].spend);
      $('#cpbody').innerHTML = `<div class="grid g3 cp-k">${tiles.join('')}</div>
        <div class="card" style="margin-top:14px"><h3>${ICO()} أداء الحملات</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>الحملة</th><th>المنصة</th><th>الحالة</th><th>الصرف / الميزانية</th><th>CTR</th><th>CPL</th><th>CPA</th><th>ROAS</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        <div class="card" style="margin-top:14px"><h3>${I.chart} حسب المنصة</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>المنصة</th><th>الحملات</th><th>الصرف</th><th>الإيراد</th><th>CTR</th><th>CPL</th><th>ROAS</th></tr></thead><tbody>${byP.map(([p, x]) =>
          `<tr><td>${esc(p)}</td><td class="num">${x.n}</td><td>${sar(x.spend)}</td><td>${sar(x.rv)}</td><td>${x.im ? pct(x.ctr) : '—'}</td><td>${sar(x.cpl)}</td><td><b>${ratio(x.roas)}</b></td></tr>`).join('')}</tbody></table></div></div>`;
      $$('#cpbody tbody tr[data-id]').forEach((tr) => tr.onclick = () => openForm('campaigns', all.find((c) => c.id == tr.dataset.id), {}, () => { invalidate('campaigns'); rerender(); }));
    };
    const bindF = (id, k) => { $(id).onchange = (e) => { st[k] = e.target.value; paint(); }; };
    bindF('#cpc', 'client'); bindF('#cpp', 'platform'); bindF('#cpf', 'from'); bindF('#cpt', 'to');
    const add = $('#cpadd'); if (add) add.onclick = () => openForm('campaigns', null, {}, () => rerender());
    paint();
  }

  Object.assign(ROUTES, {
    campaigns: { ent: 'campaigns', render: async () => { await refs('clients'); return listView('campaigns', { extra: `<a class="btn btn-g btn-s" href="#/camp">${I.chart} لوحة الحملات</a>` }); } },
    camp: { title: 'لوحة الحملات', render: campView },
  });

  if (S.meta && $('.side')) { renderShell(); rerender(); }
})();
