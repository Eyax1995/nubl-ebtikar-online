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
    const put = async (data, msg) => { try { await api('e/applications/' + a.id, { method: 'PUT', body: data }); invalidate('applications'); toast(msg); rerender(); } catch (e) { toast(e.message, 1); } };
    $$('[data-st]').forEach((b) => b.onclick = () => b.dataset.st !== a.status && put({ status: b.dataset.st }, `المرحلة: ${b.dataset.st}`));
    $$('[data-rt]').forEach((b) => b.onclick = () => put({ rating: +b.dataset.rt === a.rating ? null : +b.dataset.rt }, 'تم حفظ التقييم'));
    const sv = $('#ap-save'); if (sv) sv.onclick = () => put({ notes: $('#ap-notes').value }, 'تم حفظ الملاحظات');
    const iv = $('#iv-send'); if (iv) iv.onclick = async () => {
      const at = `${$('#iv-d').value} ${$('#iv-t').value}`; if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(at)) return toast('حدد التاريخ والوقت', 1);
      if (!(await confirmBox(`إرسال دعوة المقابلة إلى <b>${esc(a.name)}</b> على واتساب؟<br><small>${esc(at)} · ${esc($('#iv-m').value)}</small>`))) return;
      iv.disabled = true;
      try { const r = await api(`applications/${a.id}/invite`, { method: 'POST', body: { at, mode: $('#iv-m').value, note: $('#iv-n').value } }); invalidate('applications'); toast(`أُرسلت الدعوة ✓ (${r.via === 'template' ? 'قالب' : 'نص'})`); rerender(); }
      catch (e) { toast(e.message, 1); iv.disabled = false; }
    };
  } };

  // إن سبق الإقلاعُ تحميلَ هذه الوحدة: أعد بناء القائمة والصفحة
  if (S.meta && $('.side')) { renderShell(); rerender(); }
})();
