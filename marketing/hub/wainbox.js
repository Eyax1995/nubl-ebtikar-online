/* منصة نُبل وابتكار للتسويق — صندوق ردود واتساب (رقم التسويق 0563413040) */
'use strict';

const WA_ROLES = ['admin', 'manager', 'sales', 'account'];
const WA_ADMIN = ['admin', 'manager'];
let waTimer = null;

function waTime(at) {
  if (!at) return '';
  const d = new Date(String(at).replace(' ', 'T') + (String(at).includes('Z') || String(at).includes('+') ? '' : 'Z'));
  const ksa = new Date(d.getTime() + 3 * 3600e3);
  const same = ksa.toISOString().slice(0, 10) === todayStr();
  const hm = ksa.toISOString().slice(11, 16);
  return same ? `<span class="num">${hm}</span>` : `${fdate(ksa.toISOString().slice(0, 10))} <span class="num">${hm}</span>`;
}
// إشعار بزر تراجع (10 ثوانٍ)
function waUndo(msg, fn) {
  const el = document.createElement('div'); el.className = 'toast wa-undo';
  el.innerHTML = `<span>${msg}</span><button type="button">تراجع</button>`;
  $('#toast').appendChild(el); const t = setTimeout(() => el.remove(), 10000);
  el.querySelector('button').onclick = async () => { clearTimeout(t); el.remove(); try { await fn(); toast('تم الاسترجاع ✓'); } catch (err) { toast(err.message, 1); } };
}
const waPhone = (id) => (String(id).startsWith('966') ? '0' + String(id).slice(3) : '+' + id);
const waBotOn = (until) => !until || Date.parse(until) <= Date.now();

async function waView(id) {
  clearInterval(waTimer);
  if (!WA_ROLES.includes(me().role)) { V().innerHTML = '<div class="empty">لا تملك صلاحية صندوق واتساب</div>'; return; }
  V().innerHTML = `<div class="wa-box ${id ? 'has-thread' : ''}"><div class="wa-list card"><div class="wa-lh"><div><b>${I.wa} محادثات رقم التسويق</b>
      <div class="small muted num" dir="ltr">0563413040</div></div>
      <div class="wa-acts">${WA_ADMIN.includes(me().role) ? '<button class="btn btn-g btn-s" id="wa-set" title="إعدادات واتساب">⚙︎ الإعدادات</button>' : ''}
      <button class="btn btn-g btn-s" id="wa-starred" title="الرسائل المهمة المحفوظة">${WA_STAR}<span class="wa-hide-m"> المهمة</span></button>
      <button class="btn btn-wa btn-s" id="wa-new">+ محادثة جديدة</button></div></div><div id="wa-threads" class="wa-threads"><div class="empty">جارٍ التحميل…</div></div></div>
    <div class="wa-thread card" id="wa-thread">${id ? '<div class="empty">جارٍ التحميل…</div>' : '<div class="empty">اختر محادثة من القائمة</div>'}</div></div>`;
  $('#wa-new').onclick = () => waStartModal();
  $('#wa-starred').onclick = () => waStarredModal();
  if ($('#wa-set')) $('#wa-set').onclick = () => waSettingsModal();
  await waLoadThreads(id);
  if (id) await waLoadThread(id);
  waTimer = setInterval(async () => {
    if (S.route !== 'wa') { clearInterval(waTimer); return; }
    await waLoadThreads(id, true).catch(() => {});
    if (id && !($('#wa-text') && $('#wa-text').value)) await waLoadThread(id, true).catch(() => {});
  }, 15000);
}

async function waLoadThreads(active, quiet) {
  const d = await api('wa/threads');
  const el = $('#wa-threads'); if (!el) return;
  el.innerHTML = d.threads.length ? d.threads.map((t) => {
    const who = t.last_kind === 'message' ? '' : t.last_kind === 'reply' ? '🤖 ' : '👤 ';
    return `<a class="wa-ti ${t.wa_id === active ? 'on' : ''}" href="#/wa/${esc(t.wa_id)}">
      <div class="wa-tn"><b>${esc(t.name || waPhone(t.wa_id))}</b><span class="small muted">${waTime(t.last_at)}</span></div>
      <div class="wa-tp small muted">${who}${esc(String(t.last_text || '').slice(0, 80))}</div>
      <div class="wa-tf">${t.name ? `<span class="small muted num" dir="ltr">${esc(waPhone(t.wa_id))}</span>` : '<span></span>'}
        ${waBotOn(t.bot_paused_until) ? '<span class="pill t">الرد الآلي يعمل</span>' : '<span class="pill o">موظف يتولى</span>'}</div></a>`;
  }).join('') : '<div class="empty">لا توجد محادثات بعد</div>';
}

// ---------- المحادثة: عرض الوسائط + أدوات الإرسال الكاملة + ذكاء نُبل ----------
const WA_MEDIA = (mid, dl, name, mime) => { const q = new URLSearchParams(); if (dl) q.set('dl', 1); if (name) q.set('name', name); if (mime) q.set('mime', mime); const t = q.toString(); return `${API}wa/media/${encodeURIComponent(mid)}${t ? '?' + t : ''}`; };
// اسم الملف الأصلي، أو اسم واضح بالامتداد الصحيح للصور والفيديو والصوت
const WA_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/3gpp': '3gp', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr', 'application/pdf': 'pdf' };
function waFileName(md, m) {
  if (md.fn) return md.fn;
  const mime = String(md.mime || '').split(';')[0].trim();
  const ext = WA_EXT[mime] || (mime.split('/')[1] || '').replace(/[^a-z0-9]/gi, '').slice(0, 5) || ({ image: 'jpg', video: 'mp4', audio: 'ogg', sticker: 'webp' }[md.t] || 'bin');
  const kind = { image: 'صورة', video: 'فيديو', audio: md.voice ? 'رسالة-صوتية' : 'صوت', sticker: 'ملصق', document: 'ملف' }[md.t] || 'مرفق';
  const d = String((m && m.at) || '').slice(0, 16).replace(' ', '_').replace(':', '-');
  return `${kind}-واتساب-${d || Date.now()}.${ext}`;
}
const WA_DL = (md, m) => WA_MEDIA(md.id, 1, waFileName(md, m), md.mime);
const waDlBtn = (md, m) => md.id ? `<a class="wa-dl" href="${WA_DL(md, m)}" download="${esc(waFileName(md, m))}" title="تنزيل ${esc(waFileName(md, m))}">${WA_DLI}<span>تنزيل</span></a>` : '';
const WA_URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const waLinkify = (t) => esc(t).replace(WA_URL_RE, (u) => `<a href="${u.startsWith('http') ? u : 'https://' + u}" target="_blank" rel="noopener">${u}</a>`);
const WA_EMOJI = ['👍', '❤️', '😂', '😮', '🙏', '✅'];
const WA_QUICK = [
  'حياك الله 🌷 معك فريق نُبل وابتكار للتسويق، كيف نقدر نخدمك؟',
  'تمام، وصلتنا رسالتك ونرجع لك خلال الدوام بإذن الله 👌',
  'ممكن تعطينا اسم النشاط ورابط حساباتك عشان نجهّز لك تشخيصاً مناسباً؟',
  'يسعدنا نحجز لك جلسة تشخيص مجانية (45 دقيقة) — أي وقت يناسبك هذا الأسبوع؟',
  'أرسلنا لك العرض، وإذا عندك أي استفسار أنا موجود ✨',
  'شكراً لتواصلك معنا 🤍',
];
const WA_AI_MODES = [
  ['reply', 'اقترح رداً', 'chat'], ['improve', 'حسّن مسودتي', 'spark'], ['shorter', 'اختصرها', 'edit'],
  ['friendly', 'لهجة ودودة', 'users'], ['formal', 'صياغة رسمية', 'doc'], ['english', 'بالإنجليزية', 'link'],
  ['followup', 'رسالة متابعة', 'clock'], ['close', 'دفع للقرار', 'star'], ['summary', 'لخّص المحادثة', 'book'],
];
const WA_PIN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 6 4 3v2H6v-2l4-3z"/><path d="M12 15v6"/></svg>';
const WA_STAR = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
const WA_DLI = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
const WA_ST = {}; // حالة كل محادثة: مسودة، مرفقات، رد على رسالة

function waBubble(m) {
  const md = m.media || {};
  let inner = '';
  if (m.quote) inner += `<div class="wa-q"><b>${m.quote.from === 'customer' ? 'العميل' : 'نحن'}</b>${esc(m.quote.text)}</div>`;
  if (md.t === 'image' || md.t === 'sticker') {
    inner += md.id ? `<a class="wa-img" href="${WA_MEDIA(md.id, 0, waFileName(md, m), md.mime)}" target="_blank" rel="noopener"><img loading="lazy" src="${WA_MEDIA(md.id)}" alt="صورة"></a>${waDlBtn(md, m)}` : '';
    if (md.cap) inner += `<div>${waLinkify(md.cap)}</div>`;
  } else if (md.t === 'video') {
    inner += md.id ? `<video controls preload="none" src="${WA_MEDIA(md.id)}"></video>${waDlBtn(md, m)}` : '';
    if (md.cap) inner += `<div>${waLinkify(md.cap)}</div>`;
  } else if (md.t === 'audio') {
    inner += md.id ? `<audio controls preload="none" src="${WA_MEDIA(md.id)}"></audio>${waDlBtn(md, m)}` : '';
  } else if (md.t === 'document') {
    inner += `<a class="wa-doc" href="${md.id ? WA_DL(md, m) : '#'}" ${md.id ? `download="${esc(waFileName(md, m))}"` : ''}><span class="ico">${I.doc}</span><span><b>${esc(waFileName(md, m))}</b><small>${esc((waFileName(md, m).split('.').pop() || '').toUpperCase())} · تنزيل مباشر</small></span></a>`;
    if (md.cap) inner += `<div>${waLinkify(md.cap)}</div>`;
  } else if (md.t === 'location' && md.loc) {
    const u = `https://www.google.com/maps?q=${md.loc.lat},${md.loc.lng}`;
    inner += `<a class="wa-loc" href="${u}" target="_blank" rel="noopener"><span class="ico">${I.pin}</span><span><b>${esc(md.loc.name || 'موقع')}</b><small>${esc(md.loc.addr || `${Number(md.loc.lat).toFixed(5)}, ${Number(md.loc.lng).toFixed(5)}`)}</small><small class="lnk">فتح في الخرائط ↗</small></span></a>`;
  } else if (md.t === 'contacts' && md.ct) {
    inner += md.ct.map((c) => `<div class="wa-ct"><span class="ico">${I.team}</span><span><b>${esc(c.n)}</b><small class="num" dir="ltr">${esc(c.p)}</small></span>
      ${m.from === 'customer' && (c.w || c.p) ? `<span class="wa-ct-a"><a class="btn btn-g btn-s" href="#/wa/${esc(String(c.w || c.p).replace(/\D/g, ''))}">محادثة</a><button type="button" class="btn btn-g btn-s" data-lead="${esc(c.n)}|${esc(c.p)}">عميل محتمل</button></span>` : ''}</div>`).join('');
  } else {
    inner += `<div>${waLinkify(m.text).replace(/\n/g, '<br>')}</div>`;
    if (md.t === 'buttons' && md.btns) inner = `<div>${esc(String(m.text).split('\n[أزرار')[0]).replace(/\n/g, '<br>')}</div><div class="wa-pbtns">${md.btns.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`;
  }
  const acts = `<div class="wa-ma">${m.msg_id ? `<button type="button" data-rep="${esc(m.msg_id)}" title="رد على هذه الرسالة">↩︎</button>` : ''}${m.msg_id && m.from === 'customer' ? `<button type="button" data-rx="${esc(m.msg_id)}" title="تفاعل">☺︎</button>` : ''}<button type="button" data-cp title="نسخ">⧉</button>${m.id ? `<button type="button" data-pin="${m.id}" class="${m.pin ? 'on' : ''}" title="${m.pin ? 'إلغاء التثبيت' : 'تثبيت في أعلى المحادثة'}">${WA_PIN}</button><button type="button" data-star="${m.id}" class="${m.star ? 'on' : ''}" title="${m.star ? 'إزالة من الرسائل المهمة' : 'حفظ في الرسائل المهمة'}">${WA_STAR}</button>` : ''}${m.id && m.del_ok ? `<button type="button" data-del="${m.id}" class="wa-del" title="حذف الرسالة من المنصة">${I.trash}</button>` : ''}</div>`;
  return `<div class="wa-m ${m.from}${m.pin ? ' pinned' : ''}${m.star ? ' starred' : ''}" data-mid="${esc(m.msg_id || '')}" data-eid="${m.id || ''}"><div class="wa-b">${inner}${m.react ? `<span class="wa-rx">${esc(m.react)}</span>` : ''}${acts}</div>
    <div class="wa-meta small muted">${m.from === 'bot' ? '🤖 الرد الآلي · ' : m.from === 'staff' ? `👤 ${esc(m.by || 'موظف')} · ` : ''}${m.star ? '<span class="wa-flag s">'+WA_STAR+'</span>' : ''}${m.pin ? '<span class="wa-flag p">'+WA_PIN+'</span>' : ''}${waTime(m.at)}${m.status === 'send_failed' ? ' · <b style="color:var(--red)">لم يُرسل</b>' : ''}</div></div>`;
}

// ملخص سطر واحد لأي رسالة (للتثبيت والقوائم)
function waBrief(m) {
  const md = m.media || {};
  const kinds = { image: '📷 صورة', video: '🎬 فيديو', audio: '🎙️ صوت', document: '📄 ' + (md.fn || 'ملف'), sticker: 'ملصق', location: '📍 موقع', contacts: '👤 جهة اتصال' };
  const t = String(md.cap || m.text || '').replace(/\[أرسل[^\]]*\]/, '').trim();
  return (kinds[md.t] ? kinds[md.t] + (t ? ' — ' : '') : '') + t.slice(0, 120);
}
function waJump(eid) {
  const el = document.querySelector(`.wa-m[data-eid="${eid}"]`); if (!el) return toast('الرسالة أقدم من آخر 300 رسالة معروضة', 1);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}
// لوحة المرفقات: الوسائط · الملفات · الروابط · المهمة والمثبتة
function waMediaPanel(id) {
  const st = WA_ST[id] || {}; const msgs = st.msgs || [];
  const who = (m) => (m.from === 'customer' ? (st.name || 'العميل') : m.from === 'bot' ? 'الرد الآلي' : (m.by || 'فريقنا'));
  const media = msgs.filter((m) => m.media && m.media.id && ['image', 'video', 'sticker'].includes(m.media.t)).reverse();
  const files = msgs.filter((m) => m.media && m.media.id && ['document', 'audio'].includes(m.media.t)).reverse();
  const links = []; msgs.slice().reverse().forEach((m) => { const t = String((m.media && m.media.cap) || m.text || ''); (t.match(WA_URL_RE) || []).forEach((u) => links.push({ u, m })); });
  const marked = msgs.filter((m) => m.star || m.pin).reverse();
  const tabs = [['media', 'الوسائط', media.length], ['files', 'الملفات', files.length], ['links', 'الروابط', links.length], ['marked', 'المهمة والمثبتة', marked.length]];
  const first = (tabs.find((t) => t[2]) || tabs[0])[0];
  const body = {
    media: media.length ? `<div class="wa-gal">${media.map((m) => { const md = m.media; return `<div class="wa-gi">${md.t === 'video' ? `<video preload="metadata" src="${WA_MEDIA(md.id)}#t=0.5" muted></video><span class="wa-gi-v">▶</span>` : `<img loading="lazy" src="${WA_MEDIA(md.id)}" alt="">`}
        <div class="wa-gi-a"><a href="${WA_MEDIA(md.id, 0, waFileName(md, m), md.mime)}" target="_blank" rel="noopener" title="فتح">⤢</a><a href="${WA_DL(md, m)}" download="${esc(waFileName(md, m))}" title="تنزيل">${WA_DLI}</a><button type="button" data-go="${m.id}" title="عرض في المحادثة">↩︎</button></div>
        <small>${esc(who(m))} · ${waTime(m.at)}</small></div>`; }).join('')}</div>` : '<div class="empty">لا صور أو فيديو في هذه المحادثة</div>',
    files: files.length ? files.map((m) => { const md = m.media; const fn = waFileName(md, m); return `<div class="wa-fl"><span class="ico">${md.t === 'audio' ? I.chat : I.doc}</span><div class="g"><b>${esc(fn)}</b><small>${esc((fn.split('.').pop() || '').toUpperCase())} · ${esc(who(m))} · ${waTime(m.at)}</small></div>
        ${md.t === 'audio' ? `<audio controls preload="none" src="${WA_MEDIA(md.id)}"></audio>` : ''}<a class="btn btn-g btn-s" href="${WA_DL(md, m)}" download="${esc(fn)}">${WA_DLI} تنزيل</a><button type="button" class="btn btn-g btn-s" data-go="${m.id}">↩︎</button></div>`; }).join('') : '<div class="empty">لا ملفات أو رسائل صوتية</div>',
    links: links.length ? links.map(({ u, m }) => { const href = u.startsWith('http') ? u : 'https://' + u; let host = u; try { host = new URL(href).hostname.replace(/^www\./, ''); } catch { /* */ } return `<div class="wa-fl"><span class="ico">${I.link}</span><div class="g"><a href="${esc(href)}" target="_blank" rel="noopener"><b>${esc(host)}</b></a><small class="num" dir="ltr">${esc(u.slice(0, 90))}</small><small>${esc(who(m))} · ${waTime(m.at)}</small></div><button type="button" class="btn btn-g btn-s" data-copy="${esc(href)}">نسخ</button><button type="button" class="btn btn-g btn-s" data-go="${m.id}">↩︎</button></div>`; }).join('') : '<div class="empty">لا روابط في هذه المحادثة</div>',
    marked: marked.length ? marked.map((m) => `<div class="wa-fl"><span class="ico">${m.pin ? WA_PIN : WA_STAR}</span><div class="g"><b>${esc(who(m))}</b><span>${esc(waBrief(m))}</span><small>${waTime(m.at)}${m.pin ? ' · مثبتة' : ''}${m.star ? ' · مهمة' : ''}</small></div><button type="button" class="btn btn-g btn-s" data-go="${m.id}">عرض</button></div>`).join('') : '<div class="empty">ثبّت رسالة أو احفظها بالنجمة من قائمة أفعال الرسالة</div>',
  };
  const m = modal({ title: `المرفقات — ${esc(st.name || waPhone(id))}`, wide: true, body: `<div class="wa-tabs">${tabs.map(([k, l, n]) => `<button type="button" data-t="${k}" class="${k === first ? 'on' : ''}">${l}<em class="num">${n}</em></button>`).join('')}</div><div class="wa-tabb" id="wa-tabb">${body[first]}</div>` });
  m.el.classList.add('wa-mp');
  $$('[data-t]', m.el).forEach((b) => b.onclick = () => { $$('[data-t]', m.el).forEach((x) => x.classList.toggle('on', x === b)); $('#wa-tabb', m.el).innerHTML = body[b.dataset.t]; });
  m.el.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]'); if (g) { m.close(); setTimeout(() => waJump(+g.dataset.go), 250); }
    const c = e.target.closest('[data-copy]'); if (c) { navigator.clipboard?.writeText(c.dataset.copy); toast('نُسخ الرابط'); }
  });
}
// الرسائل المهمة في كل المحادثات
async function waStarredModal() {
  const m = modal({ title: 'الرسائل المهمة', wide: true, body: '<div class="empty">جارٍ التحميل…</div>' });
  try {
    const d = await api('wa/starred');
    const host = $('.modal-b', m.el);
    host.innerHTML = d.items.length ? d.items.map((x) => `<a class="wa-fl" href="#/wa/${esc(x.wa_id)}" data-eid="${x.id}"><span class="ico">${WA_STAR}</span><div class="g"><b>${esc(x.name || waPhone(x.wa_id))}</b><span>${esc(waBrief(x))}</span><small>${x.from === 'customer' ? 'من العميل' : 'منّا'} · ${waTime(x.at)}${x.by ? ` · حفظها ${esc(x.by)}` : ''}</small></div></a>`).join('') : '<div class="empty">لا رسائل محفوظة بعد — اضغط النجمة على أي رسالة لحفظها هنا</div>';
    $$('a.wa-fl', host).forEach((a) => a.onclick = () => { m.close(); const eid = +a.dataset.eid; setTimeout(() => { const t = setInterval(() => { if (document.querySelector(`.wa-m[data-eid="${eid}"]`)) { clearInterval(t); waJump(eid); } }, 300); setTimeout(() => clearInterval(t), 8000); }, 200); });
  } catch (e) { toast(e.message, 1); m.close(); }
}

async function waLoadThread(id, quiet) {
  const st = WA_ST[id] ||= { files: [], reply: null };
  const ta0 = $('#wa-text'); if (ta0) st.draft = ta0.value;
  if (quiet && (st.files.length || st.busy || $('.wa-aip:not([hidden])'))) return; // لا تقاطع الموظف أثناء التحضير
  const d = await api('wa/thread/' + encodeURIComponent(id));
  const el = $('#wa-thread'); if (!el) return;
  const box0 = $('#wa-msgs'); const atBottom = !box0 || box0.scrollHeight - box0.scrollTop - box0.clientHeight < 80;
  const on = waBotOn(d.bot_paused_until);
  st.msgs = d.messages; st.name = d.name;
  el.innerHTML = `<div class="wa-th"><a class="btn btn-g btn-s wa-back" href="#/wa" title="المحادثات">→</a>
      <div class="wa-av">${esc((d.name || '؟').trim().charAt(0))}</div>
      <div class="wa-who"><b>${esc(d.name || waPhone(d.wa_id))}</b><div class="small muted num" dir="ltr">${esc(waPhone(d.wa_id))}</div></div><span class="sp"></span>
      <button class="btn btn-s btn-g" id="wa-media" title="المرفقات والوسائط والروابط والرسائل المهمة">${I.clip}<span class="wa-hide-m"> المرفقات</span>${(() => { const n = d.messages.filter((m) => m.media && m.media.id).length; return n ? `<em class="wa-cnt">${n}</em>` : ''; })()}</button>
      <button class="btn btn-s btn-g" id="wa-sum" title="ملخص المحادثة بذكاء نُبل">${I.ai}<span class="wa-hide-m"> ملخص</span></button>
      <button class="btn btn-s ${on ? 'btn-g' : 'btn-p'}" id="wa-bot" title="${on ? 'إيقاف الرد الآلي' : 'تشغيل الرد الآلي'}">🤖<span class="wa-hide-m"> ${on ? 'إيقاف الرد الآلي' : 'تشغيل الرد الآلي'}</span></button>
      ${d.can_clear ? `<button class="btn btn-s btn-g" id="wa-clr" title="حذف المحادثة من صندوق المنصة">${I.trash}<span class="wa-hide-m"> حذف المحادثة</span></button>` : ''}
      <a class="btn btn-wa btn-s" href="tel:${esc(waPhone(d.wa_id))}" title="اتصال">${I.phone}</a></div>
    <div class="wa-bar small ${on ? 'muted' : 'off'}">${on ? 'الرد الآلي يعمل لهذه المحادثة.' : `الرد الآلي متوقف حتى ${waTime(d.bot_paused_until)} — أنت من يرد.`}${d.window_open ? ` · <span class="wa-win">${I.clock} نافذة الرد الحر مفتوحة</span>` : ''}</div>
    ${(() => { const pins = d.messages.filter((m) => m.pin).reverse(); return pins.length ? `<button type="button" class="wa-pinbar" id="wa-pinbar" data-i="0"><span class="wa-pin-ic">${WA_PIN}</span><span class="wa-pin-t"><b>رسالة مثبتة${pins.length > 1 ? ` <small class="num">(1 من ${pins.length})</small>` : ''}</b><span>${esc(waBrief(pins[0]))}</span></span></button>` : ''; })()}
    <div class="wa-msgs" id="wa-msgs">${d.messages.map(waBubble).join('') || '<div class="empty">لا رسائل</div>'}</div>
    ${d.window_open ? `<div class="wa-aip" id="wa-aip" hidden></div><div class="wa-rep" id="wa-rep" hidden></div><div class="wa-files" id="wa-files" hidden></div>
      <form class="wa-compose" id="wa-form">
        <div class="wa-tools">
          <div class="wa-menu"><button type="button" class="wa-tb" id="wa-att" title="إرفاق">${I.clip}</button>
            <div class="wa-pop" id="wa-attpop" hidden>
              <button type="button" data-a="media">${I.upload}<span>صور وفيديو</span></button>
              <button type="button" data-a="doc">${I.doc}<span>ملفات ومستندات</span></button>
              <button type="button" data-a="audio">${I.chat}<span>ملف صوتي</span></button>
              <button type="button" data-a="loc">${I.pin}<span>موقع</span></button>
              <button type="button" data-a="ct">${I.team}<span>جهة اتصال</span></button>
              <button type="button" data-a="btns">${I.layers}<span>رسالة بأزرار</span></button>
              <button type="button" data-a="quick">${I.spark}<span>ردود جاهزة</span></button>
            </div></div>
          <div class="wa-menu"><button type="button" class="wa-tb aib" id="wa-ai" title="ذكاء نُبل">${I.ai}</button>
            <div class="wa-pop" id="wa-aipop" hidden><div class="wa-pop-h">${I.ai} ذكاء نُبل</div>${WA_AI_MODES.filter((x) => x[0] !== 'summary').map(([k, l, ic]) => `<button type="button" data-ai="${k}">${I[ic]}<span>${l}</span></button>`).join('')}
              <input class="inp" id="wa-aihint" placeholder="توجيه إضافي (اختياري): مثلاً اذكر الباقة السنوية"></div></div>
        </div>
        <textarea class="inp" id="wa-text" rows="1" placeholder="${MOBILE_WA() ? 'اكتب ردك…' : 'اكتب ردك… (Enter للإرسال · Shift+Enter سطر جديد)'}">${esc(st.draft || '')}</textarea>
        <button class="btn btn-wa wa-send" title="إرسال">${I.wa}<span class="wa-hide-m"> إرسال</span></button>
        <input type="file" id="wa-fmedia" accept="image/jpeg,image/png,video/mp4,video/3gpp" multiple hidden>
        <input type="file" id="wa-fdoc" multiple hidden>
        <input type="file" id="wa-faudio" accept="audio/*" multiple hidden>
      </form>
      <div class="small muted wa-hint">ردك يوقف الرد الآلي لهذه المحادثة 12 ساعة · اسحب الملفات وأفلتها هنا لإرفاقها</div>`
    : `<div class="wa-closed small"><span>مرّ أكثر من 24 ساعة على آخر رسالة من العميل، وواتساب لا يسمح بالرد الحر الآن. ابدأ برسالة قالب معتمد، ومتى ردّ العميل تُفتح النافذة 24 ساعة.</span>
      <span class="wa-acts"><button class="btn btn-g btn-s" id="wa-sum2">${I.ai} ملخص</button><button class="btn btn-wa btn-s" id="wa-tpl">إرسال قالب</button></span></div>`}`;
  const box = $('#wa-msgs'); if (box && (atBottom || !quiet)) box.scrollTop = box.scrollHeight;
  if ($('#wa-tpl')) $('#wa-tpl').onclick = () => waStartModal({ to: waPhone(d.wa_id), name: d.name });
  $('#wa-bot').onclick = async () => {
    try { await api('wa/bot/' + encodeURIComponent(id), { method: 'POST', body: { on: !on } }); toast(on ? 'أُوقف الرد الآلي لهذه المحادثة' : 'عاد الرد الآلي للعمل'); waLoadThread(id); waLoadThreads(id); }
    catch (e) { toast(e.message, 1); }
  };
  const sumBtn = () => waSummary(id);
  $('#wa-sum').onclick = sumBtn; if ($('#wa-sum2')) $('#wa-sum2').onclick = sumBtn;
  $('#wa-media').onclick = () => waMediaPanel(id);
  const clr = $('#wa-clr');
  if (clr) clr.onclick = async () => {
    if (!(await confirmBox('حذف هذه المحادثة من صندوق المنصة؟<br><small>تختفي كل رسائلها الحالية من القائمة، وتعود المحادثة تلقائياً إذا راسلك العميل مجدداً. لا تُحذف من جوال العميل.</small>'))) return;
    try {
      await api('wa/mark/' + encodeURIComponent(id), { method: 'POST', body: { kind: 'clr', on: true } });
      waUndo('حُذفت المحادثة', async () => { await api('wa/mark/' + encodeURIComponent(id), { method: 'POST', body: { kind: 'clr', on: false } }); location.hash = '#/wa/' + encodeURIComponent(id); });
      location.hash = '#/wa';
    } catch (err) { toast(err.message, 1); }
  };
  const pb = $('#wa-pinbar');
  if (pb) pb.onclick = () => {
    const pins = st.msgs.filter((m) => m.pin).reverse(); const i = +pb.dataset.i || 0; const m = pins[i % pins.length];
    waJump(m.id); const n = (i + 1) % pins.length; pb.dataset.i = n;
    if (pins.length > 1) { const nx = pins[n]; $('.wa-pin-t', pb).innerHTML = `<b>رسالة مثبتة <small class="num">(${n + 1} من ${pins.length})</small></b><span>${esc(waBrief(nx))}</span>`; }
  };

  // أفعال الرسائل: رد، تفاعل، نسخ، حفظ جهة الاتصال
  box && box.addEventListener('click', async (e) => {
    const rep = e.target.closest('[data-rep]'); const rx = e.target.closest('[data-rx]'); const cp = e.target.closest('[data-cp]'); const ld = e.target.closest('[data-lead]');
    const dl = e.target.closest('[data-del]');
    if (dl) {
      if (!(await confirmBox('حذف هذه الرسالة من صندوق المنصة؟<br><small>تختفي من المحادثة والمرفقات والرسائل المهمة. لا تُحذف من جوال العميل — واتساب لا يتيح ذلك للأنظمة.</small>'))) return;
      try {
        const eid = +dl.dataset.del;
        await api('wa/mark/' + encodeURIComponent(id), { method: 'POST', body: { event_id: eid, kind: 'del', on: true } });
        waUndo('حُذفت الرسالة', async () => { await api('wa/mark/' + encodeURIComponent(id), { method: 'POST', body: { event_id: eid, kind: 'del', on: false } }); waLoadThread(id); });
        waLoadThread(id);
      } catch (err) { toast(err.message, 1); }
      return;
    }
    const mk = e.target.closest('[data-pin],[data-star]');
    if (mk) {
      const kind = mk.dataset.pin ? 'pin' : 'star'; const on = !mk.classList.contains('on');
      try {
        await api('wa/mark/' + encodeURIComponent(id), { method: 'POST', body: { event_id: +(mk.dataset.pin || mk.dataset.star), kind, on } });
        toast(kind === 'pin' ? (on ? 'ثُبّتت الرسالة أعلى المحادثة' : 'أُلغي التثبيت') : (on ? 'حُفظت في الرسائل المهمة ✓' : 'أُزيلت من الرسائل المهمة'));
        waLoadThread(id);
      } catch (err) { toast(err.message, 1); }
      return;
    }
    if (rep) { const m = st.msgs.find((x) => x.msg_id === rep.dataset.rep); st.reply = m ? { id: m.msg_id, text: m.text, from: m.from } : null; drawReply(); $('#wa-text')?.focus(); }
    if (cp) { const b = cp.closest('.wa-b'); navigator.clipboard?.writeText(b.innerText.replace(/[↩︎☺︎⧉]/g, '').trim()); toast('نُسخ النص'); }
    if (ld) { const [n, p] = ld.dataset.lead.split('|'); openForm('leads', null, { name: n, phone: p, source: 'واتساب' }); }
    if (rx) {
      $$('.wa-rxp').forEach((x) => x.remove());
      const pop = document.createElement('div'); pop.className = 'wa-rxp';
      pop.innerHTML = WA_EMOJI.map((em) => `<button type="button">${em}</button>`).join('') + '<button type="button" data-none title="إزالة">✕</button>';
      rx.closest('.wa-b').appendChild(pop);
      pop.onclick = async (ev) => {
        const b = ev.target.closest('button'); if (!b) return; pop.remove();
        try { await api('wa/send/' + encodeURIComponent(id), { method: 'POST', body: { type: 'reaction', message_id: rx.dataset.rx, emoji: b.dataset.none !== undefined ? '' : b.textContent } }); waLoadThread(id); }
        catch (err) { toast(err.message, 1); }
      };
    }
  });

  const f = $('#wa-form'); if (!f) return;
  const ta = $('#wa-text');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'; }; grow();
  ta.addEventListener('input', () => { st.draft = ta.value; grow(); });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !MOBILE_WA()) { e.preventDefault(); f.requestSubmit(); } });
  const drawReply = () => {
    const r = $('#wa-rep'); if (!r) return;
    r.hidden = !st.reply;
    r.innerHTML = st.reply ? `<div><b>رد على ${st.reply.from === 'customer' ? 'العميل' : 'رسالتنا'}</b><span>${esc(String(st.reply.text || '').slice(0, 120))}</span></div><button type="button" aria-label="إلغاء">✕</button>` : '';
    if (st.reply) $('button', r).onclick = () => { st.reply = null; drawReply(); };
  };
  const drawFiles = () => {
    const w = $('#wa-files'); if (!w) return;
    w.hidden = !st.files.length;
    w.innerHTML = st.files.map((x, i) => `<div class="wa-fi ${x.err ? 'err' : ''}">
      ${x.preview ? `<img src="${x.preview}" alt="">` : `<span class="ico">${x.kind === 'video' ? I.upload : x.kind === 'audio' ? I.chat : I.doc}</span>`}
      <div class="wa-fi-b"><b title="${esc(x.file.name)}">${esc(x.file.name)}</b><small>${x.file.size < 1048576 ? Math.max(1, Math.round(x.file.size / 1024)) + ' ك.ب' : (x.file.size / 1048576).toFixed(1) + ' م.ب'}${x.err ? ' · ' + esc(x.err) : x.done ? ' · ✓' : ''}</small>
        ${x.kind !== 'audio' ? `<input class="inp" data-cap="${i}" placeholder="وصف (اختياري)" value="${esc(x.cap || '')}">` : ''}</div>
      <button type="button" class="wa-fi-x" data-rm="${i}" title="حذف">${I.trash}</button></div>`).join('') + (st.files.length ? `<div class="small muted">${st.files.length} مرفق — يُرسل كل مرفق برسالة مستقلة مع وصفه</div>` : '');
    $$('[data-cap]', w).forEach((inp) => inp.oninput = () => { st.files[+inp.dataset.cap].cap = inp.value; });
    $$('[data-rm]', w).forEach((b) => b.onclick = () => { const x = st.files.splice(+b.dataset.rm, 1)[0]; if (x && x.preview) URL.revokeObjectURL(x.preview); drawFiles(); });
  };
  const addFiles = (list) => {
    for (const file of list) {
      const t = (file.type || '').toLowerCase();
      const kind = /^image\/(jpeg|png)$/.test(t) ? 'image' : /^video\/(mp4|3gpp)$/.test(t) ? 'video' : /^audio\//.test(t) ? 'audio' : 'document';
      const lim = { image: 5, video: 16, audio: 16, document: 100 }[kind];
      const x = { file, kind, cap: '', preview: kind === 'image' ? URL.createObjectURL(file) : '' };
      if (file.size > lim * 1048576) x.err = `أكبر من ${lim} م.ب`;
      st.files.push(x);
    }
    drawFiles();
  };
  drawReply(); drawFiles();
  const pick = (sel) => { const inp = $(sel); inp.value = ''; inp.onchange = () => addFiles([...inp.files]); inp.click(); };
  const pops = { '#wa-att': '#wa-attpop', '#wa-ai': '#wa-aipop' };
  Object.entries(pops).forEach(([b, p]) => { $(b).onclick = (e) => { e.stopPropagation(); const el2 = $(p); const was = el2.hidden; $$('.wa-pop').forEach((x) => x.hidden = true); el2.hidden = !was; }; });
  $$('#wa-attpop [data-a]').forEach((b) => b.onclick = () => {
    $('#wa-attpop').hidden = true;
    const a = b.dataset.a;
    if (a === 'media') pick('#wa-fmedia'); else if (a === 'doc') pick('#wa-fdoc'); else if (a === 'audio') pick('#wa-faudio');
    else if (a === 'loc') waLocationModal(id); else if (a === 'ct') waContactsModal(id); else if (a === 'btns') waButtonsModal(id, ta.value);
    else if (a === 'quick') waQuickModal((t) => { ta.value = t; st.draft = t; grow(); ta.focus(); });
  });
  $$('#wa-aipop [data-ai]').forEach((b) => b.onclick = () => { $('#wa-aipop').hidden = true; waAI(id, b.dataset.ai, ta.value, $('#wa-aihint').value); });
  // السحب والإفلات واللصق
  const zone = $('#wa-thread');
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drop'); };
  zone.ondragleave = (e) => { if (e.target === zone) zone.classList.remove('drop'); };
  zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove('drop'); if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); };
  ta.addEventListener('paste', (e) => { const fl = [...(e.clipboardData?.files || [])]; if (fl.length) { e.preventDefault(); addFiles(fl); } });

  f.onsubmit = async (e) => {
    e.preventDefault(); if (st.busy) return;
    const text = ta.value.trim(); const files = st.files.filter((x) => !x.err && !x.done);
    if (!text && !files.length) return;
    const b = $('.wa-send', f); b.disabled = true; st.busy = true;
    const replyTo = st.reply ? st.reply.id : undefined;
    try {
      for (const x of files) {
        const fd = new FormData(); fd.append('file', x.file, x.file.name);
        const up = await fetch(API + 'wa/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
        const u = await up.json().catch(() => ({}));
        if (!up.ok) { x.err = u.error || 'تعذّر الرفع'; drawFiles(); continue; }
        await api('wa/send/' + encodeURIComponent(id), { method: 'POST', body: { type: u.kind, media_id: u.id, mime: u.mime, filename: u.name, caption: x.cap || '', reply_to: replyTo } });
        x.done = true; drawFiles();
      }
      if (text) await api('wa/send/' + encodeURIComponent(id), { method: 'POST', body: { type: 'text', text, reply_to: files.length ? undefined : replyTo } });
      const failed = st.files.filter((x) => x.err);
      st.files = failed; st.reply = null; st.draft = ''; ta.value = '';
      toast(failed.length ? `أُرسل الباقي — ${failed.length} مرفق لم يُرسل` : 'أُرسل', !!failed.length);
      st.busy = false; await waLoadThread(id); waLoadThreads(id);
    } catch (err) { toast(err.message, 1); st.busy = false; b.disabled = false; }
  };
  if (!quiet && !MOBILE_WA()) ta.focus();
}
const MOBILE_WA = () => window.matchMedia('(max-width:860px)').matches;

// ذكاء نُبل داخل المحادثة
async function waAI(id, mode, draft, hint) {
  const p = $('#wa-aip'); if (!p) return;
  const label = (WA_AI_MODES.find((x) => x[0] === mode) || [])[1] || '';
  p.hidden = false;
  p.innerHTML = `<div class="wa-aih">${I.ai}<b>ذكاء نُبل — ${esc(label)}</b><span class="sp"></span><button type="button" data-x>✕</button></div><div class="wa-ait shimmer">يكتب…</div>`;
  $('[data-x]', p).onclick = () => { p.hidden = true; };
  try {
    const r = await api('wa/ai/' + encodeURIComponent(id), { method: 'POST', body: { mode, draft, hint } });
    p.innerHTML = `<div class="wa-aih">${I.ai}<b>ذكاء نُبل — ${esc(label)}</b><span class="sp"></span><button type="button" data-x>✕</button></div>
      <textarea class="inp wa-ait" rows="4">${esc(r.text)}</textarea>
      <div class="wa-aia">${mode === 'summary' ? '' : '<button type="button" class="btn btn-n btn-s" data-use>استخدم في الرد</button>'}<button type="button" class="btn btn-g btn-s" data-again>توليد آخر</button>
      <span class="small muted">راجع النص قبل الإرسال — لا يُرسل شيء تلقائياً</span></div>`;
    $('[data-x]', p).onclick = () => { p.hidden = true; };
    $('[data-again]', p).onclick = () => waAI(id, mode, draft, hint);
    const use = $('[data-use]', p);
    if (use) use.onclick = () => { const ta = $('#wa-text'); ta.value = $('textarea', p).value; ta.dispatchEvent(new Event('input')); p.hidden = true; ta.focus(); };
  } catch (e) { p.innerHTML = `<div class="wa-aih">${I.ai}<b>ذكاء نُبل</b><span class="sp"></span><button type="button" data-x>✕</button></div><div class="wa-ait">${esc(e.message)}</div>`; $('[data-x]', p).onclick = () => { p.hidden = true; }; }
}
async function waSummary(id) {
  const m = modal({ title: 'ملخص المحادثة — ذكاء نُبل', icon: 'ai', body: '<div class="wa-ait shimmer">يحلل المحادثة…</div>' });
  try { const r = await api('wa/ai/' + encodeURIComponent(id), { method: 'POST', body: { mode: 'summary' } }); $('.modal-b', m.el).innerHTML = `<div class="ai-box">${esc(r.text)}</div>`; }
  catch (e) { $('.modal-b', m.el).innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// إرسال موقع
function waLocationModal(id) {
  const m = modal({ title: 'إرسال موقع', icon: 'pin', body: `<form class="fgrid" id="wa-lf" novalidate>
    <div class="full wa-lbtns"><button type="button" class="btn btn-g" id="wa-gps">${I.pin} موقعي الحالي</button></div>
    <label class="f full"><span>أو الصق رابط خرائط جوجل أو الإحداثيات</span><input class="inp" name="link" dir="ltr" placeholder="https://maps.google.com/?q=21.54,39.17  أو  21.54, 39.17"></label>
    <label class="f"><span>خط العرض <i>*</i></span><input class="inp num" name="lat" dir="ltr" inputmode="decimal"></label>
    <label class="f"><span>خط الطول <i>*</i></span><input class="inp num" name="lng" dir="ltr" inputmode="decimal"></label>
    <label class="f"><span>اسم المكان</span><input class="inp" name="name" placeholder="مثال: مقر نُبل وابتكار"></label>
    <label class="f"><span>العنوان</span><input class="inp" name="address" placeholder="الحي، الشارع، جدة"></label>
    <div class="full small muted" id="wa-lprev"></div></form>`,
    foot: '<button class="btn btn-wa" data-go>إرسال الموقع</button><button class="btn btn-g" data-x>إلغاء</button>' });
  const f = $('#wa-lf', m.el);
  const prev = () => { const a = +f.lat.value, b = +f.lng.value; $('#wa-lprev', m.el).innerHTML = a && b ? `<a href="https://www.google.com/maps?q=${a},${b}" target="_blank" rel="noopener">معاينة على الخرائط ↗</a>` : ''; };
  f.link.oninput = () => {
    const s = f.link.value; const mm = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
    if (mm) { f.lat.value = mm[1]; f.lng.value = mm[2]; prev(); }
  };
  f.lat.oninput = prev; f.lng.oninput = prev;
  $('#wa-gps', m.el).onclick = () => {
    if (!navigator.geolocation) return toast('المتصفح لا يدعم تحديد الموقع', 1);
    $('#wa-gps', m.el).disabled = true;
    navigator.geolocation.getCurrentPosition((p) => { f.lat.value = p.coords.latitude.toFixed(6); f.lng.value = p.coords.longitude.toFixed(6); prev(); $('#wa-gps', m.el).disabled = false; },
      (e) => { toast('تعذّر تحديد الموقع: ' + e.message, 1); $('#wa-gps', m.el).disabled = false; }, { enableHighAccuracy: true, timeout: 15000 });
  };
  $('[data-x]', m.el).onclick = m.close;
  $('[data-go]', m.el).onclick = async (e) => {
    e.target.disabled = true;
    try { await api('wa/send/' + encodeURIComponent(id), { method: 'POST', body: { type: 'location', lat: f.lat.value, lng: f.lng.value, name: f.name.value, address: f.address.value } }); m.close(); toast('أُرسل الموقع'); waLoadThread(id); }
    catch (err) { toast(err.message, 1); e.target.disabled = false; }
  };
}

// إرسال جهات اتصال (من العملاء والعملاء المحتملين أو يدوياً)
async function waContactsModal(id) {
  await Promise.all(['clients', 'leads'].map((r) => refs(r).catch(() => [])));
  const pool = [...(S.cache.clients?.rows || []).filter((r) => r.phone).map((r) => ({ n: r.contact_name ? `${r.contact_name} — ${r.name}` : r.name, p: r.phone, org: r.name, k: 'عميل' })),
    ...(S.cache.leads?.rows || []).filter((r) => r.phone).map((r) => ({ n: r.name || r.company, p: r.phone, org: r.company || '', k: 'عميل محتمل' }))];
  const chosen = [];
  const m = modal({ title: 'إرسال جهة اتصال', icon: 'team', body: `<label class="f"><span>ابحث في العملاء والعملاء المحتملين</span><input class="inp" id="wa-cq" placeholder="الاسم أو الجوال"></label>
    <div class="pick" id="wa-cl"></div><div class="wa-chosen" id="wa-cc"></div>
    <details class="wa-man"><summary>أو أضف يدوياً</summary><div class="fgrid"><label class="f"><span>الاسم</span><input class="inp" id="wa-mn"></label><label class="f"><span>الجوال</span><input class="inp" id="wa-mp" dir="ltr" placeholder="05xxxxxxxx"></label>
    <label class="f"><span>الجهة / المسمى</span><input class="inp" id="wa-mo"></label><div class="f" style="align-self:end"><button type="button" class="btn btn-g" id="wa-madd">إضافة</button></div></div></details>`,
    foot: '<button class="btn btn-wa" data-go>إرسال</button><button class="btn btn-g" data-x>إلغاء</button>' });
  const draw = () => {
    const q = $('#wa-cq', m.el).value.trim();
    const hits = pool.filter((x) => !q || x.n.includes(q) || String(x.p).includes(q.replace(/\D/g, '') || '§')).slice(0, 30);
    $('#wa-cl', m.el).innerHTML = hits.map((x, i) => `<div class="list-i" data-i="${pool.indexOf(x)}"><div class="g"><b>${esc(x.n)}</b><span class="small muted num" dir="ltr">${esc(x.p)}</span></div><span class="pill">${x.k}</span></div>`).join('') || '<div class="empty small">لا نتائج</div>';
    $$('#wa-cl [data-i]', m.el).forEach((d) => d.onclick = () => { if (chosen.length >= 5) return toast('حتى 5 جهات في الرسالة', 1); chosen.push(pool[+d.dataset.i]); drawC(); });
  };
  const drawC = () => {
    $('#wa-cc', m.el).innerHTML = chosen.map((x, i) => `<span class="pill t">${esc(x.n)} <button type="button" data-r="${i}">✕</button></span>`).join('');
    $$('#wa-cc [data-r]', m.el).forEach((b) => b.onclick = () => { chosen.splice(+b.dataset.r, 1); drawC(); });
  };
  $('#wa-cq', m.el).oninput = draw; draw();
  $('#wa-madd', m.el).onclick = () => { const n = $('#wa-mn', m.el).value.trim(), p = $('#wa-mp', m.el).value.trim(); if (!n || !p) return toast('الاسم والجوال مطلوبان', 1); chosen.push({ n, p, org: $('#wa-mo', m.el).value.trim() }); drawC(); };
  $('[data-x]', m.el).onclick = m.close;
  $('[data-go]', m.el).onclick = async (e) => {
    if (!chosen.length) return toast('اختر جهة اتصال', 1);
    e.target.disabled = true;
    try { await api('wa/send/' + encodeURIComponent(id), { method: 'POST', body: { type: 'contacts', contacts: chosen.map((x) => ({ name: x.n, phone: x.p, org: x.org })) } }); m.close(); toast('أُرسلت جهة الاتصال'); waLoadThread(id); }
    catch (err) { toast(err.message, 1); e.target.disabled = false; }
  };
}

// رسالة بأزرار رد سريع (حتى 3)
function waButtonsModal(id, text) {
  const m = modal({ title: 'رسالة بأزرار رد سريع', icon: 'layers', body: `<form class="fgrid" id="wa-bf" novalidate>
    <label class="f full"><span>نص الرسالة <i>*</i></span><textarea class="inp" name="text" rows="3">${esc(text || '')}</textarea></label>
    <label class="f"><span>الزر 1 <i>*</i></span><input class="inp" name="b1" maxlength="20" placeholder="مثال: أحجز جلسة"></label>
    <label class="f"><span>الزر 2</span><input class="inp" name="b2" maxlength="20" placeholder="مثال: أرسل العرض"></label>
    <label class="f"><span>الزر 3</span><input class="inp" name="b3" maxlength="20" placeholder="مثال: لاحقاً"></label>
    <label class="f"><span>تذييل صغير</span><input class="inp" name="footer" maxlength="60" placeholder="نُبل وابتكار للتسويق"></label>
    <div class="full"><span class="small muted">معاينة</span><div class="wa-prev" id="wa-bprev"></div></div></form>`,
    foot: '<button class="btn btn-wa" data-go>إرسال</button><button class="btn btn-g" data-x>إلغاء</button>' });
  const f = $('#wa-bf', m.el);
  const prev = () => { $('#wa-bprev', m.el).innerHTML = esc(f.text.value).replace(/\n/g, '<br>') + (f.footer.value ? `<div class="small muted">${esc(f.footer.value)}</div>` : '') + `<div class="wa-pbtns">${[f.b1, f.b2, f.b3].map((x) => x.value.trim()).filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('')}</div>`; };
  f.oninput = prev; prev();
  $('[data-x]', m.el).onclick = m.close;
  $('[data-go]', m.el).onclick = async (e) => {
    e.target.disabled = true;
    try { await api('wa/send/' + encodeURIComponent(id), { method: 'POST', body: { type: 'buttons', text: f.text.value, footer: f.footer.value, buttons: [f.b1.value, f.b2.value, f.b3.value] } }); m.close(); toast('أُرسلت الرسالة'); const ta = $('#wa-text'); if (ta) { ta.value = ''; (WA_ST[id] || {}).draft = ''; } waLoadThread(id); }
    catch (err) { toast(err.message, 1); e.target.disabled = false; }
  };
}

function waQuickModal(onPick) {
  const m = modal({ title: 'ردود جاهزة', icon: 'spark', body: `<div class="pick">${WA_QUICK.map((t, i) => `<div class="list-i" data-i="${i}"><div class="g"><span>${esc(t)}</span></div></div>`).join('')}</div>
    <div class="small muted" style="margin-top:8px">تُدرج في خانة الرد لتعدّلها قبل الإرسال.</div>` });
  $$('[data-i]', m.el).forEach((d) => d.onclick = () => { m.close(); onPick(WA_QUICK[+d.dataset.i]); });
}

document.addEventListener('click', (e) => { if (!e.target.closest('.wa-menu')) $$('.wa-pop').forEach((x) => { x.hidden = true; }); if (!e.target.closest('.wa-rxp,[data-rx]')) $$('.wa-rxp').forEach((x) => x.remove()); });

// بدء محادثة جديدة (أو إعادة فتح محادثة مغلقة) برسالة قالب معتمد
let waTplCache = null;
async function waStartModal(pre = {}) {
  const m = modal({ title: 'محادثة جديدة عبر واتساب', wide: true, body: '<div class="empty">جارٍ تحميل القوالب المعتمدة…</div>' });
  let d;
  try { d = waTplCache || (waTplCache = await api('wa/templates')); } catch (e) { $('.modal-b', m.el).innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  const list = d.templates.filter((t) => t.name !== 'hello_world');
  if (!list.length) {
    $('.modal-b', m.el).innerHTML = `<div class="wa-note">لا توجد قوالب معتمدة بعد. واتساب يشترط أن تبدأ الشركة أي محادثة بقالب تعتمده Meta مسبقاً.
      ${d.pending.length ? `<br><br>قيد المراجعة الآن: <b class="num">${d.pending.length}</b> قالباً، وتُعتمد عادةً خلال دقائق إلى 24 ساعة.` : ''}</div>`;
    return;
  }
  const catAr = { UTILITY: 'خدمي', MARKETING: 'تسويقي', AUTHENTICATION: 'تحقق' };
  $('.modal-b', m.el).innerHTML = `<form class="fgrid" id="wa-sf" novalidate>
    <label class="f"><span>رقم الجوال <i>*</i></span><input class="inp" name="to" dir="ltr" placeholder="05XXXXXXXX" value="${esc(pre.to || '')}"></label>
    <label class="f"><span>اسم العميل</span><input class="inp" name="cname" value="${esc(pre.name || '')}" placeholder="يظهر في صندوق المحادثات"></label>
    <label class="f full"><span>القالب <i>*</i></span><select class="inp" name="tpl">${list.map((t, i) => `<option value="${i}">${esc(t.name.replace(/^nubl_/, '').replace(/_/g, ' '))} — ${catAr[t.category] || t.category}</option>`).join('')}</select></label>
    <div class="full" id="wa-params"></div>
    <div class="full"><span class="small muted">معاينة الرسالة</span><div class="wa-prev" id="wa-prev"></div></div></form>
    <div class="small muted">الرسالة تُرسل من رقم التسويق 0563413040. القوالب التسويقية تُحتسب بسعر أعلى من الخدمية لدى Meta، فاستخدم الخدمي متى ناسب.</div>`;
  $('.modal-f', m.el) || m.el.querySelector('.modal').insertAdjacentHTML('beforeend', '<div class="modal-f"><button class="btn btn-wa" id="wa-sgo">إرسال</button><button class="btn btn-g" id="wa-sx">إلغاء</button></div>');
  const f = $('#wa-sf', m.el);
  const cur = () => list[+f.tpl.value];
  const vals = () => $$('[data-p]', f).map((x) => x.value.trim());
  const render = () => {
    const t = cur(); let txt = esc(t.text);
    vals().forEach((v, i) => { txt = txt.split(`{{${i + 1}}}`).join(v ? `<b>${esc(v)}</b>` : `<span class="wa-ph">{{${i + 1}}}</span>`); });
    $('#wa-prev', m.el).innerHTML = txt.replace(/\n/g, '<br>') + (t.buttons.length ? `<div class="wa-pbtns">${t.buttons.map((b) => `<span>${esc(b)}</span>`).join('')}</div>` : '');
  };
  const build = () => {
    const t = cur();
    $('#wa-params', m.el).innerHTML = t.params ? `<div class="fgrid">${Array.from({ length: t.params }, (_, i) => `<label class="f"><span>المتغير {{${i + 1}}} <i>*</i></span><input class="inp" data-p="${i}" value="${i === 0 && f.elements.cname.value ? esc(f.elements.cname.value) : ''}"></label>`).join('')}</div>` : '';
    $$('[data-p]', f).forEach((x) => (x.oninput = render)); render();
  };
  f.tpl.onchange = build;
  f.elements.cname.oninput = () => { const p0 = $('[data-p="0"]', f); if (p0 && !p0.dataset.touched) { p0.value = f.elements.cname.value; render(); } };
  f.addEventListener('input', (e) => { if (e.target.dataset.p === '0') e.target.dataset.touched = 1; });
  build();
  $('#wa-sx', m.el).onclick = m.close;
  $('#wa-sgo', m.el).onclick = async (e) => {
    const t = cur(); const params = vals();
    if (params.some((x) => !x)) return toast('املأ كل متغيرات القالب', 1);
    let preview = t.text; params.forEach((v, i) => { preview = preview.split(`{{${i + 1}}}`).join(v); });
    e.target.disabled = true;
    try {
      const r = await api('wa/start', { method: 'POST', body: { to: f.to.value, name: f.elements.cname.value, template: t.name, lang: t.lang, params, preview } });
      m.close(); toast('أُرسلت الرسالة'); location.hash = '#/wa/' + r.wa_id;
    } catch (err) { toast(err.message, 1); e.target.disabled = false; }
  };
}

// إعدادات الملف التجاري على واتساب (للمدير)
async function waSettingsModal() {
  const m = modal({ title: 'إعدادات واتساب — رقم التسويق', wide: true, body: '<div class="empty">جارٍ التحميل…</div>' });
  let d; try { d = await api('wa/profile'); } catch (e) { $('.modal-b', m.el).innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  const p = d.profile, n = d.phone;
  const VAR = { PROF_SERVICES: 'خدمات مهنية', OTHER: 'أخرى', RETAIL: 'تسوق وبيع بالتجزئة', EDU: 'تعليم', EVENT_PLAN: 'تخطيط فعاليات', FINANCE: 'خدمات مالية', APPAREL: 'ملابس', BEAUTY: 'تجميل', ENTERTAIN: 'ترفيه', GROCERY: 'بقالة', HEALTH: 'صحة', HOTEL: 'فنادق', NONPROFIT: 'غير ربحي', RESTAURANT: 'مطاعم', TRAVEL: 'سفر', AUTO: 'سيارات' };
  const nameSt = { APPROVED: 'معتمد', PENDING_REVIEW: 'قيد المراجعة', DECLINED: 'مرفوض', NONE: '—' };
  const ws = p.websites || [];
  $('.modal-b', m.el).innerHTML = `<div class="wa-prof">
    <div class="wa-ph-box"><div class="wa-avatar" id="wa-av">${p.profile_picture_url ? `<img src="${esc(p.profile_picture_url)}" alt="">` : I.wa}</div>
      <label class="btn btn-g btn-s">تغيير الصورة<input type="file" id="wa-file" accept="image/jpeg,image/png" hidden></label>
      <div class="small muted">مربعة، 640×640 بكسل على الأقل، JPG أو PNG، حتى 5 ميجابايت.</div></div>
    <div><b>${esc(n.verified_name || '')}</b> <span class="pill ${n.name_status === 'APPROVED' ? 't' : 'o'}">الاسم: ${nameSt[n.name_status] || esc(n.name_status || '')}</span>
      <div class="small muted num" dir="ltr">${esc(n.display_phone_number || '')}</div>
      <div class="small muted">جودة الرقم: ${esc(n.quality_rating || '—')}</div>
      <div class="small muted">تغيير اسم العرض يتم من مدير واتساب في Meta ويخضع لمراجعة.</div></div></div>
    <form class="fgrid" id="wa-pf" novalidate>
      <label class="f full"><span>النبذة (About) — تظهر تحت الاسم</span><input class="inp" name="about" maxlength="139" value="${esc(p.about || '')}"></label>
      <label class="f full"><span>وصف النشاط</span><textarea class="inp" name="description" maxlength="512" rows="3">${esc(p.description || '')}</textarea></label>
      <label class="f"><span>التصنيف</span><select class="inp" name="vertical">${d.verticals.map((v) => `<option value="${v}" ${p.vertical === v ? 'selected' : ''}>${VAR[v] || v}</option>`).join('')}</select></label>
      <label class="f"><span>البريد الإلكتروني</span><input class="inp" name="email" type="email" dir="ltr" value="${esc(p.email || '')}"></label>
      <label class="f full"><span>العنوان</span><input class="inp" name="address" maxlength="256" value="${esc(p.address || '')}"></label>
      <label class="f"><span>الموقع 1</span><input class="inp" name="w1" dir="ltr" placeholder="https://" value="${esc(ws[0] || '')}"></label>
      <label class="f"><span>الموقع 2</span><input class="inp" name="w2" dir="ltr" placeholder="https://" value="${esc(ws[1] || '')}"></label></form>`;
  m.el.querySelector('.modal').insertAdjacentHTML('beforeend', '<div class="modal-f"><button class="btn btn-p" id="wa-psave">حفظ التعديلات</button><button class="btn btn-g" id="wa-px">إغلاق</button></div>');
  $('#wa-px', m.el).onclick = m.close;
  $('#wa-psave', m.el).onclick = async (e) => {
    const f = $('#wa-pf', m.el);
    const body = { about: f.about.value, description: f.description.value, vertical: f.vertical.value, email: f.email.value, address: f.address.value, websites: [f.w1.value, f.w2.value].filter(Boolean) };
    e.target.disabled = true;
    try { await api('wa/profile', { method: 'POST', body }); toast('حُفظت إعدادات واتساب'); } catch (err) { toast(err.message, 1); }
    e.target.disabled = false;
  };
  $('#wa-file', m.el).onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) return toast('الصورة يجب أن تكون JPG أو PNG', 1);
    if (file.size > 5 * 1024 * 1024) return toast('الحد الأقصى 5 ميجابايت', 1);
    const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(file); });
    $('#wa-av', m.el).innerHTML = `<img src="data:${file.type};base64,${data}" alt="" style="opacity:.5">`;
    try { await api('wa/photo', { method: 'POST', body: { data, type: file.type } }); toast('تم تحديث الصورة — قد تستغرق دقائق لتظهر للعملاء'); $('img', $('#wa-av', m.el)).style.opacity = 1; }
    catch (err) { toast(err.message, 1); }
  };
}

// التسجيل في القائمة والمسارات
ROUTES.wa = { title: 'صندوق واتساب', render: waView };
(() => {
  const g = NAV.find((x) => x[0] === 'المبيعات و CRM');
  if (g && !g[1].some((i) => i[0] === 'wa')) g[1].unshift(['wa', 'صندوق واتساب', 'wa', '#wa']);
  const orig = navAllowed;
  // eslint-disable-next-line no-global-assign
  navAllowed = (perm) => (perm === '#wa' ? WA_ROLES.includes(me().role) : orig(perm));
})();

(() => {
  const css = `.wa-box{display:grid;grid-template-columns:340px 1fr;gap:14px;height:calc(100vh - 120px);min-height:480px}
  .wa-list,.wa-thread{padding:0;display:flex;flex-direction:column;overflow:hidden}
  .wa-lh{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line)}
  .wa-lh svg{width:16px;height:16px;color:#1FA855;vertical-align:-3px}
  .wa-threads{overflow:auto;flex:1}
  .wa-ti{display:block;padding:10px 14px;border-bottom:1px solid var(--line);color:inherit}
  .wa-ti:hover{background:var(--soft)}.wa-ti.on{background:#E3F2F1}
  .wa-tn,.wa-tf{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .wa-tp{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:2px 0}
  .wa-th{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line)}
  .wa-th .sp{flex:1}.wa-back{display:none}
  .wa-msgs{flex:1;overflow:auto;padding:14px;background:#EFE9DE;display:flex;flex-direction:column;gap:8px}
  .wa-m{max-width:78%;display:flex;flex-direction:column}
  .wa-m.customer{align-self:flex-start}.wa-m.bot,.wa-m.staff{align-self:flex-end}
  .wa-b{padding:8px 12px;border-radius:12px;background:#fff;box-shadow:0 1px 1px rgba(0,0,0,.06);white-space:normal;word-break:break-word}
  .wa-m.bot .wa-b{background:#DCF5E3}.wa-m.staff .wa-b{background:#D7ECF4}
  .wa-meta{padding:2px 6px}
  .wa-compose{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--line);align-items:flex-end}
  .wa-compose textarea{flex:1;resize:vertical;min-height:44px}
  .wa-closed{padding:12px 14px;border-top:1px solid var(--line);background:#FBEEE8;color:#A04A1F;display:flex;gap:12px;align-items:center;justify-content:space-between}
  .wa-acts{display:flex;gap:6px}
  .wa-prev{margin-top:6px;padding:12px 14px;border-radius:12px;background:#DCF5E3;line-height:1.8;max-width:520px}
  .wa-ph{color:#A04A1F;background:#FBEEE8;border-radius:4px;padding:0 3px}
  .wa-pbtns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.wa-pbtns span{background:#fff;border-radius:8px;padding:4px 10px;font-size:.85em;color:#1F8A4C}
  .wa-note{padding:14px;background:var(--soft);border-radius:10px;line-height:1.9}
  .wa-prof{display:flex;gap:18px;align-items:flex-start;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--line)}
  .wa-ph-box{display:flex;flex-direction:column;align-items:center;gap:8px;width:170px;text-align:center}
  .wa-avatar{width:110px;height:110px;border-radius:50%;overflow:hidden;background:var(--soft);display:grid;place-items:center}
  .wa-avatar img{width:100%;height:100%;object-fit:cover}.wa-avatar svg{width:44px;height:44px;color:#1FA855}
  @media(max-width:860px){.wa-prof{flex-direction:column;align-items:center}.wa-closed{flex-direction:column;align-items:stretch}.wa-box{grid-template-columns:1fr;height:auto}.wa-box.has-thread .wa-list{display:none}
    .wa-box:not(.has-thread) .wa-thread{display:none}.wa-back{display:inline-flex}.wa-msgs{max-height:60vh}}
  .wa-th{gap:10px}.wa-av{width:40px;height:40px;border-radius:14px;background:var(--g-brand,#15556B);color:#fff;display:grid;place-items:center;font-weight:700;flex:none}
  .wa-who{min-width:0}.wa-who b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wa-th .btn .ai,.wa-th .btn svg{width:17px;height:17px}
  .wa-bar{padding:6px 14px;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:4px;align-items:center}.wa-bar.off{color:var(--terra)}
  .wa-win{display:inline-flex;align-items:center;gap:4px;color:var(--teal);font-weight:600}.wa-win .ai{width:14px;height:14px}
  .wa-msgs{background:#EFE9DE;background-image:radial-gradient(rgba(24,86,109,.06) 1px,transparent 1px);background-size:18px 18px}
  .wa-b{position:relative;border-radius:16px;padding:8px 12px 10px;line-height:1.7}
  .wa-m.customer .wa-b{border-top-right-radius:4px}.wa-m.staff .wa-b,.wa-m.bot .wa-b{border-top-left-radius:4px}
  .wa-img img{display:block;max-width:min(280px,100%);max-height:320px;border-radius:12px;margin-bottom:4px;object-fit:cover;background:#ddd}
  .wa-b video{max-width:min(300px,100%);border-radius:12px;display:block}
  .wa-b audio{width:min(280px,70vw);display:block}
  .wa-doc,.wa-loc,.wa-ct{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.65);border:1px solid rgba(0,0,0,.05);color:inherit;margin-bottom:4px;min-width:220px}
  .wa-doc b,.wa-loc b,.wa-ct b{display:block;font-size:13.5px;word-break:break-all}.wa-doc small,.wa-loc small,.wa-ct small{display:block;color:var(--muted);font-size:11.5px}
  .wa-doc .ico,.wa-loc .ico,.wa-ct .ico{width:36px;height:36px;font-size:19px}
  .wa-ct{flex-wrap:wrap}.wa-ct-a{display:flex;gap:6px;width:100%}
  .wa-q{border-inline-start:3px solid var(--teal);background:rgba(0,0,0,.04);border-radius:8px;padding:4px 8px;margin-bottom:6px;font-size:12.5px;color:var(--muted)}.wa-q b{display:block;color:var(--teal);font-size:11.5px}
  .wa-rx{position:absolute;bottom:-12px;inset-inline-start:8px;background:#fff;border-radius:99px;padding:0 5px;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.15)}
  .wa-ma{position:absolute;top:-14px;inset-inline-end:6px;display:none;gap:2px;background:#fff;border-radius:99px;padding:2px 4px;box-shadow:0 4px 12px rgba(0,0,0,.15)}
  .wa-m:hover .wa-ma,.wa-m:focus-within .wa-ma{display:flex}
  .wa-dl{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:4px 10px;border-radius:6px;background:rgba(24,86,109,.08);color:var(--navy);font-size:12px;font-weight:700}.wa-dl:hover{background:var(--navy);color:#fff}
  .wa-ma button.wa-del svg{width:15px;height:15px}.wa-ma button.wa-del:hover{color:var(--red,#c0392b)}.wa-undo{display:flex;align-items:center;gap:14px;pointer-events:auto}.wa-undo button{border:0;background:rgba(255,255,255,.18);color:inherit;font:inherit;font-weight:700;border-radius:8px;padding:3px 12px;cursor:pointer}.wa-ma button.on{color:var(--terra)}.wa-ma button[data-star].on{color:var(--gold)}.wa-ma button svg{vertical-align:-2px}
  .wa-flag{display:inline-flex;vertical-align:-2px;margin-inline-end:4px}.wa-flag.s{color:var(--gold)}.wa-flag.p{color:var(--terra)}
  .wa-m.starred .wa-b{box-shadow:inset 3px 0 0 var(--gold)}.wa-m.pinned .wa-b{outline:1px dashed rgba(208,100,41,.5)}
  @keyframes wa-flash{0%,60%{background:rgba(219,156,71,.28)}100%{background:transparent}}.wa-m.flash{animation:wa-flash 1.8s ease-out;border-radius:6px}
  .wa-pinbar{display:flex;align-items:center;gap:10px;width:100%;text-align:start;border:0;border-bottom:1px solid var(--line);background:#FBF1E1;padding:7px 14px;cursor:pointer;font:inherit;color:var(--ink)}
  .wa-pinbar:hover{background:#F0DDB8}.wa-pin-ic{color:var(--terra);display:inline-flex}.wa-pin-t{display:flex;flex-direction:column;min-width:0;line-height:1.45}.wa-pin-t b{font-size:12px;color:var(--navy)}.wa-pin-t span{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wa-cnt{font-style:normal;background:var(--terra);color:#fff;border-radius:99px;font-size:11px;padding:0 6px;margin-inline-start:4px;font-family:"DG Agnadeen",sans-serif}
  .wa-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:10px}
  .wa-tabs button{border:1px solid var(--line);background:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font:inherit;font-weight:700;color:var(--muted)}.wa-tabs button.on{background:var(--navy);border-color:var(--navy);color:#fff}
  .wa-tabs em{font-style:normal;margin-inline-start:6px;opacity:.8;font-size:12px}
  .wa-tabb{max-height:62vh;overflow:auto}
  .wa-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
  .wa-gi{position:relative;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#F1F5F6}.wa-gi img,.wa-gi video{width:100%;aspect-ratio:1;object-fit:cover;display:block}
  .wa-gi small{display:block;padding:5px 8px;font-size:11px;color:var(--muted)}.wa-gi-v{position:absolute;top:8px;inset-inline-start:8px;background:rgba(24,86,109,.85);color:#fff;border-radius:6px;padding:0 6px;font-size:11px}
  .wa-gi-a{position:absolute;top:6px;inset-inline-end:6px;display:flex;gap:4px;opacity:0;transition:opacity .2s}.wa-gi:hover .wa-gi-a,.wa-gi:focus-within .wa-gi-a{opacity:1}
  .wa-gi-a a,.wa-gi-a button{display:grid;place-items:center;width:28px;height:28px;border-radius:6px;border:0;background:#fff;color:var(--navy);cursor:pointer}
  .wa-fl{display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--line);color:inherit}.wa-fl .g{flex:1;min-width:0;display:flex;flex-direction:column}.wa-fl .g b,.wa-fl .g span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .wa-fl small{color:var(--muted);font-size:11.5px}.wa-fl .ico{color:var(--navy)}.wa-fl audio{max-width:200px;height:32px}a.wa-fl:hover{background:#F1F5F6}
  @media(max-width:860px){.wa-gi-a{opacity:1}.wa-fl audio{display:none}.wa-gal{grid-template-columns:repeat(3,1fr)}}
  .wa-ma button{border:0;background:none;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:14px;color:var(--navy)}.wa-ma button:hover{background:var(--soft)}
  .wa-rxp{position:absolute;top:-46px;inset-inline-start:0;display:flex;gap:2px;background:#fff;border-radius:99px;padding:4px 6px;box-shadow:0 10px 24px rgba(0,0,0,.2);z-index:5;animation:mpop .3s var(--spring,ease) both}
  .wa-rxp button{border:0;background:none;font-size:20px;width:34px;height:34px;border-radius:50%;cursor:pointer;transition:transform .2s}.wa-rxp button:hover{transform:scale(1.25)}
  .wa-compose{align-items:flex-end;gap:8px;padding:10px 12px;background:#fff}
  .wa-compose textarea.inp{min-height:46px;max-height:180px;resize:none;border-radius:16px;line-height:1.6;padding-top:11px}
  .wa-tools{display:flex;gap:6px}
  .wa-tb{width:44px;height:46px;border-radius:14px;border:1.5px solid var(--line-2,#D8CCB6);background:#fff;color:var(--navy);display:grid;place-items:center;cursor:pointer;transition:transform .25s}
  .wa-tb:hover{transform:translateY(-2px)}.wa-tb .ai{width:22px;height:22px}
  .wa-tb.aib{background:linear-gradient(135deg,#0C3B4C,#308D8B);color:#fff;border:0;--ic-a:#F2B562;--ic-b:#E3F2F1}
  .wa-menu{position:relative}
  .wa-pop{position:absolute;bottom:calc(100% + 8px);inset-inline-start:0;z-index:20;width:250px;background:#fff;border-radius:18px;padding:8px;box-shadow:0 24px 50px -16px rgba(8,42,55,.5);border:1px solid var(--line);animation:mpop .3s var(--spring,ease) both}
  .wa-pop button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;padding:9px 10px;border-radius:12px;cursor:pointer;font:inherit;color:var(--ink);text-align:start}
  .wa-pop button:hover{background:var(--soft)}.wa-pop button .ai{width:20px;height:20px;color:var(--navy)}
  .wa-pop-h{display:flex;align-items:center;gap:6px;font-weight:700;color:var(--deep);padding:4px 10px 6px}.wa-pop-h .ai{width:18px;height:18px}
  .wa-pop .inp{min-height:40px;font-size:13px;margin-top:6px}
  .wa-send{min-height:46px;border-radius:14px}
  .wa-hint{padding:0 14px 10px;background:#fff}
  .wa-rep,.wa-aip,.wa-files{margin:0 12px;padding:10px 12px;border-radius:14px 14px 0 0;background:#F6F1E6;border:1px solid var(--line);border-bottom:0}
  .wa-rep{display:flex;gap:10px;align-items:center;border-inline-start:4px solid var(--teal)}.wa-rep div{flex:1;min-width:0}.wa-rep b{display:block;color:var(--teal);font-size:12px}.wa-rep span{display:block;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wa-rep button,.wa-aih button{border:0;background:none;cursor:pointer;font-size:16px;color:var(--muted)}
  .wa-rep[hidden],.wa-aip[hidden],.wa-files[hidden]{display:none}
  .wa-files{display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto}
  .wa-fi{display:flex;gap:10px;align-items:center;background:#fff;border-radius:12px;padding:6px 8px;border:1px solid var(--line)}
  .wa-fi img{width:52px;height:52px;border-radius:10px;object-fit:cover}.wa-fi .ico{width:52px;height:52px}
  .wa-fi-b{flex:1;min-width:0}.wa-fi-b b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wa-fi-b small{color:var(--muted);font-size:11.5px}
  .wa-fi-b .inp{min-height:36px;margin-top:4px;font-size:13px;padding:6px 10px}
  .wa-fi.err{border-color:#E2A496;background:#FFF6F3}
  .wa-fi-x{border:0;background:var(--soft);width:36px;height:36px;border-radius:10px;cursor:pointer;color:var(--red);display:grid;place-items:center}.wa-fi-x .ai{width:18px;height:18px}
  .wa-aip{background:linear-gradient(135deg,#0C3B4C,#15556B);color:#E6EFF3;border:0}
  .wa-aih{display:flex;align-items:center;gap:8px;margin-bottom:8px}.wa-aih .ai{width:18px;height:18px;--ic-a:#F2B562;--ic-b:#E3F2F1}.wa-aih .sp{flex:1}.wa-aih button{color:#CFE5EA}
  .wa-aip textarea.wa-ait{background:rgba(255,255,255,.96);color:var(--ink);min-height:90px}
  .wa-aia{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}.wa-aia .muted{color:#BFD9DF!important}
  .shimmer{background:linear-gradient(90deg,rgba(255,255,255,.15),rgba(255,255,255,.4),rgba(255,255,255,.15));background-size:200% 100%;animation:shim 1.2s linear infinite;border-radius:10px;padding:14px;color:#fff}
  .modal .shimmer{color:var(--deep);background:linear-gradient(90deg,#F2ECE0,#FFF,#F2ECE0);background-size:200% 100%}
  @keyframes shim{to{background-position:-200% 0}}
  .wa-thread.drop{outline:3px dashed var(--teal);outline-offset:-8px}
  .wa-chosen{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.wa-chosen button{border:0;background:none;cursor:pointer;color:inherit}
  .wa-man{margin-top:8px}.wa-man summary{cursor:pointer;color:var(--navy);font-weight:600;margin-bottom:8px}
  @media(max-width:860px){.wa-hide-m{display:none}.wa-compose{padding:8px}.wa-tb{width:42px}.wa-pop{position:fixed;inset-inline:10px;bottom:calc(var(--bn,72px) + 90px);width:auto}
    .wa-hint{display:none}.wa-th{flex-wrap:nowrap}.wa-th .btn-s{padding:5px 9px}.wa-box.has-thread .wa-thread{height:calc(100dvh - var(--top,58px) - var(--bn,72px) - 44px);display:flex}.wa-msgs{max-height:none}}`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();
