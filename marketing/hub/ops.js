/* منصة نُبل وابتكار للتسويق — المرحلة 2: التشغيل التعاوني
   1) أطراف المهمة: أكثر من مكلّف + مراجع + مطّلع + أطراف خارجية (عميل، قطاع الإنتاج، مورد…)
   2) التذكيرات في كل العمليات: لمن، متى، وبأي قناة (المنصة · واتساب · تلجرام)
   3) تقويم المتابعة الشخصي: بطاقة في لوحة القيادة + صفحة «تقويمي» */
'use strict';
(function nublOps() {
  const REM_ENTS = ['tasks', 'leads', 'deals', 'activities', 'clients', 'contracts', 'invoices', 'quotes', 'projects', 'content', 'visits'];
  const P_ROLES = ['مكلّف', 'مراجع', 'مطّلع'];
  const EXT_KINDS = ['عميل', 'قطاع الإنتاج', 'الدعاية والإعلان', 'مورد', 'أخرى'];
  const CH = [['app', 'المنصة'], ['wa', 'واتساب'], ['tg', 'تلجرام']];
  const activeUsers = () => (S.meta?.users || []).filter((u) => u.active);
  const ksaNow = () => new Date(Date.now() + 3 * 3600e3);
  const pad = (n) => String(n).padStart(2, '0');
  const fmtAt = (s) => { if (!s) return ''; const [d, t] = String(s).split(' '); return `${fdate(d)} <span class="num">${t || ''}</span>`; };
  const QUICK_AT = [['بعد ساعة', 60], ['بعد 3 ساعات', 180], ['غداً 9 ص', 'tom9'], ['بعد يومين', 2880], ['الأسبوع القادم', 10080]];
  const quickAt = (q) => {
    const n = ksaNow();
    if (q === 'tom9') { n.setUTCDate(n.getUTCDate() + 1); return `${n.toISOString().slice(0, 10)}T09:00`; }
    const x = new Date(n.getTime() + q * 60e3); return x.toISOString().slice(0, 16);
  };

  // ---------- مكوّن التذكيرات ----------
  // mode: 'live' (سجل محفوظ — يحفظ فوراً) أو 'pending' (سجل جديد — يُحفظ بعد إنشاء السجل)
  function reminderBox(host, entity, entityId, pending) {
    host.classList.add('rem-box');
    const st = { rows: [], pending: pending || [] };
    const draw = () => {
      const list = entityId ? st.rows : st.pending;
      host.innerHTML = `<div class="rem-h">${I.bell}<b>التذكيرات</b><span class="sp"></span><button type="button" class="btn btn-g btn-s" data-add>${I.plus} تذكير</button></div>
        <div class="rem-l">${list.length ? list.map((r, i) => `<div class="rem-i ${r.status && r.status !== 'pending' ? 'done' : ''}">
          <span class="ico">${I.clock}</span><div class="g"><b>${fmtAt(String(r.remind_at).replace('T', ' '))}</b>
          <small>${String(r.user_ids || '').split(',').filter(Boolean).map((id) => esc(userName(id))).join('، ') || 'أنا'} · ${String(r.channels || 'app').split(',').map((c) => (CH.find((x) => x[0] === c) || [, c])[1]).join(' + ')}${r.note ? ' · ' + esc(r.note) : ''}${r.status === 'sent' ? ' · <b class="ok">أُرسل ✓</b>' : ''}</small></div>
          <button type="button" class="rem-x" data-del="${i}" title="حذف">${I.trash}</button></div>`).join('') : '<div class="small muted">لا تذكيرات — أضف تذكيراً ليصلك أو يصل زميلك في الموعد.</div>'}</div><div class="rem-f" hidden></div>`;
      $('[data-add]', host).onclick = openForm2;
      $$('[data-del]', host).forEach((b) => b.onclick = async () => {
        const i = +b.dataset.del;
        if (!entityId) { st.pending.splice(i, 1); draw(); return; }
        try { await api('reminders/' + st.rows[i].id, { method: 'DELETE' }); await load(); } catch (e) { toast(e.message, 1); }
      });
    };
    const openForm2 = () => {
      const f = $('.rem-f', host); f.hidden = false;
      const def = quickAt('tom9');
      f.innerHTML = `<div class="rem-q">${QUICK_AT.map(([l, q]) => `<button type="button" class="chipb" data-q="${q}">${l}</button>`).join('')}</div>
        <div class="fgrid"><label class="f"><span>الموعد</span><input class="inp" type="datetime-local" data-at value="${def}"></label>
        <label class="f"><span>ملاحظة التذكير</span><input class="inp" data-note placeholder="مثال: اتصل وأكد موعد الجلسة"></label>
        <div class="f full"><span class="lbl">من يُذكَّر؟</span><div class="chips" data-users>${activeUsers().map((u) => `<button type="button" class="chipb ${u.id === me().id ? 'on' : ''}" data-u="${u.id}">${esc(u.name)}</button>`).join('')}</div></div>
        <div class="f full"><span class="lbl">طريقة التذكير</span><div class="chips" data-ch>${CH.map(([k, l]) => `<button type="button" class="chipb on ${k === 'app' ? 'lock' : ''}" data-c="${k}">${l}</button>`).join('')}</div>
          <small class="muted">يصل التذكير في موعده بالقنوات المختارة · المنصة دائماً · تلجرام لمن ربط حسابه</small></div></div>
        <div class="rem-act"><button type="button" class="btn btn-n btn-s" data-save>حفظ التذكير</button><button type="button" class="btn btn-g btn-s" data-cancel>إلغاء</button></div>`;
      $$('[data-q]', f).forEach((b) => b.onclick = () => { $('[data-at]', f).value = quickAt(isNaN(+b.dataset.q) ? b.dataset.q : +b.dataset.q); $$('[data-q]', f).forEach((x) => x.classList.toggle('on', x === b)); });
      $$('[data-u],[data-c]', f).forEach((b) => b.onclick = () => { if (!b.classList.contains('lock')) b.classList.toggle('on'); });
      $('[data-cancel]', f).onclick = () => { f.hidden = true; };
      $('[data-save]', f).onclick = async () => {
        const r = { entity, entity_id: entityId, remind_at: $('[data-at]', f).value.replace('T', ' '), note: $('[data-note]', f).value.trim(),
          user_ids: $$('[data-u].on', f).map((b) => b.dataset.u).join(',') || String(me().id), channels: $$('[data-c].on', f).map((b) => b.dataset.c).join(',') };
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(r.remind_at)) return toast('حدد موعد التذكير', 1);
        if (!entityId) { st.pending.push(r); draw(); toast('سيُحفظ التذكير مع السجل'); return; }
        try { await api('reminders', { method: 'POST', body: r }); toast('حُفظ التذكير'); await load(); } catch (e) { toast(e.message, 1); }
      };
    };
    const load = async () => { if (!entityId) return draw(); try { st.rows = (await api(`reminders?entity=${entity}&entity_id=${entityId}`)).rows; } catch { st.rows = []; } draw(); };
    load();
    return st;
  }
  async function flushReminders(entity, id, pending) {
    for (const r of pending || []) { try { await api('reminders', { method: 'POST', body: { ...r, entity, entity_id: id } }); } catch (e) { toast('تعذّر حفظ تذكير: ' + e.message, 1); } }
  }

  // ---------- مكوّن أطراف المهمة ----------
  function peopleBox(host, taskId, assigneeId, initial) {
    host.classList.add('ppl-box');
    const st = { list: initial || [], assignee: assigneeId };
    const draw = () => {
      const us = activeUsers();
      host.innerHTML = `<div class="rem-h">${I.users}<b>أطراف المهمة</b><span class="small muted">— أضف أكثر من مكلّف ومراجعاً وأطرافاً خارجية</span></div>
        <div class="chips" data-team>${us.map((u) => { const p = st.list.find((x) => x.user_id == u.id); const isA = u.id == st.assignee;
          return `<button type="button" class="chipb ${p || isA ? 'on' : ''} ${isA ? 'lock' : ''}" data-u="${u.id}" title="${isA ? 'المكلّف الرئيسي' : 'اضغط للإضافة/الإزالة'}">${esc(u.name)}${isA ? ' ★' : p ? ` · ${esc(p.role)}` : ''}</button>`; }).join('')}</div>
        <div class="ppl-l">${st.list.map((p, i) => p.user_id ? `<div class="ppl-i"><span class="av">${esc(userName(p.user_id).charAt(0))}</span><b>${esc(userName(p.user_id))}</b>
          <select class="inp" data-r="${i}">${P_ROLES.map((r) => `<option ${r === p.role ? 'selected' : ''}>${r}</option>`).join('')}</select><button type="button" class="rem-x" data-rm="${i}">${I.trash}</button></div>`
          : `<div class="ppl-i ext"><span class="av">${I.link}</span><b>${esc(p.ext_name)}</b><small class="num" dir="ltr">${esc(p.ext_phone || '')}</small><span class="pill">${esc(p.ext_kind || 'أخرى')}</span><button type="button" class="rem-x" data-rm="${i}">${I.trash}</button></div>`).join('')}</div>
        <details class="ppl-ext"><summary>${I.plus} طرف خارجي (عميل، قطاع الإنتاج، مورد…)</summary>
          <div class="fgrid"><label class="f"><span>الاسم</span><input class="inp" data-en></label><label class="f"><span>الجوال</span><input class="inp" data-ep dir="ltr" placeholder="05xxxxxxxx"></label>
          <label class="f"><span>الجهة</span><select class="inp" data-ek>${EXT_KINDS.map((k) => `<option>${k}</option>`).join('')}</select></label>
          <div class="f" style="align-self:end"><button type="button" class="btn btn-g" data-eadd>إضافة الطرف</button></div></div></details>`;
      $$('[data-u]', host).forEach((b) => b.onclick = () => {
        if (b.classList.contains('lock')) return;
        const id = Number(b.dataset.u); const i = st.list.findIndex((x) => x.user_id == id);
        if (i >= 0) st.list.splice(i, 1); else st.list.push({ user_id: id, role: 'مكلّف' });
        draw(); changed();
      });
      $$('[data-r]', host).forEach((s) => s.onchange = () => { st.list[+s.dataset.r].role = s.value; draw(); changed(); });
      $$('[data-rm]', host).forEach((b) => b.onclick = () => { st.list.splice(+b.dataset.rm, 1); draw(); changed(); });
      $('[data-eadd]', host).onclick = () => {
        const n = $('[data-en]', host).value.trim(); if (!n) return toast('اكتب اسم الطرف', 1);
        st.list.push({ ext_name: n, ext_phone: $('[data-ep]', host).value.trim(), ext_kind: $('[data-ek]', host).value, role: 'طرف خارجي' }); draw(); changed();
      };
    };
    let t = null;
    const changed = () => { if (!taskId) return; clearTimeout(t); t = setTimeout(async () => { try { await api('people/' + taskId, { method: 'PUT', body: { people: st.list } }); toast('حُدّثت أطراف المهمة'); } catch (e) { toast(e.message, 1); } }, 600); };
    st.setAssignee = (id) => { st.assignee = Number(id) || null; st.list = st.list.filter((x) => x.user_id != st.assignee); draw(); };
    draw();
    return st;
  }

  // ---------- دمج المكوّنات في النماذج ----------
  const baseOpenForm = openForm;
  openForm = async function (ent, row = null, preset = {}, onSaved) {
    if (!REM_ENTS.includes(ent)) return baseOpenForm(ent, row, preset, onSaved);
    let remSt = null; let pplSt = null;
    const wrapped = async (saved) => {
      if (saved && !row) {
        if (remSt) await flushReminders(ent, saved.id, remSt.pending);
        if (pplSt && ent === 'tasks' && pplSt.list.length) { try { await api('people/' + saved.id, { method: 'PUT', body: { people: pplSt.list } }); } catch (e) { toast(e.message, 1); } }
      }
      onSaved ? onSaved(saved) : rerender();
    };
    const m = await baseOpenForm(ent, row, preset, wrapped);
    if (!m || !m.el) return m;
    const b = $('.modal-b', m.el);
    if (ent === 'tasks') {
      const box = document.createElement('div'); b.appendChild(box);
      let init = [];
      if (row) { try { init = (await api('people/' + row.id)).people; } catch { /* */ } }
      pplSt = peopleBox(box, row ? row.id : null, row ? row.assignee_id : null, init);
      const sel = $('[name="assignee_id"]', b); if (sel) sel.addEventListener('change', () => pplSt.setAssignee(sel.value));
    }
    if (can(ent, 'w') || row) { const box = document.createElement('div'); b.appendChild(box); remSt = reminderBox(box, ent, row ? row.id : null); }
    return m;
  };

  // قوالب المهام: أطراف + تذكير قبل الإنشاء
  if (typeof runTplForm === 'function') {
    const baseRun = runTplForm;
    runTplForm = async function (tpl, preset = {}, onDone) {
      let remSt = null; let pplSt = null;
      const done = async (r) => {
        if (r && r.entity === 'tasks' && r.id) {
          if (pplSt && pplSt.list.length) { try { await api('people/' + r.id, { method: 'PUT', body: { people: pplSt.list } }); } catch (e) { toast(e.message, 1); } }
          if (remSt) await flushReminders('tasks', r.id, remSt.pending);
        } else if (r && remSt && REM_ENTS.includes(r.entity) && r.id) await flushReminders(r.entity, r.id, remSt.pending);
        onDone ? onDone(r) : rerender();
      };
      await baseRun(tpl, preset, done);
      const all = $$('.modal-bg'); const mb = all[all.length - 1]; if (!mb) return;
      const b = $('.modal-b', mb);
      if ((tpl.kind || 'task') === 'task') {
        const box = document.createElement('div'); b.appendChild(box);
        pplSt = peopleBox(box, null, null, []);
        const sel = $('[name="assignee"]', b); if (sel) sel.addEventListener('change', () => pplSt.setAssignee(sel.value));
      }
      const box2 = document.createElement('div'); b.appendChild(box2);
      remSt = reminderBox(box2, (tpl.kind || 'task') === 'task' ? 'tasks' : tpl.kind === 'lead' ? 'leads' : tpl.kind === 'activity' ? 'activities' : 'visits', null);
    };
  }

  // صفحات التفاصيل (العميل المحتمل، العميل، العقد، الفاتورة، عرض السعر): بطاقة تذكيرات
  const DETAIL = { lead: 'leads', client: 'clients', contract: 'contracts', invoice: 'invoices', quote: 'quotes' };
  function detailCards() {
    const [r, id] = location.hash.replace(/^#\/?/, '').split('/');
    const ent = DETAIL[r]; if (!ent || !id || $('#view .rem-card')) return;
    const view = $('#view'); if (!view || !view.children.length) return;
    const card = document.createElement('div'); card.className = 'card rem-card'; card.style.marginTop = '14px';
    view.appendChild(card); reminderBox(card, ent, Number(id));
  }

  // ---------- تقويم المتابعة ----------
  const KIND = { task: ['مهمة', 'check', '#15556B'], followup: ['متابعة', 'phone', '#D2652A'], reminder: ['تذكير', 'bell', '#DC9C47'], content: ['محتوى', 'cal', '#308D8B'], renewal: ['تجديد', 'sign', '#7A4DB0'], season: ['موسم', 'star', '#B8860B'] };
  const iso = (d) => d.toISOString().slice(0, 10);
  const agendaItem = (x) => { const k = KIND[x.kind] || KIND.task;
    return `<a class="ag-i ${x.done ? 'done' : ''} ${x.d < todayStr() && !x.done && x.kind !== 'season' ? 'late' : ''}" href="${esc(x.link || '#')}" style="--kc:${k[2]}"><span class="ico">${I[k[1]]}</span>
      <span class="g"><b>${esc(x.title)}</b><small>${k[0]}${x.time ? ` · <span class="num">${x.time}</span>` : ''}${x.tag ? ' · ' + esc(x.tag) : ''}${x.note ? ' · ' + esc(x.note) : ''}</small></span></a>`; };

  async function dashCard() {
    if (S.route !== 'dashboard' || $('#ag-card')) return;
    const view = $('#view'); const g = view && view.querySelector('.grid.g2'); if (!g) return;
    const card = document.createElement('div'); card.className = 'card ag-card'; card.id = 'ag-card';
    g.prepend(card);
    const t0 = ksaNow(); const days = [...Array(7)].map((_, i) => { const d = new Date(t0); d.setUTCDate(d.getUTCDate() + i); return iso(d); });
    card.innerHTML = `<h3>${I.cal} تقويم المتابعة — لي<span class="sp"></span><a href="#/agenda" class="small">التقويم الكامل ←</a></h3><div class="empty small">جارٍ التحميل…</div>`;
    let items = [];
    try { items = (await api(`agenda?from=${addDays(days[0], -14)}&to=${days[6]}`)).items; } catch (e) { card.lastElementChild.textContent = e.message; return; }
    const late = items.filter((x) => x.d < days[0] && !x.done && x.kind !== 'season' && x.kind !== 'renewal');
    let sel = days[0];
    const draw = () => {
      const DN = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
      const list = items.filter((x) => x.d === sel);
      card.innerHTML = `<h3>${I.cal} تقويم المتابعة — لي<span class="sp"></span><a href="#/agenda" class="small">التقويم الكامل ←</a></h3>
        <div class="ag-week">${days.map((d) => { const n = items.filter((x) => x.d === d && !x.done).length; const dt = new Date(d + 'T00:00:00Z');
          return `<button type="button" class="ag-d ${d === sel ? 'on' : ''} ${d === days[0] ? 'today' : ''}" data-d="${d}"><small>${d === days[0] ? 'اليوم' : DN[dt.getUTCDay()]}</small><b class="num">${dt.getUTCDate()}</b>${n ? `<i>${n}</i>` : '<i class="z"></i>'}</button>`; }).join('')}</div>
        ${late.length && sel === days[0] ? `<div class="ag-late">${I.clock} ${late.length} متأخرة من الأيام السابقة</div>${late.slice(0, 4).map(agendaItem).join('')}` : ''}
        <div class="ag-l">${list.map(agendaItem).join('') || '<div class="empty small">لا مواعيد في هذا اليوم</div>'}</div>`;
      $$('[data-d]', card).forEach((b) => b.onclick = () => { sel = b.dataset.d; draw(); });
    };
    draw();
  }

  async function agendaView(id) {
    const st = (S.ag ||= { m: todayStr().slice(0, 7), user: me().id, sel: todayStr() });
    const [y, mo] = st.m.split('-').map(Number);
    const first = new Date(Date.UTC(y, mo - 1, 1)); const start = new Date(first); start.setUTCDate(1 - first.getUTCDay());
    const cells = [...Array(42)].map((_, i) => { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); return iso(d); });
    V().innerHTML = `<div class="toolbar"><button class="btn btn-g btn-s" data-m="-1">→ السابق</button><b class="ag-title">${MONTHS[mo - 1]} <span class="num">${y}</span></b><button class="btn btn-g btn-s" data-m="1">التالي ←</button>
      <button class="btn btn-g btn-s" data-m="0">اليوم</button><span class="sp"></span>
      ${isBoss() ? `<select class="inp" id="ag-u">${activeUsers().map((u) => `<option value="${u.id}" ${u.id == st.user ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>` : ''}
      <span class="ag-leg">${Object.values(KIND).map(([l, , c]) => `<span><i style="--kc:${c}"></i>${l}</span>`).join('')}</span></div>
      <div class="ag-wrap"><div class="cal ag-cal">${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((d) => `<div class="dh">${d}</div>`).join('')}
        ${cells.map((d) => `<div class="d ${d.slice(0, 7) !== st.m ? 'o' : ''} ${d === todayStr() ? 'today' : ''} ${d === st.sel ? 'sel' : ''}" data-d="${d}"><div class="dn"><span class="num">${+d.slice(8)}</span></div><div class="ag-dots" data-dots="${d}"></div></div>`).join('')}</div>
        <div class="card ag-side"><h3>${I.cal} <span id="ag-st"></span></h3><div id="ag-sl"></div></div></div>`;
    $$('[data-m]', V()).forEach((b) => b.onclick = () => {
      const k = +b.dataset.m; if (!k) { st.m = todayStr().slice(0, 7); st.sel = todayStr(); } else { const d = new Date(Date.UTC(y, mo - 1 + k, 1)); st.m = iso(d).slice(0, 7); }
      agendaView();
    });
    if ($('#ag-u')) $('#ag-u').onchange = (e) => { st.user = +e.target.value; agendaView(); };
    let items = [];
    try { items = (await api(`agenda?from=${cells[0]}&to=${cells[41]}&user=${st.user}`)).items; } catch (e) { toast(e.message, 1); }
    const side = () => {
      $('#ag-st').textContent = fdate(st.sel).replace(/<[^>]+>/g, '');
      const l = items.filter((x) => x.d === st.sel);
      $('#ag-sl').innerHTML = l.map(agendaItem).join('') || '<div class="empty small">لا مواعيد</div>';
      $$('.ag-cal .d', V()).forEach((c) => c.classList.toggle('sel', c.dataset.d === st.sel));
    };
    cells.forEach((d) => {
      const l = items.filter((x) => x.d === d); const box = $(`[data-dots="${d}"]`, V()); if (!box) return;
      box.innerHTML = l.slice(0, 3).map((x) => `<span class="ag-ev ${x.done ? 'done' : ''}" style="--kc:${(KIND[x.kind] || KIND.task)[2]}">${esc(x.title)}</span>`).join('') + (l.length > 3 ? `<span class="ag-more">+${l.length - 3}</span>` : '');
    });
    $$('.ag-cal .d', V()).forEach((c) => c.onclick = () => { st.sel = c.dataset.d; side(); if (MOBILE()) $('.ag-side').scrollIntoView({ behavior: 'smooth' }); });
    side();
  }
  const MOBILE = () => window.matchMedia('(max-width:860px)').matches;
  ROUTES.agenda = { title: 'تقويم المتابعة', render: agendaView };
  const g0 = NAV.find((x) => x[0] === 'الرئيسية'); if (g0 && !g0[1].some((i) => i[0] === 'agenda')) g0[1].push(['agenda', 'تقويمي', 'cal']);

  new MutationObserver(() => requestAnimationFrame(() => { detailCards(); dashCard(); })).observe(document.body, { childList: true, subtree: true });

  const css = `
  .rem-box,.ppl-box{margin-top:16px;padding:14px;border:1px solid var(--line);border-radius:16px;background:#fff}
  .rem-card.rem-box{margin-top:14px}
  .rem-h{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}.rem-h>.ai{width:20px;height:20px;color:var(--navy)}.rem-h .sp{flex:1}
  .rem-l{display:flex;flex-direction:column;gap:6px}
  .rem-i{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;background:var(--soft)}
  .rem-i .ico{width:34px;height:34px;font-size:18px}.rem-i .g{flex:1;min-width:0}.rem-i b{display:block;font-size:13.5px}.rem-i small{color:var(--muted);font-size:12px}
  .rem-i.done{opacity:.6}.rem-i .ok{color:var(--teal)}
  .rem-x{border:0;background:#fff;width:34px;height:34px;border-radius:10px;cursor:pointer;color:var(--red);display:grid;place-items:center;flex:none}.rem-x .ai{width:17px;height:17px}
  .rem-f{margin-top:12px;padding:12px;border-radius:14px;background:var(--soft);animation:mpop .3s var(--spring,ease) both}
  .rem-q,.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
  .chipb{border:1.5px solid var(--line-2,#D8CCB6);background:#fff;border-radius:99px;padding:6px 12px;font:600 12.5px/1.3 inherit;color:var(--ink);cursor:pointer;transition:.2s}
  .chipb:hover{border-color:var(--teal)}.chipb.on{background:var(--teal);border-color:var(--teal);color:#fff}.chipb.lock{background:var(--navy);border-color:var(--navy);color:#fff;cursor:default}
  .lbl{display:block;font-size:13px;font-weight:700;color:var(--deep);margin-bottom:7px}
  .rem-act{display:flex;gap:8px}
  .ppl-l{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
  .ppl-i{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:12px;background:var(--soft)}
  .ppl-i b{flex:1;font-size:13.5px}.ppl-i .inp{width:auto;min-height:36px;padding:4px 34px 4px 10px;font-size:13px}
  .ppl-i .av{width:32px;height:32px;border-radius:10px;background:var(--g-brand,#15556B);color:#fff;display:grid;place-items:center;font-weight:700;flex:none}
  .ppl-i.ext .av{background:var(--g-warm,#D2652A)}.ppl-i .av .ai{width:17px;height:17px}
  .ppl-ext summary{cursor:pointer;color:var(--navy);font-weight:600;display:flex;align-items:center;gap:6px;margin:6px 0}.ppl-ext summary .ai{width:16px;height:16px}
  .ag-card .ag-week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:10px}
  .ag-d{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 2px;border-radius:14px;border:1px solid var(--line);background:#fff;cursor:pointer;font:inherit;transition:.25s var(--spring,ease)}
  .ag-d small{font-size:10.5px;color:var(--muted)}.ag-d b{font-size:17px;color:var(--deep)}
  .ag-d i{min-width:18px;height:18px;border-radius:99px;background:var(--terra);color:#fff;font:700 10.5px/18px inherit;font-style:normal;padding:0 4px}.ag-d i.z{background:transparent}
  .ag-d.today{border-color:var(--gold)}.ag-d.on{background:var(--g-brand,#15556B);border-color:transparent;transform:translateY(-2px)}.ag-d.on small,.ag-d.on b{color:#fff}
  .ag-i{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;color:var(--ink);border-inline-start:4px solid var(--kc);background:var(--soft);margin-bottom:6px;transition:transform .25s var(--e,ease)}
  .ag-i:hover{transform:translateX(-3px)}.ag-i .ico{width:32px;height:32px;font-size:17px;color:var(--kc)}.ag-i .g{flex:1;min-width:0}
  .ag-i b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ag-i small{color:var(--muted);font-size:11.5px}
  .ag-i.done{opacity:.55}.ag-i.done b{text-decoration:line-through}.ag-i.late{background:#FFF4F0}
  .ag-late{display:flex;align-items:center;gap:6px;color:var(--red);font-weight:600;font-size:12.5px;margin:4px 0 6px}.ag-late .ai{width:16px;height:16px}
  .ag-title{font-size:17px;color:var(--deep);min-width:120px;text-align:center}
  .ag-leg{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11.5px;color:var(--muted);align-items:center}.ag-leg i{display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--kc);margin-inline-end:3px}
  .ag-wrap{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start}
  .ag-cal .d{cursor:pointer;min-height:104px;transition:background .2s}.ag-cal .d:hover{background:#FBF6EC}.ag-cal .d.sel{box-shadow:inset 0 0 0 2px var(--teal)}
  .ag-ev{display:block;font-size:11px;line-height:1.5;padding:1px 6px;border-radius:6px;margin-bottom:2px;background:color-mix(in srgb,var(--kc) 14%,#fff);color:var(--kc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
  .ag-ev.done{opacity:.5;text-decoration:line-through}.ag-more{font-size:10.5px;color:var(--muted)}
  .ag-side{position:sticky;top:80px}
  @media(max-width:860px){.ag-wrap{grid-template-columns:1fr}.ag-cal .d{min-height:54px}.ag-ev{font-size:0;height:6px;padding:0;border-radius:3px;background:var(--kc)}.ag-more{display:none}
    .ag-dots{display:flex;flex-direction:column;gap:2px}.ag-leg{grid-column:1/-1}.ag-d{padding:6px 0}.ag-d b{font-size:15px}.ppl-i{flex-wrap:wrap}}`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();
