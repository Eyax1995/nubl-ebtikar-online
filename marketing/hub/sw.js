/* عامل الخدمة لمنصة نُبل وابتكار — إشعارات الدفع فقط (لا تخزين مؤقت ولا اعتراض للطلبات، فلا تظهر نسخة قديمة من المنصة أبداً).
   الخادم يرسل «إيقاظاً» فارغاً، وهنا يُجلب آخر إشعار من المنصة بجلسة المستخدم ويُعرض على الجهاز (الجوال المثبّت وسطح المكتب). */
'use strict';
const BASE = '/marketing/hub/';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let n = null, unread = 0;
    try {
      const r = await fetch(BASE + 'api/push/latest', { credentials: 'same-origin', cache: 'no-store' });
      if (r.ok) { const d = await r.json(); n = d.n; unread = d.unread || 0; }
    } catch (_) { /* بلا شبكة: إشعار عام */ }
    try { if (self.navigator.setAppBadge) await (unread ? self.navigator.setAppBadge(unread) : self.navigator.clearAppBadge()); } catch (_) { /* */ }
    // iOS وChrome يشترطان إظهار إشعار مع كل دفعة
    await self.registration.showNotification(n?.title || 'منصة نُبل وابتكار', {
      body: n?.body || 'لديك إشعار جديد — افتح المنصة للاطلاع',
      icon: BASE + 'brand/app-192.png', badge: BASE + 'brand/badge-96.png',
      tag: n ? 'n-' + n.id : 'nubl', renotify: !!n, lang: 'ar', dir: 'rtl',
      data: { link: n?.link || '', id: n?.id || null },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const { link, id } = e.notification.data || {};
  const url = BASE + (link || '');
  e.waitUntil((async () => {
    if (id) fetch(BASE + 'api/notifications/read', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.includes(BASE)) { try { await w.navigate(url); } catch (_) { /* */ } return w.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});

// تجدّد الاشتراك من المتصفح (نادر): يُسجَّل الجديد بجلسة المستخدم
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    try {
      const r = await fetch(BASE + 'api/push/key', { credentials: 'same-origin' }); const { key } = await r.json();
      const pad = '='.repeat((4 - key.length % 4) % 4); const raw = atob((key + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
      await fetch(BASE + 'api/push/subscribe', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
    } catch (_) { /* يُعاد عند فتح المنصة */ }
  })());
});
