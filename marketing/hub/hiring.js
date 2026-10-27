/* التوظيف (v16): الوظائف المعلنة في صفحة «انضم إلينا» + طلبات التقديم ومراحلها
   - #/applications قائمة الطلبات (تصفية بالوظيفة والمرحلة) · #/application/<id> ملف المتقدم: المرحلة، التقييم، الملاحظات، السيرة، واتساب
   - #/jobs الوظائف: إضافة وتعديل وفتح/إغلاق، والمهارات والبرامج وأنواع الدوام تتحكم في نموذج التقديم مباشرة
   الصلاحية: الدور (admin/manager كتابة، executive اطلاع) + قسم «الموارد البشرية». لا حذف: تُغلق الوظيفة ويُستبعد الطلب. */
(() => {
  const STATUSES = ['جديد', 'قيد الفرز', 'مقابلة', 'عرض وظيفي', 'مقبول', 'معتذر عنه', 'انسحب'];
  const EXPERIENCE = ['أقل من سنة', 'من سنة إلى سنتين', 'من 3 إلى 5 سنوات', 'أكثر من 5 سنوات'];
  const START = ['خلال أسبوع', 'خلال أسبوعين', 'خلال شهر', 'أكثر من شهر'];
  Object.assign(PILL, { 'قيد الفرز': 'g', 'مقابلة': 'o', 'عرض وظيفي': 'o', 'مقبول': 't', 'معتذر عنه': 'x', 'انسحب': 'x', 'مفتوحة': 't', 'مغلقة': 'x' });
  const CAREERS = location.origin + '/marketing/careers';
  const jobLink = (j) => CAREERS + (j.slug ? '?job=' + encodeURIComponent(j.slug) : '');
  const stars = (n) => (n ? '★'.repeat(n) + '<span class="muted">' + '★'.repeat(5 - n) + '</span>' : '<span class="muted">—</span>');
  const waLink = (p, name, job) => `https://wa.me/${String(p || '').replace(/\D/g, '')}?text=${encodeURIComponent(`مرحباً ${String(name || '').split(' ')[0]}، معك فريق نُبل وابتكار للخدمات التسويقية بخصوص طلبك لوظيفة «${job || ''}».`)}`;

  const jobF = F('job_id', 'الوظيفة', 'select', { o: [], filter: 1 });
  ENT.applications = {
    title: 'طلبات التوظيف', one: 'طلب', icon: 'team', detail: 'application',
    fields: [
      F('number', 'الرقم', 'text', { list: 1, ro: 1 }), F('name', 'الاسم', 'text', { list: 1, req: 1 }), F('job_title', 'الوظيفة', 'text', { list: 1, ro: 1 }), jobF,
      F('phone', 'الجوال', 'text'), F('email', 'البريد', 'text'), F('city', 'المدينة', 'text', { list: 1 }),
      F('experience', 'الخبرة', 'select', { o: EXPERIENCE, list: 1 }), F('mode', 'الدوام', 'text', { list: 1 }), F('salary', 'الراتب المتوقع', 'text', { list: 1 }),
      F('start_when', 'المباشرة', 'select', { o: START }), F('status', 'المرحلة', 'select', { o: STATUSES, list: 1, filter: 1, def: 'جديد' }),
      F('rating', 'التقييم', 'number'), F('portfolio', 'معرض الأعمال', 'url'), F('cv_link', 'رابط السيرة', 'url'), F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
      F('created_at', 'تاريخ التقديم', 'date', { list: 1, ro: 1 }),
    ],
  };
  ENT.jobs = {
    title: 'الوظائف المعلنة', one: 'وظيفة', icon: 'brief',
    fields: [
      F('title', 'المسمى الوظيفي', 'text', { list: 1, req: 1, w: 'full' }),
      F('slug', 'الرمز في الرابط', 'text', { list: 1, req: 1, hint: 'بالإنجليزية بلا مسافات، مثل designer — يظهر في رابط التقديم' }),
      F('status', 'الحالة', 'select', { o: ['مفتوحة', 'مغلقة'], list: 1, filter: 1, def: 'مفتوحة' }),
      F('location', 'المقر', 'text', { list: 1, def: 'جدة — حي الحمدانية' }), F('sort', 'الترتيب', 'number', { def: 10 }),
      F('summary', 'نبذة قصيرة (تظهر في بطاقة الوظيفة)', 'textarea', { rows: 2 }), F('details', 'تفاصيل الوظيفة', 'textarea', { rows: 4 }),
      F('modes', 'أنواع الدوام المتاحة (نوع في كل سطر)', 'lines', { def: JSON.stringify(['حضوري في جدة']), hint: 'نوع واحد = يظهر للمتقدم معلومةً ثابتة لا سؤالاً' }),
      F('skills', 'المهارات التي يختار منها المتقدم (مهارة في كل سطر)', 'lines'), F('tools', 'البرامج (برنامج في كل سطر)', 'lines'),
      F('extra_q', 'سؤال الختام (اختياري)', 'text', { w: 'full', hint: 'مثال: أفضل عمل صممتِه ولماذا؟' }),
    ],
  };

  // القائمة: ضمن «الموارد البشرية»
  const g = NAV.find((x) => x[0] === 'الموارد البشرية');
  const items = [['applications', 'طلبات التوظيف', 'team', 'applications', 'application'], ['jobs', 'الوظائف المعلنة', 'brief', 'jobs']];
  if (g) items.forEach((it) => { if (!g[1].some((i) => i[0] === it[0])) g[1].unshift(it); });
  else NAV.push(['الموارد البشرية', items]);

  async function loadJobs() { const { rows } = await api('e/jobs?limit=200'); jobF.o = rows.map((j) => [j.id, j.title]); return rows; }

  ROUTES.applications = { ent: 'applications', render: async () => {
    await loadJobs().catch(() => []);
    await listView('applications', { noAdd: true, extra: `<a class="btn btn-g btn-s" href="${CAREERS}" target="_blank" rel="noopener">صفحة التقديم ↗</a>` });
  } };

  ROUTES.jobs = { ent: 'jobs', render: () => listView('jobs', {
    rowActions: (j) => `<button class="btn btn-g btn-s" data-copy="${esc(jobLink(j))}">نسخ رابط التقديم</button>`,
    after: () => $$('[data-copy]').forEach((b) => b.onclick = async (e) => { e.stopPropagation();
      try { await navigator.clipboard.writeText(b.dataset.copy); toast('نُسخ رابط التقديم'); } catch { prompt('انسخ الرابط:', b.dataset.copy); } }),
  }) };

  /* ---------- ملف المتقدم ---------- */
  ROUTES.application = { title: 'طلب توظيف', render: async (id, sub, seq) => {
    const { row: a } = await api('e/applications/' + id);
    if (seq !== S.renderSeq) return;
    $('#ptitle').textContent = `${a.name} — ${a.job_title || 'طلب توظيف'}`;
    const w = can('applications', 'w');
    const chipsOf = (v) => parseJ(v, []).map((x) => `<span class="pill b" style="margin:0 0 4px 4px">${esc(x)}</span>`).join('') || '<span class="muted">—</span>';
    const row = (l, v) => `<div class="list-i"><div class="g"><span class="small muted">${l}</span><b>${v}</b></div></div>`;
    const cvBtn = a.cv_chunks ? `<a class="btn btn-p btn-s" href="${API}applications/${a.id}/cv" target="_blank" rel="noopener">📎 السيرة الذاتية</a>`
      : a.cv_link ? `<a class="btn btn-p btn-s" href="${esc(a.cv_link)}" target="_blank" rel="noopener">📎 السيرة (رابط) ↗</a>` : '';
    V().innerHTML = `<div class="toolbar"><a class="btn btn-g btn-s" href="#/applications">→ كل الطلبات</a><span class="sp"></span>
        ${a.phone ? `<a class="btn btn-n btn-s" href="${waLink(a.phone, a.name, a.job_title)}" target="_blank" rel="noopener">واتساب</a><a class="btn btn-g btn-s" href="tel:+${esc(a.phone)}">اتصال</a>` : ''}
        ${a.email ? `<a class="btn btn-g btn-s" href="mailto:${esc(a.email)}">البريد</a>` : ''}</div>
      <div class="grid g2">
        <div>
          <div class="card"><h3>${esc(a.name)} <span class="sp"></span>${pill(a.status)}</h3>
            <div class="small muted" style="margin-bottom:10px"><span class="num">${esc(a.number || '')}</span> · ${esc(a.job_title || '')} · قُدّم ${fdate(a.created_at)}${a.submits > 1 ? ` · حُدّث ${a.submits - 1} مرة (آخرها ${fdate(a.updated_at)})` : ''}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">${a.portfolio ? `<a class="btn btn-p btn-s" href="${esc(a.portfolio)}" target="_blank" rel="noopener">🎨 معرض الأعمال ↗</a>` : ''}${cvBtn}</div></div>
          <div class="card" style="margin-top:14px"><h3>المرحلة</h3>
            <div style="display:flex;gap:6px;flex-wrap:wrap" id="ap-st">${STATUSES.map((s) => `<button class="btn btn-s ${s === a.status ? 'btn-p' : 'btn-g'}" data-st="${s}" ${w ? '' : 'disabled'}>${s}</button>`).join('')}</div>
            <h3 style="margin-top:16px">التقييم</h3>
            <div id="ap-rt" style="font-size:24px;letter-spacing:4px;color:var(--gold)">${[1, 2, 3, 4, 5].map((n) => `<button data-rt="${n}" ${w ? '' : 'disabled'} aria-label="${n} من 5" style="background:none;border:0;cursor:pointer;font:inherit;color:${n <= (a.rating || 0) ? 'var(--gold)' : 'rgba(62,90,102,.28)'}">★</button>`).join('')}</div>
            <h3 style="margin-top:16px">دعوة المقابلة</h3>
            ${a.interview_sent_at ? `<div class="small" style="margin-bottom:8px">${a.interview_status === 'مؤكد' ? '✅ <b>أكّد الحضور</b>' : a.interview_status === 'ملاحظات' ? '💬 <b>أرسل ملاحظات</b>' : '📨 <b>مدعو</b> — بانتظار تأكيده'} · ${esc(a.interview_mode || 'حضوري')} · <span class="num">${esc(a.interview_at || '')}</span> · أُرسلت ${fdate(a.interview_sent_at)}${a.interview_note ? `<div style="white-space:pre-wrap;margin-top:4px;padding:8px;background:var(--bg2,#F4F7F8);border-radius:8px">${esc(a.interview_note)}</div>` : ''}</div>` : '<div class="small muted" style="margin-bottom:8px">لم تُرسل دعوة بعد</div>'}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><input class="inp" type="date" id="iv-d" value="${esc(String(a.interview_at || '').slice(0, 10))}" ${w ? '' : 'disabled'}><input class="inp" type="time" id="iv-t" value="${esc(String(a.interview_at || '').slice(11, 16))}" ${w ? '' : 'disabled'}>
              <select class="inp" id="iv-m" ${w ? '' : 'disabled'}><option ${a.interview_mode !== 'فيديو' ? 'selected' : ''}>حضوري</option><option ${a.interview_mode === 'فيديو' ? 'selected' : ''}>فيديو</option></select>
              <input class="inp" id="iv-n" placeholder="ملاحظة في الدعوة (اختياري)" maxlength="300" ${w ? '' : 'disabled'}></div>
            ${w ? `<button class="btn btn-p btn-s" id="iv-send" style="margin-top:8px">📨 ${a.interview_sent_at ? 'إعادة إرسال الدعوة' : 'إرسال دعوة المقابلة عبر واتساب'}</button>` : ''}
            ${a.interview_at ? `<div class="small" style="margin-top:10px">${a.gcal_id ? '📅 في تقويم Google' : '📅 ليس في التقويم بعد'}${a.meet_link ? ` · <a href="${esc(a.meet_link)}" target="_blank" rel="noopener">رابط Meet ↗</a>` : ''}${a.followup_task_id ? ` · <a href="#/tasks">مهمة المتابعة ↗</a>` : ''}
              ${w ? `<button class="btn btn-g btn-s" id="iv-sched" style="margin-inline-start:6px">🗓️ ${a.gcal_id ? 'تحديث الجدولة' : 'جدولة (تقويم + Meet + مهمة)'}</button>` : ''}</div>` : ''}
            ${a.status === 'معتذر عنه' ? `<h3 style="margin-top:16px">رسالة الاعتذار</h3><div class="small muted" style="margin-bottom:8px">${a.regret_sent_at ? `✅ أُرسلت ${fdate(a.regret_sent_at)} — نحتفظ ببياناته لاحتياج مستقبلي` : 'لم تُرسل بعد — تشكره وتخبره أننا نحتفظ ببياناته لأي احتياج أو وظيفة مستقبلية'}</div>${w ? `<button class="btn btn-g btn-s" id="rg-send">💌 ${a.regret_sent_at ? 'إعادة إرسال رسالة الاعتذار' : 'إرسال رسالة الاعتذار عبر واتساب'}</button>` : ''}` : ''}
            <h3 style="margin-top:16px">ملاحظات المقابلة والفرز</h3>
            <textarea class="inp" id="ap-notes" rows="5" ${w ? '' : 'readonly'} placeholder="انطباعك عن الأعمال، نتيجة المقابلة، الخطوة التالية…">${esc(a.notes || '')}</textarea>
            ${w ? '<button class="btn btn-p btn-s" id="ap-save" style="margin-top:8px">حفظ الملاحظات</button>' : ''}</div>
        </div>
        <div class="card"><h3>بيانات الطلب</h3>
          ${row('الجوال (واتساب)', `<span class="num" dir="ltr">${esc(a.phone || '—')}</span>`)}${row('البريد', `<span dir="ltr">${esc(a.email || '—')}</span>`)}
          ${row('المدينة والحي', esc(a.city || '—'))}${row('سنوات الخبرة', esc(a.experience || '—'))}${row('نوع الدوام', esc(a.mode || '—'))}
          ${row('الراتب المتوقع', `<span class="num">${esc(a.salary || '—')}</span> ر.س`)}${row('موعد المباشرة', esc(a.start_when || '—'))}
          <div class="list-i"><div class="g"><span class="small muted">المهارات</span><div>${chipsOf(a.skills)}</div></div></div>
          <div class="list-i"><div class="g"><span class="small muted">البرامج</span><div>${chipsOf(a.tools)}</div></div></div>
          ${a.answer ? `<div class="list-i"><div class="g"><span class="small muted">إجابة سؤال الختام</span><div style="white-space:pre-wrap">${esc(a.answer)}</div></div></div>` : ''}
        </div>
      </div>`;
    // بطاقة العرض الوظيفي (تظهر عند مرحلة «عرض وظيفي» أو «مقبول» أو عند وجود عرض)
    if (['عرض وظيفي', 'مقبول'].includes(a.status) || w) {
      const host = document.createElement('div'); host.className = 'card'; host.style.marginTop = '14px'; host.innerHTML = '<h3>📄 العرض الوظيفي</h3><div class="small muted">جارٍ التحميل…</div>';
      $('.grid.g2 > div', V()).appendChild(host);
      offerCard(host, a, w).catch((e) => { host.innerHTML = `<h3>📄 العرض الوظيفي</h3><div class="small muted">${esc(e.message)}</div>`; });
    }
    const put = async (data, msg) => { try { await api('e/applications/' + a.id, { method: 'PUT', body: data }); invalidate('applications'); toast(msg); rerender(); } catch (e) { toast(e.message, 1); } };
    $$('[data-st]').forEach((b) => b.onclick = () => b.dataset.st !== a.status && put({ status: b.dataset.st }, `المرحلة: ${b.dataset.st}`));
    $$('[data-rt]').forEach((b) => b.onclick = () => put({ rating: +b.dataset.rt === a.rating ? null : +b.dataset.rt }, 'تم حفظ التقييم'));
    const sv = $('#ap-save'); if (sv) sv.onclick = () => put({ notes: $('#ap-notes').value }, 'تم حفظ الملاحظات');
    const sc = $('#iv-sched'); if (sc) sc.onclick = async () => {
      if (!(await confirmBox(`جدولة مقابلة <b>${esc(a.name)}</b>؟<br><small>حدث في تقويم Google${a.interview_mode === 'فيديو' ? ' مع رابط Meet' : ''}، ورسالة تأكيد للمتقدم على واتساب، ومهمة متابعة.</small>`))) return;
      sc.disabled = true;
      try { const r = await api(`applications/${a.id}/schedule`, { method: 'POST', body: {} }); invalidate('applications'); toast(`التقويم: ${r.calendar} · واتساب: ${r.wa}${r.meet ? ' · Meet جاهز' : ''}`); rerender(); }
      catch (e) { toast(e.message, 1); sc.disabled = false; }
    };
    const rg = $('#rg-send'); if (rg) rg.onclick = async () => {
      if (!(await confirmBox(`إرسال رسالة الاعتذار إلى <b>${esc(a.name)}</b> على واتساب؟`))) return;
      rg.disabled = true;
      try { await api(`applications/${a.id}/regret`, { method: 'POST', body: {} }); invalidate('applications'); toast('أُرسلت رسالة الاعتذار ✓'); rerender(); }
      catch (e) { toast(e.message, 1); rg.disabled = false; }
    };
    const iv = $('#iv-send'); if (iv) iv.onclick = async () => {
      const at = `${$('#iv-d').value} ${$('#iv-t').value}`; if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(at)) return toast('حدد التاريخ والوقت', 1);
      if (!(await confirmBox(`إرسال دعوة المقابلة إلى <b>${esc(a.name)}</b> على واتساب؟<br><small>${esc(at)} · ${esc($('#iv-m').value)}</small>`))) return;
      iv.disabled = true;
      try { const r = await api(`applications/${a.id}/invite`, { method: 'POST', body: { at, mode: $('#iv-m').value, note: $('#iv-n').value } }); invalidate('applications'); toast(`أُرسلت الدعوة ✓ (${r.via === 'template' ? 'قالب' : 'نص'})`); rerender(); }
      catch (e) { toast(e.message, 1); iv.disabled = false; }
    };
  } };

  /* ---------- العرض الوظيفي: مسودة → اعتماد مدير التسويق → اعتماد الرئيس التنفيذي → إرسال → قبول ---------- */
  Object.assign(PILL, { 'بانتظار مدير التسويق': 'o', 'بانتظار الرئيس التنفيذي': 'o', 'معتمد': 't', 'مرسل': 'b' });
  async function offerCard(host, a, w) {
    const d = await api(`applications/${a.id}/offer`);
    const o = d.offer; const c = d.can; const J = (v) => parseJ(v, []);
    const ap = o ? parseJ(o.approvals, []) : [];
    const STEP = { submit: '📝 أُرسل للاعتماد', manager: '✅ اعتماد مدير التسويق', ceo: '🖋️ اعتماد الرئيس التنفيذي', return: '↩️ أُعيد للمسودة', send: '📨 أُرسل للمرشح' };
    if (!o && !w) { host.innerHTML = '<h3>📄 العرض الوظيفي</h3><div class="small muted">لا عرض بعد</div>'; return; }
    const ro = o && !c.edit;
    const f = (k, l, type, v, extra = '') => `<label class="f${type === 'textarea' ? ' full' : ''}"><span>${l}</span>${type === 'textarea' ? `<textarea class="inp" name="${k}" rows="4" ${ro ? 'readonly' : ''}>${esc(v)}</textarea>` : `<input class="inp${type === 'number' ? ' num' : ''}" type="${type}" name="${k}" value="${esc(v)}" ${ro ? 'readonly' : ''} ${extra}>`}</label>`;
    host.innerHTML = `<h3>📄 العرض الوظيفي ${o ? pill(o.status) : '<span class="pill x">لا عرض بعد</span>'}${o ? ` <span class="small muted num">${esc(o.number)}</span>` : ''}</h3>
      ${ap.length ? `<div class="small" style="margin:6px 0 10px;line-height:1.9">${ap.map((x) => `${STEP[x.step] || x.step} — ${esc(x.by)} <span class="muted num">${fdate(x.at)}</span>${x.note ? ` · <i>${esc(x.note)}</i>` : ''}`).join('<br>')}</div>` : ''}
      ${o && o.status === 'مقبول' ? `<div class="notice">🎉 قبِل/ت العرض${(() => { const e = parseJ(o.esign, null); return e ? ` — ${esc(e.name)} · ${esc(e.at)} · رمز <span class="num" dir="ltr">${esc(e.code)}</span>` : ''; })()}${o.response_note ? `<br>💬 ${esc(o.response_note)}` : ''}</div>` : o && o.status === 'مرفوض' ? `<div class="notice">✖️ اعتذر/ت عن العرض${o.response_note ? ` — ${esc(o.response_note)}` : ''}</div>` : o && o.response_note ? `<div class="notice">💬 استفسار المرشح: ${esc(o.response_note)}</div>` : ''}
      <form class="fgrid" id="of-form">
        ${f('salary', 'الراتب الشهري الإجمالي (ر.س)', 'number', o?.salary ?? a.salary?.replace(/\D/g, '') ?? '')}${f('salary_note', 'ملاحظة الراتب', 'text', o?.salary_note ?? 'قابل للزيادة بعد اجتياز فترة التجربة')}
        ${f('start_date', 'تاريخ المباشرة', 'date', o?.start_date ?? '')}${f('probation_days', 'فترة التجربة (يوم)', 'number', o?.probation_days ?? 90)}
        ${f('hours', 'الدوام', 'text', o?.hours ?? 'دوام كامل حضوري — 8 ساعات يومياً، 5 أيام أسبوعياً')}${f('location', 'مقر العمل', 'text', o?.location ?? 'جدة — حي الحمدانية')}
        ${f('duties', 'المهام والمسؤوليات (سطر لكل مهمة)', 'textarea', o ? J(o.duties).join('\n') : '')}${f('benefits', 'المزايا (سطر لكل ميزة)', 'textarea', o ? J(o.benefits).join('\n') : '')}
        ${f('valid_days', 'صلاحية العرض (أيام)', 'number', o?.valid_days ?? 5)}
      </form>
      ${o ? `<div class="small muted" style="margin-top:8px">${o.jd ? `📘 يتضمن الخطاب الوصف الوظيفي المعتمد كاملاً (${esc(parseJ(o.jd, {}).source || '')}): بطاقة الوظيفة، الهدف، 4 أقسام للمهام، المهارات، 7 مؤشرات أداء، الطاقة والحدود، التجربة والتقييم.` : 'بلا وصف وظيفي مضمّن.'}${me().role === 'admin' ? ' <button type="button" class="btn btn-g btn-s" data-of="jd">📘 تضمين/تحديث الوصف الوظيفي المعتمد</button>' : ''}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
        ${w && c.edit ? '<button class="btn btn-p btn-s" data-of="save">💾 حفظ المسودة</button>' : ''}
        ${w && c.submit ? '<button class="btn btn-n btn-s" data-of="submit">📝 إرسال لاعتماد مدير التسويق</button>' : ''}
        ${c.approve_mgr ? '<button class="btn btn-p btn-s" data-of="approve">✅ اعتماد مدير التسويق</button>' : ''}
        ${c.approve_ceo ? '<button class="btn btn-p btn-s" data-of="approve">🖋️ اعتماد الرئيس التنفيذي</button>' : ''}
        ${c.send ? `<button class="btn btn-wa btn-s" data-of="send">📨 ${o.status === 'مرسل' ? 'إعادة إرسال للمرشح' : 'إرسال للمرشح عبر واتساب'}</button>` : ''}
        ${c.reject ? '<button class="btn btn-g btn-s" data-of="reject">↩️ إعادة للمسودة</button>' : ''}
        ${o ? `<button class="btn btn-g btn-s" data-of="print">🖨️ طباعة / PDF</button><a class="btn btn-g btn-s" href="${API}studio/doc/offer/${o.id}">Word</a>` : ''}
        ${o?.link ? `<button class="btn btn-g btn-s" data-of="copy" data-link="${esc(o.link)}">🔗 نسخ رابط العرض</button>` : ''}
      </div>`;
    const form = $('#of-form', host);
    const vals = () => Object.fromEntries([...form.elements].filter((e) => e.name).map((e) => [e.name, e.value]));
    const act = async (sub, body, msg, confirmMsg) => {
      if (confirmMsg && !(await confirmBox(confirmMsg))) return;
      try { await api(`applications/${a.id}/offer${sub ? '/' + sub : ''}`, { method: 'POST', body }); toast(msg); invalidate('applications'); offerCard(host, a, w); } catch (e) { toast(e.message, 1); }
    };
    $$('[data-of]', host).forEach((b) => b.onclick = async () => {
      const k = b.dataset.of;
      if (k === 'save') return act('', vals(), 'حُفظت مسودة العرض');
      if (k === 'submit') { if (c.edit && o) await api(`applications/${a.id}/offer`, { method: 'POST', body: vals() }).catch(() => {}); return act('submit', {}, 'أُرسل العرض لاعتماد مدير التسويق', `إرسال عرض <b>${esc(a.name)}</b> لاعتماد مدير التسويق؟`); }
      if (k === 'approve') return act('approve', {}, 'تم الاعتماد ✓', `اعتماد العرض الوظيفي لـ <b>${esc(a.name)}</b> (${esc(String(o.salary))} ر.س)؟`);
      if (k === 'reject') { const note = prompt('سبب الإعادة للمسودة (اختياري):') ?? null; if (note === null) return; return act('reject', { note }, 'أُعيد العرض للمسودة'); }
      if (k === 'send') return act('send', {}, 'أُرسل العرض للمرشح ✓', `إرسال العرض إلى <b>${esc(a.name)}</b> على واتساب برابط القبول؟`);
      if (k === 'jd') return act('jd', {}, 'ضُمّن الوصف الوظيفي المعتمد في العرض');
      if (k === 'print') return window.nublPrintOfficial ? window.nublPrintOfficial('offer', o.id) : toast('افتح الاستوديو أولاً', 1);
      if (k === 'copy') { try { await navigator.clipboard.writeText(b.dataset.link); toast('نُسخ الرابط'); } catch { prompt('انسخ الرابط:', b.dataset.link); } }
    });
  }

  // إن سبق الإقلاعُ تحميلَ هذه الوحدة: أعد بناء القائمة والصفحة
  if (S.meta && $('.side')) { renderShell(); rerender(); }
})();
