/* جلسات التشخيص (v19) — تقويم مخصص + ملف تحضير لكل جلسة + إعدادات الحجز وربط Google
   #/diag التقويم الأسبوعي (أو قائمة على الجوال) مع مؤشرات القياس · #/session/<id> ملف الجلسة: الموعد والاجتماع، التحليل بالذكاء (ملخص، جاهزية، تحديات،
   فرص، أسئلة مقترحة، أجندة 45 دقيقة، الباقة المرشحة)، إجابات الاستبيان، الحالة والنتيجة والملاحظات. العميل لا يرى أسماء الفريق؛ هنا يراها الجميع. */
'use strict';
(function nublDiag() {
  const MODE = { video: '🎥 مرئي', phone: '📞 مكالمة' };
  const STP = { 'محجوزة': 'b', 'مؤكدة': 't', 'تمت': 'g', 'لم يحضر': 'r', 'ملغاة': 'x' };
  Object.assign(PILL, STP);
  const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const t12 = (t) => { const [h, m] = String(t).split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; };
  const dayOf = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
  const addD = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const weekStart = (d) => addD(d, -((dayOf(d) + 1) % 7)); // الأسبوع يبدأ السبت
  const css = document.createElement('style');
  css.textContent = `.wk-grid{display:grid;gap:6px}.wk-col{background:var(--soft,#F6F3EC);border-radius:12px;padding:8px;min-height:120px}
  .wk-col h4{margin:0 0 6px;font-size:13px;color:var(--deep)}.wk-col.today{outline:2px solid var(--gold,#DC9C47)}
  .ses{display:block;background:#fff;border:1px solid var(--line);border-inline-start:4px solid var(--teal,#308D8B);border-radius:10px;padding:7px 9px;margin-bottom:6px;text-decoration:none;color:inherit;font-size:12.5px}
  .ses b{display:block;font-size:13px}.ses.st-ملغاة{opacity:.5;border-inline-start-color:#999}.ses.st-تمت{border-inline-start-color:#1F6B69}.ses.st-لم.يحضر{border-inline-start-color:#A3401C}
  .kpis6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:12px}@media(max-width:900px){.kpis6{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .brief h4{margin:14px 0 6px;color:var(--deep)}.brief ul{margin:0;padding-inline-start:18px}.brief li{margin:3px 0}
  .score{display:flex;align-items:center;gap:12px}.score .ring{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:18px;background:conic-gradient(var(--teal,#308D8B) calc(var(--v)*1%),#E6EDF0 0)}
  .score .ring span{background:#fff;width:50px;height:50px;border-radius:50%;display:grid;place-items:center}
  .agenda{border-collapse:collapse;width:100%}.agenda td{border-bottom:1px dashed var(--line);padding:6px 4px;vertical-align:top;font-size:13px}.agenda td:first-child{white-space:nowrap;color:var(--muted);width:70px}
  .qa{font-size:13px}.qa dt{color:var(--muted);margin-top:8px}.qa dd{margin:2px 0 0;font-weight:600;white-space:pre-wrap}`;
  document.head.appendChild(css);

  // القائمة: «جلسات التشخيص» ضمن المبيعات
  const g = NAV.find((x) => x[0] === 'المبيعات و CRM');
  if (g && !g[1].some((i) => i[0] === 'diag')) g[1].splice(1, 0, ['diag', 'جلسات التشخيص', 'cal', 'leads', 'session']);

  /* ---------- التقويم ---------- */
  let wk = null;
  async function diagView() {
    const seq = S.renderSeq; wk ||= weekStart(todayStr());
    const to = addD(wk, 6);
    const [d, st] = await Promise.all([api(`sessions?from=${wk}&to=${to}`), api('sessions/stats')]);
    if (seq !== S.renderSeq) return;
    const days = [...Array(7)].map((_, i) => addD(wk, i)).filter((x) => d.cfg.days.includes(dayOf(x)));
    const pct = (v) => (v == null ? '—' : v + '%');
    V().innerHTML = `<div class="kpis6">${[
        ['قادمة', st.upcoming], ['تمت (90 يوماً)', st.done], ['نسبة الحضور', pct(st.show_rate)], ['أكملوا الاستبيان', pct(st.survey_rate)], ['تحولت لعرض سعر', pct(st.quote_rate)], ['تحولت لتعاقد', pct(st.win_rate)],
      ].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v num">${v ?? 0}</div></div>`).join('')}</div>
      <div class="toolbar" style="flex-wrap:wrap;gap:8px"><button class="btn btn-g btn-s" data-w="-7">→ الأسبوع السابق</button><button class="btn btn-g btn-s" data-w="0">هذا الأسبوع</button><button class="btn btn-g btn-s" data-w="7">الأسبوع التالي ←</button>
        <b style="margin-inline-start:8px">${fdate(wk)} — ${fdate(to)}</b><span class="sp"></span>
        ${d.google ? '<span class="pill t">Google Meet مربوط</span>' : '<a class="pill o" href="#/settings">اربط Google لروابط Meet</a>'}
        <button class="btn btn-p btn-s" id="cp-book">نسخ رابط الحجز</button></div>
      <div class="wk-grid" style="grid-template-columns:repeat(${days.length},minmax(0,1fr))">${days.map((x) => {
        const list = d.rows.filter((r) => r.start_at.slice(0, 10) === x);
        return `<div class="wk-col ${x === todayStr() ? 'today' : ''}"><h4>${DAYS[dayOf(x)]} <span class="num muted">${+x.slice(8)}/${+x.slice(5, 7)}</span></h4>${list.map((r) => `<a class="ses st-${r.status.replace(' ', '.')}" href="#/session/${r.id}">
          <b class="num">${t12(r.start_at.slice(11))}</b>${esc(r.company || r.name)}<br><span class="muted">${MODE[r.mode] || ''} · ${r.survey_done ? '✅ استبيان' : '⏳ استبيان'}${r.host_name ? ' · ' + esc(r.host_name.split(' ')[0]) : ''}</span>
          <br>${pill(r.status)}</a>`).join('') || '<div class="small muted">—</div>'}</div>`;
      }).join('')}</div>
      <p class="small muted" style="margin-top:10px">ساعات الحجز: ${t12(d.cfg.from)} — ${t12(d.cfg.to)} · الجلسة ${d.cfg.len} دقيقة + ${d.cfg.gap} فاصل · الحجز قبل ${d.cfg.notice} ساعة على الأقل. التعديل من الإعدادات.</p>`;
    $$('[data-w]').forEach((b) => b.onclick = () => { wk = +b.dataset.w ? addD(wk, +b.dataset.w) : weekStart(todayStr()); rerender(); });
    $('#cp-book').onclick = async () => { try { await navigator.clipboard.writeText(d.book_link); toast('نُسخ رابط الحجز العام'); } catch { prompt('رابط الحجز:', d.book_link); } };
  }
  ROUTES.diag = { title: 'جلسات التشخيص', render: diagView };

  /* ---------- ملف الجلسة ---------- */
  const list = (a) => (Array.isArray(a) && a.length ? `<ul>${a.map((x) => `<li>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul>` : '<p class="muted small">—</p>');
  function briefHtml(b) {
    if (!b) return '<div class="empty small">لم يُحلَّل بعد — يُحلَّل آلياً عند إكمال العميل للاستبيان، أو اضغط «تحليل الآن».</div>';
    const r = b.readiness || {}; const p = b.profile || {};
    return `<div class="brief"><p>${esc(b.summary || '')}</p>
      <div class="score"><div class="ring" style="--v:${Number(r.score) || 0}"><span class="num">${Number(r.score) || 0}</span></div><div><b>الجاهزية: ${esc(r.label || '')}</b>${list(r.reasons)}</div></div>
      <h4>ملف النشاط</h4><dl class="qa">${[['النشاط', p.activity], ['المرحلة', p.stage], ['القنوات', p.channels], ['الجمهور', p.audience], ['الميزانية', p.budget]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <div class="grid g2"><div><h4>⚠️ التحديات</h4>${list(b.challenges)}</div><div><h4>✨ الفرص السريعة</h4>${list(b.opportunities)}</div></div>
      <div class="grid g2"><div><h4>🚩 إشارات حذر</h4>${list(b.risks)}</div><div><h4>🔎 نتحقق منه في الجلسة</h4>${list(b.verify)}</div></div>
      <h4>📋 قبل الجلسة</h4>${list(b.prep)}
      <h4>❓ الأسئلة المقترحة</h4><ol>${(b.questions || []).map((q) => `<li><b>${esc(q.q || q)}</b>${q.why ? `<br><span class="small muted">${esc(q.why)}</span>` : ''}</li>`).join('')}</ol>
      <h4>⏱️ إدارة الجلسة (45 دقيقة)</h4><table class="agenda">${(b.agenda || []).map((a) => `<tr><td class="num">${esc(a.min || '')}</td><td><b>${esc(a.title || '')}</b><br><span class="small muted">${esc(a.goal || '')}</span></td></tr>`).join('')}</table>
      ${b.recommendation ? `<h4>🎯 الترشيح والخطوة التالية</h4><p><b>${esc(b.recommendation.package || '')}</b> — ${esc(b.recommendation.why || '')}<br><span class="small">${esc(b.recommendation.next || '')}</span></p>` : ''}</div>`;
  }
  async function sessionView(id) {
    const seq = S.renderSeq;
    const d = await api('sessions/' + id); if (seq !== S.renderSeq) return;
    const s = d.row; const w = can('leads', 'w');
    $('#ptitle').textContent = `جلسة ${s.number} — ${s.company || s.name}`;
    const ans = s.survey || {};
    V().innerHTML = `<div class="toolbar" style="flex-wrap:wrap;gap:8px"><a class="btn btn-g btn-s" href="#/diag">→ التقويم</a><span class="sp"></span>
        ${s.mode === 'video' ? (s.meet_link ? `<a class="btn btn-p btn-s" href="${esc(s.meet_link)}" target="_blank" rel="noopener">🎥 دخول الاجتماع</a>` : (w ? '<button class="btn btn-p btn-s" id="mk-meet">إنشاء رابط Meet</button>' : '')) : `<a class="btn btn-p btn-s" href="tel:+${esc(s.phone || '')}">📞 اتصال ${esc(s.phone || '')}</a>`}
        ${s.phone ? `<a class="btn btn-g btn-s" href="https://wa.me/${esc(s.phone)}" target="_blank" rel="noopener">واتساب</a>` : ''}
        ${w ? `<button class="btn btn-g btn-s" data-rm="reminder">تذكير العميل</button>${s.survey_at ? '' : '<button class="btn btn-g btn-s" data-rm="survey">تذكير بالاستبيان</button>'}` : ''}</div>
      <div class="grid g2"><div>
        <div class="card"><h3>${esc(s.name)}${s.company ? ' — ' + esc(s.company) : ''} <span class="sp"></span>${pill(s.status)}</h3>
          <div class="list-i"><div class="g"><span class="small muted">الموعد</span><b>${fdate(s.start_at)} · <span class="num">${t12(s.start_at.slice(11))}</span> (${MODE[s.mode]})</b></div></div>
          <div class="list-i"><div class="g"><span class="small muted">التواصل</span><b><span class="num" dir="ltr">${esc(s.phone || '—')}</span>${s.email ? ` · <span dir="ltr">${esc(s.email)}</span>` : ''}</b></div></div>
          <div class="list-i"><div class="g"><span class="small muted">المصدر</span><b>${esc(s.source || '—')}${d.lead ? ` · <a href="#/lead/${d.lead.id}">ملف العميل المحتمل</a>` : ''}</b></div></div>
          ${s.notes_client ? `<div class="list-i"><div class="g"><span class="small muted">طلب العميل عند الحجز</span><b>${esc(s.notes_client)}</b></div></div>` : ''}
          ${d.quotes.length ? `<div class="list-i"><div class="g"><span class="small muted">عروضه</span><b>${d.quotes.map((q) => `<a href="#/quote/${q.id}">${esc(q.number)}</a> ${pill(q.status)}`).join(' · ')}</b></div></div>` : ''}
          <div class="small muted" style="margin-top:8px">رابط العميل لإدارة حجزه: <a href="${esc(d.manage)}" target="_blank" rel="noopener">فتح ↗</a></div></div>
        ${w ? `<div class="card" style="margin-top:14px"><h3>الحالة والنتيجة</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${d.statuses.map((x) => `<button class="btn btn-s ${x === s.status ? 'btn-p' : 'btn-g'}" data-st="${x}">${x}</button>`).join('')}</div>
          <label class="f" style="margin-top:12px"><span>يدير الجلسة (داخلي — لا يظهر للعميل)</span><select class="inp" id="host"><option value="">— الفريق —</option>${S.meta.users.filter((u) => u.active).map((u) => `<option value="${u.id}" ${u.id === s.host_id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
          <label class="f"><span>نتيجة الجلسة ومخرجات التشخيص</span><textarea class="inp" id="outcome" rows="4" placeholder="ما الذي خرجنا به؟ الاحتياج، الميزانية، الباقة المناسبة، الخطوة التالية…">${esc(s.outcome || '')}</textarea></label>
          <label class="f"><span>ملاحظات داخلية</span><textarea class="inp" id="notes" rows="2">${esc(s.notes || '')}</textarea></label>
          ${s.mode === 'video' ? `<label class="f"><span>رابط الاجتماع (يدوي عند الحاجة)</span><input class="inp" id="meet" dir="ltr" value="${esc(s.meet_link || '')}" placeholder="https://meet.google.com/..."></label>` : ''}
          <button class="btn btn-p btn-s" id="save">حفظ</button></div>` : ''}
        <div class="card" style="margin-top:14px"><h3>📝 إجابات الاستبيان ${s.survey_at ? `<span class="small muted">· ${fdate(s.survey_at)}</span>` : ''}</h3>
          ${s.survey_at ? `<dl class="qa">${d.questions.map((q) => { const v = ans[q.id]; const t = Array.isArray(v) ? v.join('، ') : v; return t ? `<dt>${esc(q.label)}</dt><dd>${esc(t)}</dd>` : ''; }).join('')}</dl>` : '<div class="empty small">لم يكمل العميل الاستبيان بعد.</div>'}</div>
      </div>
      <div class="card"><h3>🤖 ملف التحضير والتحليل <span class="sp"></span>${w ? `<button class="btn btn-g btn-s" id="an">${s.brief ? 'إعادة التحليل' : 'تحليل الآن'}</button>` : ''}</h3>
        ${s.brief_at ? `<p class="small muted">حُلّل ${fdate(s.brief_at)}${s.brief_engine ? ' · ' + esc(String(s.brief_engine).split(' ')[0]) : ''}</p>` : ''}${briefHtml(s.brief)}</div></div>`;
    const put = async (body, msg) => { try { await api('sessions/' + id, { method: 'PUT', body }); toast(msg); rerender(); } catch (e) { toast(e.message, 1); } };
    $$('[data-st]').forEach((b) => b.onclick = () => b.dataset.st !== s.status && put({ status: b.dataset.st }, 'الحالة: ' + b.dataset.st));
    const sv = $('#save'); if (sv) sv.onclick = () => put({ host_id: $('#host').value || null, outcome: $('#outcome').value, notes: $('#notes').value, ...($('#meet') ? { meet_link: $('#meet').value.trim() } : {}) }, 'تم الحفظ');
    const an = $('#an'); if (an) an.onclick = async () => { an.disabled = true; an.textContent = 'جارٍ التحليل… (حتى دقيقة)'; try { await api(`sessions/${id}/analyze`, { method: 'POST' }); toast('اكتمل التحليل'); rerender(); } catch (e) { toast(e.message, 1); an.disabled = false; an.textContent = 'تحليل الآن'; } };
    const mk = $('#mk-meet'); if (mk) mk.onclick = async () => { mk.disabled = true; try { await api(`sessions/${id}/meet`, { method: 'POST' }); toast('أُنشئ رابط الاجتماع وأُرسل للعميل'); rerender(); } catch (e) { toast(e.message, 1); mk.disabled = false; } };
    $$('[data-rm]').forEach((b) => b.onclick = async () => { b.disabled = true; try { await api(`sessions/${id}/remind`, { method: 'POST', body: { kind: b.dataset.rm } }); toast('أُرسل للعميل على واتساب'); } catch (e) { toast(e.message, 1); } b.disabled = false; });
  }
  ROUTES.session = { title: 'جلسة تشخيص', render: (id) => sessionView(String(id).split('?')[0]) };

  /* ---------- في صفحة العميل المحتمل: جلساته + إرسال رابط الحجز ---------- */
  const lr = ROUTES.lead;
  if (lr) { const base = lr.render; lr.render = async (...a) => { await base(...a); try { await leadCard(a[0]); } catch (e) { console.warn('diag', e.message); } }; }
  async function leadCard(id) {
    if (!/^\d+$/.test(String(id))) return; const seq = S.renderSeq;
    const d = await api('sessions?lead_id=' + id); if (seq !== S.renderSeq) return;
    $('#diag-card')?.remove();
    const c = document.createElement('div'); c.className = 'card'; c.id = 'diag-card'; c.style.marginTop = '14px';
    c.innerHTML = `<h3>📅 جلسات التشخيص <span class="sp"></span>${can('leads', 'w') ? '<button class="btn btn-p btn-s" id="inv">إرسال رابط حجز جلسة</button>' : ''}</h3>
      ${d.rows.length ? d.rows.map((r) => `<a class="list-i" href="#/session/${r.id}"><div class="g"><b>${fdate(r.start_at)} · <span class="num">${t12(r.start_at.slice(11))}</span> (${MODE[r.mode]})</b><span class="small muted">${esc(r.number)} · ${r.survey_done ? 'الاستبيان مكتمل' : 'الاستبيان لم يكتمل'}</span></div>${pill(r.status)}</a>`).join('')
        : '<div class="empty small">لا جلسات بعد — أرسل له رابط الحجز ليختار الوقت المناسب.</div>'}`;
    const trk = $('#trk-card'); trk ? trk.before(c) : $('#view').appendChild(c);
    const inv = $('#inv', c); if (inv) inv.onclick = async () => { inv.disabled = true; try { const r = await api('sessions/invite', { method: 'POST', body: { lead_id: +id } }); toast(r.queued ? 'أُرسل رابط الحجز على واتساب' : 'سُجّل — لا يوجد جوال للإرسال'); } catch (e) { toast(e.message, 1); } inv.disabled = false; };
  }

  /* ---------- الإعدادات: أوقات الحجز + ربط Google ---------- */
  const sr = ROUTES.settings;
  if (sr) { const base = sr.render; sr.render = async (...a) => { await base(...a); try { await settingsCard(); } catch (e) { console.warn('diag', e.message); } }; }
  async function settingsCard() {
    if (me().role !== 'admin' || $('#diag-set')) return;
    const [g, st] = await Promise.all([api('google/status'), api('settings')]);
    const s = st.settings; const days = String(s.book_days ?? '6,0,1,2,3,4').split(',');
    const gm = location.hash.match(/google=([^&/]*)/); const msg = gm ? decodeURIComponent(gm[1]) : '';
    if (msg) { toast(msg === 'ok' ? 'رُبط حساب Google بنجاح' : msg, msg !== 'ok'); history.replaceState(null, '', '#/settings'); }
    const c = document.createElement('div'); c.className = 'card'; c.id = 'diag-set'; c.style.marginTop = '14px';
    c.innerHTML = `<h3>📅 جلسات التشخيص — الحجز وGoogle Meet</h3>
      <div class="small" style="margin-bottom:10px">Google: ${g.connected ? `<span class="pill t">مربوط</span> ${esc(g.email || '')} <button class="btn btn-g btn-s" id="g-off">فصل</button>` : g.configured ? '<span class="pill o">غير مربوط</span> <button class="btn btn-p btn-s" id="g-on">ربط Google</button> <span class="muted">سجّل بحساب التسويق</span>' : '<span class="pill x">يحتاج إعداداً لمرة واحدة</span>'}${g.error ? `<br><span style="color:var(--red)">${esc(g.error)}</span>` : ''}</div>
      ${!g.configured ? `<details class="small" style="margin-bottom:12px"><summary><b>خطوات الإعداد (10 دقائق، مرة واحدة)</b></summary><ol style="margin:8px 0;padding-inline-start:18px;line-height:1.9">
        <li>ادخل <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a> بحساب التسويق وأنشئ مشروعاً باسم «Nubl Hub».</li>
        <li>من «APIs & Services ← Library» فعّل <b>Google Calendar API</b>.</li>
        <li>من «OAuth consent screen» اختر Internal (إن كان الحساب Workspace) أو External وأضف بريد التسويق مستخدماً تجريبياً.</li>
        <li>من «Credentials ← Create credentials ← OAuth client ID» اختر <b>Web application</b> وأضف رابط التحويل:<br><code dir="ltr">${esc(g.redirect)}</code></li>
        <li>انسخ Client ID وClient secret وأضفهما في Cloudflare Pages ← nubl-ebtikar-online ← Settings ← Variables (Secret) باسمَي <code>GOOGLE_CLIENT_ID</code> و<code>GOOGLE_CLIENT_SECRET</code>.</li>
        <li>بعد دقيقة عُد هنا واضغط «ربط Google».</li></ol></details>` : ''}
      <form class="fgrid" id="bk-f">
        <label class="f full"><span>أيام الحجز</span><div style="display:flex;flex-wrap:wrap;gap:10px">${[6, 0, 1, 2, 3, 4, 5].map((n) => `<label class="small"><input type="checkbox" name="d${n}" ${days.includes(String(n)) ? 'checked' : ''}> ${DAYS[n]}</label>`).join('')}</div></label>
        <label class="f"><span>من الساعة</span><input class="inp" type="time" name="book_from" value="${esc(s.book_from || '12:00')}"></label>
        <label class="f"><span>إلى الساعة</span><input class="inp" type="time" name="book_to" value="${esc(s.book_to || '21:00')}"></label>
        <label class="f"><span>مدة الجلسة (دقيقة)</span><input class="inp" type="number" name="book_len" value="${esc(s.book_len || 45)}"></label>
        <label class="f"><span>فاصل بين الجلسات (دقيقة)</span><input class="inp" type="number" name="book_gap" value="${esc(s.book_gap ?? 15)}"></label>
        <label class="f"><span>أقل مدة قبل الحجز (ساعة)</span><input class="inp" type="number" name="book_notice_h" value="${esc(s.book_notice_h ?? 12)}"></label>
        <label class="f"><span>الحجز حتى (يوماً مقدماً)</span><input class="inp" type="number" name="book_horizon_d" value="${esc(s.book_horizon_d || 14)}"></label>
        <label class="f"><span>جلسات متزامنة في نفس الوقت</span><input class="inp" type="number" name="book_capacity" value="${esc(s.book_capacity || 1)}"></label>
        <label class="f full"><span>أيام إجازة (تواريخ مفصولة بفواصل)</span><input class="inp" name="book_off" dir="ltr" placeholder="2026-12-01,2026-12-02" value="${esc(s.book_off || '')}"></label>
      </form><button class="btn btn-p btn-s" id="bk-sv">حفظ أوقات الحجز</button> <span class="small muted">الرابط العام: <a href="/book" target="_blank">nubl-ebtikar.online/book</a></span>`;
    ($('#view .grid.g2 > div:last-child') || $('#view')).appendChild(c);
    $('#bk-sv').onclick = async () => {
      const f = $('#bk-f'); const body = { book_days: [6, 0, 1, 2, 3, 4, 5].filter((n) => f[`d${n}`].checked).join(',') };
      ['book_from', 'book_to', 'book_len', 'book_gap', 'book_notice_h', 'book_horizon_d', 'book_capacity', 'book_off'].forEach((k) => body[k] = f[k].value.trim());
      await api('settings', { method: 'PUT', body }); toast('حُفظت أوقات الحجز');
    };
    const on = $('#g-on'); if (on) on.onclick = () => { location.href = API + 'google/connect'; };
    const off = $('#g-off'); if (off) off.onclick = async () => { if (!(await confirmBox('فصل حساب Google؟ لن تُنشأ روابط Meet جديدة حتى يُعاد الربط.'))) return; await api('google/disconnect', { method: 'POST' }); toast('فُصل الحساب'); c.remove(); settingsCard(); };
  }

  if (S.meta && $('.side')) { renderShell(); rerender(); }
})();
