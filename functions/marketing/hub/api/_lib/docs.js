// قوالب المستندات الرسمية: عرض السعر (بنموذج عرض BBR) · العقد (بنود قياسية ثابتة + أجزاء متغيرة) · الخطة التسويقية
// المحتوى المتغير يأتي من الذكاء الاصطناعي، والأسعار والمجاميع تُحسب هنا دائماً (لا يحسبها الذكاء).
import { arMoney, arDigits, arDate, ORD } from './docx.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ---------- مجاميع عرض السعر ----------
export function quoteTotals(doc, vatRate = 15) {
  const v = Number(vatRate) / 100;
  const g = doc.pricing || {};
  const sum = (items) => r2((items || []).reduce((a, i) => a + (Number(i.qty) || 1) * (Number(i.price) || 0), 0));
  const setup = sum(g.setup?.items); const monthly = sum(g.monthly?.items);
  const months = Math.max(Number(g.monthly?.min_months) || 0, g.monthly?.items?.length ? 1 : 0);
  return {
    setup, setup_vat: r2(setup * v), setup_total: r2(setup * (1 + v)),
    monthly, monthly_vat: r2(monthly * v), monthly_total: r2(monthly * (1 + v)), months,
    contract_net: r2(setup + monthly * months), contract_vat: r2((setup + monthly * months) * v), contract_total: r2((setup + monthly * months) * (1 + v)),
    review: [...(g.setup?.items || []), ...(g.monthly?.items || []), ...(g.addons?.items || [])].filter((i) => i.review).length,
  };
}

function sectionBlocks(sec) {
  const out = [];
  if (sec.intro) out.push({ t: 'p', text: sec.intro });
  if (sec.table?.rows?.length) {
    const cols = (sec.table.columns || ['البند', 'التفاصيل']).map((label, i) => ({ label, w: i === 0 ? 2.1 : 6.2 / Math.max(1, (sec.table.columns || [1, 2]).length - 1), align: i === 0 ? 'right' : 'right' }));
    out.push({ t: 'table', cols, rows: sec.table.rows.map((r) => (Array.isArray(r) ? r : [r.name || '', r.details || ''])) });
  }
  if (sec.bullets?.length) out.push({ t: 'bullets', items: sec.bullets });
  if (sec.callout?.text) out.push({ t: 'callout', label: sec.callout.label || '', text: sec.callout.text });
  return out;
}
const priceCell = (i, unit) => ({ text: i.price == null || i.price === '' ? 'يُحدد' : Number(i.price) === 0 ? 'مشمول' : arMoney((Number(i.qty) || 1) * Number(i.price)) + (unit ? ` / ${unit}` : ''), align: 'center' });
const itemCell = (i) => ({ text: i.name + (Number(i.qty) > 1 ? ` (×${arDigits(i.qty)})` : ''), sub: i.desc || '' });

// تاريخ سياسة «الخيارات بلا أسعار»: ما قبله يحتفظ بأسعار خياراته كما أُرسلت
const ADDON_POLICY_FROM = '2026-10-20 00:00:00'; // يشمل عرض سديم Q-2026-0022 (مسودة لم تُرسل) ولا يمس أي عرض أُرسل قبله
export const addonPrices = (q, addons) => addons?.show_prices === true || (addons?.show_prices !== false && !!q?.created_at && String(q.created_at) < ADDON_POLICY_FROM);
export function quoteBlocks(q, doc, ctx) {
  const s = ctx.settings || {}; const vat = Number(s.vat_rate || 15);
  const t = quoteTotals(doc, vat); const n = { i: 0 };
  const H = (text) => ({ t: 'h1', text: `${ORD[n.i++]}: ${text}` });
  const b = [
    { t: 'date', text: `${(s.company_city || 'جدة').split('—')[0].trim()}، في ${arDate(q.created_at || ctx.today)}` },
    { t: 'title', text: 'عرض سعر' },
    doc.subject && { t: 'subtitle', text: doc.subject },
    { t: 'meta', label: 'أُعِدّ لـ', text: doc.prepared_for || ctx.clientName || '', shade: true },
    { t: 'meta', label: 'رقم العرض', text: q.number || '' },
    doc.intro && { t: 'p', text: doc.intro },
  ];
  const pre = (doc.sections || []).filter((x) => !x.after_pricing); const post = (doc.sections || []).filter((x) => x.after_pricing);
  for (const sec of pre) b.push(H(sec.heading), ...sectionBlocks(sec));
  // العرض المالي
  const P = doc.pricing || {};
  if (P.setup?.items?.length || P.monthly?.items?.length || P.addons?.items?.length) {
    b.push(H('العرض المالي'));
    if (P.setup?.items?.length) {
      b.push({ t: 'h2', text: P.setup.title || 'التأسيس (يُدفع مرة واحدة)' });
      b.push({ t: 'table', cols: [{ label: 'البند', w: 6.46 }, { label: 'السعر (ر.س)', w: 1.85, align: 'center' }], rows: [
        ...P.setup.items.map((i) => [itemCell(i), priceCell(i)]),
        { total: 1, cells: ['الإجمالي قبل الضريبة', { text: arMoney(t.setup), align: 'center' }] },
        { total: 1, cells: [`ضريبة القيمة المضافة ${arDigits(vat)}٪`, { text: arMoney(t.setup_vat), align: 'center' }] },
        { total: 1, cells: ['الإجمالي شامل الضريبة', { text: arMoney(t.setup_total), align: 'center' }] }] });
    }
    if (P.monthly?.items?.length) {
      b.push({ t: 'h2', text: P.monthly.title || `الإدارة والتشغيل (شهرياً${t.months > 1 ? ` — حد أدنى ${arDigits(t.months)} أشهر` : ''})` });
      b.push({ t: 'table', cols: [{ label: 'البند', w: 6.46 }, { label: 'السعر (ر.س)', w: 1.85, align: 'center' }], rows: [
        ...P.monthly.items.map((i) => [itemCell(i), priceCell(i)]),
        { total: 1, cells: [`ضريبة القيمة المضافة ${arDigits(vat)}٪`, { text: arMoney(t.monthly_vat), align: 'center' }] },
        { total: 1, cells: ['الإجمالي الشهري شامل الضريبة', { text: arMoney(t.monthly_total), align: 'center' }] }] });
    }
    if (P.addons?.items?.length) {
      b.push({ t: 'h2', text: P.addons.title || 'خيارات إضافية للنمو (اختيارية)' });
      // سياسة العروض (قرار إياد 21 أكتوبر 2026): الخيارات غير الملزمة تُدرج بلا أسعار، ويُثبت في العقد ما اختاره العميل ومبلغه.
      // العروض الأقدم تحتفظ بأسعار خياراتها كما أُرسلت، و show_prices يفرض إظهارها في أي عرض.
      if (addonPrices(q, P.addons)) {
        b.push({ t: 'table', cols: [{ label: 'الخيار', w: 6.46 }, { label: 'السعر (ر.س)', w: 1.85, align: 'center' }],
          rows: P.addons.items.map((i) => [itemCell(i), { text: (i.from ? 'من ' : '') + (i.price ? arMoney(i.price) : 'يُحدد') + (i.unit ? ` / ${i.unit}` : ''), align: 'center' }]) });
      } else {
        b.push({ t: 'table', cols: [{ label: 'الخيار', w: 8.31 }], rows: P.addons.items.map((i) => [itemCell(i)]) });
        b.push({ t: 'p', text: 'خيارات غير ملزمة: اختر منها ما يناسبك، وتُحدد قيمة ما تختاره في العقد عند الاتفاق.' });
      }
    }
    if (P.perk) b.push({ t: 'callout', label: P.perk_label || 'ميزة عند التعاقد', text: P.perk });
  }
  for (const sec of post) b.push(H(sec.heading), ...sectionBlocks(sec));
  if (doc.timeline?.length || doc.terms?.length) {
    b.push(H(doc.timeline_heading || 'الجدول الزمني والمطلوب منكم'));
    if (doc.timeline?.length) b.push({ t: 'table', cols: [{ label: 'المرحلة', w: 5.5 }, { label: 'المدة', w: 2.8, align: 'center' }], rows: doc.timeline.map((x) => [x.phase, { text: x.duration, align: 'center' }]) });
    if (doc.terms?.length) b.push({ t: 'bullets', items: doc.terms });
  }
  if (s.bank_line) b.push({ t: 'small', jc: 'right', text: `**الحساب البنكي:** ${s.bank_line}` });
  b.push({ t: 'small', text: `هذا عرض مبدئي أُعِدّ خصيصاً للعميل الموجَّه إليه، وجميع الأرقام قابلة للتعديل حتى الاعتماد الخطي النهائي من الطرفين. صالح ${arDigits(doc.validity_days || s.quote_validity_days || 14)} يوماً من تاريخه.` });
  b.push({ t: 'closing' }, { t: 'sign', name: ctx.signName, title: ctx.signTitle, org: ctx.signOrg });
  return b;
}

// ---------- العقد: بنود قياسية ثابتة (لا يغيّرها الذكاء) + أجزاء متغيرة ----------
export function contractPayments(t, split = [50, 50]) {
  const rows = [];
  if (t.setup > 0) {
    const sp = Array.isArray(split) && split.length && Math.abs(split.reduce((a, x) => a + Number(x), 0) - 100) < 0.01 ? split.map(Number) : [50, 50];
    const labels = sp.length === 1 ? ['عند توقيع العقد'] : sp.length === 2 ? ['عند توقيع العقد', 'عند التسليم والنشر'] : sp.map((_, i) => (i === 0 ? 'عند توقيع العقد' : i === sp.length - 1 ? 'عند التسليم النهائي' : `عند إنجاز المرحلة ${i + 1}`));
    sp.forEach((p, i) => rows.push({ label: `دفعة التأسيس ${arDigits(i + 1)} (${arDigits(p)}٪)`, net: r2((t.setup * p) / 100), due: labels[i] }));
  }
  if (t.monthly > 0) for (let m = 1; m <= t.months; m++) rows.push({ label: `الاشتراك الشهري — الشهر ${arDigits(m)}`, net: t.monthly, due: m === 1 ? 'مقدماً مع بداية التنفيذ' : `مقدماً بداية الشهر ${arDigits(m)}` });
  return rows;
}

export function contractBlocks(c, doc, ctx) {
  const s = ctx.settings || {}; const vat = Number(s.vat_rate || 15); const cl = ctx.client || {};
  const t = doc.totals || {}; const pays = contractPayments(t, doc.setup_split);
  const n = { i: 0 }; const H = (text) => ({ t: 'h1', text: `البند ${ORD[n.i++]}: ${text}` });
  const months = Number(c.months) || t.months || 1;
  const b = [
    { t: 'date', text: `${(s.company_city || 'جدة').split('—')[0].trim()}، في ${arDate(c.created_at || ctx.today)}` },
    { t: 'title', text: 'عقد تقديم خدمات تسويقية' },
    { t: 'subtitle', text: c.title || doc.subject || '' },
    { t: 'meta', label: 'رقم العقد', text: `${c.number || ''}${ctx.quoteNumber ? ` · مبني على عرض السعر ${ctx.quoteNumber}` : ''}` },
    c.status === 'مسودة' && { t: 'callout', label: 'مسودة', text: 'هذه نسخة أولية تُراجع قانونياً وتُعتمد من الطرفين قبل التوقيع.' },
    { t: 'p', text: `إنه في يوم ${arDate(c.start_date || ctx.today)} تم الاتفاق بين كل من:` },
    { t: 'table', cols: [{ label: 'الطرف', w: 1.6 }, { label: 'البيانات', w: 6.7 }], rows: [
      ['الطرف الأول', { text: `${s.legal_name || 'مؤسسة نبل وابتكار للأعمال التجارية'} (${s.company_name || 'نُبل وابتكار للخدمات التسويقية'})`, sub: `سجل تجاري ${s.cr_number || ''} · الرقم الضريبي ${s.vat_number || ''} · ${s.company_city || 'جدة'} · ويمثلها ${ctx.signName || 'إياد المغيرة'} — ${ctx.signTitle || 'مدير قطاع التسويق'}` }],
      ['الطرف الثاني', { text: cl.name || '', sub: [cl.cr_number && `سجل تجاري ${cl.cr_number}`, cl.vat_number && `الرقم الضريبي ${cl.vat_number}`, cl.national_address || cl.city, cl.contact_name && `ويمثله ${cl.contact_name}`, cl.phone && `جوال ${cl.phone}`].filter(Boolean).join(' · ') || 'تُستكمل بيانات السجل والعنوان الوطني قبل التوقيع' }]] },
    H('التمهيد'),
    { t: 'p', text: doc.intro || `حيث إن الطرف الأول جهة متخصصة في تقديم الخدمات التسويقية، ويرغب الطرف الثاني في الاستفادة من خدماته وفق عرض السعر المعتمد، فقد اتفق الطرفان وهما بكامل أهليتهما المعتبرة شرعاً ونظاماً على ما يلي، ويُعد هذا التمهيد وعرض السعر${ctx.quoteNumber ? ` رقم ${ctx.quoteNumber}` : ''} جزءاً لا يتجزأ من هذا العقد.` },
    H('موضوع العقد ونطاق الخدمات'),
    { t: 'p', text: 'يلتزم الطرف الأول بتقديم الخدمات التالية للطرف الثاني، ولا يشمل العقد أي خدمة لم ترد في هذا البند أو في عرض السعر المعتمد إلا بملحق مكتوب:' },
    doc.scope?.length && { t: 'table', cols: [{ label: 'الخدمة', w: 2.6 }, { label: 'التفاصيل', w: 5.7 }], rows: doc.scope.map((x) => [x.item, x.details || '']) },
    H('المخرجات والاعتماد'),
    doc.deliverables?.length && { t: 'bullets', items: doc.deliverables },
    { t: 'bullets', items: [
      'يعتمد الطرف الثاني المخرجات أو يبدي ملاحظاته خلال (٣) أيام عمل من استلامها، وإلا عُدّت معتمدة.',
      'يشمل كل مخرج جولتي تعديل مجانيتين، وما زاد عليهما يُسعَّر باتفاق مكتوب.',
      'لا يُنشر أي محتوى باسم الطرف الثاني قبل اعتماده منه أو من ممثله المفوّض.'] },
    H('مدة العقد'),
    { t: 'p', text: `مدة هذا العقد (${arDigits(months)}) ${months > 2 && months < 11 ? 'أشهر' : 'شهراً'} تبدأ من ${arDate(c.start_date || ctx.today)} وتنتهي في ${arDate(c.end_date || '')}${c.auto_renew ? `، وتتجدد تلقائياً لمدة مماثلة ما لم يُشعر أحد الطرفين الآخر كتابياً برغبته في عدم التجديد قبل (${arDigits(c.notice_days || 30)}) يوماً من تاريخ الانتهاء` : ''}.` },
    doc.timeline?.length && { t: 'table', cols: [{ label: 'المرحلة', w: 5.5 }, { label: 'المدة', w: 2.8, align: 'center' }], rows: doc.timeline.map((x) => [x.phase, { text: x.duration, align: 'center' }]) },
    H('المقابل المالي وطريقة الدفع'),
    { t: 'p', text: `إجمالي قيمة العقد (${arMoney(t.contract_net)}) ريال سعودي قبل ضريبة القيمة المضافة، تضاف إليها الضريبة بنسبة ${arDigits(vat)}٪ بمبلغ (${arMoney(t.contract_vat)}) ريال، ليصبح الإجمالي (${arMoney(t.contract_total)}) ريال سعودي، يُسدَّد وفق الجدول التالي:` },
    pays.length && { t: 'table', cols: [{ label: 'الدفعة', w: 3.7 }, { label: 'الاستحقاق', w: 2.6, align: 'center' }, { label: 'المبلغ شامل الضريبة (ر.س)', w: 2.0, align: 'center' }],
      rows: [...pays.map((p) => [p.label, { text: p.due, align: 'center' }, { text: arMoney(p.net * (1 + vat / 100)), align: 'center' }]),
        { total: 1, cells: ['الإجمالي', { text: '', align: 'center' }, { text: arMoney(pays.reduce((a, p) => a + p.net, 0) * (1 + vat / 100)), align: 'center' }] }] },
    { t: 'bullets', items: [
      'تصدر لكل دفعة فاتورة ضريبية نظامية، وتُسدَّد خلال (٧) أيام من تاريخ إصدارها.',
      'يحق للطرف الأول إيقاف تقديم الخدمات مؤقتاً عند تأخر السداد أكثر من (١٥) يوماً بعد إشعار كتابي، دون أن يُعد ذلك إخلالاً منه.',
      s.bank_line ? `يتم السداد بالتحويل إلى حساب الطرف الأول: ${s.bank_line}.` : 'يتم السداد بالتحويل إلى الحساب البنكي المعتمد للطرف الأول.'] },
    H('الميزانيات الإعلانية'),
    { t: 'p', text: 'لا تشمل قيمة العقد مبالغ الإنفاق على الإعلانات الممولة ما لم يُنص على ذلك صراحة، ويتحملها الطرف الثاني مباشرة لدى المنصات أو عبر الطرف الأول مقابل إيصالات موثقة. ويبذل الطرف الأول العناية المهنية اللازمة لتحقيق الأهداف المتفق عليها، دون ضمان أرقام محددة للمبيعات أو الوصول لارتباطها بخوارزميات المنصات وعوامل السوق.' },
    H('التزامات الطرف الأول'),
    { t: 'bullets', items: ['تنفيذ الخدمات بمهنية وفق أفضل الممارسات وأنظمة المملكة العربية السعودية وسياسات المنصات.', 'الالتزام بالجدول الزمني المتفق عليه، وإشعار الطرف الثاني بأي تأخير وأسبابه.', 'تقديم تقرير أداء دوري يوضح النتائج والتوصيات.', 'المحافظة على هوية الطرف الثاني وعدم نشر ما يخالف توجيهاته المكتوبة.'] },
    H('التزامات الطرف الثاني'),
    { t: 'bullets', items: [...(doc.client_duties || []), 'تزويد الطرف الأول بالمواد والمعلومات والصلاحيات اللازمة في مواعيدها، ويُمدد الجدول الزمني بقدر أي تأخير فيها.', 'تعيين ممثل مفوّض للتواصل والاعتماد.', 'ضمان صحة المعلومات المقدمة ومشروعية المنتجات والخدمات المعلن عنها وحيازة التراخيص اللازمة لها.', 'سداد المستحقات في مواعيدها.'] },
    H('الملكية الفكرية'),
    { t: 'p', text: 'تنتقل ملكية المخرجات النهائية المعتمدة إلى الطرف الثاني بعد سداد قيمتها كاملة، وتبقى ملفات العمل والأدوات والقوالب والمنهجيات ملكاً للطرف الأول. ويحق للطرف الأول عرض الأعمال المنفذة ضمن نماذج أعماله ما لم يعترض الطرف الثاني كتابياً.' },
    H('السرية وحماية البيانات'),
    { t: 'p', text: 'يلتزم الطرفان بالمحافظة على سرية المعلومات التي يطلع عليها كل منهما بحكم هذا العقد، وعدم استخدامها لغير أغراضه، ويستمر هذا الالتزام سنتين بعد انتهائه. ويلتزم الطرف الأول بمعالجة أي بيانات شخصية وفق نظام حماية البيانات الشخصية ولوائحه.' },
    H('حسابات المنصات وصلاحيات الوصول'),
    { t: 'p', text: 'تبقى حسابات التواصل الاجتماعي والإعلانات والمتجر ملكاً للطرف الثاني ومسجلة باسمه، ويُمنح الطرف الأول صلاحيات الإدارة اللازمة فقط، وتُسحب أو تُسلَّم عند انتهاء العقد.' },
    H('التعديل والإنهاء'),
    { t: 'bullets', items: ['لا يُعتد بأي تعديل على نطاق الخدمات أو قيمتها إلا بملحق مكتوب موقع من الطرفين.', 'يحق لأي طرف إنهاء العقد إذا أخلّ الطرف الآخر بالتزاماته ولم يعالج الإخلال خلال (١٥) يوماً من إشعاره كتابياً.', 'يحق لأي طرف إنهاء العقد بعد انقضاء الحد الأدنى للمدة بإشعار كتابي قبل (٣٠) يوماً.', 'عند الإنهاء يستحق الطرف الأول مقابل ما أُنجز حتى تاريخه، ولا تُسترد المبالغ المدفوعة عن أعمال منفذة.'] },
    H('حدود المسؤولية والقوة القاهرة'),
    { t: 'p', text: 'لا يُسأل أي طرف عن الأضرار غير المباشرة أو الأرباح الفائتة، ولا تتجاوز مسؤولية الطرف الأول في جميع الأحوال قيمة ما دُفع له خلال الأشهر الثلاثة السابقة للمطالبة. ولا يُعد أي طرف مخلاً بالتزاماته إذا تعذر تنفيذها بسبب قوة قاهرة خارجة عن إرادته، على أن يُشعر الطرف الآخر بها فور زوالها.' },
    doc.special_terms?.length && H('شروط خاصة'),
    doc.special_terms?.length && { t: 'bullets', items: doc.special_terms },
    H('النظام الواجب التطبيق وتسوية النزاعات'),
    { t: 'p', text: 'يخضع هذا العقد لأنظمة المملكة العربية السعودية، ويُسعى لحل أي خلاف ودياً خلال (٣٠) يوماً، فإن تعذر فتختص المحكمة المختصة في مدينة جدة بالفصل فيه.' },
    H('الإشعارات ونسخ العقد'),
    { t: 'p', text: 'تُعد العناوين والبريد الإلكتروني وأرقام الجوال المسجلة في هذا العقد معتمدة للإشعارات بين الطرفين. وحُرر هذا العقد من نسختين أصليتين بيد كل طرف نسخة للعمل بموجبها، ويُعتد بالتوقيع الإلكتروني وفق نظام التعاملات الإلكترونية.' },
    { t: 'spacer', after: 200 },
    { t: 'signatures', left: 'الطرف الأول', right: 'الطرف الثاني', leftName: `${ctx.signName || 'إياد المغيرة'} — ${ctx.signTitle || 'مدير قطاع التسويق'}`, rightName: cl.contact_name || cl.name || '' },
  ];
  return b;
}

// ---------- الخطة التسويقية ----------
export function planBlocks(p, doc, ctx) {
  const s = ctx.settings || {}; const n = { i: 0 }; const H = (text) => ({ t: 'h1', text: `${ORD[n.i++]}: ${text}` });
  const T = (cols, rows) => (rows?.length ? { t: 'table', cols: cols.map(([label, w, align]) => ({ label, w, align })), rows } : null);
  const sw = doc.swot || {};
  const b = [
    { t: 'date', text: `${(s.company_city || 'جدة').split('—')[0].trim()}، في ${arDate(p.created_at || ctx.today)}` },
    { t: 'title', text: 'الخطة التسويقية' },
    { t: 'subtitle', text: doc.title || p.title || '' },
    { t: 'meta', label: 'أُعِدّت لـ', text: ctx.clientName || '', shade: true },
    { t: 'meta', label: 'الفترة', text: `${arDigits(p.months || doc.months || 3)} أشهر تبدأ ${arDate(p.start_date || ctx.today)}` },
    doc.summary && { t: 'p', text: doc.summary },
    doc.summary_callout && { t: 'callout', label: 'الخلاصة', text: doc.summary_callout },
    (sw.strengths || sw.weaknesses) && H('تحليل الوضع الحالي (SWOT)'),
    (sw.strengths || sw.weaknesses) && T([['المحور', 1.8], ['التحليل', 6.5]], [
      ['نقاط القوة', (sw.strengths || []).join(' · ')], ['نقاط الضعف', (sw.weaknesses || []).join(' · ')],
      ['الفرص', (sw.opportunities || []).join(' · ')], ['التهديدات', (sw.threats || []).join(' · ')]].filter((r) => r[1])),
    doc.objectives?.length && H('الأهداف ومؤشرات الأداء'),
    T([['الهدف', 3.6], ['المؤشر (KPI)', 2.6], ['المستهدف', 2.1, 'center']], (doc.objectives || []).map((o) => [o.goal, o.kpi, { text: o.target, align: 'center' }])),
    doc.audience?.length && H('الجمهور المستهدف'),
    T([['الشريحة', 2.2], ['الدافع / الاحتياج', 3.2], ['الرسالة', 2.9]], (doc.audience || []).map((a) => [a.segment, a.insight, a.message])),
    doc.positioning && H('التموضع والرسالة الرئيسية'),
    doc.positioning && { t: 'p', text: doc.positioning },
    doc.pillars?.length && H('محاور المحتوى'),
    T([['المحور', 2.2], ['النسبة', 1.1, 'center'], ['أمثلة', 5]], (doc.pillars || []).map((x) => [x.name, { text: arDigits(x.share) + '٪', align: 'center' }, (x.examples || []).join(' · ')])),
    doc.channels?.length && H('القنوات ووتيرة النشر'),
    T([['المنصة', 1.8], ['الدور', 3.0], ['الوتيرة', 1.6, 'center'], ['أفضل الأوقات', 1.9, 'center']], (doc.channels || []).map((c) => [c.platform, c.role, { text: c.frequency, align: 'center' }, { text: c.best_times, align: 'center' }])),
    doc.calendar?.length && H('خطة الأشهر والمواسم'),
    T([['الشهر', 1.6], ['الفكرة الرئيسية', 3.4], ['المواسم والمناسبات', 3.3]], (doc.calendar || []).map((m) => [m.month, m.theme, (m.seasons || []).join(' · ')])),
    doc.ads?.split?.length && H('الإعلانات الممولة'),
    doc.ads?.budget && { t: 'p', text: `الميزانية الإعلانية المقترحة: **${doc.ads.budget}** (لا تشمل أتعاب الإدارة، وتُدفع للمنصات مباشرة).` },
    T([['المنصة / الحملة', 2.6], ['الهدف', 3.3], ['النسبة', 1.2, 'center']], (doc.ads?.split || []).map((a) => [a.channel, a.objective, { text: arDigits(a.pct) + '٪', align: 'center' }])),
    doc.roadmap?.length && H('خارطة التنفيذ'),
    T([['المرحلة', 2.2], ['المدة', 1.4, 'center'], ['الإجراءات', 4.7]], (doc.roadmap || []).map((r) => [r.phase, { text: r.duration, align: 'center' }, (r.actions || []).join(' · ')])),
    doc.risks?.length && H('المخاطر والمعالجة'),
    T([['الخطر', 3.6], ['المعالجة', 4.7]], (doc.risks || []).map((r) => [r.risk, r.mitigation])),
    doc.next_steps?.length && H('الخطوات التالية'),
    doc.next_steps?.length && { t: 'bullets', items: doc.next_steps },
    { t: 'small', text: 'الأرقام المستهدفة تقديرات مبنية على المعطيات الحالية وأداء القطاع، وتُراجع شهرياً مع تقرير الأداء.' },
    { t: 'closing' }, { t: 'sign', name: ctx.signName, title: ctx.signTitle, org: ctx.signOrg },
  ];
  return b;
}
