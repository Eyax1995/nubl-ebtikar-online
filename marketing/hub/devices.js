/* إشعارات الأجهزة (v18): تسجيل عامل الخدمة والاشتراك في Web Push لكل مستخدم — الجوال (بعد تثبيت المنصة على الشاشة الرئيسية) وسطح المكتب.
   • من منح إذن الإشعارات سابقاً يُشترك تلقائياً بلا أي خطوة.
   • نافذة «إشعارات هذا الجهاز» من قائمة المستخدم: الحالة، التفعيل، تجربة إشعار، وتعليمات iPhone. */
'use strict';
(function nublDevices() {
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let reg = null;

  const keyBytes = (k) => { const p = '='.repeat((4 - k.length % 4) % 4); const r = atob((k + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
  async function register() {
    if (!ok) return null;
    try { reg = reg || await navigator.serviceWorker.register('sw.js', { scope: './' }); return reg; } catch (e) { console.warn('sw', e.message); return null; }
  }
  async function subscribe() {
    const r = await register(); if (!r || Notification.permission !== 'granted') return false;
    let sub = await r.pushManager.getSubscription();
    if (!sub) { const { key } = await api('push/key'); sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }); }
    await api('push/subscribe', { method: 'POST', body: sub.toJSON() });
    return true;
  }
  async function enable() {
    if (!ok) throw new Error(ios && !standalone ? 'على iPhone: أضف المنصة إلى الشاشة الرئيسية أولاً ثم افتحها من الأيقونة' : 'هذا المتصفح لا يدعم الإشعارات');
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (p !== 'granted') throw new Error('لم يُسمح بالإشعارات — فعّلها من إعدادات المتصفح لهذا الموقع');
    await subscribe();
  }
  window.nublPush = { enable, subscribe, supported: ok };

  async function state() {
    if (!ok) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    const r = await register(); const s = r && await r.pushManager.getSubscription();
    return s && Notification.permission === 'granted' ? 'on' : 'off';
  }

  async function panel() {
    const st = await state();
    let devices = 0; try { devices = (await api('push/devices')).rows.length; } catch { /* */ }
    const txt = {
      on: ['✅ مفعّلة على هذا الجهاز', 'تصلك كل تنبيهات المنصة هنا حتى والمنصة مغلقة.'],
      off: ['🔕 غير مفعّلة على هذا الجهاز', 'فعّلها لتصلك المهام والعملاء الجدد وتحديثات العروض فوراً.'],
      denied: ['⛔ محظورة في المتصفح', 'اسمح بالإشعارات لهذا الموقع من إعدادات المتصفح ثم أعد المحاولة.'],
      unsupported: [ios && !standalone ? '📲 ثبّت المنصة أولاً' : '⚠️ غير مدعومة هنا', ios && !standalone
        ? 'على iPhone/iPad: اضغط زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية»، وافتح المنصة من الأيقونة الجديدة، ثم فعّل الإشعارات من هنا.'
        : 'استخدم متصفحاً حديثاً (Chrome أو Edge أو Safari) لتلقي الإشعارات.'],
    }[st];
    const m = modal({ title: 'إشعارات هذا الجهاز', body: `<div class="card" style="margin-bottom:12px"><b>${txt[0]}</b><p class="muted small" style="margin:6px 0 0">${txt[1]}</p></div>
      <p class="small muted">الأجهزة المفعّلة لحسابك: <b class="num">${devices}</b> · على أندرويد وiPhone ثبّت المنصة من قائمة المتصفح «إضافة إلى الشاشة الرئيسية» لتعمل كتطبيق.</p>`,
      foot: `${st === 'off' || st === 'denied' ? '<button class="btn btn-p" data-en>تفعيل الإشعارات</button>' : ''}${st === 'on' ? '<button class="btn btn-p" data-test>إرسال إشعار تجريبي</button>' : ''}` });
    const en = m.el.querySelector('[data-en]');
    if (en) en.onclick = async () => { en.disabled = true; try { await enable(); toast('فُعّلت الإشعارات على هذا الجهاز'); m.close(); panel(); } catch (e) { toast(e.message, 1); en.disabled = false; } };
    const tb = m.el.querySelector('[data-test]');
    if (tb) tb.onclick = async () => { tb.disabled = true; try { const r = await api('push/test', { method: 'POST' }); toast(r.sent ? 'أُرسل — سيظهر الإشعار خلال ثوانٍ' : 'لم يُرسل لأي جهاز — أعد التفعيل', !r.sent); } catch (e) { toast(e.message, 1); } tb.disabled = false; };
  }
  window.nublDevicesPanel = panel;

  // زر في قائمة المستخدم أسفل القائمة الجانبية
  const shell = renderShell;
  renderShell = function () {
    shell.apply(this, arguments);
    const me = document.querySelector('.side .me');
    if (me && !me.querySelector('#devbtn')) {
      const b = document.createElement('button'); b.id = 'devbtn'; b.textContent = '🔔 إشعارات الجهاز';
      me.querySelector('#chpw')?.before(b, document.createTextNode(' · '));
      b.onclick = panel;
    }
    // من منح الإذن سابقاً (إشعارات سطح المكتب) يُشترك تلقائياً
    if (ok && Notification.permission === 'granted') subscribe().catch(() => {});
    else register();
  };
  if (S.meta && document.querySelector('.side')) { renderShell(); rerender(); }
})();
