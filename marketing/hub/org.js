/* الجهات داخل المنصة — دمج «مروج الحجاز» (القطاع غير الربحي) مع «نُبل وابتكار» (القطاع الربحي)
   الفريق والإدارة واحدة، والأعمال مفصولة: كل سجل يحمل الجهة، ومبدّل الجهة في الشريط العلوي يفلتر القوائم
   ولوحة القيادة والتقارير (رأس x-org يُرسل من api في hub.js). يغلّف renderShell وROUTES ولا يعدّل النواة. */
(() => {
  const ORGS = {
    nubl: { short: 'نُبل وابتكار', name: 'نُبل وابتكار للتسويق', sector: 'القطاع الربحي', c: '#308D8B' },
    morooj: { short: 'مروج الحجاز', name: 'مروج الحجاز للأعمال التجارية', sector: 'القطاع غير الربحي', c: '#6E8B3D' },
  };
  const ORG_ENTS = ['leads', 'deals', 'activities', 'visits', 'clients', 'catalog', 'quotes', 'contracts', 'invoices', 'payments', 'expenses', 'projects', 'tasks', 'content'];
  const OPTS = Object.entries(ORGS).map(([k, o]) => [k, `${o.short} — ${o.sector}`]);

  window.orgBadge = (v) => { const o = ORGS[v || 'nubl']; return o ? `<span class="orgb" style="--oc:${o.c}"><i></i>${esc(o.short)}</span>` : ''; };
  window.ORGS_UI = ORGS;

  // حقل «الجهة» في نماذج كل الكيانات المفصولة (يُحسم آلياً من العميل عند ربطه)
  for (const e of ORG_ENTS) {
    const def = ENT[e]; if (!def || def.fields.some((f) => f.k === 'org')) continue;
    def.fields.push(F('org', 'الجهة', 'select', { o: OPTS, list: 1, def: () => S.org || 'nubl', hint: 'تتبع جهة العميل تلقائياً عند ربط السجل بعميل' }));
  }

  const css = document.createElement('style');
  css.textContent = `
  .orgb{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;background:color-mix(in srgb,var(--oc) 12%,#fff);color:color-mix(in srgb,var(--oc) 80%,#082A37);white-space:nowrap}
  .orgb i{width:7px;height:7px;border-radius:50%;background:var(--oc)}
  .orgsw{position:relative}
  .orgsw>button{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:#fff;font:inherit;font-weight:600;font-size:13px;color:var(--ink,#082A37);cursor:pointer;white-space:nowrap}
  .orgsw>button i{width:10px;height:10px;border-radius:50%;background:var(--oc);box-shadow:0 0 0 3px color-mix(in srgb,var(--oc) 22%,transparent)}
  .orgsw>button svg{width:14px;height:14px;opacity:.6}
  .orgsw .orgm{position:absolute;top:calc(100% + 8px);inset-inline-end:0;min-width:290px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 22px 50px -24px rgba(8,42,55,.55);padding:8px;z-index:60;display:none}
  .orgsw.open .orgm{display:block}
  .orgm button{display:flex;width:100%;align-items:flex-start;gap:10px;text-align:start;border:0;background:none;padding:10px 12px;border-radius:12px;font:inherit;cursor:pointer;color:inherit}
  .orgm button:hover,.orgm button.on{background:var(--soft,#F6F3EC)}
  .orgm button i{flex:none;width:12px;height:12px;border-radius:50%;margin-top:5px;background:var(--oc)}
  .orgm b{display:block;font-size:14px}.orgm small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
  .orgm .num{font-variant-numeric:tabular-nums}
  html.org-nubl .top{box-shadow:inset 0 -3px 0 #308D8B}
  html.org-morooj .top{box-shadow:inset 0 -3px 0 #6E8B3D}
  @media (max-width:760px){.orgsw>button{height:36px;padding:0 10px;font-size:12px}.orgsw>button .lbl-l{display:none}.orgsw .orgm{min-width:0;width:min(310px,calc(100vw - 24px))}}
  @media (min-width:761px){.orgsw>button .lbl-s{display:none}}
  @media (max-width:760px){.top h2 .orgb{display:none}}
  `;
  document.head.appendChild(css);

  let SUM = null;
  const loadSum = async () => { try { SUM = await api('orgs'); } catch { SUM = null; } return SUM; };
  const dotC = (k) => (k ? ORGS[k].c : '#15556B');

  function setOrg(k) {
    S.org = ORGS[k] ? k : '';
    try { localStorage.setItem('nh_org', S.org); } catch { /* */ }
    S.cache = {}; S.list = {};
    document.documentElement.classList.remove('org-nubl', 'org-morooj');
    if (S.org) document.documentElement.classList.add('org-' + S.org);
    paint(); rerender();
    toast(S.org ? `تعرض الآن أعمال ${ORGS[S.org].name}` : 'تعرض الآن أعمال الجهتين معاً');
  }

  function menuHtml() {
    const row = (k, title, sub) => {
      const s = SUM?.orgs?.[k];
      const stat = k && s ? `<small><bdi>${s.clients}</bdi> عميل · <bdi>${s.leads}</bdi> عميل محتمل · <bdi>${s.contracts}</bdi> عقد نشط</small>` : '';
      return `<button data-org="${k}" class="${S.org === k ? 'on' : ''}" style="--oc:${dotC(k)}"><i></i><span><b>${title}</b><small>${sub}</small>${stat}</span></button>`;
    };
    return row('', 'كل الأعمال', 'الجهتان معاً — للإدارة والمتابعة الشاملة') + row('nubl', ORGS.nubl.name, ORGS.nubl.sector) + row('morooj', ORGS.morooj.name, ORGS.morooj.sector);
  }

  function paint() {
    const w = $('#orgsw'); if (!w) return;
    const o = ORGS[S.org];
    w.innerHTML = `<button type="button" style="--oc:${dotC(S.org)}" aria-haspopup="true" title="الجهة المعروضة"><i></i><span class="lbl-l">${o ? o.short + ' · ' + o.sector : 'كل الأعمال'}</span><span class="lbl-s">${o ? o.short : 'الكل'}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button><div class="orgm">${menuHtml()}</div>`;
    $('button', w).onclick = async (e) => {
      e.stopPropagation(); w.classList.toggle('open'); if (!w.classList.contains('open')) return;
      const m = $('.orgm', w); m.style.transform = '';
      const fit = () => { const r = m.getBoundingClientRect(); const dx = r.left < 12 ? 12 - r.left : r.right > innerWidth - 12 ? innerWidth - 12 - r.right : 0; if (dx) m.style.transform = `translateX(${dx}px)`; };
      fit(); await loadSum(); m.innerHTML = menuHtml(); bindMenu(w); fit();
    };
    bindMenu(w);
  }
  function bindMenu(w) { $$('[data-org]', w).forEach((b) => b.onclick = () => { w.classList.remove('open'); if (b.dataset.org !== S.org) setOrg(b.dataset.org); }); }
  document.addEventListener('click', (e) => { const w = $('#orgsw'); if (w && !w.contains(e.target)) w.classList.remove('open'); });

  const baseShell = renderShell;
  renderShell = function () {
    baseShell.apply(this, arguments);
    const top = $('.top'); if (!top || $('#orgsw')) return;
    const w = document.createElement('div'); w.id = 'orgsw'; w.className = 'orgsw';
    const gs = $('#gsearch', top); gs ? gs.before(w) : top.appendChild(w);
    if (S.org) document.documentElement.classList.add('org-' + S.org);
    paint();
  };
  if (S.meta && $('.side')) { renderShell(); rerender(); }

  // عنوان الصفحة يذكر الجهة عند التصفية
  const baseRerender = rerender;
  rerender = async function () {
    await baseRerender.apply(this, arguments);
    const t = $('#ptitle'); if (t && S.org && !$('.orgb', t)) t.insertAdjacentHTML('beforeend', ' ' + orgBadge(S.org));
  };

  /* ---------- الإعدادات: دمج مروج الحجاز ---------- */
  async function mergeCard() {
    const v = $('#view'); if (!v || $('#mrj-card') || me().role !== 'admin') return;
    const sum = await loadSum();
    const card = document.createElement('div'); card.className = 'card'; card.id = 'mrj-card'; card.style.marginTop = '14px';
    const lg = sum?.legacy || [];
    const LBL = { leads: 'العملاء المحتملون', clients: 'العملاء', deals: 'الصفقات', activities: 'سجل التواصل', visits: 'الزيارات', catalog: 'الكتالوج', quotes: 'عروض الأسعار', contracts: 'العقود', invoices: 'الفواتير', payments: 'المدفوعات', receipts: 'سندات القبض ← مدفوعات', expenses: 'المصروفات', disbursements: 'سندات الصرف ← مصروفات', projects: 'المشاريع', tasks: 'المهام', content: 'تقويم المحتوى', accounts: 'شجرة الحسابات', journals: 'القيود', employees: 'الموظفون', payroll: 'مسيّر الرواتب', advances: 'السلف', campaigns: 'الحملات', articles: 'قاعدة المعرفة', templates: 'القوالب', seasons: 'المواسم', settings: 'إعدادات مروج' };
    card.innerHTML = `<h3>دمج منصة مروج الحجاز</h3>
      <p class="muted small" style="margin-bottom:10px">ارفع ملف «تنزيل نسخة احتياطية» من إعدادات منصة مروج الحجاز. تُنقل البيانات بجهة <b>مروج الحجاز — القطاع غير الربحي</b> مع إعادة ربط العملاء والعروض والعقود والفواتير والمقبوضات، ويُحفظ كل سجل خام في أرشيف الدمج (المحاسبة والموارد البشرية والحملات تُنقل آلياً من الأرشيف، والمتجر في مرحلة لاحقة). إعادة الرفع آمنة ولا تكرر السجلات.</p>
      <div class="grid g2" style="gap:10px;margin-bottom:12px">${Object.entries(sum?.orgs || {}).map(([k, o]) => `<div class="card" style="padding:12px">${orgBadge(k)}<div class="small" style="margin-top:8px">${o.clients} عميل · ${o.leads} عميل محتمل · ${o.contracts} عقد نشط<br>ذمم مفتوحة: ${moneyTxt(o.receivable)}</div></div>`).join('')}</div>
      ${lg.length ? `<details style="margin-bottom:12px"><summary class="small">أرشيف الدمج (${lg.reduce((a, x) => a + x.n, 0)} سجل)</summary><table class="t" style="margin-top:8px"><thead><tr><th>البيان</th><th>في الأرشيف</th><th>نُقل للمنصة</th></tr></thead><tbody>${lg.map((x) => `<tr><td>${esc(LBL[x.entity] || x.entity)}</td><td class="num">${x.n}</td><td class="num">${x.moved || 0}</td></tr>`).join('')}</tbody></table></details>` : ''}
      <label class="btn btn-p">${I.upload || ''} اختيار ملف النسخة (JSON)<input type="file" id="mrj-file" accept=".json,application/json" hidden></label>
      <div id="mrj-out" style="margin-top:12px"></div>`;
    const host = $('#view .grid.g2 > div:last-child') || v;
    host.appendChild(card);
    $('#mrj-file').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      const out = $('#mrj-out'); out.innerHTML = '<div class="muted small">جارٍ قراءة الملف…</div>';
      let j; try { j = JSON.parse(await f.text()); } catch { out.innerHTML = '<div class="small" style="color:var(--red)">الملف ليس JSON صالحاً</div>'; return; }
      const payload = { data: j.data, settings: j.settings };
      try {
        const pv = await api('import/morooj', { method: 'POST', body: { ...payload, dry: true } });
        const rows = Object.entries(pv.counts || {});
        const extra = Object.entries(pv.legacy || {});
        out.innerHTML = `<div class="small" style="margin-bottom:8px">معاينة قبل الدمج — نسخة بتاريخ ${esc(String(j.exported || '').slice(0, 10) || 'غير محدد')}</div>
          <table class="t"><thead><tr><th>البيان</th><th>في الملف</th><th>سيُنقل</th><th>سبق نقله / مستبعد</th></tr></thead><tbody>
          ${rows.map(([k, c]) => `<tr><td>${esc(LBL[k] || k)}</td><td class="num">${c.total}</td><td class="num"><b>${c.imported}</b></td><td class="num">${c.skipped}</td></tr>`).join('')}
          ${extra.map(([k, n]) => `<tr><td>${esc(LBL[k] || k)}</td><td class="num">${n}</td><td class="muted small">${['accounts', 'journals', 'employees', 'payroll', 'advances', 'campaigns'].includes(k) ? 'يُنقل بعد الدمج' : 'أرشيف (مرحلة لاحقة)'}</td><td></td></tr>`).join('')}</tbody></table>
          <div style="margin-top:10px;display:flex;gap:8px"><button class="btn btn-p" id="mrj-go">تنفيذ الدمج</button><button class="btn btn-g" id="mrj-x">إلغاء</button></div>`;
        $('#mrj-x').onclick = () => { out.innerHTML = ''; };
        $('#mrj-go').onclick = async () => {
          if (!(await confirmBox('دمج بيانات مروج الحجاز في المنصة بجهة «مروج الحجاز — القطاع غير الربحي»؟'))) return;
          const b = $('#mrj-go'); b.disabled = true; b.textContent = 'جارٍ الدمج…';
          try {
            const r = await api('import/morooj', { method: 'POST', body: payload });
            const n = Object.values(r.counts || {}).reduce((a, c) => a + c.imported, 0);
            toast(`تم دمج ${n} سجل من مروج الحجاز`); S.cache = {}; card.remove(); mergeCard();
          } catch (err) { toast(err.message, 1); b.disabled = false; b.textContent = 'تنفيذ الدمج'; }
        };
      } catch (err) { out.innerHTML = `<div class="small" style="color:var(--red)">${esc(err.message)}</div>`; }
    };
  }
  const st = ROUTES.settings;
  if (st) { const base = st.render; st.render = async (...a) => { await base(...a); await mergeCard(); }; }
})();
