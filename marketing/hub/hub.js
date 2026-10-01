/* منصة نُبل وابتكار للتسويق — النواة: الأدوات، الحالة، تعريف الكيانات، الجداول والنماذج العامة */
'use strict';
const API = '/marketing/hub/api/';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = (v) => (v == null || v === '' ? '—' : `<span class="num">${nf.format(Number(v))}</span> ر.س`);
const moneyTxt = (v) => nf.format(Number(v) || 0);
const todayStr = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function fdate(d) {
  if (!d) return '—'; const s = String(d).slice(0, 10); const [y, m, dd] = s.split('-');
  if (!m) return esc(d); return `<span class="num">${+dd}</span> ${MONTHS[+m - 1]} <span class="num">${y}</span>`;
}
function relDays(d) {
  if (!d) return ''; const diff = Math.round((new Date(String(d).slice(0, 10)) - new Date(todayStr())) / 864e5);
  if (diff === 0) return 'اليوم'; if (diff === 1) return 'غداً'; if (diff === -1) return 'أمس';
  return diff > 0 ? `بعد ${diff} يوم` : `متأخر ${-diff} يوم`;
}
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
function toast(msg, err) {
  const el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg;
  $('#toast').appendChild(el); setTimeout(() => el.remove(), err ? 5000 : 2600);
}
function waLink(phone, text) {
  if (!phone) return null; let p = String(phone).replace(/\D/g, '');
  if (/^05\d{8}$/.test(p)) p = '966' + p.slice(1);
  return `https://wa.me/${p}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

async function api(path, opts = {}) {
  const o = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
  if (opts.body !== undefined) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
  const r = await fetch(API + path, o);
  let data = {}; try { data = await r.json(); } catch { /* */ }
  if (r.status === 401 && !opts.noAuthRedirect) { S.meta = null; renderLogin(); throw new Error(data.error || 'سجّل الدخول'); }
  if (r.status === 428) { renderForcePassword(); throw new Error(data.error); }
  if (!r.ok) throw new Error(data.error || 'تعذّر تنفيذ الطلب');
  return data;
}

/* ---------- الأيقونات ---------- */
const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  home: P('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  users: P('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.7.8 2.8 2.6 3 5.2"/>'),
  funnel: P('<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>'),
  chat: P('<path d="M4 5h16v11H8l-4 4z"/>'),
  pin: P('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  brief: P('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'),
  tag: P('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>'),
  doc: P('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'),
  sign: P('<path d="M4 20h16M6 16l9.5-9.5a2.1 2.1 0 0 1 3 3L9 19H6z"/>'),
  bill: P('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  cash: P('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),
  out: P('<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'),
  folder: P('<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>'),
  check: P('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>'),
  cal: P('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  star: P('<path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z"/>'),
  book: P('<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v14h-7"/>'),
  chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  team: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  upload: P('<path d="M12 21V9M7 14l5-5 5 5M4 4h16"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  menu: P('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.5 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>',
  phone: P('<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>'),
  print: P('<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>'),
  spark: P('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
};

/* ---------- القوائم الثابتة ---------- */
const L = {
  leadStatus: ['جديد', 'قيد التواصل', 'مهتم', 'جلسة تشخيص', 'غير مهتم', 'غير صالح', 'محوّل لعميل'],
  segment: ['أ — مؤكد بالاسم', 'ب — واتساب أعمال', 'ج — مجموعات', 'عميل الكيان الأم', 'جديد كلياً'],
  source: ['قاعدة الكيان الأم', 'الموقع', 'واتساب', 'إنستقرام', 'تيك توك', 'سناب شات', 'X', 'إعلان ممول', 'إحالة', 'زيارة ميدانية', 'معرض/فعالية', 'قوقل', 'استيراد', 'أخرى'],
  interest: ['حار', 'دافئ', 'بارد'],
  stages: ['جديدة', 'تواصل أول', 'جلسة تشخيص', 'عرض سعر', 'تفاوض', 'مكسوبة', 'خاسرة'],
  loss: ['السعر', 'التوقيت', 'اختار منافساً', 'لا حاجة الآن', 'لم يعد يرد', 'خارج الفئة المستهدفة', 'أخرى'],
  actKind: ['مكالمة', 'واتساب', 'اجتماع', 'زيارة', 'بريد', 'جلسة تشخيص', 'ملاحظة', 'نموذج الموقع'],
  outcome: ['تم الرد — مهتم', 'تم الرد — غير مهتم', 'لم يرد', 'طلب التواصل لاحقاً', 'حُجز موعد', 'أُرسل عرض', 'أخرى'],
  clientStatus: ['نشط', 'موقوف مؤقتاً', 'منتهي'],
  health: ['ممتاز', 'جيد', 'معرّض للخطر'],
  quoteStatus: ['مسودة', 'مرسل', 'مقبول', 'مرفوض', 'منتهي'],
  contractStatus: ['مسودة', 'موقّع', 'نشط', 'منتهي', 'ملغي'],
  invStatus: ['مسودة', 'مصدرة', 'مدفوعة جزئياً', 'مدفوعة', 'ملغاة'],
  payMethod: ['تحويل بنكي', 'نقداً', 'مدى / شبكة', 'رابط دفع', 'شيك'],
  expCat: ['رواتب', 'عمولات', 'اشتراكات وأدوات', 'إنتاج وتصوير', 'طباعة (الكيان الأم)', 'مستقلون', 'إعلانات الكيان', 'نقل ومواصلات', 'أخرى'],
  projType: ['إدارة حساب شهري', 'هوية بصرية', 'موقع / متجر', 'حملة موسمية', 'تصوير / فيديو', 'فعالية', 'ملف تعريفي', 'أخرى'],
  projStatus: ['نشط', 'معلّق', 'مكتمل', 'ملغي'],
  taskStatus: ['جديدة', 'قيد التنفيذ', 'مراجعة', 'تعديلات', 'منجزة'],
  priority: ['عاجلة', 'عالية', 'عادية', 'منخفضة'],
  contentStatus: ['فكرة', 'كتابة', 'تصميم', 'مراجعة', 'بانتظار اعتماد العميل', 'تعديلات', 'معتمد', 'مجدول', 'منشور', 'ملغي'],
  platform: ['إنستقرام', 'تيك توك', 'سناب شات', 'X', 'لينكدإن', 'فيسبوك', 'يوتيوب', 'قوقل بزنس', 'واتساب'],
  format: ['منشور', 'كاروسيل', 'ريل', 'ستوري', 'فيديو', 'إعلان ممول', 'مقال'],
  pillar: ['تعليمي', 'عرض / بيع', 'خلف الكواليس', 'موسمي', 'دليل اجتماعي', 'هوية وقيم'],
  artCat: ['البيع', 'التشغيل', 'العقود', 'الهوية', 'أدلة الأدوات', 'أخرى'],
  kind: [['package', 'باقة'], ['service', 'خدمة مفردة'], ['print', 'مطبوعات']],
  plan: [['single', 'دفعة واحدة'], ['monthly', 'شهرياً مقدماً'], ['60-40', 'دفعتان 60% + 40%'], ['50-30-20', '50% / 30% / 20%'], ['3q', '3 دفعات ربعية'], ['4q', '4 دفعات ربعية']],
};
const PILL = {
  'جديد': 'b', 'قيد التواصل': 'g', 'مهتم': 't', 'جلسة تشخيص': 't', 'غير مهتم': 'x', 'غير صالح': 'x', 'محوّل لعميل': 't',
  'جديدة': 'b', 'تواصل أول': 'g', 'عرض سعر': 'g', 'تفاوض': 'o', 'مكسوبة': 't', 'خاسرة': 'r',
  'نشط': 't', 'موقوف مؤقتاً': 'o', 'منتهي': 'x', 'ممتاز': 't', 'جيد': 'b', 'معرّض للخطر': 'r',
  'مسودة': 'x', 'مرسل': 'b', 'مقبول': 't', 'مرفوض': 'r', 'موقّع': 't', 'ملغي': 'x',
  'مصدرة': 'b', 'مدفوعة جزئياً': 'g', 'مدفوعة': 't', 'ملغاة': 'x', 'متأخرة': 'r',
  'قيد التنفيذ': 'g', 'مراجعة': 'o', 'تعديلات': 'r', 'منجزة': 't', 'معلّق': 'o', 'مكتمل': 't',
  'عاجلة': 'r', 'عالية': 'o', 'عادية': 'b', 'منخفضة': 'x', 'حار': 'r', 'دافئ': 'o', 'بارد': 'b',
  'فكرة': 'x', 'كتابة': 'b', 'تصميم': 'g', 'بانتظار اعتماد العميل': 'o', 'معتمد': 't', 'مجدول': 'b', 'منشور': 't',
};
const pill = (v) => (v ? `<span class="pill ${PILL[v] || ''}">${esc(v)}</span>` : '');

/* ---------- الحالة العامة ---------- */
const S = { meta: null, cache: {}, route: '' };
const me = () => S.meta?.user || {};
const can = (ent, op = 'r') => (S.meta?.perms?.[ent] || '').includes(op);
const isBoss = () => ['admin', 'manager'].includes(me().role);
const userName = (id) => S.meta?.users.find((u) => u.id == id)?.name || '';
const sectorName = (id) => S.meta?.sectors.find((s) => s.id === id)?.name || id || '';
const optLabel = (opts, v) => { const o = (opts || []).find((x) => (Array.isArray(x) ? x[0] : x) == v); return o ? (Array.isArray(o) ? o[1] : o) : v; };

const REF = {
  clients: { label: (r) => r.name },
  leads: { label: (r) => [r.company, r.name].filter(Boolean).join(' — ') || r.phone },
  deals: { label: (r) => r.title },
  projects: { label: (r) => r.name },
  contracts: { label: (r) => `${r.number || ''} ${r.title || ''}`.trim() },
  invoices: { label: (r) => `${r.number} — ${moneyTxt(r.total)}` },
};
async function refs(ent, force) {
  if (ent === 'users') return S.meta.users;
  if (!can(ent)) return [];
  if (!force && S.cache[ent] && Date.now() - S.cache[ent].t < 60e3) return S.cache[ent].rows;
  const d = await api(`e/${ent}?limit=2000`);
  S.cache[ent] = { t: Date.now(), rows: d.rows };
  return d.rows;
}
const invalidate = (ent) => { delete S.cache[ent]; };
function refLabel(ent, id) {
  if (id == null || id === '') return '';
  if (ent === 'users') return userName(id);
  const r = S.cache[ent]?.rows.find((x) => x.id == id);
  return r ? REF[ent].label(r) : `#${id}`;
}

/* ---------- تعريف الكيانات للواجهة ----------
   t: text|textarea|number|money|date|select|ref|phone|email|url|bool|sector|month
   list: يظهر في الجدول · filter: فلتر في شريط الأدوات */
const F = (k, l, t = 'text', x = {}) => ({ k, l, t, ...x });
const ENT = {
  leads: {
    title: 'العملاء المحتملون', one: 'عميل محتمل', icon: 'users', detail: 'lead',
    fields: [
      F('name', 'اسم الشخص', 'text', { list: 1, req: 1 }), F('company', 'المنشأة / النشاط', 'text', { list: 1 }),
      F('phone', 'الجوال', 'phone', { list: 1 }), F('email', 'البريد', 'email'), F('city', 'المدينة'),
      F('sector', 'القطاع', 'sector', { list: 1, filter: 1 }), F('segment', 'الشريحة', 'select', { o: L.segment, filter: 1 }),
      F('source', 'المصدر', 'select', { o: L.source, list: 1, filter: 1 }), F('status', 'الحالة', 'select', { o: L.leadStatus, list: 1, filter: 1, def: 'جديد' }),
      F('interest', 'درجة الاهتمام', 'select', { o: L.interest, list: 1, filter: 1 }), F('owner_id', 'المسؤول', 'ref', { ref: 'users', list: 1, filter: 1 }),
      F('next_followup', 'موعد المتابعة', 'date', { list: 1 }), F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  },
  deals: {
    title: 'الصفقات', one: 'صفقة', icon: 'funnel',
    fields: [
      F('title', 'عنوان الصفقة', 'text', { list: 1, req: 1, w: 'full' }), F('lead_id', 'العميل المحتمل', 'ref', { ref: 'leads', list: 1 }),
      F('client_id', 'العميل', 'ref', { ref: 'clients' }), F('stage', 'المرحلة', 'select', { o: L.stages, list: 1, filter: 1, def: 'جديدة' }),
      F('value', 'القيمة المتوقعة (قبل الضريبة)', 'money', { list: 1 }), F('probability', 'احتمال الإغلاق %', 'number'),
      F('expected_close', 'تاريخ الإغلاق المتوقع', 'date', { list: 1 }), F('owner_id', 'المسؤول', 'ref', { ref: 'users', list: 1, filter: 1 }),
      F('sector', 'القطاع', 'sector'), F('package', 'الباقة / الخدمة'), F('loss_reason', 'سبب الخسارة', 'select', { o: L.loss }),
      F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  },
  activities: {
    title: 'سجل التواصل', one: 'تواصل', icon: 'chat',
    fields: [
      F('kind', 'النوع', 'select', { o: L.actKind, list: 1, filter: 1, req: 1, def: 'مكالمة' }), F('at', 'التاريخ', 'datetime', { list: 1 }),
      F('lead_id', 'العميل المحتمل', 'ref', { ref: 'leads', list: 1 }), F('client_id', 'العميل', 'ref', { ref: 'clients', list: 1 }),
      F('deal_id', 'الصفقة', 'ref', { ref: 'deals' }), F('subject', 'الموضوع', 'text', { list: 1 }),
      F('outcome', 'النتيجة', 'select', { o: L.outcome, list: 1, filter: 1 }), F('user_id', 'بواسطة', 'ref', { ref: 'users', list: 1, filter: 1, ro: 1 }),
      F('next_step', 'الخطوة التالية'), F('next_date', 'تاريخ الخطوة التالية', 'date'), F('notes', 'التفاصيل', 'textarea', { w: 'full' }),
    ],
  },
  visits: {
    title: 'الزيارات الميدانية', one: 'زيارة', icon: 'pin', custom: 'visits',
    fields: [
      F('place_name', 'المنشأة', 'text', { list: 1, req: 1 }), F('city', 'المدينة', 'text', { list: 1 }), F('at', 'الوقت', 'datetime', { list: 1 }),
      F('lead_id', 'العميل المحتمل', 'ref', { ref: 'leads' }), F('client_id', 'العميل', 'ref', { ref: 'clients' }),
      F('outcome', 'النتيجة', 'select', { o: L.outcome, list: 1 }), F('interest', 'الاهتمام', 'select', { o: L.interest, list: 1 }),
      F('user_id', 'المندوب', 'ref', { ref: 'users', list: 1, filter: 1, ro: 1 }), F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  },
  clients: {
    title: 'العملاء', one: 'عميل', icon: 'brief', detail: 'client',
    fields: [
      F('name', 'اسم العميل / المنشأة', 'text', { list: 1, req: 1 }), F('brand', 'العلامة التجارية'), F('sector', 'القطاع', 'sector', { list: 1, filter: 1 }),
      F('contact_name', 'الشخص المسؤول', 'text', { list: 1 }), F('phone', 'الجوال', 'phone', { list: 1 }), F('email', 'البريد', 'email'), F('city', 'المدينة'),
      F('status', 'الحالة', 'select', { o: L.clientStatus, list: 1, filter: 1, def: 'نشط' }), F('health', 'صحة الحساب', 'select', { o: L.health, list: 1, filter: 1, def: 'جيد' }),
      F('account_manager_id', 'مدير الحساب', 'ref', { ref: 'users', list: 1, filter: 1 }), F('package', 'الباقة الحالية'),
      F('start_date', 'بداية التعامل', 'date'), F('renewal_date', 'موعد التجديد', 'date', { list: 1 }), F('report_day', 'يوم التقرير الشهري', 'number'),
      F('cr_number', 'السجل التجاري'), F('vat_number', 'الرقم الضريبي'), F('national_address', 'العنوان الوطني', 'text', { w: 'full' }),
      F('socials', 'حسابات التواصل (رابط في كل سطر)', 'textarea', { w: 'full' }), F('drive_link', 'مجلد الأصول (Drive)', 'url', { w: 'full' }),
      F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  },
  catalog: {
    title: 'الكتالوج والأسعار', one: 'بند', icon: 'tag',
    fields: [
      F('kind', 'النوع', 'select', { o: L.kind, list: 1, filter: 1, req: 1 }), F('sector', 'القطاع / المجموعة', 'text', { list: 1 }),
      F('code', 'الرمز', 'text', { list: 1 }), F('name', 'الاسم', 'text', { list: 1, req: 1, w: 'full' }),
      F('months', 'المدة (شهور)', 'number', { list: 1 }), F('monthly', 'السعر الشهري', 'money', { list: 1 }), F('price', 'السعر الإجمالي', 'money', { list: 1 }),
      F('unit', 'الوحدة'), F('plan', 'خطة الدفع', 'select', { o: L.plan }), F('delivery', 'التسليم / الدفع'),
      F('active', 'مفعّل', 'bool', { def: 1 }), F('details', 'تفاصيل (JSON أو نص)', 'textarea', { w: 'full' }),
    ],
  },
  quotes: {
    title: 'عروض الأسعار', one: 'عرض سعر', icon: 'doc', detail: 'quote',
    fields: [
      F('number', 'الرقم', 'text', { list: 1, ro: 1 }), F('title', 'العنوان', 'text', { list: 1 }), F('client_id', 'العميل', 'ref', { ref: 'clients', list: 1 }),
      F('lead_id', 'العميل المحتمل', 'ref', { ref: 'leads', list: 1 }), F('total', 'الإجمالي شامل الضريبة', 'money', { list: 1, ro: 1 }),
      F('valid_until', 'صالح حتى', 'date', { list: 1 }), F('status', 'الحالة', 'select', { o: L.quoteStatus, list: 1, filter: 1 }),
    ],
  },
  contracts: {
    title: 'العقود', one: 'عقد', icon: 'sign', detail: 'contract',
    fields: [
      F('number', 'رقم العقد', 'text', { list: 1, ro: 1 }), F('client_id', 'العميل', 'ref', { ref: 'clients', list: 1, req: 1 }),
      F('title', 'عنوان العقد', 'text', { list: 1, w: 'full' }), F('package', 'الباقة / النطاق', 'textarea', { w: 'full' }),
      F('start_date', 'تاريخ البداية', 'date', { list: 1 }), F('months', 'المدة (شهور)', 'number', { def: 1 }), F('end_date', 'تاريخ النهاية', 'date', { list: 1 }),
      F('monthly_value', 'القيمة الشهرية (قبل الضريبة)', 'money', { list: 1 }), F('total_value', 'إجمالي العقد (قبل الضريبة)', 'money'),
      F('plan', 'خطة الدفع', 'select', { o: L.plan, def: 'monthly' }), F('status', 'الحالة', 'select', { o: L.contractStatus, list: 1, filter: 1, def: 'مسودة' }),
      F('auto_renew', 'تجديد تلقائي', 'bool', { def: 1 }), F('notice_days', 'مهلة الإشعار (يوم)', 'number', { def: 30 }), F('signed_at', 'تاريخ التوقيع', 'date'),
      F('owner_id', 'مسؤول الحساب', 'ref', { ref: 'users', filter: 1 }), F('file_link', 'رابط نسخة العقد الموقّعة', 'url', { w: 'full' }),
      F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  },
  invoices: {
    title: 'الفواتير والمطالبات', one: 'فاتورة', icon: 'bill', detail: 'invoice',
    fields: [
      F('number', 'الرقم', 'text', { list: 1, ro: 1 }), F('client_id', 'العميل', 'ref', { ref: 'clients', list: 1, req: 1 }),
      F('contract_id', 'العقد', 'ref', { ref: 'contracts' }), F('description', 'البيان', 'text', { list: 1, w: 'full' }),
      F('issue_date', 'تاريخ الإصدار', 'date', { def: todayStr }), F('due_date', 'تاريخ الاستحقاق', 'date', { list: 1 }),
      F('subtotal', 'المبلغ قبل الضريبة', 'money', { req: 1 }), F('total', 'الإجمالي', 'money', { list: 1, ro: 1 }), F('paid', 'المدفوع', 'money', { list: 1, ro: 1 }),
      F('status', 'الحالة', 'select', { o: L.invStatus, list: 1, filter: 1, def: 'مسودة' }), F('tax_ref', 'رقم الفاتورة الضريبية (النظام المحاسبي)'),
      F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  },
  payments: {
    title: 'المدفوعات', one: 'دفعة', icon: 'cash',
    fields: [
      F('paid_at', 'التاريخ', 'date', { list: 1, def: todayStr }), F('client_id', 'العميل', 'ref', { ref: 'clients', list: 1 }),
      F('invoice_id', 'الفاتورة', 'ref', { ref: 'invoices', list: 1 }), F('amount', 'المبلغ', 'money', { list: 1, req: 1 }),
      F('method', 'الطريقة', 'select', { o: L.payMethod, list: 1, filter: 1 }), F('ref', 'المرجع'), F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  },
  expenses: {
    title: 'المصروفات', one: 'مصروف', icon: 'out',
    fields: [
      F('date', 'التاريخ', 'date', { list: 1, def: todayStr }), F('category', 'البند', 'select', { o: L.expCat, list: 1, filter: 1, req: 1 }),
      F('vendor', 'المورد / الجهة', 'text', { list: 1 }), F('amount', 'المبلغ', 'money', { list: 1, req: 1 }), F('vat', 'الضريبة', 'money'),
      F('client_id', 'مرتبط بعميل', 'ref', { ref: 'clients', list: 1 }), F('receipt_link', 'رابط الإيصال', 'url'), F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  },
  projects: {
    title: 'المشاريع', one: 'مشروع', icon: 'folder',
    fields: [
      F('name', 'اسم المشروع', 'text', { list: 1, req: 1, w: 'full' }), F('client_id', 'العميل', 'ref', { ref: 'clients', list: 1, filter: 1 }),
      F('contract_id', 'العقد', 'ref', { ref: 'contracts' }), F('type', 'النوع', 'select', { o: L.projType, list: 1, filter: 1 }),
      F('status', 'الحالة', 'select', { o: L.projStatus, list: 1, filter: 1, def: 'نشط' }), F('owner_id', 'المسؤول', 'ref', { ref: 'users', list: 1 }),
      F('start_date', 'البداية', 'date'), F('due_date', 'موعد التسليم', 'date', { list: 1 }), F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  },
  tasks: {
    title: 'المهام', one: 'مهمة', icon: 'check',
    fields: [
      F('title', 'المهمة', 'text', { list: 1, req: 1, w: 'full' }), F('client_id', 'العميل', 'ref', { ref: 'clients', list: 1, filter: 1 }),
      F('project_id', 'المشروع', 'ref', { ref: 'projects' }), F('assignee_id', 'المكلّف', 'ref', { ref: 'users', list: 1, filter: 1 }),
      F('status', 'الحالة', 'select', { o: L.taskStatus, list: 1, filter: 1, def: 'جديدة' }), F('priority', 'الأولوية', 'select', { o: L.priority, list: 1, filter: 1, def: 'عادية' }),
      F('due_date', 'الاستحقاق', 'date', { list: 1 }), F('revisions', 'جولات التعديل', 'number', { list: 1 }),
      F('est_hours', 'الساعات المقدّرة', 'number'), F('spent_hours', 'الساعات الفعلية', 'number'),
      F('link', 'رابط الملف', 'url', { w: 'full' }), F('description', 'الوصف', 'textarea', { w: 'full' }),
    ],
  },
  content: {
    title: 'تقويم المحتوى', one: 'منشور', icon: 'cal',
    fields: [
      F('client_id', 'العميل', 'ref', { ref: 'clients', list: 1, filter: 1, req: 1 }), F('publish_date', 'تاريخ النشر', 'date', { list: 1, req: 1 }),
      F('platform', 'المنصة', 'select', { o: L.platform, list: 1, filter: 1 }), F('format', 'الصيغة', 'select', { o: L.format, list: 1 }),
      F('pillar', 'المحور', 'select', { o: L.pillar }), F('status', 'الحالة', 'select', { o: L.contentStatus, list: 1, filter: 1, def: 'فكرة' }),
      F('title', 'الفكرة / العنوان', 'text', { list: 1, w: 'full', req: 1 }), F('caption', 'النص (الكابشن)', 'textarea', { w: 'full' }),
      F('assignee_id', 'مدير الحساب', 'ref', { ref: 'users', filter: 1 }), F('designer_id', 'المصمم', 'ref', { ref: 'users', list: 1, filter: 1 }),
      F('revisions', 'جولات التعديل', 'number'), F('asset_link', 'رابط التصميم', 'url'), F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  },
  seasons: {
    title: 'تقويم المواسم', one: 'موسم', icon: 'star',
    fields: [
      F('name', 'الموسم', 'text', { list: 1, req: 1 }), F('date', 'تاريخ الموسم', 'date', { list: 1, req: 1 }),
      F('plan_days', 'تسليم الخطة قبل (يوم)', 'number', { def: 42 }), F('print_days', 'جاهزية المطبوعات قبل (يوم)', 'number', { def: 28 }),
      F('sectors', 'القطاعات المعنية', 'text', { list: 1 }), F('notes', 'ملاحظات', 'textarea', { w: 'full', list: 1 }),
    ],
  },
  articles: {
    title: 'قاعدة المعرفة', one: 'مقال', icon: 'book',
    fields: [
      F('category', 'التصنيف', 'select', { o: L.artCat, list: 1, filter: 1 }), F('title', 'العنوان', 'text', { list: 1, req: 1, w: 'full' }),
      F('body', 'المحتوى', 'textarea', { w: 'full', rows: 14 }),
    ],
  },
};

/* ---------- عرض قيمة حقل ---------- */
function cell(f, row) {
  const v = row[f.k];
  switch (f.t) {
    case 'money': return v == null ? '—' : money(v);
    case 'date': {
      if (!v) return '<span class="muted">—</span>';
      const late = ['next_followup', 'due_date', 'publish_date'].includes(f.k) && v < todayStr();
      return `<span class="n" ${late ? 'style="color:var(--red)"' : ''}>${fdate(v)}</span>`;
    }
    case 'datetime': return v ? fdate(v) + ` <span class="muted small num">${String(v).slice(11, 16)}</span>` : '—';
    case 'select': return f.k === 'status' || f.k === 'stage' || f.k === 'interest' || f.k === 'health' || f.k === 'priority' ? pill(optLabel(f.o, v)) : esc(optLabel(f.o, v) ?? '');
    case 'ref': return esc(refLabel(f.ref, v));
    case 'sector': return esc(sectorName(v));
    case 'phone': return v ? `<span class="num">${esc(v)}</span>` : '';
    case 'bool': return v ? '✓' : '—';
    case 'number': return v == null ? '' : `<span class="num">${esc(v)}</span>`;
    case 'url': return v ? `<a href="${esc(v)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">فتح ↗</a>` : '';
    default: { const s = String(v ?? ''); return esc(s.length > 70 ? s.slice(0, 70) + '…' : s); }
  }
}

/* ---------- حقول النموذج ---------- */
function input(f, val, ro) {
  const name = `name="${f.k}"`; const req = f.req ? 'required' : '';
  const v = val ?? '';
  if (ro || f.ro) return `<div class="inp" style="background:var(--soft)">${f.t === 'money' ? money(v) : f.t === 'ref' ? esc(refLabel(f.ref, v)) : esc(v) || '—'}</div>`;
  switch (f.t) {
    case 'textarea': return `<textarea class="inp" ${name} ${req} rows="${f.rows || 4}">${esc(v)}</textarea>`;
    case 'number': case 'money': return `<input class="inp num" type="number" step="any" inputmode="decimal" ${name} ${req} value="${esc(v)}">`;
    case 'date': return `<input class="inp" type="date" ${name} ${req} value="${esc(String(v).slice(0, 10))}">`;
    case 'datetime': return `<input class="inp" type="datetime-local" ${name} ${req} value="${esc(String(v).replace(' ', 'T').slice(0, 16))}">`;
    case 'email': return `<input class="inp" type="email" dir="ltr" ${name} ${req} value="${esc(v)}">`;
    case 'url': return `<input class="inp" type="url" dir="ltr" ${name} ${req} value="${esc(v)}" placeholder="https://">`;
    case 'phone': return `<input class="inp num" type="tel" dir="ltr" ${name} ${req} value="${esc(v)}" placeholder="05xxxxxxxx">`;
    case 'bool': return `<label class="chk"><input type="checkbox" ${name} ${v ? 'checked' : ''}> نعم</label>`;
    case 'select': return `<select class="inp" ${name} ${req}><option value=""></option>${f.o.map((o) => {
      const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}" ${k == v ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
    case 'sector': return `<select class="inp" ${name} ${req}><option value=""></option>${S.meta.sectors.map((s) =>
      `<option value="${s.id}" ${s.id === v ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}<option value="other" ${v === 'other' ? 'selected' : ''}>قطاع آخر</option></select>`;
    case 'ref': {
      if (f.ref === 'users') return `<select class="inp" ${name} ${req}><option value=""></option>${S.meta.users.filter((u) => u.active || u.id == v)
        .map((u) => `<option value="${u.id}" ${u.id == v ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`;
      const rows = S.cache[f.ref]?.rows || [];
      const id = `dl_${f.k}_${Math.random().toString(36).slice(2, 7)}`;
      const cur = v ? `${refLabel(f.ref, v)} ⟨${v}⟩` : '';
      return `<input class="inp" list="${id}" data-ref="${f.ref}" ${name} ${req} value="${esc(cur)}" placeholder="ابحث واختر…" autocomplete="off">
        <datalist id="${id}">${rows.slice(0, 2000).map((r) => `<option value="${esc(REF[f.ref].label(r))} ⟨${r.id}⟩"></option>`).join('')}</datalist>`;
    }
    default: return `<input class="inp" type="text" ${name} ${req} value="${esc(v)}">`;
  }
}
function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    if (f.ro) continue;
    const el = form.elements[f.k]; if (!el) continue;
    let v;
    if (f.t === 'bool') v = el.checked ? 1 : 0;
    else if (f.t === 'ref' && f.ref !== 'users') { const m = String(el.value).match(/⟨(\d+)⟩\s*$/); v = m ? Number(m[1]) : (el.value.trim() === '' ? null : undefined); if (v === undefined) throw new Error(`اختر «${f.l}» من القائمة`); }
    else if (f.t === 'number' || f.t === 'money') v = el.value === '' ? null : Number(el.value);
    else if (f.t === 'datetime') v = el.value ? el.value.replace('T', ' ') + ':00' : null;
    else if (f.t === 'ref') v = el.value === '' ? null : Number(el.value);
    else v = el.value.trim() === '' ? null : el.value.trim();
    out[f.k] = v;
  }
  return out;
}

/* ---------- النوافذ ---------- */
function modal({ title, body, foot = '', wide = false, onOpen }) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true"><div class="modal-h"><h3>${title}</h3><button class="x" aria-label="إغلاق">×</button></div>
    <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  $('.x', bg).onclick = close; document.addEventListener('keydown', onKey);
  document.body.appendChild(bg); onOpen && onOpen(bg, close);
  return { el: bg, close };
}
function confirmBox(msg) {
  return new Promise((res) => {
    const m = modal({ title: 'تأكيد', body: `<p>${msg}</p>`, foot: '<button class="btn btn-d" data-y>نعم، تابع</button><button class="btn btn-g" data-n>إلغاء</button>' });
    $('[data-y]', m.el).onclick = () => { m.close(); res(true); }; $('[data-n]', m.el).onclick = () => { m.close(); res(false); };
  });
}

/* نموذج إنشاء/تعديل عام */
async function openForm(ent, row = null, preset = {}, onSaved) {
  const def = ENT[ent];
  const needRefs = [...new Set(def.fields.filter((f) => f.t === 'ref' && f.ref !== 'users').map((f) => f.ref))];
  await Promise.all(needRefs.map((r) => refs(r).catch(() => [])));
  const data = { ...(row || {}) };
  if (!row) for (const f of def.fields) { if (preset[f.k] !== undefined) data[f.k] = preset[f.k]; else if (f.def !== undefined) data[f.k] = typeof f.def === 'function' ? f.def() : f.def; }
  const writable = can(ent, 'w');
  const fields = def.fields.filter((f) => !(f.ro && !row));
  const body = `<form class="fgrid" novalidate>${fields.map((f) => `<label class="f ${f.w === 'full' || f.t === 'textarea' ? 'full' : ''}"><span>${f.l}${f.req ? ' <i>*</i>' : ''}</span>${input(f, data[f.k], !writable)}</label>`).join('')}</form>`;
  const foot = (writable ? `<button class="btn btn-p" data-save>حفظ</button>` : '') + '<button class="btn btn-g" data-cancel>إغلاق</button><span class="sp"></span>'
    + (row && can(ent, 'd') ? '<button class="btn btn-d" data-del>حذف</button>' : '');
  const m = modal({ title: (row ? 'تعديل ' : 'إضافة ') + def.one, body, foot, wide: def.fields.length > 10 });
  $('[data-cancel]', m.el).onclick = m.close;
  const save = $('[data-save]', m.el);
  if (save) save.onclick = async () => {
    const form = $('form', m.el);
    try {
      const vals = readForm(form, fields);
      for (const f of fields) if (f.req && (vals[f.k] == null || vals[f.k] === '')) throw new Error(`حقل «${f.l}» مطلوب`);
      for (const [k, v] of Object.entries(preset)) if (vals[k] === undefined && !fields.find((f) => f.k === k)) vals[k] = v;
      save.disabled = true;
      const res = row ? await api(`e/${ent}/${row.id}`, { method: 'PUT', body: vals }) : await api(`e/${ent}`, { method: 'POST', body: vals });
      invalidate(ent); toast('تم الحفظ'); m.close(); onSaved ? onSaved(res.row) : rerender();
    } catch (e) { toast(e.message, 1); save.disabled = false; }
  };
  const del = $('[data-del]', m.el);
  if (del) del.onclick = async () => {
    if (!(await confirmBox(`حذف هذا ${def.one} نهائياً؟`))) return;
    try { await api(`e/${ent}/${row.id}`, { method: 'DELETE' }); invalidate(ent); toast('تم الحذف'); m.close(); onSaved ? onSaved(null) : rerender(); } catch (e) { toast(e.message, 1); }
  };
  return m;
}

/* ---------- الجدول العام ---------- */
async function listView(ent, opts = {}) {
  const def = ENT[ent]; const v = $('#view');
  const st = (S.list ||= {})[ent] ||= { q: '', f: {}, offset: 0 };
  const listF = def.fields.filter((f) => f.list);
  const filters = def.fields.filter((f) => f.filter);
  v.innerHTML = `<div class="toolbar">
    <div class="search">${I.search}<input class="inp" id="q" placeholder="بحث…" value="${esc(st.q)}"></div>
    ${filters.map((f) => `<select class="inp" data-f="${f.k}"><option value="">${f.l}: الكل</option>${
      (f.t === 'ref' ? S.meta.users.filter((u) => u.active).map((u) => [u.id, u.name]) : f.t === 'sector' ? S.meta.sectors.map((s) => [s.id, s.name]) : f.o)
        .map((o) => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}" ${st.f[f.k] == k ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`).join('')}
    <span class="sp"></span>${opts.extra || ''}
    <button class="btn btn-g btn-s" id="csv">تصدير CSV</button>
    ${can(ent, 'w') && !opts.noAdd ? `<button class="btn btn-p" id="add">${I.plus} ${def.one} جديد</button>` : ''}
  </div><div id="tbl"><div class="empty">جارٍ التحميل…</div></div>`;
  const load = async () => {
    const qs = new URLSearchParams({ limit: 200, offset: st.offset });
    if (st.q) qs.set('q', st.q);
    for (const [k, val] of Object.entries({ ...st.f, ...(opts.fixed || {}) })) if (val !== '' && val != null) qs.set('f_' + k, val);
    const refsNeeded = [...new Set(listF.filter((f) => f.t === 'ref' && f.ref !== 'users').map((f) => f.ref))];
    const [d] = await Promise.all([api(`e/${ent}?${qs}`), ...refsNeeded.map((r) => refs(r).catch(() => []))]);
    S.lastRows = d.rows;
    if (!d.rows.length) { $('#tbl').innerHTML = `<div class="tbl-wrap"><div class="empty"><div class="star"></div><br>لا توجد سجلات${st.q || Object.values(st.f).some(Boolean) ? ' مطابقة' : ' بعد'}</div></div>`; return; }
    $('#tbl').innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr>${listF.map((f) => `<th>${f.l}</th>`).join('')}${opts.rowActions ? '<th></th>' : ''}</tr></thead>
      <tbody>${d.rows.map((r) => `<tr data-id="${r.id}">${listF.map((f) => `<td>${cell(f, r)}</td>`).join('')}${opts.rowActions ? `<td class="n">${opts.rowActions(r)}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      <div class="pager"><span>${d.total} سجل</span>${st.offset > 0 ? '<button class="btn btn-g btn-s" data-p="-1">السابق</button>' : ''}${st.offset + 200 < d.total ? '<button class="btn btn-g btn-s" data-p="1">التالي</button>' : ''}</div>`;
    $$('#tbl tbody tr').forEach((tr) => tr.onclick = (e) => {
      if (e.target.closest('a,button')) return;
      const row = d.rows.find((r) => r.id == tr.dataset.id);
      if (def.detail) go(`#/${def.detail}/${row.id}`); else openForm(ent, row);
    });
    $$('#tbl [data-p]').forEach((b) => b.onclick = () => { st.offset += 200 * +b.dataset.p; load(); });
    opts.after && opts.after(d.rows);
  };
  $('#q').oninput = debounce((e) => { st.q = e.target.value.trim(); st.offset = 0; load(); });
  $$('[data-f]', v).forEach((s) => s.onchange = () => { st.f[s.dataset.f] = s.value; st.offset = 0; load(); });
  const add = $('#add'); if (add) add.onclick = () => (opts.onAdd ? opts.onAdd() : openForm(ent, null, opts.preset || {}));
  $('#csv').onclick = () => exportCsv(def.title, def.fields, S.lastRows || []);
  await load();
}

function exportCsv(name, fields, rows) {
  const plain = (f, r) => {
    const v = r[f.k]; if (v == null) return '';
    if (f.t === 'ref') return refLabel(f.ref, v); if (f.t === 'sector') return sectorName(v); if (f.t === 'select') return optLabel(f.o, v);
    return v;
  };
  const lines = [fields.map((f) => f.l), ...rows.map((r) => fields.map((f) => plain(f, r)))]
    .map((a) => a.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}-${todayStr()}.csv`; a.click();
}

/* ---------- التنقل ---------- */
function go(h) { if (location.hash === h) rerender(); else location.hash = h; }
let ROUTES = {};
async function rerender() {
  const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [name, id, sub] = h.split('/');
  S.route = name;
  $$('.nav-a').forEach((a) => a.classList.toggle('on', a.dataset.r === name || (a.dataset.alt || '').split(',').includes(name)));
  $('.side')?.classList.remove('open');
  const r = ROUTES[name];
  if (!r) { $('#view').innerHTML = '<div class="empty">الصفحة غير موجودة</div>'; return; }
  $('#ptitle').textContent = r.title || ENT[r.ent]?.title || '';
  try { await r.render(id, sub); } catch (e) { console.error(e); $('#view').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => S.meta && rerender());

/* ---------- الدخول ---------- */
function renderLogin() {
  $('#root').innerHTML = `<div class="login"><form class="login-card" id="lf">
    <img src="../logo.png" alt="نُبل وابتكار"><h1>منصة نُبل وابتكار للتسويق</h1>
    <p class="sub">الإدارة · العملاء · العقود · التشغيل</p>
    <label class="f"><span>البريد الإلكتروني</span><input class="inp" name="email" type="email" dir="ltr" autocomplete="username" required></label>
    <label class="f"><span>كلمة المرور</span><input class="inp" name="password" type="password" dir="ltr" autocomplete="current-password" required></label>
    <button class="btn btn-p">دخول</button><div class="login-strip"></div></form></div>`;
  $('#lf').onsubmit = async (e) => {
    e.preventDefault(); const b = $('button', e.target); b.disabled = true;
    try {
      await api('auth/login', { method: 'POST', body: { email: e.target.email.value, password: e.target.password.value }, noAuthRedirect: true });
      await boot();
    } catch (err) { toast(err.message, 1); b.disabled = false; }
  };
}
function renderForcePassword() {
  $('#root').innerHTML = `<div class="login"><form class="login-card" id="pf">
    <img src="../logo.png" alt=""><h1>تعيين كلمة مرور جديدة</h1>
    <p class="sub">كلمة المرور الحالية مؤقتة — اختر كلمة خاصة بك (8 أحرف على الأقل).</p>
    <label class="f"><span>كلمة المرور المؤقتة</span><input class="inp" name="current" type="password" dir="ltr" required></label>
    <label class="f"><span>كلمة المرور الجديدة</span><input class="inp" name="next" type="password" dir="ltr" minlength="8" autocomplete="new-password" required></label>
    <label class="f"><span>تأكيدها</span><input class="inp" name="again" type="password" dir="ltr" minlength="8" required></label>
    <button class="btn btn-p">حفظ والمتابعة</button></form></div>`;
  $('#pf').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    if (f.next.value !== f.again.value) return toast('كلمتا المرور غير متطابقتين', 1);
    try { await api('auth/password', { method: 'POST', body: { current: f.current.value, next: f.next.value } }); toast('تم تحديث كلمة المرور'); await boot(); }
    catch (err) { toast(err.message, 1); }
  };
}

const NAV = [
  ['الرئيسية', [['dashboard', 'لوحة القيادة', 'home'], ['myday', 'يومي', 'sun']]],
  ['المبيعات و CRM', [['leads', 'العملاء المحتملون', 'users', 'leads', 'lead,import'], ['pipeline', 'الصفقات', 'funnel', 'deals'], ['activities', 'سجل التواصل', 'chat', 'activities'], ['visits', 'الزيارات الميدانية', 'pin', 'visits']]],
  ['العملاء والعقود', [['clients', 'العملاء', 'brief', 'clients', 'client'], ['quotes', 'عروض الأسعار', 'doc', 'quotes', 'quote'], ['contracts', 'العقود', 'sign', 'contracts', 'contract'], ['catalog', 'الكتالوج والأسعار', 'tag', 'catalog']]],
  ['المالية', [['invoices', 'الفواتير', 'bill', 'invoices', 'invoice'], ['payments', 'المدفوعات', 'cash', 'payments'], ['expenses', 'المصروفات', 'out', 'expenses']]],
  ['التشغيل', [['tasks', 'المهام', 'check', 'tasks'], ['content', 'تقويم المحتوى', 'cal', 'content'], ['projects', 'المشاريع', 'folder', 'projects'], ['seasons', 'المواسم', 'star', 'seasons']]],
  ['الإدارة', [['reports', 'التقارير', 'chart', '#reports'], ['kb', 'قاعدة المعرفة', 'book', 'articles'], ['team', 'الفريق', 'team', 'users'], ['settings', 'الإعدادات', 'gear', '#admin']]],
];
function navAllowed(perm) {
  if (!perm) return true;
  if (perm === '#reports') return ['admin', 'manager', 'finance'].includes(me().role);
  if (perm === '#admin') return me().role === 'admin';
  return can(perm);
}
function renderShell() {
  const u = me();
  $('#root').innerHTML = `<div class="app"><aside class="side">
    <div class="brand"><img src="../logo-white.png" alt=""><div><b>نُبل وابتكار</b><span>منصة الخدمات التسويقية</span></div></div>
    ${NAV.map(([g, items]) => { const its = items.filter((i) => navAllowed(i[3])); return its.length ? `<div class="nav-g"><h6>${g}</h6>${its.map(([r, l, ic, , alt]) =>
      `<a class="nav-a" href="#/${r}" data-r="${r}" data-alt="${alt || ''}">${I[ic]}<span>${l}</span></a>`).join('')}</div>` : ''; }).join('')}
    <div class="me"><b>${esc(u.name)}</b><span class="muted">${esc(S.meta.roles[u.role] || u.role)}</span><br>
      <button id="chpw">تغيير كلمة المرور</button> · <button id="logout">خروج</button></div></aside>
    <div class="main"><header class="top"><button class="burger" aria-label="القائمة">${I.menu}</button><h2 id="ptitle"></h2><span class="sp"></span>
      <div class="search" id="gsearch">${I.search}<input class="inp" placeholder="بحث سريع: اسم، جوال، رقم عقد…"></div></header>
      <main class="view" id="view"></main></div></div>`;
  $('.burger').onclick = () => $('.side').classList.toggle('open');
  $('#logout').onclick = async () => { await api('auth/logout', { method: 'POST' }).catch(() => {}); S.meta = null; renderLogin(); };
  $('#chpw').onclick = () => {
    const m = modal({ title: 'تغيير كلمة المرور', body: `<form><label class="f"><span>الحالية</span><input class="inp" name="current" type="password" dir="ltr"></label>
      <label class="f"><span>الجديدة (8 أحرف على الأقل)</span><input class="inp" name="next" type="password" dir="ltr"></label></form>`, foot: '<button class="btn btn-p">حفظ</button>' });
    $('.btn-p', m.el).onclick = async () => { const f = $('form', m.el); try { await api('auth/password', { method: 'POST', body: { current: f.current.value, next: f.next.value } }); toast('تم التحديث'); m.close(); } catch (e) { toast(e.message, 1); } };
  };
  $('#gsearch input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) go('#/search/' + encodeURIComponent(e.target.value.trim())); });
}

async function boot() {
  try { S.meta = await api('meta', { noAuthRedirect: true }); } catch (e) { renderLogin(); return; }
  if (S.meta.user.must_change) { renderForcePassword(); return; }
  renderShell(); rerender();
}
