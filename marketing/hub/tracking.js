/* مسار العميل (v18): كل انتقال للعرض/العقد/الفاتورة يُسجَّل ويُبلَّغ به العميل ومندوبه على واتساب برابط متابعة.
   بطاقة «مسار العميل ورابط المتابعة» أسفل صفحات العرض والعميل المحتمل والعميل: الرابط (نسخ/إرسال)، المستلمون، الأحداث، وحالة كل رسالة.
   وفي الإعدادات (للمدير): تشغيل/إيقاف إشعارات العملاء، حالة قالب واتساب لدى Meta، وأعداد الطابور. */
'use strict';
(function nublTracking() {
  const ST = { pending: ['بانتظار', 'o'], sent: ['أُرسلت', 't'], failed: ['تعذّرت', 'r'], skipped: ['متجاوزة', 'x'] };
  const MODE = { text: 'نص', template: 'قالب' };
  const ROLE = { client: 'العميل', rep: 'المندوب' };
  const time = (at) => { if (!at) return ''; const d = new Date(String(at).replace(' ', 'T') + 'Z'); const k = new Date(d.getTime() + 3 * 3600e3).toISOString(); return `${fdate(k.slice(0, 10))} <span class="num small muted" dir="ltr">${k.slice(11, 16)}</span>`; };

  async function card(params, ref) {
    const seq = S.renderSeq;
    let d; try { d = await api('track/info?' + new URLSearchParams(params)); } catch (e) { return; }
    if (seq !== S.renderSeq || !$('#view')) return;
    $('#trk-card')?.remove();
    const c = document.createElement('div'); c.className = 'card'; c.id = 'trk-card'; c.style.marginTop = '14px';
    const evs = d.events || []; const msgs = d.msgs || [];
    const byEv = {}; msgs.forEach((m) => (byEv[m.event_id] ||= []).push(m));
    c.innerHTML = `<h3>🧭 مسار العميل ورابط المتابعة</h3>
      ${d.link ? `<div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <input class="inp" readonly value="${esc(d.link)}" dir="ltr" style="flex:1;min-width:220px;font-size:12.5px">
        <button class="btn btn-g btn-s" data-cp>نسخ الرابط</button>
        ${can('leads', 'w') ? `<button class="btn btn-p btn-s" data-send ${d.recipients.length ? '' : 'disabled title="لا يوجد جوال للعميل أو مندوبه"'}>إرسال الرابط على واتساب</button>` : ''}
        <a class="btn btn-g btn-s" href="${esc(d.link)}" target="_blank" rel="noopener">معاينة ↗</a></div>
        <p class="small muted" style="margin:0 0 10px">يُرسل لـ: ${d.recipients.length ? d.recipients.map((r) => `${ROLE[r.role]} <span class="num" dir="ltr">${esc(r.phone)}</span>`).join(' · ') : '<b style="color:var(--red)">لا يوجد جوال — أضفه لتصل الإشعارات</b>'}
        · يُبلَّغ آلياً عند: استلام الطلب، إرسال العرض، القبول، العقد والفاتورة، وقبل انتهاء العرض بيومين.</p>` : '<p class="muted small">اربط العرض بعميل أو عميل محتمل ليظهر رابط المتابعة.</p>'}
      ${evs.length ? `<div class="tl">${evs.map((e) => `<div class="list-i" style="align-items:flex-start"><div class="g">
          <b>${esc(e.title)}</b><span class="small muted">${time(e.created_at)} · ${esc(e.user_name || e.via || 'آلي')}${e.detail ? ' · ' + esc(e.detail) : ''}</span>
          ${(byEv[e.id] || []).map((m) => `<span class="small"><span class="pill ${ST[m.status]?.[1] || 'x'}">${esc(ST[m.status]?.[0] || m.status)}</span> واتساب ${ROLE[m.role] || ''} <span class="num" dir="ltr">${esc(m.to_phone)}</span>${m.mode ? ' · ' + MODE[m.mode] : ''}${m.error && m.status !== 'sent' ? ` — <span class="muted">${esc(m.error)}</span>` : ''}${m.status === 'failed' && can('leads', 'w') ? ` <button class="btn btn-g btn-s" data-retry="${m.id}">إعادة</button>` : ''}</span>`).join('<br>')}
        </div></div>`).join('')}</div>` : '<div class="empty small">لا أحداث بعد — ستظهر هنا كل مرحلة يمر بها العميل.</div>'}`;
    $('#view').appendChild(c);
    c.querySelector('[data-cp]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(d.link); toast('نُسخ رابط المتابعة'); } catch { prompt('انسخ الرابط:', d.link); } });
    const sb = c.querySelector('[data-send]');
    if (sb) sb.onclick = () => {
      const m = modal({ title: 'إرسال رابط المتابعة', body: `<p class="small muted">يصل للعميل${d.recipients.some((r) => r.role === 'rep') ? ' ومندوبه' : ''} على واتساب مع الرابط. اكتب رسالة قصيرة أو اتركها للنص الافتراضي:</p>
        <textarea class="inp" rows="3" id="trk-note" placeholder="هذا رابط متابعة طلبك لدى نُبل وابتكار: تجد فيه مراحل العمل وعروض الأسعار ويمكنك قبولها مباشرة."></textarea>`, foot: '<button class="btn btn-p">إرسال</button>' });
      m.el.querySelector('.btn-p').onclick = async (e) => {
        e.target.disabled = true;
        try { const r = await api('track/send', { method: 'POST', body: { ...ref, note: $('#trk-note').value.trim() } }); toast(r.queued ? 'أُرسل الرابط' : 'سُجّل — سيُرسل عند الإمكان'); m.close(); card(params, ref); }
        catch (err) { toast(err.message, 1); e.target.disabled = false; }
      };
    };
    c.querySelectorAll('[data-retry]').forEach((b) => b.onclick = async () => { b.disabled = true; try { await api('track/retry/' + b.dataset.retry, { method: 'POST' }); card(params, ref); } catch (e) { toast(e.message, 1); } });
  }

  const wrap = (name, fn) => { const r = ROUTES[name]; if (!r) return; const base = r.render; r.render = async (...a) => { await base(...a); try { await fn(...a); } catch (e) { console.warn('track', e.message); } }; };
  wrap('quote', async (id) => { const q = String(id || '').split('?')[0]; if (/^\d+$/.test(q)) await card({ quote_id: q }, await (async () => { const { row } = await api('e/quotes/' + q); return { lead_id: row.lead_id, client_id: row.client_id }; })()); });
  wrap('lead', async (id) => { if (/^\d+$/.test(String(id))) await card({ lead_id: id }, { lead_id: +id }); });
  wrap('client', async (id) => { if (/^\d+$/.test(String(id))) await card({ client_id: id }, { client_id: +id }); });

  // الإعدادات: إشعارات العملاء
  wrap('settings', async () => {
    if (me().role !== 'admin' || $('#trk-set')) return;
    const st = await api('track/status');
    const c = document.createElement('div'); c.className = 'card'; c.id = 'trk-set'; c.style.marginTop = '14px';
    const tpl = String(st.template || '');
    const tplTxt = tpl === 'APPROVED' ? '<span class="pill t">معتمد</span>' : /PENDING/.test(tpl) ? '<span class="pill o">قيد مراجعة Meta</span>' : /REJECTED|FAILED/.test(tpl) ? `<span class="pill r">${esc(tpl)}</span>` : `<span class="pill x">${esc(tpl || 'لم يُنشأ بعد')}</span>`;
    const n = st.counts || {};
    c.innerHTML = `<h3>📣 إشعارات العملاء على واتساب</h3>
      <p class="muted small">تصل العميل ومندوبه رسالة برابط المتابعة عند كل مرحلة. داخل 24 ساعة من آخر رسالة للعميل تُرسل نصاً، وخارجها بقالب «nubl_client_update» بعد اعتماده من Meta.</p>
      <label class="small" style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="trk-on" ${st.enabled ? 'checked' : ''}> تشغيل الإشعارات الآلية للعملاء</label>
      <div class="small">قالب واتساب: ${tplTxt} <button class="btn btn-g btn-s" id="trk-chk">فحص/إنشاء الآن</button></div>
      <div class="small muted" style="margin-top:6px">الطابور: أُرسلت <b class="num">${n.sent || 0}</b> · بانتظار <b class="num">${n.pending || 0}</b> · تعذّرت <b class="num">${n.failed || 0}</b></div>`;
    ($('#view .grid.g2 > div:last-child') || $('#view')).appendChild(c);
    $('#trk-on').onchange = async (e) => { await api('settings', { method: 'PUT', body: { client_notify: e.target.checked ? '1' : '0' } }); toast(e.target.checked ? 'شُغّلت إشعارات العملاء' : 'أُوقفت إشعارات العملاء'); };
    $('#trk-chk').onclick = async (e) => { e.target.disabled = true; await api('track/status?check=1'); c.remove(); ROUTES.settings && rerender(); };
  });

  if (S.meta && $('.side')) rerender();
})();
