/* منصة نُبل وابتكار للتسويق — استوديو الذكاء الاصطناعي
   عرض سعر ذكي بنموذج الكيان (عرض BBR) ← اعتماد الأسعار ← عقد ذكي ← خطة تسويقية ← منشورات الشهر موزعة على التقويم.
   كل المستندات تُنزَّل Word على أوراق الكيان، وكل ما يولّده الذكاء يُحفظ مباشرة في قاعدة البيانات ويظهر في السجلات المرتبطة. */
'use strict';
(function nublStudio() {
  const APPROVERS = ['admin', 'manager', 'finance'];
  const canApprove = () => APPROVERS.includes(me().role);
  const ORD = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً', 'حادي عشر', 'ثاني عشر'];
  const PLAN_STATUS = ['مسودة', 'معتمدة', 'قيد التنفيذ', 'منتهية', 'ملغاة'];
  const parseJ2 = (s, d) => { try { return typeof s === 'string' ? JSON.parse(s) : s || d; } catch { return d; } };
  const bold = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  let STATUS = null;
  const status = async () => (STATUS ||= await api('studio/status').catch(() => ({ ai: false, engines: {} })));

  Object.assign(PILL, { 'معتمدة': 'b', 'قيد التنفيذ': 'g', 'منتهية': 'x', 'يحتاج اعتماد': 'o' });

  // ---------- كيان الخطط + حقول المنشور الجديدة ----------
  ENT.plans = {
    title: 'الخطط التسويقية', one: 'خطة', icon: 'doc', detail: 'plan',
    fields: [
      F('client_id', 'العميل', 'ref', { ref: 'clients', list: 1, filter: 0, req: 1 }), F('title', 'العنوان', 'text', { list: 1, w: 'full' }),
      F('start_date', 'البداية', 'date', { list: 1 }), F('months', 'المدة (شهور)', 'number', { list: 1 }),
      F('status', 'الحالة', 'select', { o: PLAN_STATUS, list: 1, filter: 1, def: 'مسودة' }), F('budget', 'الميزانية الإعلانية'),
      F('goals', 'الأهداف', 'textarea', { w: 'full' }), F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  };
  REF.plans = { label: (r) => r.title || `خطة #${r.id}` };
  (() => {
    const fs = ENT.content.fields; const at = (k) => fs.findIndex((f) => f.k === k);
    if (!fs.some((f) => f.k === 'publish_time')) fs.splice(at('publish_date') + 1, 0, F('publish_time', 'وقت النشر', 'text', { list: 1, hint: 'HH:MM بتوقيت الرياض' }));
    if (!fs.some((f) => f.k === 'hashtags')) fs.splice(at('caption') + 1, 0, F('hashtags', 'الوسوم', 'text', { w: 'full' }), F('cta', 'الدعوة لاتخاذ إجراء', 'text', { w: 'full' }), F('brief', 'وصف التصميم للمصمم', 'textarea', { w: 'full' }));
  })();

  // ---------- أدوات ----------
  function busy(title, msg) {
    const col = '<div class="st-orb"><i></i><i></i><i></i></div>';
    const steps = ['يقرأ بيانات العميل والكتالوج…', 'يحلل القطاع والجمهور والمواسم…', 'يكتب المحتوى بصياغة الكيان…', 'يراجع الأرقام والاتساق…', 'يجهّز المستند على الأوراق الرسمية…'];
    const m = modal({ title, body: `<div class="st-busy">${col}<p>${msg}</p><p class="small" id="bstep">${steps[0]}</p><small class="muted">يعمل ذكاء نُبل الآن — مضى <span class="t3" id="btime">0:00</span> · لا تغلق الصفحة.</small></div>` });
    $('.x', m.el).style.display = 'none';
    const t0 = Date.now(); let k = 0;
    const iv = setInterval(() => { if (!document.body.contains(m.el)) return clearInterval(iv); const s = Math.floor((Date.now() - t0) / 1000); const b = $('#btime', m.el); if (b) b.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (s && s % 12 === 0) { k = Math.min(k + 1, steps.length - 1); const e = $('#bstep', m.el); if (e) e.textContent = steps[k]; } }, 1000);
    return m;
  }
  async function run(title, msg, fn) {
    const m = busy(title, msg);
    try { return await fn(); } catch (e) { toast(e.message, 1); return null; } finally { m.close(); }
  }
  const chips = (name, opts, sel = []) => `<div class="chips" data-chips="${name}">${opts.map(([k, l]) => `<button type="button" class="chipb ${sel.includes(k) ? 'on' : ''}" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
  const wireChips = (el) => $$('[data-chips] .chipb', el).forEach((b) => b.onclick = () => b.classList.toggle('on'));
  const chipVals = (el, name) => $$(`[data-chips="${name}"] .chipb.on`, el).map((b) => b.dataset.v);
  const refVal = (el, name) => { const v = $(`[name="${name}"]`, el)?.value || ''; const m = v.match(/⟨(\d+)⟩\s*$/); return m ? +m[1] : null; };
  // يقبل الاختيار من القائمة أو كتابة الاسم يدوياً: يطابقه مع سجل موجود، وإن كان عميلاً جديداً يُنشئه بعد التأكيد
  const norm = (x) => String(x || '').replace(/[ًٌٍَُِّْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();
  async function partyId(el, name, ent, label) {
    const id = refVal(el, name); if (id) return id;
    const text = ($(`[name="${name}"]`, el)?.value || '').replace(/⟨\d+⟩\s*$/, '').trim();
    if (!text) return null;
    const rows = await refs(ent, true).catch(() => []);
    const hit = rows.filter((r) => [REF[ent]?.label(r), r.name, r.company, r.title].some((v) => v && norm(v) === norm(text)));
    if (hit.length === 1) return hit[0].id;
    const near = rows.filter((r) => [r.name, r.company, r.title].some((v) => v && norm(v).includes(norm(text))));
    if (near.length === 1) return near[0].id;
    if (ent === 'clients' && can('clients', 'w')) {
      if (!(await confirmBox(`«${esc(text)}» غير مسجّل كعميل في المنصة. هل تريد إنشاءه الآن ثم المتابعة؟`))) throw new Error('اختر العميل من القائمة المقترحة');
      const r = await api('e/clients', { method: 'POST', body: { name: text, status: 'نشط' } }); invalidate('clients');
      toast(`أُضيف العميل «${text}»`); return r.row.id;
    }
    throw new Error(near.length > 1 ? `أكثر من ${label} يطابق «${text}» — اختره من القائمة المقترحة` : `لم أجد ${label} باسم «${text}» — اختره من القائمة المقترحة`);
  }
  const word = (kind, id) => { location.href = `${API}studio/doc/${kind}/${id}`; };
  // طباعة / حفظ PDF على الأوراق الرسمية — نفس محتوى ملف Word حرفياً
  const printOfficial = async (kind, id) => {
    const w = window.open('', '_blank'); if (!w) return toast('اسمح بالنوافذ المنبثقة للطباعة', 1);
    w.document.write('<p style="font-family:sans-serif;text-align:center;margin-top:40vh;color:#15556B">جارٍ تجهيز المستند على الأوراق الرسمية…</p>');
    try { const d = await api(`studio/doc/${kind}/${id}?format=html`); w.document.open(); w.document.write(docShell(d.title, d.html, { official: true, fit: kind === 'quote', docx: API + `studio/doc/${kind}/${id}` })); w.document.close(); }
    catch (e) { w.close(); toast(e.message, 1); }
  };
  window.nublPrintOfficial = printOfficial;
  const prBtn = (kind, id) => `<button class="btn btn-g" id="pdf">${I.print} طباعة / PDF</button>`;
  const aiBanner = (st) => (st.ai ? '' : `<div class="notice">الذكاء الاصطناعي غير مفعّل بعد: أضف المفتاح <b dir="ltr">ANTHROPIC_API_KEY</b> في إعدادات مشروع Cloudflare Pages ‹ Settings ‹ Variables and Secrets، ثم أعد النشر.</div>`);

  // ---------- مُعالجات الإنشاء ----------
  async function quoteWizard(preset = {}) {
    await Promise.all(['clients', 'leads', 'deals', 'catalog'].map((r) => refs(r).catch(() => [])));
    const cat = (S.cache.catalog?.rows || []).filter((c) => c.active);
    const groups = [['package', 'الباقات التسويقية'], ['service', 'الخدمات'], ['print', 'المطبوعات']];
    const m = modal({ title: `${I.ai || ''} عرض سعر ذكي`, wide: true, body: `<form class="fgrid st-form">
      <label class="f"><span>العميل</span>${input({ k: 'client_id', t: 'ref', ref: 'clients' }, preset.client_id)}</label>
      <label class="f"><span>أو العميل المحتمل</span>${input({ k: 'lead_id', t: 'ref', ref: 'leads' }, preset.lead_id)}</label>
      <label class="f"><span>الصفقة (اختياري)</span>${input({ k: 'deal_id', t: 'ref', ref: 'deals' }, preset.deal_id)}</label>
      <label class="f"><span>مدة التعاقد (شهور)</span><input class="inp num" type="number" name="months" min="1" max="36" placeholder="مثال: 3"></label>
      <label class="f full"><span>ماذا يحتاج العميل؟ <i>*</i></span><textarea class="inp" name="brief" rows="6" placeholder="مثال: شركة ديكورات GRC في جدة تحتاج صفحة تعريفية تعرض أعمالها وتستقبل طلبات التسعير على واتساب، مع إدارة شهرية ودعم فني. الهدف زيادة طلبات المقاولين والمطورين. يفضّل دومين .com وتصوير مشاريعهم."></textarea>
        <small class="muted">كلما ذكرت الهدف التجاري والنطاق والقيود (المدة، الميزانية، المنصات) كان العرض أدق. أسعار الكتالوج تُطبَّق تلقائياً ولا يغيّرها الذكاء.</small></label>
      <label class="f"><span>ميزانية العميل التقريبية (اختياري)</span><input class="inp" name="budget" placeholder="مثال: 6–8 آلاف تأسيس + شهري"></label>
      <div class="f full"><span class="lbl">خدمات يجب تضمينها من الكتالوج (اختياري)</span>
        ${groups.map(([k, l]) => { const rows = cat.filter((c) => c.kind === k); return rows.length ? `<details class="st-cat"><summary>${l} <span class="muted small">(${rows.length})</span></summary>${chips('svc', rows.map((c) => [String(c.id), `${c.name}${c.kind === 'package' ? ` · ${c.months}ش` : ''}`]), (preset.services || []).map(String))}</details>` : ''; }).join('')}</div>
      </form>`, foot: '<button class="btn btn-p" data-go>توليد العرض</button><button class="btn btn-g" data-x>إلغاء</button>' });
    wireChips(m.el); $('[data-x]', m.el).onclick = m.close;
    $('[data-go]', m.el).onclick = async () => {
      const f = $('form', m.el);
      let body;
      try { body = { client_id: await partyId(f, 'client_id', 'clients', 'عميل'), lead_id: ($('[name=lead_id]', f).value.trim() ? await partyId(f, 'lead_id', 'leads', 'عميل محتمل') : null), deal_id: ($('[name=deal_id]', f).value.trim() ? await partyId(f, 'deal_id', 'deals', 'صفقة') : null), brief: f.brief.value.trim(), budget: f.budget.value.trim(), months: +f.months.value || null, services: chipVals(f, 'svc').map(Number) }; } catch (e) { return toast(e.message, 1); }
      if (!body.client_id && !body.lead_id) return toast('اختر العميل أو العميل المحتمل', 1);
      if (body.brief.length < 15) return toast('صف الاحتياج بجملة أو جملتين على الأقل', 1);
      m.close();
      const r = await run('عرض سعر ذكي', 'يدرس ذكاء نُبل الاحتياج والكتالوج ويكتب العرض بنموذج الكيان…', () => api('studio/quote', { method: 'POST', body }));
      if (r) { invalidate('quotes'); toast(r.review ? `أُنشئ ${r.number} — ${r.review} بند بانتظار اعتماد السعر` : `أُنشئ ${r.number}`); go(`#/quote/${r.id}`); }
    };
  }

  async function planWizard(preset = {}) {
    await refs('clients').catch(() => []);
    const plats = ['إنستقرام', 'تيك توك', 'سناب شات', 'X', 'لينكدإن', 'فيسبوك', 'يوتيوب', 'قوقل بزنس'];
    const m = modal({ title: 'خطة تسويقية ذكية', wide: true, body: `<form class="fgrid st-form">
      <label class="f"><span>العميل <i>*</i></span>${input({ k: 'client_id', t: 'ref', ref: 'clients' }, preset.client_id)}</label>
      <label class="f"><span>تبدأ في</span><input class="inp" type="date" name="start_date" value="${todayStr()}"></label>
      <label class="f"><span>المدة (شهور)</span><select class="inp" name="months">${[1, 3, 6, 12].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="f"><span>الميزانية الإعلانية الشهرية</span><input class="inp" name="budget" placeholder="مثال: 3,000 ر.س"></label>
      <label class="f full"><span>الأهداف والاحتياج</span><textarea class="inp" name="goals" rows="4" placeholder="مثال: زيادة الطلبات عبر واتساب 30٪، إطلاق خط منتجات جديد في نوفمبر، بناء الوعي في جدة ومكة"></textarea></label>
      <label class="f full"><span>الجمهور المستهدف (اختياري)</span><input class="inp" name="audience" placeholder="مثال: سيدات 25–45 في جدة، دخل متوسط إلى مرتفع"></label>
      <div class="f full"><span class="lbl">المنصات المفضلة (اختياري)</span>${chips('pl', plats.map((p) => [p, p]))}</div>
      <label class="f full"><span>ملاحظات إضافية</span><textarea class="inp" name="notes" rows="2" placeholder="منافسون، عروض قادمة، قيود…"></textarea></label></form>`,
    foot: '<button class="btn btn-p" data-go>توليد الخطة</button><button class="btn btn-g" data-x>إلغاء</button>' });
    wireChips(m.el); $('[data-x]', m.el).onclick = m.close;
    $('[data-go]', m.el).onclick = async () => {
      const f = $('form', m.el); let cid; try { cid = await partyId(f, 'client_id', 'clients', 'عميل'); } catch (e) { return toast(e.message, 1); }
      if (!cid) return toast('اختر العميل', 1);
      const body = { client_id: cid, start_date: f.start_date.value, months: +f.months.value, budget: f.budget.value.trim(), goals: f.goals.value.trim(), audience: f.audience.value.trim(), platforms: chipVals(f, 'pl'), notes: f.notes.value.trim() };
      m.close();
      const r = await run('خطة تسويقية ذكية', 'يحلل ذكاء نُبل العميل وقطاعه ومواسم الفترة ويكتب الخطة…', () => api('studio/plan', { method: 'POST', body }));
      if (r) { invalidate('plans'); toast('أُنشئت الخطة'); go(`#/plan/${r.id}`); }
    };
  }

  async function postsWizard(preset = {}) {
    await Promise.all([refs('clients').catch(() => []), refs('plans').catch(() => [])]);
    const plats = ['إنستقرام', 'تيك توك', 'سناب شات', 'X', 'لينكدإن', 'فيسبوك', 'يوتيوب', 'قوقل بزنس'];
    const next = preset.month || todayStr().slice(0, 7);
    const m = modal({ title: 'منشورات الشهر بالذكاء', wide: true, body: `<form class="fgrid st-form">
      <label class="f"><span>العميل <i>*</i></span>${input({ k: 'client_id', t: 'ref', ref: 'clients' }, preset.client_id)}</label>
      <label class="f"><span>الشهر</span><input class="inp" type="month" name="month" value="${next}"></label>
      <label class="f"><span>عدد المنشورات</span><input class="inp num" type="number" name="count" min="1" max="40" placeholder="حسب الباقة (افتراضياً 12)"></label>
      <label class="f"><span>الخطة المرجعية (اختياري)</span>${input({ k: 'plan_id', t: 'ref', ref: 'plans' }, preset.plan_id)}</label>
      <div class="f full"><span class="lbl">المنصات</span>${chips('pl', plats.map((p) => [p, p]), ['إنستقرام', 'تيك توك', 'سناب شات'])}</div>
      <label class="f full"><span>توجيهات (اختياري)</span><textarea class="inp" name="notes" rows="3" placeholder="مثال: عرض الجمعة البيضاء من 25 نوفمبر، التركيز على المنتج الجديد، نبرة ودودة"></textarea></label>
      <p class="small muted full">يكتب الذكاء النص والوسوم والدعوة لاتخاذ إجراء ووصف التصميم، ويوزّع المنشورات على أيام الشهر وأوقات الذروة لكل منصة بتوقيت الرياض، مع مراعاة المواسم والخطة. تُضاف للتقويم بحالة «كتابة» للمراجعة ثم التصميم والاعتماد.</p></form>`,
    foot: '<button class="btn btn-p" data-go>تجهيز المنشورات</button><button class="btn btn-g" data-x>إلغاء</button>' });
    wireChips(m.el); $('[data-x]', m.el).onclick = m.close;
    $('[data-go]', m.el).onclick = async () => {
      const f = $('form', m.el); let cid, pid; try { cid = await partyId(f, 'client_id', 'clients', 'عميل'); pid = $('[name=plan_id]', f).value.trim() ? await partyId(f, 'plan_id', 'plans', 'خطة') : null; } catch (e) { return toast(e.message, 1); }
      if (!cid) return toast('اختر العميل', 1);
      const body = { client_id: cid, month: f.month.value, count: +f.count.value || null, plan_id: pid, platforms: chipVals(f, 'pl'), notes: f.notes.value.trim() };
      m.close();
      const r = await run('منشورات الشهر', 'يكتب ذكاء نُبل المنشورات ويوزّعها على التقويم…', () => api('studio/posts', { method: 'POST', body }));
      if (r) { invalidate('content'); toast(`أُضيف ${r.created} منشوراً إلى تقويم ${r.month}`); S.ct = { month: r.month, client: String(cid) }; go('#/content'); if (S.route === 'content') rerender(); }
    };
  }
  window.studioQuote = quoteWizard; window.studioPlan = planWizard; window.studioPosts = postsWizard;

  // ---------- صفحة الاستوديو ----------
  async function studioView() {
    const st = await status();
    const card = (ic, t, d, btn, id, ok) => `<div class="card st-card"><div class="st-ic">${I[ic] || ''}</div><h3>${t}</h3><p class="muted small">${d}</p>${ok ? `<button class="btn btn-p" id="${id}">${btn}</button>` : '<span class="small muted">لا تملك صلاحية</span>'}</div>`;
    V().innerHTML = `${aiBanner(st)}<div class="st-hero"><div><h2>استوديو ذكاء نُبل</h2><p>من الاحتياج إلى عرض سعر بنموذج الكيان، ثم عقد، ثم خطة تسويقية ومنشورات موزعة على التقويم — وكل شيء يُحفظ مباشرة في المنصة.</p></div>
      <div class="st-flow"><span>عرض سعر</span>←<span>اعتماد الأسعار</span>←<span>عقد</span>←<span>خطة</span>←<span>منشورات</span></div></div>
      <div class="grid g4" style="margin-top:14px">
      ${card('doc', 'عرض سعر ذكي', 'يكتب العرض كاملاً بنموذج عرض BBR المعتمد: المحتوى، العرض المالي (تأسيس/شهري/إضافات)، الجدول والشروط — بأسعار الكتالوج المقفلة.', 'إنشاء عرض', 'sq', can('quotes', 'w'))}
      ${card('sign', 'عقد ذكي', 'يحوّل العرض المعتمد إلى عقد: بنود قياسية ثابتة + نطاق ومخرجات وجدول دفعات يملؤها الذكاء من العرض. يُراجع قانونياً قبل التوقيع.', 'اختيار عرض', 'sc', can('contracts', 'w'))}
      ${card('chart', 'خطة تسويقية', 'تحليل SWOT، أهداف SMART، الجمهور والتموضع، المحاور والقنوات، الإعلانات، خارطة التنفيذ — حسب قطاع العميل ومواسم الفترة.', 'إنشاء خطة', 'sp', can('plans', 'w'))}
      ${card('cal', 'منشورات الشهر', 'نصوص ووسوم ودعوة لاتخاذ إجراء ووصف تصميم، موزعة على أيام الشهر وأوقات الذروة لكل منصة، مباشرة في تقويم المحتوى.', 'تجهيز منشورات', 'ss', can('content', 'w'))}</div>
      <div class="grid g2" style="margin-top:14px"><div class="card"><h3>${I.doc} آخر العروض الذكية</h3><div id="stq"><div class="empty small">…</div></div></div>
        <div class="card"><h3>${I.chart} آخر الخطط</h3><div id="stp"><div class="empty small">…</div></div></div></div>
      <p class="small muted" style="margin-top:10px">المحرك: ${st.engines?.claude ? 'Claude' : ''}${st.engines?.gemini ? `${st.engines?.claude ? ' ← ' : ''}Gemini` : ''}${st.engines?.workers ? ' ← Workers AI (احتياطي)' : ''}. أسعار الكتالوج لا يغيّرها الذكاء، وأي بند خارج الكتالوج يظهر «يحتاج اعتماد» حتى يعتمده المدير العام أو المالية. لا يُرسل شيء للعميل تلقائياً.</p>`;
    $('#sq') && ($('#sq').onclick = () => quoteWizard()); $('#sp') && ($('#sp').onclick = () => planWizard()); $('#ss') && ($('#ss').onclick = () => postsWizard());
    $('#sc') && ($('#sc').onclick = () => go('#/quotes'));
    if (can('quotes')) api('e/quotes?limit=8').then((d) => { $('#stq').innerHTML = d.rows.map((q) => `<a class="list-i" href="#/quote/${q.id}"><div class="g"><b>${esc(q.number)} — ${esc(q.title || '')}</b><span class="small muted">${fdate(String(q.created_at).slice(0, 10))}${q.doc ? ' · ذكاء نُبل' : ''}${q.price_review ? ' · <b style="color:var(--terra)">يحتاج اعتماد</b>' : ''}</span></div>${pill(q.status)} ${money(q.total)}</a>`).join('') || '<div class="empty small">لا عروض بعد</div>'; }).catch(() => {});
    else $('#stq').innerHTML = '<div class="empty small">—</div>';
    if (can('plans')) api('e/plans?limit=8').then(async (d) => { await refs('clients').catch(() => []); $('#stp').innerHTML = d.rows.map((p) => `<a class="list-i" href="#/plan/${p.id}"><div class="g"><b>${esc(p.title || '')}</b><span class="small muted">${esc(refLabel('clients', p.client_id))} · ${p.months} أشهر</span></div>${pill(p.status)}</a>`).join('') || '<div class="empty small">لا خطط بعد</div>'; }).catch(() => {});
    else $('#stp').innerHTML = '<div class="empty small">—</div>';
  }

  // ---------- معاينة عرض السعر (مطابقة لملف Word) ----------
  const amt = (n) => nf.format(Math.round((Number(n) || 0) * 100) / 100);
  function quotePaper(q, doc) {
    const t = doc.totals || {}; const vat = Number(S.meta.settings.vat_rate || 15); let n = 0;
    const H = (x) => `<h4 class="pp-h1">${ORD[n++]}: ${esc(x)}</h4>`;
    const sec = (s) => `${H(s.heading)}${s.intro ? `<p>${bold(s.intro)}</p>` : ''}${s.table?.rows?.length ? `<table class="pp-t"><thead><tr>${(s.table.columns || ['البند', 'التفاصيل']).map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? '' : ' class="k"'}>${bold(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
      ${s.bullets?.length ? `<ul class="pp-ul">${s.bullets.map((b) => `<li>${bold(b)}</li>`).join('')}</ul>` : ''}${s.callout?.text ? `<div class="pp-call">${s.callout.label ? `<b>${esc(s.callout.label)}:</b> ` : ''}${bold(s.callout.text)}</div>` : ''}`;
    const item = (i, unit) => `<tr class="${i.review ? 'rv' : ''}"><td class="k">${esc(i.name)}${Number(i.qty) > 1 ? ` (×${i.qty})` : ''}${i.desc ? `<small>${esc(i.desc)}</small>` : ''}${i.locked ? '<span class="pp-tag lk">كتالوج</span>' : i.review ? '<span class="pp-tag rv">يحتاج اعتماد</span>' : ''}</td>
      <td class="c">${i.price == null ? 'يُحدد' : Number(i.price) === 0 ? 'مشمول' : (i.from ? 'من ' : '') + amt((Number(i.qty) || 1) * i.price) + (unit || i.unit ? ` / ${esc(unit || i.unit)}` : '')}</td></tr>`;
    const tot = (l, v) => `<tr class="tot"><td>${l}</td><td class="c">${amt(v)}</td></tr>`;
    const P = doc.pricing || {};
    const pre = (doc.sections || []).filter((s) => !s.after_pricing).map(sec).join('');
    const fin = (P.setup?.items?.length || P.monthly?.items?.length || P.addons?.items?.length) ? `${H('العرض المالي')}
      ${P.setup?.items?.length ? `<h5 class="pp-h2">${esc(P.setup.title || 'التأسيس (يُدفع مرة واحدة)')}</h5><table class="pp-t"><thead><tr><th>البند</th><th>السعر (ر.س)</th></tr></thead><tbody>${P.setup.items.map((i) => item(i)).join('')}${tot('الإجمالي قبل الضريبة', t.setup)}${tot(`ضريبة القيمة المضافة ${vat}٪`, t.setup_vat)}${tot('الإجمالي شامل الضريبة', t.setup_total)}</tbody></table>` : ''}
      ${P.monthly?.items?.length ? `<h5 class="pp-h2">${esc(P.monthly.title || `الإدارة والتشغيل (شهرياً${t.months > 1 ? ` — حد أدنى ${t.months} أشهر` : ''})`)}</h5><table class="pp-t"><thead><tr><th>البند</th><th>السعر (ر.س)</th></tr></thead><tbody>${P.monthly.items.map((i) => item(i)).join('')}${tot(`ضريبة القيمة المضافة ${vat}٪`, t.monthly_vat)}${tot('الإجمالي الشهري شامل الضريبة', t.monthly_total)}</tbody></table>` : ''}
      ${P.addons?.items?.length ? `<h5 class="pp-h2">${esc(P.addons.title || 'خيارات إضافية للنمو (اختيارية)')}</h5><table class="pp-t"><thead><tr><th>الخيار</th><th>السعر (ر.س)</th></tr></thead><tbody>${P.addons.items.map((i) => item(i)).join('')}</tbody></table>` : ''}
      ${P.perk ? `<div class="pp-call"><b>${esc(P.perk_label || 'ميزة عند التعاقد')}:</b> ${bold(P.perk)}</div>` : ''}` : '';
    const post = (doc.sections || []).filter((s) => s.after_pricing).map(sec).join('');
    const tl = doc.timeline?.length || doc.terms?.length ? `${H(doc.timeline_heading || 'الجدول الزمني والمطلوب منكم')}${doc.timeline?.length ? `<table class="pp-t"><thead><tr><th>المرحلة</th><th>المدة</th></tr></thead><tbody>${doc.timeline.map((x) => `<tr><td class="k">${esc(x.phase)}</td><td class="c">${esc(x.duration)}</td></tr>`).join('')}</tbody></table>` : ''}${doc.terms?.length ? `<ul class="pp-ul">${doc.terms.map((x) => `<li>${bold(x)}</li>`).join('')}</ul>` : ''}` : '';
    return `<div class="paper">
      <p class="pp-date">جدة، في ${fdate(String(q.created_at || todayStr()).slice(0, 10))}</p><h3 class="pp-title">عرض سعر</h3>${doc.subject ? `<p class="pp-sub">${esc(doc.subject)}</p>` : ''}
      <p class="pp-for"><b>أُعِدّ لـ:</b> ${esc(doc.prepared_for || '')}</p><p class="pp-no"><b>رقم العرض:</b> <span dir="ltr">${esc(q.number || '')}</span></p>${doc.intro ? `<p>${bold(doc.intro)}</p>` : ''}
      ${pre}${fin}${post}${tl}
      ${S.meta.settings.bank_line ? `<p class="pp-small"><b>الحساب البنكي:</b> ${esc(S.meta.settings.bank_line)}</p>` : ''}
      <p class="pp-small">هذا عرض مبدئي أُعِدّ خصيصاً للعميل الموجَّه إليه، وجميع الأرقام قابلة للتعديل حتى الاعتماد الخطي النهائي من الطرفين. صالح ${doc.validity_days || 14} يوماً من تاريخه.</p>
      <p class="pp-close">وتفضلوا بقبول فائق الود والتقدير</p><p class="pp-sign"><b>${esc(S.meta.settings.sign_name || 'إياد المغيرة')}</b><br>${esc(S.meta.settings.sign_title || 'مدير قطاع التسويق')}<br>نُبل وابتكار للخدمات التسويقية</p></div>`;
  }

  async function aiQuoteView(q) {
    await Promise.all([refs('clients').catch(() => []), refs('leads').catch(() => [])]);
    const doc = parseJ2(q.doc, {}); const t = doc.totals || {};
    const party = q.client_id ? refLabel('clients', q.client_id) : q.lead_id ? refLabel('leads', q.lead_id) : '';
    const w = can('quotes', 'w');
    $('#ptitle').textContent = `عرض سعر ${q.number}`;
    V().innerHTML = `<div class="toolbar"><a href="#/quotes" class="btn btn-g btn-s">→ عروض الأسعار</a><b>${esc(q.number)}</b> ${pill(q.status)} ${q.price_review ? pill('يحتاج اعتماد') : ''}<span class="sp"></span>
        <button class="btn btn-p" id="wd">${I.doc} تحميل Word</button>${prBtn()}
        ${w ? `<button class="btn btn-g" id="rv">${I.ai || ''} تعديل بالذكاء</button><button class="btn btn-g" id="ed">${I.edit || ''} تحرير</button>` : ''}
        ${q.price_review && canApprove() ? '<button class="btn btn-n" id="ap">اعتماد الأسعار</button>' : ''}
        ${can('contracts', 'w') && !q.price_review && q.status !== 'مرفوض' ? '<button class="btn btn-n" id="tc">تحويل إلى عقد بالذكاء</button>' : ''}</div>
      ${q.price_review ? `<div class="notice">${t.review || ''} بند خارج الكتالوج بسعر مقترح من الذكاء — ${canApprove() ? 'راجع الأسعار (يمكنك تعديلها من «تحرير») ثم اعتمدها قبل الإرسال للعميل.' : 'بانتظار اعتماد المدير العام أو المالية قبل الإرسال للعميل.'}</div>` : ''}
      <div class="st-q"><div class="st-side"><div class="card"><h3>الملخص</h3><dl class="dl">
          <dt>العميل</dt><dd>${q.client_id ? `<a href="#/client/${q.client_id}">${esc(party)}</a>` : q.lead_id ? `<a href="#/lead/${q.lead_id}">${esc(party)}</a>` : '—'}</dd>
          ${t.setup ? `<dt>التأسيس</dt><dd>${money(t.setup)} <small class="muted">+ ضريبة</small></dd>` : ''}
          ${t.monthly ? `<dt>الشهري</dt><dd>${money(t.monthly)} × ${t.months}</dd>` : ''}
          <dt>قيمة التعاقد</dt><dd><b>${money(t.contract_net)}</b><div class="small muted">شامل الضريبة ${moneyTxt(t.contract_total)} ر.س</div></dd>
          <dt>صالح حتى</dt><dd>${fdate(q.valid_until)}</dd><dt>المحرك</dt><dd class="small" dir="ltr">${esc(q.ai_engine || '—')}</dd></dl>
          ${w ? `<label class="f" style="margin-top:10px"><span>الحالة</span><select class="inp" id="qs">${L.quoteStatus.map((s) => `<option ${s === q.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
          ${(() => { const cl = S.cache.clients?.rows.find((c) => c.id == q.client_id) || S.cache.leads?.rows.find((l) => l.id == q.lead_id); return cl?.phone && !q.price_review ? `<a class="btn btn-wa" style="margin-top:10px;width:100%" target="_blank" rel="noopener" href="${waLink(cl.phone, `السلام عليكم ${cl.contact_name || cl.name || ''}،\nيسعدنا مشاركتكم عرض السعر رقم ${q.number}: ${doc.subject || ''}\nقيمة التعاقد ${moneyTxt(t.contract_net)} ر.س قبل الضريبة. نرفق لكم الملف، ونسعد بأي استفسار.\nفريق نُبل وابتكار للتسويق`)}">${I.wa} رسالة للعميل (أرفق ملف Word)</a>` : ''; })()}</div></div>
        <div>${quotePaper(q, doc)}</div></div>`;
    $('#wd').onclick = () => word('quote', q.id); $('#pdf').onclick = () => printOfficial('quote', q.id);
    $('#qs') && ($('#qs').onchange = async (e) => { try { await api(`e/quotes/${q.id}`, { method: 'PUT', body: { status: e.target.value } }); toast('تم تحديث الحالة'); } catch (er) { toast(er.message, 1); } });
    $('#ap') && ($('#ap').onclick = async () => { if (!(await confirmBox(`اعتماد أسعار ${t.review} بند خارج الكتالوج كما هي؟`))) return; try { await api(`studio/quote/${q.id}/approve`, { method: 'POST' }); toast('اعتُمدت الأسعار'); rerender(); } catch (e) { toast(e.message, 1); } });
    $('#tc') && ($('#tc').onclick = () => contractFromQuote(q));
    $('#rv') && ($('#rv').onclick = () => {
      const m = modal({ title: 'تعديل العرض بالذكاء', body: `<label class="f"><span>ما التعديل المطلوب؟</span><textarea class="inp" id="ri" rows="4" placeholder="مثال: أضف قسماً عن خيارات الدومين بعد العرض المالي، واجعل الإدارة الشهرية حد أدنى 6 أشهر، واختصر المقدمة"></textarea></label><p class="small muted">أسعار الكتالوج تبقى كما هي، والبنود الخاصة الجديدة تحتاج اعتماداً.</p>`, foot: '<button class="btn btn-p" data-go>تنفيذ</button>' });
      $('[data-go]', m.el).onclick = async () => { const ins = $('#ri', m.el).value.trim(); if (!ins) return; m.close(); const r = await run('تعديل العرض', 'يعدّل ذكاء نُبل العرض…', () => api(`studio/quote/${q.id}/revise`, { method: 'POST', body: { instruction: ins } })); if (r) { toast('عُدّل العرض'); rerender(); } };
    });
    $('#ed') && ($('#ed').onclick = () => editDoc(q, doc));
  }

  function editDoc(q, doc) {
    const appr = canApprove();
    const groups = [['setup', 'التأسيس'], ['monthly', 'الشهري'], ['addons', 'الإضافات']];
    const row = (g, i, k) => `<div class="st-item" data-g="${g}" data-i="${k}"><input class="inp" data-f="name" value="${esc(i.name)}"><input class="inp" data-f="desc" value="${esc(i.desc || '')}" placeholder="التفصيل">
      <input class="inp num" type="number" data-f="qty" value="${i.qty || 1}" min="1" title="الكمية"><input class="inp num" type="number" step="any" data-f="price" value="${i.price ?? ''}" ${i.locked ? 'disabled title="سعر الكتالوج مقفل"' : ''} placeholder="السعر">
      <span class="small">${i.locked ? '🔒 كتالوج' : i.review ? '<b style="color:var(--terra)">يحتاج اعتماد</b>' : 'معتمد'}</span><button type="button" class="btn btn-d btn-s" data-rm>×</button></div>`;
    const m = modal({ title: `تحرير ${q.number}`, wide: true, body: `<form class="fgrid st-form">
      <label class="f full"><span>عنوان العرض</span><input class="inp" name="subject" value="${esc(doc.subject || '')}"></label>
      <label class="f full"><span>أُعِدّ لـ</span><input class="inp" name="prepared_for" value="${esc(doc.prepared_for || '')}"></label>
      <label class="f full"><span>المقدمة</span><textarea class="inp" name="intro" rows="4">${esc(doc.intro || '')}</textarea></label>
      ${groups.map(([g, l]) => `<div class="f full"><span class="lbl">${l}${g === 'monthly' ? ` — حد أدنى <input class="inp num" style="width:70px;display:inline-block" type="number" name="min_months" value="${doc.pricing?.monthly?.min_months || 0}"> أشهر` : ''}</span>${(doc.pricing?.[g]?.items || []).map((i, k) => row(g, i, k)).join('')}</div>`).join('')}
      <label class="f full"><span>الشروط (سطر لكل شرط)</span><textarea class="inp" name="terms" rows="4">${esc((doc.terms || []).join('\n'))}</textarea></label>
      <label class="f full"><span>ميزة عند التعاقد</span><input class="inp" name="perk" value="${esc(doc.pricing?.perk || '')}"></label>
      <p class="small muted full">${appr ? 'حفظك يعتمد أسعار البنود الخاصة تلقائياً.' : 'تعديل سعر بند خاص يعيده إلى «يحتاج اعتماد».'} لإضافة أقسام أو بنود جديدة استخدم «تعديل بالذكاء».</p></form>`,
    foot: '<button class="btn btn-p" data-sv>حفظ</button><button class="btn btn-g" data-x>إلغاء</button>' });
    $('[data-x]', m.el).onclick = m.close;
    $$('[data-rm]', m.el).forEach((b) => b.onclick = () => b.closest('.st-item').remove());
    $('[data-sv]', m.el).onclick = async () => {
      const f = $('form', m.el); const nd = JSON.parse(JSON.stringify(doc));
      nd.subject = f.subject.value.trim(); nd.prepared_for = f.prepared_for.value.trim(); nd.intro = f.intro.value.trim();
      nd.terms = f.terms.value.split('\n').map((x) => x.trim()).filter(Boolean); nd.pricing.perk = f.perk.value.trim(); nd.pricing.monthly.min_months = +f.min_months.value || 0;
      for (const [g] of groups) {
        nd.pricing[g].items = $$(`.st-item[data-g="${g}"]`, f).map((el) => {
          const o = doc.pricing[g].items[+el.dataset.i]; const v = (k) => $(`[data-f="${k}"]`, el).value;
          return { ...o, name: v('name').trim(), desc: v('desc').trim(), qty: +v('qty') || 1, price: o.locked ? o.price : (v('price') === '' ? null : +v('price')) };
        }).filter((i) => i.name);
      }
      delete nd.totals;
      try { const r = await api(`studio/quote/${q.id}`, { method: 'PUT', body: { doc: nd } }); toast(r.review ? `حُفظ — ${r.review} بند بانتظار الاعتماد` : 'حُفظ'); m.close(); rerender(); } catch (e) { toast(e.message, 1); }
    };
  }

  async function contractFromQuote(q) {
    const m = modal({ title: 'تحويل إلى عقد بالذكاء', body: `<p>سيُنشأ عقد (مسودة) من العرض <b>${esc(q.number)}</b>: يُحوَّل العميل المحتمل إلى عميل عند الحاجة، وتُغلق الصفقة كمكسوبة، ويكتب الذكاء نطاق الخدمات والمخرجات والجدول والشروط الخاصة، والبنود القانونية القياسية ثابتة.</p>
      <label class="f"><span>ملاحظات للعقد (اختياري)</span><textarea class="inp" id="cn" rows="3" placeholder="مثال: البداية 1 نوفمبر، الدومين باسم العميل، فترة إشعار 30 يوماً"></textarea></label>`, foot: '<button class="btn btn-p" data-go>إنشاء العقد</button>' });
    $('[data-go]', m.el).onclick = async () => {
      const notes = $('#cn', m.el).value.trim(); m.close();
      const r = await run('عقد ذكي', 'يصيغ ذكاء نُبل العقد من العرض المعتمد…', () => api(`studio/contract/${q.id}`, { method: 'POST', body: { notes } }));
      if (r) { invalidate('contracts'); invalidate('clients'); toast(`أُنشئ العقد ${r.number}`); go(`#/contract/${r.contract_id}`); }
    };
  }

  // ---------- الخطة ----------
  function planPaper(p, d) {
    let n = 0; const H = (x) => `<h4 class="pp-h1">${ORD[n++]}: ${esc(x)}</h4>`;
    const T = (cols, rows) => (rows?.length ? `<table class="pp-t"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? '' : ' class="k"'}>${bold(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '');
    const sw = d.swot || {}; const j = (a) => (a || []).join(' · ');
    return `<div class="paper"><h3 class="pp-title">الخطة التسويقية</h3><p class="pp-sub">${esc(d.title || p.title || '')}</p>
      <p class="pp-for"><b>أُعِدّت لـ:</b> ${esc(refLabel('clients', p.client_id))} · ${p.months} أشهر تبدأ ${fdate(p.start_date)}</p>
      ${d.summary ? `<p>${bold(d.summary)}</p>` : ''}${d.summary_callout ? `<div class="pp-call"><b>الخلاصة:</b> ${bold(d.summary_callout)}</div>` : ''}
      ${sw.strengths || sw.weaknesses ? H('تحليل الوضع الحالي (SWOT)') + T(['المحور', 'التحليل'], [['نقاط القوة', j(sw.strengths)], ['نقاط الضعف', j(sw.weaknesses)], ['الفرص', j(sw.opportunities)], ['التهديدات', j(sw.threats)]].filter((r) => r[1])) : ''}
      ${d.objectives?.length ? H('الأهداف ومؤشرات الأداء') + T(['الهدف', 'المؤشر (KPI)', 'المستهدف'], d.objectives.map((o) => [o.goal, o.kpi, o.target])) : ''}
      ${d.audience?.length ? H('الجمهور المستهدف') + T(['الشريحة', 'الدافع / الاحتياج', 'الرسالة'], d.audience.map((a) => [a.segment, a.insight, a.message])) : ''}
      ${d.positioning ? H('التموضع والرسالة الرئيسية') + `<p>${bold(d.positioning)}</p>` : ''}
      ${d.pillars?.length ? H('محاور المحتوى') + T(['المحور', 'النسبة', 'أمثلة'], d.pillars.map((x) => [x.name, `${x.share}٪`, j(x.examples)])) : ''}
      ${d.channels?.length ? H('القنوات ووتيرة النشر') + T(['المنصة', 'الدور', 'الوتيرة', 'أفضل الأوقات'], d.channels.map((c) => [c.platform, c.role, c.frequency, c.best_times])) : ''}
      ${d.calendar?.length ? H('خطة الأشهر والمواسم') + T(['الشهر', 'الفكرة الرئيسية', 'المواسم'], d.calendar.map((m) => [m.month, m.theme, j(m.seasons)])) : ''}
      ${d.ads?.split?.length ? H('الإعلانات الممولة') + (d.ads.budget ? `<p>الميزانية المقترحة: <b>${esc(d.ads.budget)}</b></p>` : '') + T(['المنصة / الحملة', 'الهدف', 'النسبة'], d.ads.split.map((a) => [a.channel, a.objective, `${a.pct}٪`])) : ''}
      ${d.roadmap?.length ? H('خارطة التنفيذ') + T(['المرحلة', 'المدة', 'الإجراءات'], d.roadmap.map((r) => [r.phase, r.duration, j(r.actions)])) : ''}
      ${d.risks?.length ? H('المخاطر والمعالجة') + T(['الخطر', 'المعالجة'], d.risks.map((r) => [r.risk, r.mitigation])) : ''}
      ${d.next_steps?.length ? H('الخطوات التالية') + `<ul class="pp-ul">${d.next_steps.map((x) => `<li>${bold(x)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  async function planView(id) {
    await refs('clients').catch(() => []);
    const { row: p } = await api(`e/plans/${id}`);
    const d = parseJ2(p.doc, {}); const w = can('plans', 'w');
    $('#ptitle').textContent = p.title || 'الخطة التسويقية';
    V().innerHTML = `<div class="toolbar"><a href="#/plans" class="btn btn-g btn-s">→ الخطط</a>${pill(p.status)}<span class="sp"></span>
      <button class="btn btn-p" id="wd">${I.doc} تحميل Word</button>${prBtn()}
      ${w ? `<button class="btn btn-g" id="rv">${I.ai || ''} تعديل بالذكاء</button>` : ''}
      ${can('content', 'w') ? '<button class="btn btn-n" id="ps">توليد منشورات من الخطة</button>' : ''}
      ${w ? `<select class="inp" id="pst" style="max-width:150px">${PLAN_STATUS.map((s) => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select>` : ''}</div>
      <div class="st-plan">${planPaper(p, d)}</div>`;
    $('#wd').onclick = () => word('plan', p.id); $('#pdf').onclick = () => printOfficial('plan', p.id);
    $('#ps') && ($('#ps').onclick = () => postsWizard({ client_id: p.client_id, plan_id: p.id, month: (p.start_date || todayStr()).slice(0, 7) }));
    $('#pst') && ($('#pst').onchange = async (e) => { try { await api(`e/plans/${p.id}`, { method: 'PUT', body: { status: e.target.value } }); toast('تم'); } catch (er) { toast(er.message, 1); } });
    $('#rv') && ($('#rv').onclick = () => {
      const m = modal({ title: 'تعديل الخطة بالذكاء', body: '<textarea class="inp" id="ri" rows="4" placeholder="مثال: ركّز على تيك توك وسناب، وارفع الميزانية الإعلانية إلى 5,000 ر.س، وأضف حملة رمضان"></textarea>', foot: '<button class="btn btn-p" data-go>تنفيذ</button>' });
      $('[data-go]', m.el).onclick = async () => { const ins = $('#ri', m.el).value.trim(); if (!ins) return; m.close(); const r = await run('تعديل الخطة', 'يعدّل ذكاء نُبل الخطة…', () => api(`studio/plan/${p.id}/revise`, { method: 'POST', body: { instruction: ins } })); if (r) { toast('عُدّلت الخطة'); rerender(); } };
    });
  }

  // ---------- تصدير المنشورات للجدولة ----------
  async function exportPosts() {
    const st = S.ct || { month: todayStr().slice(0, 7) };
    const [yy, mm] = st.month.split('-').map(Number); const from = `${st.month}-01`; const to = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
    const qs = new URLSearchParams({ limit: 2000, gte_publish_date: from, lte_publish_date: to }); if (st.client) qs.set('f_client_id', st.client);
    const { rows } = await api(`e/content?${qs}`);
    if (!rows.length) return toast('لا منشورات في هذا الشهر', 1);
    await refs('clients').catch(() => []);
    const head = ['العميل', 'التاريخ', 'الوقت', 'المنصة', 'الصيغة', 'المحور', 'العنوان', 'النص', 'الوسوم', 'الدعوة لاتخاذ إجراء', 'وصف التصميم', 'رابط التصميم', 'الحالة', 'Text (للجدولة)'];
    const data = rows.sort((a, b) => (a.publish_date + (a.publish_time || '')).localeCompare(b.publish_date + (b.publish_time || ''))).map((r) => [refLabel('clients', r.client_id), r.publish_date, r.publish_time || '', r.platform, r.format, r.pillar, r.title, r.caption, r.hashtags, r.cta, r.brief, r.asset_link, r.status, [r.caption, r.hashtags].filter(Boolean).join('\n\n')]);
    const csv = '﻿' + [head, ...data].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `منشورات-${st.month}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- التسجيل والربط بالشاشات القائمة ----------
  ROUTES.studio = { title: 'استوديو ذكاء نُبل', render: studioView };
  ROUTES.plans = { ent: 'plans', render: () => listView('plans', { onAdd: () => planWizard() }) };
  ROUTES.plan = { title: 'الخطة التسويقية', render: planView };

  // نغلّف دوال الشاشات نفسها (لا مسارات فقط) لأن الشاشات تستدعي نفسها عند التنقل الداخلي (تبويبات، أشهر، حفظ)
  const baseQuote = quoteView;
  quoteView = async function (id) {
    const qid = String(id || '').split('?')[0];
    if (/^\d+$/.test(qid)) {
      const { row } = await api(`e/quotes/${qid}`);
      if (row.doc) return aiQuoteView(row);
      await baseQuote(id);
      const tb = $('.toolbar', V());
      if (tb && !$('#wd', tb)) { tb.insertAdjacentHTML('beforeend', `<button class="btn btn-g" id="wd">${I.doc} Word</button>`); $('#wd').onclick = () => word('quote', qid); }
      const pr0 = $('#pr', tb); if (pr0) pr0.onclick = () => printOfficial('quote', qid);
      if (tb && can('contracts', 'w') && !$('#tca', tb)) { tb.insertAdjacentHTML('beforeend', '<button class="btn btn-g" id="tca">عقد بالذكاء</button>'); $('#tca').onclick = () => contractFromQuote(row); }
      return;
    }
    await baseQuote(id);
    const tb = $('.toolbar', V());
    if (tb && can('quotes', 'w') && !$('#aiq', tb)) { tb.insertAdjacentHTML('beforeend', `<button class="btn btn-n" id="aiq">${I.ai || ''} عرض ذكي بدلاً من ذلك</button>`); $('#aiq').onclick = () => { const p = new URLSearchParams(location.hash.split('?')[1] || ''); quoteWizard({ client_id: +p.get('client') || null, lead_id: +p.get('lead') || null }); }; }
  };
  const baseContract = contractView;
  contractView = async function (id) {
    await baseContract(id);
    const tb = $('.toolbar', V());
    const prc = $('#pr', tb); if (prc) { prc.innerHTML = `${I.print} طباعة / PDF`; prc.onclick = () => printOfficial('contract', id); }
    if (tb && !$('#wd', tb)) { const pr = $('#pr', tb); (pr || tb).insertAdjacentHTML(pr ? 'beforebegin' : 'beforeend', `<button class="btn btn-p" id="wd">${I.doc} تحميل العقد Word</button>`); $('#wd').onclick = () => word('contract', id); }
  };
  ROUTES.contract.render = contractView;
  const baseClient = clientView;
  clientView = async function (id, t) {
    await baseClient(id, t);
    const tb = $('.toolbar', V()); if (!tb || $('#aist', tb)) return;
    const btns = [can('quotes', 'w') && ['aiq', 'عرض ذكي', () => quoteWizard({ client_id: +id })], can('plans', 'w') && ['aip', 'خطة تسويقية', () => planWizard({ client_id: +id })], can('content', 'w') && ['aic', 'منشورات الشهر', () => postsWizard({ client_id: +id })]].filter(Boolean);
    if (!btns.length) return;
    tb.insertAdjacentHTML('beforeend', `<span id="aist" class="st-chipset">${btns.map(([k, l]) => `<button class="btn btn-g btn-s" id="${k}">${I.ai || ''} ${l}</button>`).join('')}</span>`);
    btns.forEach(([k, , fn]) => { $('#' + k).onclick = fn; });
  };
  const baseLead = leadView;
  leadView = async function (id, ...r) {
    await baseLead(id, ...r);
    const tb = $('.toolbar', V()); if (!tb || $('#aiq', tb) || !can('quotes', 'w')) return;
    tb.insertAdjacentHTML('beforeend', `<button class="btn btn-g" id="aiq">${I.ai || ''} عرض سعر ذكي</button>`); $('#aiq').onclick = () => quoteWizard({ lead_id: +id });
  };
  ROUTES.lead.render = leadView;
  const baseContent = contentView;
  contentView = async function (...a) {
    await baseContent(...a);
    const tb = $('.toolbar', V()); if (!tb || $('#expo', tb)) return;
    tb.insertAdjacentHTML('beforeend', `${can('content', 'w') ? `<button class="btn btn-n" id="aipo">${I.ai || ''} منشورات بالذكاء</button>` : ''}<button class="btn btn-g btn-s" id="expo">تصدير للجدولة</button>`);
    $('#aipo') && ($('#aipo').onclick = () => postsWizard({ client_id: S.ct?.client ? +S.ct.client : null, month: S.ct?.month }));
    $('#expo').onclick = exportPosts;
  };
  ROUTES.content.render = contentView;

  const css = document.createElement('style');
  css.textContent = `
  .st-hero{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;background:linear-gradient(135deg,var(--deep,#082A37),var(--navy,#15556B));color:#fff;border-radius:18px;padding:20px 22px}
  .st-hero h2{margin:0 0 4px;font-size:22px}.st-hero p{margin:0;opacity:.85;max-width:620px;font-size:14px}
  .st-flow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;opacity:.9}.st-flow span{background:#ffffff1f;border-radius:99px;padding:4px 11px}
  .st-card{display:flex;flex-direction:column;gap:8px}.st-card h3{margin:0}.st-card p{flex:1;margin:0}.st-ic svg{width:34px;height:34px}
  .st-busy{text-align:center;padding:18px 6px}.st-busy p{font-weight:600;margin:14px 0 4px}
  .st-orb{display:inline-flex;gap:7px}.st-orb i{width:12px;height:12px;border-radius:50%;background:var(--gold,#DC9C47);animation:stb 1s infinite ease-in-out}.st-orb i:nth-child(2){animation-delay:.15s;background:var(--teal,#308D8B)}.st-orb i:nth-child(3){animation-delay:.3s;background:var(--terra,#D2652A)}
  @keyframes stb{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-8px);opacity:1}}
  .st-cat{border:1px solid var(--line);border-radius:10px;padding:6px 10px;margin-top:6px}.st-cat summary{cursor:pointer;font-weight:600;font-size:13px}.st-cat .chips{margin-top:8px}
  .st-q{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;align-items:start}.st-side{position:sticky;top:80px}
  .st-item{display:grid;grid-template-columns:2fr 2fr 60px 110px auto auto;gap:6px;align-items:center;margin-top:6px}
  .st-chipset{display:inline-flex;gap:6px;flex-wrap:wrap}
  .paper{background:url(brand/lh-top.png) top center/100% auto no-repeat,url(brand/lh-bottom.png) bottom center/100% auto no-repeat,url(brand/lh-strip.png) right top/5.72% auto repeat-y,#fff;border:1px solid var(--line);border-radius:6px;padding:25% 11.5% 15.5% 9.5%;color:#1E3E4A;font-size:14px;line-height:1.8;max-width:860px;box-shadow:0 1px 0 var(--line)}
  .paper p{margin:0 0 10px;text-align:justify}.pp-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E8EEF0;padding-bottom:10px;margin-bottom:12px}.pp-head{border-bottom:2px solid #18566D!important}.pp-head img{height:44px}.pp-head span{color:#18566D;font-weight:700;letter-spacing:.12em;font-size:12px}.pp-title,.pp-h1,.pp-h2{font-family:var(--f-ar)}
  .pp-date{color:#3E5A66;font-size:12.5px}.pp-title{text-align:center;color:#18566D;font-size:24px;margin:4px 0}.pp-sub{text-align:center!important;color:#D06429;font-weight:700;font-size:15.5px}
  .pp-for{background:#CCE2E2;padding:4px 10px;border-radius:6px}.pp-for b{color:#D06429}.pp-no{font-size:12.5px}
  .pp-h1{color:#18566D;font-size:17px;border-bottom:2px solid #D06429;padding-bottom:4px;margin:20px 0 10px}.pp-h2{color:#D06429;font-size:14.5px;margin:14px 0 6px}
  .pp-t{width:100%;border-collapse:collapse;font-size:12.8px;margin-bottom:10px}.pp-t th{background:#18566D;color:#fff;padding:6px 8px;font-weight:600}.pp-t td{border:1px solid #C5D5DA;padding:6px 8px;vertical-align:top}
  .pp-t td.k{color:#18566D;font-weight:700}.pp-t td.c{text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums}.pp-t td small{display:block;color:#3E5A66;font-weight:400}.pp-t tr.tot td{background:#E8EEF0;color:#18566D;font-weight:700}
  .pp-t tr.rv td{background:#FBF0EA}.pp-tag{display:inline-block;font-size:10.5px;border-radius:99px;padding:0 7px;margin-inline-start:6px;font-weight:600}.pp-tag.lk{background:#E8EEF0;color:#18566D}.pp-tag.rv{background:#F3D8CA;color:#A8501F}
  .pp-call{background:#CCE2E2;border-inline-start:5px solid #D06429;padding:8px 12px;margin:8px 0 12px;font-size:13px}
  .pp-ul{margin:4px 0 10px;padding-inline-start:20px}.pp-ul li::marker{color:#D06429}
  .pp-small{font-size:12px;color:#333}.pp-close{text-align:center!important;color:#18566D;font-weight:700;margin-top:18px!important}.pp-sign{text-align:center!important;color:#3E5A66;font-size:13px}.pp-sign b{color:#18566D;font-size:15px}
  @media(max-width:900px){.st-q{grid-template-columns:1fr}.st-side{position:static}.paper{padding:25% 12% 16% 6%;font-size:13px}.pp-t{font-size:12px}.st-item{grid-template-columns:1fr 1fr}
    .pp-t{display:block;overflow-x:auto}}`;
  document.head.appendChild(css);

  const baseShell = renderShell;
  renderShell = function () {
    const g = NAV.find((x) => x[0] === 'العملاء والعقود');
    if (g && !g[1].some((i) => i[0] === 'studio')) g[1].unshift(['studio', 'استوديو الذكاء', 'ai']);
    const o = NAV.find((x) => x[0] === 'التشغيل');
    if (o && !o[1].some((i) => i[0] === 'plans')) o[1].splice(2, 0, ['plans', 'الخطط التسويقية', 'chart', 'plans', 'plan']);
    baseShell();
  };
})();
