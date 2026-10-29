/* الملف الشخصي (29 أكتوبر 2026 — v30): #/me ملفي · #/me/welcome بعد تفعيل الحساب · #/me/<id> ملف عضو (الإدارة تؤكّد البيانات)
   تبويبات: 👤 بياناتي · 🪪 المستندات والبنك · 🔐 الأمان · 🔔 التنبيهات · 📊 أعمالي — وحالة كل قسم: ناقص / بانتظار التأكيد / مؤكَّد ✓
   + دعوات التفعيل للموظف الجديد (inviteModal / inviteResult يستعملهما «الفريق») + «ملفات بانتظار التأكيد» أعلى صفحة الفريق. */
(() => {
  const css = `
.pf-app{max-width:1100px;margin:0 auto}
.pf-hero{display:flex;gap:18px;align-items:center;margin-bottom:12px}
.pf-av{position:relative;width:96px;height:96px;flex:0 0 96px;border-radius:50%;background:var(--g-brand,var(--navy));color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700}
.pf-av img{position:absolute;inset:0;width:96px;height:96px;border-radius:50%;object-fit:cover}
.pf-av-edit{position:absolute;bottom:-2px;inset-inline-start:-2px;width:34px;height:34px;border-radius:50%;background:var(--terra);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.pf-hi{flex:1;min-width:0}.pf-hi h3{margin:0 0 2px;color:var(--deep);font-size:20px}
.pf-sub{color:var(--muted);font-size:13px;word-break:break-all}
.pf-roles{margin-top:6px;display:flex;flex-wrap:wrap;gap:5px}
.pf-roles span{background:var(--soft);color:var(--navy);border:1px solid var(--line);border-radius:99px;padding:1px 10px;font-size:12px;font-weight:600}
.pf-social{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}
.pf-social a{width:32px;height:32px;border-radius:50%;border:1px solid var(--line);background:var(--card);display:inline-flex;align-items:center;justify-content:center;font-size:14px;color:var(--ink)}
.pf-social a:hover{border-color:var(--navy);transform:translateY(-1px)}
.pf-complete{margin-top:10px;font-size:12.5px;color:var(--muted)}
.pf-complete .bar{height:7px;border-radius:5px;background:var(--soft);border:1px solid var(--line);overflow:hidden;margin:4px 0;max-width:380px}
.pf-complete .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--teal),var(--gold));transition:width .5s}
.pf-complete a{cursor:pointer;color:var(--terra);margin-inline-start:8px;font-weight:600}
.pf-tabs{display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px}
.pf-tabs button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:99px;padding:7px 16px;white-space:nowrap;cursor:pointer;font-weight:600}
.pf-tabs button.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.pf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px}
.pf-grid .full{grid-column:1/-1}
.pf-grid label.f{margin:0}
.pf-sec{grid-column:1/-1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:700;color:var(--navy-d);border-top:1px solid var(--line);padding-top:12px;margin-top:4px}
.pf-sec:first-child{border-top:0;padding-top:0;margin-top:0}
.pf-sec small{font-weight:400;color:var(--muted)}
.pf-sec .sp{flex:1}
.pf-actions{grid-column:1/-1;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pf-meta{font-size:12px;color:var(--muted)}
.pf-badge{display:inline-flex;align-items:center;gap:4px;border-radius:99px;padding:1px 9px;font-size:11.5px;font-weight:700}
.pf-badge.ok{background:#E3F2F1;color:#1E6765}.pf-badge.warn{background:#FBEEE8;color:#A04A1F}.pf-badge.bad{background:#FCE9E5;color:#A3321F}
.pf-file{display:flex;align-items:center;gap:10px;border:1.5px dashed var(--line-2,var(--line));border-radius:12px;padding:10px;background:var(--soft)}
.pf-file .th{width:56px;height:56px;border-radius:8px;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none;font-size:22px}
.pf-file .th img{width:100%;height:100%;object-fit:cover}
.pf-file .nm{flex:1;min-width:0;font-size:13px}.pf-file .nm b{display:block}
.pf-file .nm small{color:var(--muted)}
.pf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.pf-row{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:13px}
.pf-row:last-child{border-bottom:0}
.pf-switch{display:flex;align-items:flex-start;gap:10px;margin:12px 0;cursor:pointer;font-weight:600}
.pf-switch small{display:block;font-weight:400;color:var(--muted)}
.pf-switch input{width:18px;height:18px;margin-top:3px;accent-color:var(--navy)}
.pf-welcome{background:var(--g-brand,var(--navy));color:#fff;border-radius:var(--r);padding:16px 18px;margin-bottom:12px}
.pf-welcome h3{color:#fff;margin:0 0 6px}
.pf-welcome ul{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.pf-welcome li{background:rgba(255,255,255,.12);border-radius:99px;padding:2px 10px;font-size:12.5px}
.pf-welcome li.ok{opacity:.65;text-decoration:line-through}
.pf-pend .pf-row a{font-weight:700}
.pf-mini{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--navy);color:#fff;font-size:11px;font-weight:700;overflow:hidden;flex:none;vertical-align:middle}
.pf-mini img{width:100%;height:100%;object-fit:cover}
a.tm-pf{display:inline-flex;align-items:center;gap:7px;color:inherit}
.side .me .me-pf{display:flex;align-items:center;gap:8px;color:#fff}
.side .me .me-pf b{display:block}
.side .me .me-pct{font-size:11px;background:var(--terra);color:#fff;border-radius:99px;padding:0 7px;margin-inline-start:auto}
@media (max-width:760px){.pf-grid{grid-template-columns:1fr}.pf-hero{flex-direction:column;text-align:center}.pf-roles,.pf-social{justify-content:center}.pf-complete .bar{margin:4px auto}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const SOCIAL = [['instagram', 'إنستغرام', '📷', '@name'], ['x', 'X (تويتر)', '<b>𝕏</b>', '@name'], ['snapchat', 'سناب شات', '👻', '@name'], ['tiktok', 'تيك توك', '🎵', '@name'],
    ['linkedin', 'لينكدإن', '<b style="color:#0A66C2">in</b>', 'linkedin.com/in/…'], ['behance', 'بيهانس / معرض الأعمال', '🎨', 'behance.net/…'], ['facebook', 'فيسبوك', '<b style="color:#1877F2">f</b>', 'facebook.com/…']];
  const SOC_URL = { instagram: 'https://instagram.com/', x: 'https://x.com/', snapchat: 'https://snapchat.com/add/', tiktok: 'https://tiktok.com/@', linkedin: 'https://linkedin.com/in/', behance: 'https://behance.net/', facebook: 'https://facebook.com/' };
  const socialUrl = (k, v) => (/^https?:\/\//i.test(v) ? v : /\.[a-z]{2,}\//i.test(v) ? 'https://' + v : SOC_URL[k] + String(v).replace(/^@/, ''));
  const BANKS = ['مصرف الراجحي', 'البنك الأهلي السعودي', 'بنك الرياض', 'مصرف الإنماء', 'بنك البلاد', 'بنك الجزيرة', 'البنك السعودي البريطاني (ساب)', 'البنك العربي الوطني', 'البنك السعودي الفرنسي', 'البنك السعودي للاستثمار', 'بنك الخليج الدولي (ميم)', 'STC Bank', 'D360 Bank'];
  const STATE = { missing: ['bad', 'ناقص'], pending: ['warn', 'بانتظار التأكيد'], ok: ['ok', 'مؤكَّد ✓'] };
  const initials = (n) => String(n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.replace(/^ال/, '')[0] || '').join('‌');
  const fmtPhone = (p) => (/^9665\d{8}$/.test(String(p || '')) ? '0' + String(p).slice(3) : String(p || ''));
  const fileUrl = (id, dl) => `${API}files/${id}${dl ? '?dl=1' : ''}`;
  window.avatarHtml = (u, size = 26) => `<span class="pf-mini" style="width:${size}px;height:${size}px">${u && u.avatar ? `<img src="${fileUrl(u.avatar)}" alt="">` : esc(initials(u?.name))}</span>`;

  // ---------- القائمة الجانبية: الاسم والصورة رابط للملف الشخصي + عنصر «ملفي الشخصي» ----------
  const g0 = NAV.find((x) => x[0] === 'الرئيسية');
  if (g0 && !g0[1].some((i) => i[0] === 'me')) g0[1].push(['me', 'ملفي الشخصي', 'team']);
  const baseShell = renderShell;
  renderShell = function () {
    baseShell.apply(this, arguments);
    const box = document.querySelector('.side .me'); const u = me();
    const b = box && box.querySelector(':scope > b');
    if (b && !box.querySelector('.me-pf')) {
      const pct = u.profile_pct;
      const a = document.createElement('a'); a.href = '#/me'; a.className = 'me-pf'; a.title = 'ملفي الشخصي';
      a.innerHTML = `${avatarHtml(u, 34)}<b>${esc(u.name)}</b>${pct != null && pct < 100 ? `<span class="me-pct" title="اكتمال الملف">${pct}%</span>` : ''}`;
      b.replaceWith(a);
    }
  };
  if (S.meta && document.querySelector('.side')) { renderShell(); rerender(); }

  // ---------- أدوات ----------
  async function toB64(file) {
    const f = typeof shrinkImage === 'function' ? await shrinkImage(file) : file;
    if (f.size > 1_400_000) throw new Error(`«${file.name}» أكبر من 1.4MB`);
    const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(f); });
    return { name: f.name, mime: f.type, data };
  }
  const badge = (s) => { const [c, l] = STATE[s.state] || STATE.missing; return `<span class="pf-badge ${c}">${l}</span>${s.state === 'ok' && s.by ? ` <small class="muted">${esc(s.by)} · ${fdate(s.at)}</small>` : ''}`; };
  const val = (P, k) => esc(P.data?.[k] || '');
  const inp = (P, k, l, o = {}) => `<label class="f ${o.full ? 'full' : ''}"><span>${l}${o.req ? ' <i>*</i>' : ''}</span><input class="inp" name="${k}" value="${o.v !== undefined ? esc(o.v) : val(P, k)}" ${o.type ? `type="${o.type}"` : ''} ${o.ltr ? 'dir="ltr"' : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.list ? `list="${o.list}"` : ''} ${o.ro ? 'disabled' : ''} ${o.extra || ''}>${o.hint ? `<small class="muted">${o.hint}</small>` : ''}</label>`;
  const read = (form) => { const o = {}; $$('input[name]:not([disabled]),select[name]:not([disabled])', form).forEach((el) => { if (el.type !== 'file') o[el.name] = el.value.trim(); }); return o; };

  let tab = 'info';
  ROUTES.me = { title: 'ملفي الشخصي', render: async (id, sub, seq) => {
    const self = !id || id === 'welcome';
    const uid = self ? me().id : Number(id);
    const P = await api(self || uid === me().id ? 'profile' : 'profile/' + uid);
    if (seq !== S.renderSeq) return;
    if (!P.own) $('#ptitle').textContent = 'ملف ' + P.user.name;
    if (!P.own && ['security', 'alerts'].includes(tab)) tab = 'info';
    const welcome = id === 'welcome';
    const base = P.own ? 'profile' : 'profile/' + P.user.id;
    const ro = !P.can_edit;
    const roleL = (S.meta.roles || {})[P.user.role] || P.user.role;
    const miss = (P.required || []).filter((r) => !r.ok);
    const TABS = [['info', '👤 بياناتي'], ['docs', '🪪 المستندات والبنك'], ...(P.own ? [['security', '🔐 الأمان'], ['alerts', '🔔 التنبيهات']] : []), ...(P.works ? [['work', '📊 أعمالي']] : [])];
    if (!TABS.some((t) => t[0] === tab)) tab = 'info';
    const confBtn = (sec) => (P.can_confirm && P.sections[sec]?.state === 'pending' ? `<button type="button" class="btn btn-p btn-s" data-confirm="${sec}">✓ تأكيد</button>` : '');
    const phoneBadge = P.phone.value ? (P.phone.verified ? `<span class="pf-badge ok">✓ موثّق</span> <small class="muted">${esc(P.phone.by || '')}</small>` : '<span class="pf-badge warn">غير مؤكد بعد</span>') : '<span class="pf-badge bad">مطلوب</span>';

    let pendBox = '';
    if (P.own && ['admin', 'manager', 'finance'].includes(me().role)) pendBox = '<div id="pf-pend"></div>';

    V().innerHTML = `<div class="pf-app">
      ${!P.own ? `<div class="toolbar" style="margin-bottom:10px"><a class="btn btn-g btn-s" href="#/team">→ الفريق</a><span class="sp"></span>${P.can_confirm ? '<span class="small muted">راجع البيانات والمستندات ثم اضغط «تأكيد» لكل قسم</span>' : ''}</div>` : ''}
      ${welcome ? `<div class="pf-welcome"><h3>أهلاً بك ${esc(String(P.user.name).split(/\s+/)[0])} في نُبل وابتكار للتسويق 🌟</h3>
        <div>أكملي بياناتك — تُراجعها الإدارة وتؤكّدها، وهي سرية لا يطّلع عليها إلا الإدارة والمالية.</div>
        <ul>${(P.required || []).map((r) => `<li class="${r.ok ? 'ok' : ''}">${r.ok ? '✓' : '○'} ${esc(r.l)}</li>`).join('')}<li class="${Object.keys(P.social || {}).length ? 'ok' : ''}">${Object.keys(P.social || {}).length ? '✓' : '○'} حساباتك على المنصات (اختياري)</li></ul></div>` : ''}
      ${pendBox}
      <section class="card pf-hero">
        <div class="pf-av">${esc(initials(P.user.name))}${P.user.avatar ? `<img src="${fileUrl(P.user.avatar)}" alt="">` : ''}
          ${P.can_edit ? '<label class="pf-av-edit" title="تغيير الصورة">📷<input type="file" id="pf-avatar" accept="image/*" hidden></label>' : ''}</div>
        <div class="pf-hi"><h3>${esc(P.user.name)}</h3>
          <div class="pf-sub">${esc(P.user.title || roleL)} · <span dir="ltr">${esc(P.user.email)}</span></div>
          <div class="pf-roles"><span>${esc(roleL)}</span>${P.user.title ? `<span>${esc(P.user.title)}</span>` : ''}${P.privileged ? Object.values(P.sections).map((s) => `<span>${esc(s.label)}: ${STATE[s.state][1]}</span>`).join('') : ''}</div>
          <div class="pf-social">${SOCIAL.filter(([k]) => P.social[k]).map(([k, l, ic]) => `<a href="${esc(socialUrl(k, P.social[k]))}" target="_blank" rel="noopener" title="${esc(l)}">${ic}</a>`).join('')}</div>
          ${P.pct == null ? '' : `<div class="pf-complete">${P.pct === 100 ? '✅ الملف مكتمل' : `اكتمال الملف <b class="num">${P.pct}%</b><div class="bar"><i style="width:${P.pct}%"></i></div>ينقص: ${miss.map((r) => `<a data-go="${r.tab}">${esc(r.l)}</a>`).join('')}`}</div>`}
        </div></section>
      <nav class="pf-tabs">${TABS.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav>
      <div id="pf-pane"></div></div>`;

    const pane = $('#pf-pane');
    const panes = {
      info: () => `<form class="card pf-grid" id="pf-f" autocomplete="off">
        <div class="pf-sec">👤 البيانات الأساسية <span class="sp"></span>${P.privileged ? badge(P.sections.personal) : ''} ${confBtn('personal')}</div>
        ${inp(P, 'name', 'الاسم الكامل', { req: 1, v: P.user.name, ro })}
        ${inp(P, 'title', 'المسمى الوظيفي', { v: P.user.title, ro: !P.can_title, hint: P.can_title ? '' : 'يحدده المدير العام' })}
        ${P.privileged ? `<label class="f"><span>جوالك الشخصي (واتساب) <i>*</i></span><input class="inp" name="phone" dir="ltr" inputmode="tel" placeholder="05xxxxxxxx" value="${esc(P.phone.value ? fmtPhone(P.phone.value) : '')}" ${ro ? 'disabled' : ''}>
          <small class="muted">${phoneBadge} ${P.can_confirm && P.phone.value && !P.phone.verified ? '<button type="button" class="btn btn-g btn-s" data-confirm="phone">تأكيد الجوال</button>' : ''} تصلك عليه تنبيهات المهام وتقاريرك</small></label>` : ''}
        ${inp(P, 'email', 'البريد الوظيفي (اسم الدخول)', { v: P.user.email, ro: 1, ltr: 1, hint: 'يغيّره المدير العام من «الفريق»' })}
        ${P.privileged ? `${inp(P, 'personal_email', 'البريد الشخصي', { req: 1, ltr: 1, type: 'email', ro, ph: 'name@gmail.com' })}
        ${inp(P, 'birth_date', 'تاريخ الميلاد', { req: 1, type: 'date', ro })}` : ''}
        ${inp(P, 'nationality', 'الجنسية', { ro, ph: 'سعودي' })}
        ${inp(P, 'city', 'المدينة', { ro, ph: 'جدة' })}
        ${P.privileged ? `${inp(P, 'district', 'الحي', { ro })}
        <div class="pf-sec">🆘 جهة اتصال للطوارئ</div>
        ${inp(P, 'emergency_name', 'الاسم', { req: 1, ro })}
        ${inp(P, 'emergency_relation', 'صلة القرابة', { ro, ph: 'أخ، والدة، زوج…' })}
        ${inp(P, 'emergency_phone', 'الجوال', { req: 1, ltr: 1, ro, ph: '05xxxxxxxx', v: P.data.emergency_phone ? fmtPhone(P.data.emergency_phone) : '' })}
        <div class="pf-sec">🌐 حساباتي المهنية والاجتماعية <small>(اختيارية — الصق الرابط أو اكتب اسم المستخدم)</small></div>
        ${SOCIAL.map(([k, l, , ph]) => inp(P, 'social_' + k, l, { ltr: 1, ro, ph })).join('')}
        ${ro ? '' : `<div class="pf-actions"><button class="btn btn-p" type="submit">حفظ البيانات</button><span class="pf-meta">${P.updated_at ? 'آخر تحديث ' + fdate(P.updated_at) + ' · ' : ''}أي تعديل يعود «بانتظار التأكيد» من الإدارة</span></div>`}` : ''}
      </form>`,
      docs: () => {
        if (!P.privileged) return `<div class="card"><div class="pf-row"><span>رقم الهوية</span><b class="num">${esc(P.data.national_id || '—')}</b></div><div class="pf-row"><span>البنك</span><b>${esc(P.data.bank_name || '—')}</b></div><div class="pf-row"><span>الآيبان</span><b class="num">${esc(P.data.iban || '—')}</b></div><p class="small muted" style="margin-top:8px">🔒 البيانات الحساسة والمستندات للإدارة والمالية فقط.</p></div>`;
        const slot = (kind, label, req) => { const f = P.files[kind]; const img = f && /^image\//.test(f.mime);
          return `<div class="pf-file"><div class="th">${f ? (img ? `<img src="${fileUrl(f.id)}" alt="">` : '📕') : '🪪'}</div>
            <div class="nm"><b>${label}${req ? ' <i style="color:var(--terra);font-style:normal">*</i>' : ''}</b><small>${f ? `${esc(f.name)} · ${fdate(f.at)}` : 'لم يُرفع بعد — صورة أو PDF حتى 1.4MB'}</small></div>
            ${f ? `<a class="btn btn-g btn-s" href="${fileUrl(f.id)}" target="_blank" rel="noopener">عرض</a>` : ''}
            ${ro ? '' : `<label class="btn btn-g btn-s">${f ? 'استبدال' : '📎 رفع'}<input type="file" data-kind="${kind}" accept="image/*,application/pdf" hidden></label>`}</div>`; };
        return `<form class="card pf-grid" id="pf-f" autocomplete="off">
          <div class="pf-sec">🪪 الهوية الوطنية / الإقامة <span class="sp"></span>${badge(P.sections.id)} ${confBtn('id')}</div>
          ${inp(P, 'national_id', 'رقم الهوية / الإقامة', { req: 1, ltr: 1, ro, ph: '1xxxxxxxxx', extra: 'inputmode="numeric" maxlength="10"' })}
          ${inp(P, 'id_expiry', 'تاريخ الانتهاء', { req: 1, type: 'date', ro })}
          <div>${slot('id_front', 'صورة الهوية — الوجه', 1)}</div><div>${slot('id_back', 'صورة الهوية — الظهر (اختياري)')}</div>
          <div class="pf-sec">🏦 الحساب البنكي (لصرف الراتب) <span class="sp"></span>${badge(P.sections.bank)} ${confBtn('bank')}</div>
          ${inp(P, 'bank_name', 'اسم البنك', { req: 1, ro, list: 'pf-banks' })}<datalist id="pf-banks">${BANKS.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
          ${inp(P, 'holder_name', 'اسم صاحب الحساب', { req: 1, ro, hint: 'كما يظهر في البنك — يُفضَّل أن يطابق اسمك' })}
          ${inp(P, 'iban', 'رقم الآيبان', { req: 1, ltr: 1, ro, full: 1, ph: 'SA00 0000 0000 0000 0000 0000', extra: 'maxlength="34" id="pf-iban"', hint: '<span id="pf-iban-h">يبدأ بـ SA ويليه 22 رقماً</span>' })}
          <div class="pf-sec">📄 مستندات إضافية <small>(اختيارية)</small></div>
          <div>${slot('cv', 'السيرة الذاتية')}</div><div>${slot('degree', 'المؤهل العلمي')}</div>
          ${ro ? '' : '<div class="pf-actions"><button class="btn btn-p" type="submit">حفظ الهوية والبنك</button><span class="pf-meta">🔒 تُعرض كاملة لك وللإدارة والمالية فقط، ومقنّعة لغيرهم</span></div>'}
        </form>`;
      },
      security: () => `<div class="card"><h3>🔑 كلمة المرور</h3>
        <form class="pf-grid" id="pf-pw" autocomplete="off">
          <label class="f"><span>كلمة المرور الحالية</span><input class="inp" type="password" name="current" dir="ltr" autocomplete="current-password"></label><span></span>
          <label class="f"><span>كلمة المرور الجديدة</span><input class="inp" type="password" name="next" dir="ltr" minlength="8" autocomplete="new-password"><small class="muted">8 أحرف على الأقل — يُفضَّل أرقام وحروف ورموز</small></label>
          <label class="f"><span>تأكيدها</span><input class="inp" type="password" name="again" dir="ltr" minlength="8" autocomplete="new-password"></label>
          <div class="pf-actions"><button class="btn btn-p" type="submit">تغيير كلمة المرور</button><span class="pf-meta">يُسجَّل خروجك من الأجهزة الأخرى</span></div></form>
        <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
        <h3>✈️ تلجرام</h3><p class="small">${P.notify?.tg_linked ? `<span class="pf-badge ok">✓ مربوط</span> ${P.notify.tg_username ? '<span dir="ltr">@' + esc(P.notify.tg_username) + '</span>' : ''}` : '<span class="pf-badge warn">غير مربوط</span> اربطه لتصلك المهام والتنبيهات فوراً'}
          <button type="button" class="btn btn-g btn-s" id="pf-tg">${P.notify?.tg_linked ? 'إدارة الربط' : 'ربط تلجرام'}</button></p>
        <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
        <h3>💻 الجلسات</h3><p class="small muted">آخر دخول: <b>${P.user.last_login ? fdate(P.user.last_login) + ' <span class="num">' + esc(String(P.user.last_login).slice(11, 16)) + '</span> UTC' : '—'}</b> · عضو منذ <b>${fdate(P.user.created_at)}</b></p></div>`,
      alerts: () => `<form class="card" id="pf-nt">
        <label class="pf-switch"><input type="checkbox" name="notify_wa" ${P.notify.wa ? 'checked' : ''}><span>تنبيهات واتساب<small>إسناد مهمة أو عميل، ملاحظة إدارية، تقاريري الدورية — على جوالك الشخصي، ولا تُرسل ليلاً (11م–7ص)${P.phone.value ? '' : ' · <b style="color:var(--terra)">أضف جوالك في «بياناتي»</b>'}</small></span></label>
        <label class="pf-switch"><input type="checkbox" name="notify_tg" ${P.notify.tg ? 'checked' : ''}><span>تنبيهات تلجرام<small>${P.notify.tg_linked ? 'حسابك مربوط' : 'اربط حسابك من تبويب «الأمان»'}</small></span></label>
        <p class="small muted">التنبيهات داخل المنصة (🔔) تصلك دائماً.</p>
        <div class="pf-actions"><button class="btn btn-p" type="submit">حفظ التفضيلات</button>${typeof nublDevicesPanel === 'function' ? '<button type="button" class="btn btn-g" id="pf-dev">🔔 إشعارات هذا الجهاز</button>' : ''}${typeof reportsModal === 'function' ? '<button type="button" class="btn btn-g" id="pf-rep">تقاريري الدورية</button>' : ''}</div></form>`,
      work: () => { const w = P.works; const k = (l, v, c = '') => `<div class="kpi ${c}"><div class="l">${l}</div><div class="v num">${v}</div></div>`;
        return `<div class="pf-kpis">${k('مهام مفتوحة', w.tasks_open)}${k('متأخرة', w.tasks_overdue, w.tasks_overdue ? 'warn' : '')}${k('أُنجزت آخر 30 يوماً', w.tasks_done30, 'good')}${k('محتوى هذا الشهر', w.content_month)}${k('نُشر هذا الشهر', w.content_published, 'good')}</div>
          <div class="card"><div class="toolbar" style="margin-bottom:6px"><h3 style="margin:0">⏳ المعلّق عليّ</h3><span class="sp"></span><a class="btn btn-g btn-s" href="#/tasks">كل المهام ←</a></div>
          ${w.open_list.length ? w.open_list.map((t) => `<div class="pf-row"><span>${esc(t.title)}</span><span>${pill(t.status)} ${t.due_date ? `<small class="muted">${fdate(t.due_date)} · ${relDays(t.due_date)}</small>` : ''}</span></div>`).join('') : '<div class="empty">لا مهام مفتوحة 🎉</div>'}</div>`; },
    };
    const show = () => {
      pane.innerHTML = panes[tab]();
      $$('.pf-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
      bindPane();
    };
    const refresh = () => rerender();
    const doConfirm = async (sec, btn) => {
      btn.disabled = true;
      try { const r = await api(`profile/${P.user.id}/confirm`, { method: 'POST', body: { section: sec } }); toast(`أُكّد${r.hr_updated ? ' — وحُدّث سجل الموظف في الموارد البشرية' : ''}`); refresh(); }
      catch (e) { toast(e.message, 1); btn.disabled = false; }
    };
    function bindPane() {
      $$('[data-confirm]', V()).forEach((b) => b.onclick = () => doConfirm(b.dataset.confirm, b));
      const f = $('#pf-f');
      if (f) f.onsubmit = async (e) => {
        e.preventDefault(); const btn = $('button[type=submit]', f); if (btn) btn.disabled = true;
        const body = read(f); delete body.email;
        try { await api(base, { method: 'POST', body }); toast('حُفظت البيانات — بانتظار تأكيد الإدارة'); if (P.own) { S.meta = await api('meta'); renderShell(); } refresh(); }
        catch (er) { toast(er.message, 1); if (btn) btn.disabled = false; }
      };
      $$('input[type=file][data-kind]', pane).forEach((el) => el.onchange = () => uploadKind(el.dataset.kind, el));
      const ib = $('#pf-iban');
      if (ib) ib.oninput = () => { const v = ib.value.replace(/\s+/g, '').toUpperCase(); const ok = /^SA\d{22}$/.test(v);
        $('#pf-iban-h').innerHTML = !v ? 'يبدأ بـ SA ويليه 22 رقماً' : ok ? '<span class="pf-badge ok">✓ صيغة صحيحة</span> <span dir="ltr" class="num">' + esc(v.replace(/(.{4})/g, '$1 ').trim()) + '</span>' : `<span class="pf-badge bad">${v.length}/24</span> يبدأ بـ SA ويليه 22 رقماً`; };
      const pw = $('#pf-pw');
      if (pw) pw.onsubmit = async (e) => { e.preventDefault();
        if (pw.next.value !== pw.again.value) return toast('كلمتا المرور غير متطابقتين', 1);
        try { await api('auth/password', { method: 'POST', body: { current: pw.current.value, next: pw.next.value } }); toast('تم تغيير كلمة المرور'); pw.reset(); } catch (er) { toast(er.message, 1); } };
      $('#pf-tg') && ($('#pf-tg').onclick = () => (typeof telegramMine === 'function' ? telegramMine() : null));
      const nt = $('#pf-nt');
      if (nt) nt.onsubmit = async (e) => { e.preventDefault();
        try { await api('profile', { method: 'POST', body: { notify_wa: nt.notify_wa.checked, notify_tg: nt.notify_tg.checked } }); toast('حُفظت التفضيلات'); P.notify.wa = nt.notify_wa.checked; P.notify.tg = nt.notify_tg.checked; } catch (er) { toast(er.message, 1); } };
      $('#pf-dev') && ($('#pf-dev').onclick = () => nublDevicesPanel());
      $('#pf-rep') && ($('#pf-rep').onclick = () => reportsModal());
    }
    async function uploadKind(kind, el) {
      const file = el.files[0]; el.value = ''; if (!file) return;
      try { toast('جارٍ الرفع…'); const d = await toB64(file); await api(base + '/upload', { method: 'POST', body: { kind, ...d } }); toast(kind === 'avatar' ? 'حُدّثت الصورة' : 'رُفع المستند — بانتظار التأكيد');
        if (kind === 'avatar' && P.own) { S.meta = await api('meta'); renderShell(); }
        refresh(); } catch (e) { toast(e.message, 1); }
    }
    $$('.pf-tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.tab; show(); });
    $$('.pf-complete [data-go]').forEach((a) => a.onclick = () => { tab = a.dataset.go; show(); });
    const av = $('#pf-avatar'); if (av) av.onchange = () => uploadKind('avatar', av);
    show();
    if (pendBox) pendingCard($('#pf-pend'), true);
  } };

  // ---------- ملفات بانتظار التأكيد (الإدارة والمالية) ----------
  async function pendingCard(el, compact) {
    if (!el) return;
    let d; try { d = await api('profile/pending'); } catch { return; }
    if (!el.isConnected) return;
    const pend = d.rows.filter((r) => r.pending.length); const inc = d.rows.filter((r) => r.pct < 100);
    if (compact && !pend.length) { el.innerHTML = ''; return; }
    const lab = { personal: 'البيانات الشخصية', id: 'الهوية', bank: 'البنك' };
    el.innerHTML = `<div class="card pf-pend" style="margin-bottom:14px"><div class="toolbar" style="margin-bottom:6px"><h3 style="margin:0">🪪 ملفات بانتظار التأكيد <span class="pill ${pend.length ? 'o' : 't'}">${pend.length}</span></h3><span class="sp"></span>${inc.length ? `<span class="small muted">${inc.length} ملف غير مكتمل</span>` : ''}</div>
      ${pend.length ? pend.map((r) => `<div class="pf-row"><a href="#/me/${r.id}" class="tm-pf">${avatarHtml(r, 26)} ${esc(r.name)}</a><span>${r.pending.map((s) => `<span class="pf-badge warn">${lab[s]}</span>`).join(' ')} <small class="muted num">${r.pct}%</small></span></div>`).join('') : '<div class="small muted">لا شيء بانتظار التأكيد ✓</div>'}
      ${!compact && inc.length ? `<details style="margin-top:8px"><summary class="small" style="cursor:pointer">غير المكتملة (${inc.length})</summary>${inc.map((r) => `<div class="pf-row"><a href="#/me/${r.id}" class="tm-pf">${avatarHtml(r, 22)} ${esc(r.name)}</a><span class="small muted">${r.never_logged_in ? 'لم يفعّل حسابه بعد · ' : ''}<span class="num">${r.pct}%</span></span></div>`).join('')}</details>` : ''}</div>`;
  }
  if (ROUTES.team) {
    const baseTeam = ROUTES.team.render;
    ROUTES.team.render = async (...a) => {
      await baseTeam(...a);
      if (!['admin', 'manager', 'finance'].includes(me().role)) return;
      const box = document.createElement('div'); V().prepend(box); pendingCard(box, false);
    };
  }

  // ---------- دعوات التفعيل ----------
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('نُسخ الرابط'); } catch { prompt('انسخ الرابط:', t); } };
  window.inviteResult = (u, inv) => {
    if (inv.error && !inv.link) { toast(inv.error, 1); return; }
    const m = modal({ title: `دعوة تفعيل — ${esc(u.name)}`, wide: true, body: `
      ${inv.sent ? `<div class="notice" style="border-inline-start:5px solid var(--teal)">✅ أُرسلت الدعوة عبر واتساب${inv.via === 'template' ? ' (بالقالب المعتمد)' : ''}.</div>`
        : `<div class="notice">⚠️ لم تُرسل عبر واتساب${inv.error ? ': ' + esc(inv.error) : ''}. ${inv.has_phone ? '' : 'لا يوجد جوال للعضو. '}انسخ الرابط وأرسله له بنفسك.</div>`}
      <label class="f"><span>رابط التفعيل (لمرة واحدة · ينتهي ${esc(String(inv.expires_at).slice(0, 16))} UTC)</span><input class="inp" dir="ltr" readonly value="${esc(inv.link)}"></label>
      <details style="margin-top:8px"><summary class="small" style="cursor:pointer">نص رسالة الترحيب</summary><div class="small" style="white-space:pre-wrap;margin-top:6px">${esc(inv.text || '')}</div></details>
      <p class="small muted" style="margin-top:8px">إنشاء رابط جديد يُلغي السابق. لا تُرسل كلمات مرور في المحادثات — العضو يختار كلمته بنفسه.</p>`,
      foot: '<button class="btn btn-p" data-copy>🔗 نسخ الرابط</button><button class="btn btn-g" data-cl>إغلاق</button>' });
    $('[data-copy]', m.el).onclick = () => copy(inv.link);
    $('[data-cl]', m.el).onclick = () => { m.close(); if (S.route === 'team') rerender(); };
  };
  window.inviteModal = async (u) => {
    let st = {}; try { st = await api(`users/${u.id}/invite`); } catch (e) { toast(e.message, 1); return; }
    const l = st.last;
    const stat = !l ? 'لم تُرسل له دعوة بعد.' : l.used_at ? `✅ فُعّل الحساب ${fdate(l.used_at)}.` : l.revoked_at ? 'آخر دعوة أُلغيت.' : `آخر دعوة: ${fdate(l.created_at)} — ${l.sent_at ? `أُرسلت واتساب (${l.sent_via === 'template' ? 'قالب' : 'نص'})` : l.sent_error ? 'لم تُرسل: ' + esc(l.sent_error) : 'رابط للنسخ'} · تنتهي ${esc(String(l.expires_at).slice(0, 16))} UTC`;
    const m = modal({ title: `دعوة تفعيل — ${esc(u.name)}`, body: `<p>${stat}</p><p class="small muted" style="margin-top:6px">ترسل رسالة ترحيب من رقم التسويق فيها رابط لمرة واحدة (72 ساعة) يختار به ${esc(u.name)} كلمة مروره ثم يُكمل ملفه الشخصي.${st.has_phone ? '' : ' <b>لا يوجد جوال للعضو</b> — أضفه أولاً أو انسخ الرابط.'}</p>`,
      foot: `${st.has_phone ? `<button class="btn btn-p" data-send>📲 ${l ? 'إعادة إرسال الدعوة' : 'إرسال الدعوة'} عبر واتساب</button>` : ''}<button class="btn btn-g" data-link>🔗 إنشاء رابط ونسخه</button>` });
    const run = async (send, btn) => { btn.disabled = true; try { const inv = await api(`users/${u.id}/invite`, { method: 'POST', body: { send } }); m.close(); inviteResult(u, inv); if (!send) copy(inv.link); } catch (e) { toast(e.message, 1); btn.disabled = false; } };
    $('[data-send]', m.el) && ($('[data-send]', m.el).onclick = (e) => run(true, e.target));
    $('[data-link]', m.el).onclick = (e) => run(false, e.target);
  };
})();
