/* منصة نُبل وابتكار للتسويق — حقول ذكية 3.0
   1) حقل الاختيار من السجلات (عميل، عميل محتمل، صفقة…) يصبح بحثاً مع اقتراحات فورية بدل القائمة الجامدة:
      يطابق الاسم والجوال والمنشأة (مع توحيد الحروف العربية)، ويعرض العميل الموجود لاختياره،
      ولا يُجبر على الاختيار: يمكن تركه فارغاً، وفي قوالب المهام يُقبل اسم عميل جديد نصاً.
   2) حسابات التواصل للعملاء: أيقونات المنصات — اضغط الأيقونة وأضف الرابط مباشرة، وتُحفظ وتُعرض أيقونات. */
'use strict';
(function nublFields() {
  // ---------- أدوات ----------
  const norm = (s) => String(s ?? '').toLowerCase().replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\s+/g, ' ').trim();
  const digits = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  const SUB = {
    clients: (r) => [r.contact_name, r.phone].filter(Boolean).join(' · '),
    leads: (r) => [r.phone, r.city].filter(Boolean).join(' · '),
    deals: (r) => [r.stage, r.value ? moneyTxt(r.value) + ' ر.س' : ''].filter(Boolean).join(' · '),
    contracts: (r) => r.status || '', invoices: (r) => r.status || '', projects: (r) => r.status || '', templates: () => '',
  };
  const hay = (ent, r) => norm([REF[ent].label(r), r.name, r.company, r.brand, r.contact_name, r.title, r.number].filter(Boolean).join(' ')) + ' ' + digits(r.phone).slice(-9);

  // ---------- 1) حقل الاختيار الذكي ----------
  const baseInput = input;
  input = function (f, val, ro) {
    if (f.t !== 'ref' || f.ref === 'users' || ro || f.ro) return baseInput(f, val, ro);
    const free = !!f.free; const v = val ?? '';
    let shown = ''; let id = '';
    if (v !== '' && v != null) {
      if (/^\d+$/.test(String(v))) { id = String(v); shown = refLabel(f.ref, v); } else if (free) shown = String(v);
    }
    return `<div class="cbx" data-cbx="${esc(f.ref)}" ${free ? 'data-free="1"' : ''}>
      <input class="inp" type="text" name="${esc(f.k)}" value="${esc(shown)}" data-id="${esc(id)}" placeholder="${free ? 'ابحث بالاسم أو الجوال… أو اكتب اسماً جديداً' : 'ابحث بالاسم أو الجوال… (اختياري)'}" autocomplete="off" role="combobox" aria-expanded="false">
      <button type="button" class="cbx-x" aria-label="مسح" tabindex="-1">×</button><div class="cbx-l" role="listbox"></div></div>`;
  };

  const baseRead = readForm;
  readForm = function (form, fields) {
    const special = fields.filter((f) => f.t === 'ref' && f.ref !== 'users' && !f.ro && form.querySelector(`.cbx [name="${f.k}"]`));
    const out = baseRead(form, fields.filter((f) => !special.includes(f)));
    for (const f of special) {
      const el = form.querySelector(`.cbx [name="${f.k}"]`); const txt = el.value.trim();
      if (!txt) { out[f.k] = null; continue; }
      if (el.dataset.id) { out[f.k] = Number(el.dataset.id); continue; }
      const rows = S.cache[f.ref]?.rows || []; const n = norm(txt); const dg = digits(txt);
      const hit = rows.find((r) => norm(REF[f.ref].label(r)) === n || norm(r.name) === n) || (dg.length >= 9 ? rows.find((r) => digits(r.phone).endsWith(dg.slice(-9))) : null);
      if (hit) { out[f.k] = hit.id; continue; }
      if (f.free) { out[f.k] = txt; continue; }
      throw new Error(`«${txt}» غير موجود في ${ENT[f.ref]?.title || 'السجلات'} — اختر من الاقتراحات أو اترك «${f.l}» فارغاً`);
    }
    return out;
  };

  function openList(box) {
    const inp = $('input', box); const list = $('.cbx-l', box); const ent = box.dataset.cbx;
    const rows = S.cache[ent]?.rows || [];
    const q = inp.value.trim(); const n = norm(q); const dg = digits(q);
    let hits = !q ? rows.slice(0, 8) : rows.map((r) => {
      const h = hay(ent, r); const lab = norm(REF[ent].label(r));
      let sc = 0;
      if (lab === n) sc = 100; else if (lab.startsWith(n)) sc = 60; else if (h.includes(n)) sc = 30;
      if (dg.length >= 3 && digits(r.phone).includes(dg)) sc = Math.max(sc, 80);
      return [sc, r];
    }).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 8).map((x) => x[1]);
    const exact = q && hits.some((r) => norm(REF[ent].label(r)) === n);
    let html = hits.map((r, i) => `<div class="cbx-i ${i === 0 && q ? 'sel' : ''}" data-id="${r.id}" role="option"><b>${esc(REF[ent].label(r))}</b>${SUB[ent] && SUB[ent](r) ? `<small>${esc(SUB[ent](r))}</small>` : ''}</div>`).join('');
    if (q && hits.length) html = `<div class="cbx-h">${I.users} موجود مسبقاً — اختره لتجنّب التكرار</div>` + html;
    if (q && !exact && box.dataset.free) html += `<div class="cbx-i cbx-new" data-new="1"><b>${I.plus} استخدام «${esc(q)}» كاسم جديد</b><small>يُحفظ نصاً مع المهمة دون إنشاء سجل</small></div>`;
    if (q && !hits.length && !box.dataset.free) html += `<div class="cbx-e">لا نتائج — يمكنك ترك الحقل فارغاً</div>`;
    if (!q && !rows.length) html = '<div class="cbx-e">لا سجلات بعد</div>';
    list.innerHTML = html; box.classList.toggle('open', !!html); inp.setAttribute('aria-expanded', html ? 'true' : 'false');
    $$('.cbx-i', list).forEach((it) => it.onmousedown = (e) => { e.preventDefault(); pick(box, it); });
  }
  function pick(box, it) {
    const inp = $('input', box); const ent = box.dataset.cbx;
    if (it.dataset.new) { inp.dataset.id = ''; } else {
      const r = (S.cache[ent]?.rows || []).find((x) => x.id == it.dataset.id);
      inp.value = r ? REF[ent].label(r) : inp.value; inp.dataset.id = it.dataset.id;
    }
    box.classList.remove('open'); box.classList.add('picked'); setTimeout(() => box.classList.remove('picked'), 700);
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }
  document.addEventListener('focusin', (e) => { const box = e.target.closest?.('.cbx'); if (box && e.target.tagName === 'INPUT') openList(box); });
  document.addEventListener('input', (e) => { const box = e.target.closest?.('.cbx'); if (!box) return; e.target.dataset.id = ''; openList(box); });
  document.addEventListener('focusout', (e) => { const box = e.target.closest?.('.cbx'); if (box) setTimeout(() => box.classList.remove('open'), 120); });
  document.addEventListener('click', (e) => { const x = e.target.closest?.('.cbx-x'); if (!x) return; const box = x.closest('.cbx'); const inp = $('input', box); inp.value = ''; inp.dataset.id = ''; inp.focus(); openList(box); });
  document.addEventListener('keydown', (e) => {
    const box = e.target.closest?.('.cbx'); if (!box || !box.classList.contains('open')) return;
    const its = $$('.cbx-i', box); if (!its.length) return; let i = its.findIndex((x) => x.classList.contains('sel'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); i = e.key === 'ArrowDown' ? (i + 1) % its.length : (i - 1 + its.length) % its.length; its.forEach((x, j) => x.classList.toggle('sel', j === i)); its[i].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); pick(box, its[i]); } else if (e.key === 'Escape') box.classList.remove('open');
  });

  // قوالب المهام: العميل اختياري دائماً ويقبل اسماً جديداً
  if (typeof qToField === 'function') {
    const baseQ = qToField;
    qToField = function (q, tpl) { const f = baseQ(q, tpl); if (q.t === 'client') { f.req = 0; f.free = true; f.hint = f.hint || 'اختياري — اختر عميلاً موجوداً أو اكتب اسماً جديداً'; } return f; };
  }

  // ---------- 2) حسابات التواصل كأيقونات ----------
  const SI = {"instagram":["FF0069","M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"],"tiktok":["000000","M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"],"snapchat":["FFFC00","M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"],"x":["000000","M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"],"facebook":["0866FF","M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"],"youtube":["FF0000","M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"],"whatsapp":["25D366","M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"],"threads":["000000","M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"],"pinterest":["BD081C","M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"],"telegram":["26A5E4","M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"],"maps":["4285F4","M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.314-.236.684-.627.687h-.007c-.466-.001-.579-.53-.695-.887-.284-.874-.581-1.713-1.019-2.525-.51-.944-1.145-1.817-1.79-2.671L19.527 4.799zM8.545 7.705l-3.959 4.707c.724 1.54 1.821 2.863 2.871 4.18.247.31.494.622.737.936l4.984-5.925-.029.01c-1.741.601-3.691-.291-4.392-1.987a3.377 3.377 0 0 1-.209-.716c-.063-.437-.077-.761-.004-1.198l.001-.007zM5.492 3.149l-.003.004c-1.947 2.466-2.281 5.88-1.117 8.77l4.785-5.689-.058-.05-3.607-3.035zM14.661.436l-3.838 4.563a.295.295 0 0 1 .027-.01c1.6-.551 3.403.15 4.22 1.626.176.319.323.683.377 1.045.068.446.085.773.012 1.22l-.003.016 3.836-4.561A8.382 8.382 0 0 0 14.67.439l-.009-.003zM9.466 5.868L14.162.285l-.047-.012A8.31 8.31 0 0 0 11.986 0a8.439 8.439 0 0 0-6.169 2.766l-.016.018 3.665 3.084z"]};
  const LI = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.4 2H3.6A1.6 1.6 0 0 0 2 3.6v16.8A1.6 1.6 0 0 0 3.6 22h16.8a1.6 1.6 0 0 0 1.6-1.6V3.6A1.6 1.6 0 0 0 20.4 2zM8 19H5V9.5h3zM6.5 8.2a1.7 1.7 0 1 1 0-3.5 1.7 1.7 0 0 1 0 3.5zM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5S12.7 13 12.7 14.3V19h-3V9.5h2.8v1.3h.1a3.1 3.1 0 0 1 2.8-1.5c3 0 3.6 2 3.6 4.6z"/></svg>';
  const WEB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
  const si = (k) => `<svg viewBox="0 0 24 24"><path fill="currentColor" d="${SI[k][1]}"/></svg>`;
  // [المفتاح، الاسم، لون العلامة، أيقونة، نمط الرابط، بناء الرابط من المعرّف]
  const NET = [
    ['instagram', 'إنستقرام', '#E4405F', si('instagram'), /instagram\.com/, (h) => `https://instagram.com/${h}`],
    ['tiktok', 'تيك توك', '#010101', si('tiktok'), /tiktok\.com/, (h) => `https://www.tiktok.com/@${h}`],
    ['snapchat', 'سناب شات', '#F7D600', si('snapchat'), /snapchat\.com/, (h) => `https://www.snapchat.com/add/${h}`],
    ['x', 'إكس', '#111111', si('x'), /(twitter|x)\.com/, (h) => `https://x.com/${h}`],
    ['facebook', 'فيسبوك', '#0866FF', si('facebook'), /(facebook|fb)\.com/, (h) => `https://facebook.com/${h}`],
    ['linkedin', 'لينكدإن', '#0A66C2', LI, /linkedin\.com/, (h) => `https://www.linkedin.com/company/${h}`],
    ['youtube', 'يوتيوب', '#FF0000', si('youtube'), /(youtube\.com|youtu\.be)/, (h) => `https://www.youtube.com/@${h}`],
    ['whatsapp', 'واتساب', '#25D366', si('whatsapp'), /(wa\.me|whatsapp\.com)/, (h) => `https://wa.me/${digits(h).replace(/^0/, '966')}`],
    ['threads', 'ثريدز', '#111111', si('threads'), /threads\.(net|com)/, (h) => `https://www.threads.net/@${h}`],
    ['telegram', 'تلجرام', '#26A5E4', si('telegram'), /(t\.me|telegram\.me)/, (h) => `https://t.me/${h}`],
    ['maps', 'خرائط جوجل', '#4285F4', si('maps'), /(maps\.app\.goo\.gl|google\.[a-z.]+\/maps|goo\.gl\/maps)/, (h) => h],
    ['web', 'الموقع / المتجر', '#15556B', WEB, /./, (h) => (/^https?:\/\//.test(h) ? h : 'https://' + h)],
  ];
  const netOf = (url) => NET.find((n) => n[0] !== 'web' && n[4].test(url)) || NET[NET.length - 1];
  const parse = (txt) => { const m = {}; String(txt || '').split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((u) => { const n = netOf(u); if (!m[n[0]]) m[n[0]] = u; else m[n[0] + '_' + Object.keys(m).length] = u; }); return m; };
  const serialize = (m) => Object.values(m).filter(Boolean).join('\n');
  const toUrl = (key, raw) => {
    const v = raw.trim(); if (!v) return '';
    if (/^https?:\/\//i.test(v) || /\.[a-z]{2,}\//i.test(v)) return /^https?:\/\//i.test(v) ? v : 'https://' + v;
    const n = NET.find((x) => x[0] === key); return n[5](v.replace(/^@/, ''));
  };
  window.nublSocialIcons = (txt, size = '') => {
    const m = parse(txt); const keys = Object.keys(m);
    if (!keys.length) return '';
    return `<div class="soc-row ${size}">${keys.map((k) => { const n = NET.find((x) => x[0] === k.split('_')[0]) || NET[NET.length - 1];
      return `<a class="soc on" href="${esc(m[k])}" target="_blank" rel="noopener" title="${esc(n[1])} — ${esc(m[k])}" style="--bc:${n[2]}" onclick="event.stopPropagation()">${n[3]}</a>`; }).join('')}</div>`;
  };

  // محرر الأيقونات (داخل نموذج العميل، وفي بطاقة العميل مباشرة)
  function socialEditor(host, txt, onChange) {
    let m = parse(txt);
    const draw = () => {
      host.innerHTML = `<div class="soc-row edit">${NET.map((n) => { const has = Object.keys(m).find((k) => k.split('_')[0] === n[0]);
        return `<button type="button" class="soc ${has ? 'on' : ''}" data-k="${n[0]}" style="--bc:${n[2]}" title="${esc(n[1])}${has ? ' — ' + esc(m[has]) : ' — اضغط لإضافة الرابط'}">${n[3]}${has ? '' : '<i>+</i>'}</button>`; }).join('')}</div>
        <div class="soc-pop" hidden><div class="soc-pop-h"></div><div class="soc-pop-r"><input class="inp" dir="ltr" autocomplete="off"><button type="button" class="btn btn-n btn-s" data-ok>حفظ</button><button type="button" class="btn btn-g btn-s" data-rm>حذف</button></div><small class="muted">الصق الرابط أو اكتب المعرّف فقط (مثل @shamsline) وسنكوّن الرابط</small></div>`;
      $$('.soc', host).forEach((b) => b.onclick = () => openPop(b.dataset.k));
    };
    const openPop = (key) => {
      const n = NET.find((x) => x[0] === key); const k = Object.keys(m).find((x) => x.split('_')[0] === key);
      const pop = $('.soc-pop', host); pop.hidden = false; pop.style.setProperty('--bc', n[2]);
      $$('.soc', host).forEach((b) => b.classList.toggle('cur', b.dataset.k === key));
      $('.soc-pop-h', pop).innerHTML = `<span class="soc on" style="--bc:${n[2]}">${n[3]}</span><b>${esc(n[1])}</b>`;
      const inp = $('input', pop); inp.value = k ? m[k] : ''; inp.placeholder = key === 'whatsapp' ? '05xxxxxxxx' : key === 'web' ? 'example.com' : '@الحساب أو الرابط';
      setTimeout(() => inp.focus(), 30);
      const save = () => { const url = toUrl(key, inp.value); if (k) delete m[k]; if (url) m[key] = url; const out = serialize(m); draw(); onChange(out); };
      $('[data-ok]', pop).onclick = save;
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { pop.hidden = true; } };
      $('[data-rm]', pop).onclick = () => { if (k) delete m[k]; draw(); onChange(serialize(m)); };
    };
    draw();
  }
  window.nublSocialEditor = socialEditor;

  // تحويل حقل «حسابات التواصل» في نموذج العميل إلى أيقونات
  const sf = ENT.clients.fields.find((f) => f.k === 'socials'); if (sf) sf.l = 'حسابات التواصل — اضغط الأيقونة لإضافة الرابط';
  function enhanceForms(root) {
    $$('textarea[name="socials"]', root).forEach((ta) => {
      if (ta.dataset.soc) return; ta.dataset.soc = 1; ta.hidden = true;
      const host = document.createElement('div'); host.className = 'soc-ed'; ta.after(host);
      socialEditor(host, ta.value, (v) => { ta.value = v; });
    });
    // بطاقة «حسابات التواصل» في صفحة العميل: عرض وتعديل مباشر
    $$('#view .card').forEach((card) => {
      const h = $('h3', card); if (!h || !/حسابات التواصل/.test(h.textContent) || card.dataset.soc) return;
      const id = (location.hash.match(/#\/client\/(\d+)/) || [])[1]; if (!id) return;
      card.dataset.soc = 1;
      const txt = [...card.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).join('\n');
      [...card.children].forEach((c) => { if (c !== h) c.remove(); });
      const host = document.createElement('div'); host.className = 'soc-ed'; card.appendChild(host);
      const writable = can('clients', 'w');
      if (!writable) { host.innerHTML = nublSocialIcons(txt) || '<div class="empty small">لم تُسجَّل بعد</div>'; return; }
      socialEditor(host, txt, async (v) => {
        try { await api(`e/clients/${id}`, { method: 'PUT', body: { socials: v || null } }); invalidate('clients'); toast('حُفظت حسابات التواصل'); } catch (e) { toast(e.message, 1); }
      });
    });
  }
  new MutationObserver(() => requestAnimationFrame(() => enhanceForms(document))).observe(document.body, { childList: true, subtree: true });

  // ---------- الأنماط ----------
  const css = `
  .cbx{position:relative}
  .cbx .inp{padding-inline-end:40px}
  .cbx-x{position:absolute;inset-inline-end:8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:9px;border:0;background:transparent;color:var(--muted);font-size:18px;cursor:pointer;opacity:0;transition:.2s}
  .cbx:hover .cbx-x,.cbx:focus-within .cbx-x{opacity:1}
  .cbx-l{position:absolute;inset-inline:0;top:calc(100% + 6px);z-index:30;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh-3,0 20px 40px rgba(0,0,0,.2));max-height:280px;overflow:auto;padding:6px;display:none}
  .cbx.open .cbx-l{display:block;animation:mpop .3s var(--spring,ease) both}
  .cbx-i{display:flex;flex-direction:column;padding:9px 12px;border-radius:10px;cursor:pointer;line-height:1.45}
  .cbx-i b{font-weight:600;color:var(--deep);display:flex;align-items:center;gap:6px}
  .cbx-i b .ai{width:16px;height:16px}
  .cbx-i small{color:var(--muted);font-size:12px}
  .cbx-i.sel,.cbx-i:hover{background:var(--soft)}
  .cbx-new b{color:var(--terra)}
  .cbx-h{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--teal);font-weight:600;padding:6px 10px 4px}
  .cbx-h .ai{width:15px;height:15px}
  .cbx-e{padding:12px;color:var(--muted);font-size:13px;text-align:center}
  .cbx.picked .inp{border-color:var(--teal);box-shadow:0 0 0 4px rgba(48,141,139,.18)}
  .soc-row{display:flex;flex-wrap:wrap;gap:8px}
  .soc{position:relative;display:inline-grid;place-items:center;width:44px;height:44px;border-radius:14px;border:1.5px dashed var(--line-2,#D8CCB6);background:#fff;color:#B7AE9F;cursor:pointer;transition:transform .3s var(--spring,ease),box-shadow .25s,background .25s,color .25s}
  .soc svg{width:21px;height:21px}
  .soc i{position:absolute;bottom:-5px;inset-inline-start:-5px;width:18px;height:18px;border-radius:50%;background:var(--gold);color:#fff;font:700 13px/18px sans-serif;text-align:center;font-style:normal;box-shadow:0 0 0 2px #fff}
  .soc:hover{transform:translateY(-3px) scale(1.06);color:var(--bc)}
  .soc.on{border:0;background:var(--bc);color:#fff;box-shadow:0 10px 18px -10px var(--bc)}
  .soc.on[style*="#F7D600"]{color:#111}
  .soc.cur{outline:3px solid rgba(48,141,139,.35);outline-offset:2px}
  .soc-row:not(.edit) .soc{width:40px;height:40px;border-radius:13px}
  .soc-pop{margin-top:10px;padding:12px;border-radius:14px;background:var(--soft);border:1px solid var(--line);animation:mpop .3s var(--spring,ease) both}
  .soc-pop-h{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .soc-pop-h .soc{width:32px;height:32px;border-radius:10px}.soc-pop-h .soc svg{width:17px;height:17px}
  .soc-pop-r{display:flex;gap:6px;margin-bottom:4px}
  .soc-pop-r .inp{flex:1;min-width:0}
  .soc-pop-r .btn{min-height:46px}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();
