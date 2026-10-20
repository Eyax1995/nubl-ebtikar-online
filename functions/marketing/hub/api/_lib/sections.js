// صلاحيات الأقسام لكل مستخدم (المرحلة 2 — الخطوة 6ج، v15)
// طبقة فوق صلاحيات الأدوار لا تستبدلها: الدور يحدد ما يُسمح به (r/w/d)، والأقسام تحجب أقساماً كاملة عن مستخدم بعينه.
// users.sections = NULL ← كل الأقسام (الوضع الافتراضي، لا تغيير على أحد)، أو قائمة مفصولة بفواصل مثل 'crm,clients,ops'.
// المدير العام (admin) لا تُقيَّد أقسامه حتى لا يُقفل على نفسه.
import { ENTITIES } from './schema.js';

export const SECTIONS = {
  crm: 'المبيعات و CRM',
  clients: 'العملاء والعقود',
  finance: 'المالية',
  ops: 'التشغيل',
  marketing: 'التسويق',
  hr: 'الموارد البشرية',
  knowledge: 'المعرفة',
  store: 'المتجر',
};

// قسم كل كيان (ما لا يُذكر هنا — مثل users — لا يتبع قسماً)
export const ENTITY_SECTION = {
  leads: 'crm', deals: 'crm', activities: 'crm', visits: 'crm',
  clients: 'clients', quotes: 'clients', contracts: 'clients', catalog: 'clients',
  invoices: 'finance', payments: 'finance', expenses: 'finance', accounts: 'finance', journals: 'finance', reps: 'finance',
  tasks: 'ops', templates: 'ops', projects: 'ops', content: 'ops', seasons: 'ops',
  campaigns: 'marketing', plans: 'marketing',
  employees: 'hr', payroll: 'hr', advances: 'hr',
  articles: 'knowledge',
};

// قسم مسارات الإجراءات الخاصة (خارج e/<كيان>)
export const ROUTE_SECTION = {
  fin: 'finance', debts: 'finance', commissions: 'finance', invoices: 'finance',
  hr: 'hr', leads: 'crm', timeline: 'crm', quotes: 'clients', contracts: 'clients', studio: 'clients', xq: 'clients', templates: 'ops', store: 'store',
};

// NULL = كل الأقسام · '' = بلا أي قسم · 'crm,ops' = هذه فقط
export function parseSections(v) {
  if (v == null) return null;
  const list = String(v).split(',').map((s) => s.trim()).filter((s) => SECTIONS[s]);
  return [...new Set(list)];
}

// هل القسم مسموح لهذا المستخدم؟ (null/undefined = بلا قسم = مسموح)
export function sectionAllowed(user, sec) {
  if (!sec || !user || user.role === 'admin') return true;
  const list = parseSections(user.sections);
  return list === null || list.includes(sec);
}

// صلاحية الدور على الكيان + القسم — المصدر الوحيد لكل فحوص الصلاحية في الخادم
export function allowed(user, entity, op) {
  if (!(ENTITIES[entity]?.perms[user.role] || '').includes(op)) return false;
  return sectionAllowed(user, ENTITY_SECTION[entity]);
}

// سلسلة الصلاحيات الفعلية (r/w/d) لكيان — للواجهة ووكلاء الذكاء
export const permsFor = (user, entity) => (sectionAllowed(user, ENTITY_SECTION[entity]) ? ENTITIES[entity]?.perms[user.role] || '' : '');
