/* الجولة التدريبية داخل المنصة (29 أكتوبر 2026 — v31)
   محرك عام: إضاءة عنصر حقيقي (عناصر القائمة بـ data-r، الأزرار، حقول النماذج) مع بطاقة شرح (العنوان، النص، رقم الخطوة، التالي/السابق/تخطَّ)،
   ينتقل بين الصفحات عند الحاجة، RTL، وعلى الجوال (≤600px) تلتصق البطاقة بأسفل الشاشة وتُفتح القائمة الجانبية لإضاءة عناصرها.
   التقدّم في الخادم (GET/POST tour/*) فيُستأنف من أي جهاز. المحتوى حسب الدور: جولة المصمم/ة كاملة، وجولة عامة لبقية الأدوار.
   المدخل الدائم: «🎓 الجولة التدريبية» في «الرئيسية» (#/tour)، ومعاينة أي جولة للإدارة، وبطاقة حالة الفريق في «الفريق». */
(() => {
  'use strict';
  const css = `
.tr-block{position:fixed;inset:0;z-index:449;background:transparent;cursor:default}
.tr-hole{position:fixed;z-index:450;border-radius:14px;pointer-events:none;box-shadow:0 0 0 4px rgba(220,156,71,.95),0 0 0 9999px rgba(8,42,55,.6);transition:left .32s var(--e,ease),top .32s var(--e,ease),width .32s var(--e,ease),height .32s var(--e,ease),box-shadow .2s}
.tr-hole.none{opacity:0}.tr-block.dim{background:rgba(8,42,55,.6);transition:background .25s}
.tr-card{position:fixed;z-index:460;width:min(390px,calc(100vw - 32px));background:var(--card,#fff);color:var(--ink,#10303C);border:1px solid var(--line,#E6DCCB);border-radius:18px;
  box-shadow:var(--sh-3,0 30px 70px -28px rgba(8,42,55,.55));padding:14px 16px 12px;max-height:min(72vh,600px);overflow:auto;transition:top .3s var(--e,ease),left .3s var(--e,ease);animation:trIn .3s var(--e,ease) both}
@keyframes trIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
.tr-top{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted,#5F7681)}
.tr-ch{background:var(--soft,#F7F3EA);color:var(--navy,#15556B);border:1px solid var(--line,#E6DCCB);border-radius:99px;padding:1px 10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62%}
.tr-n{font-family:"IBM Plex Sans",sans-serif;font-weight:600}
.tr-x{margin-inline-start:auto;width:30px;height:30px;border-radius:50%;border:1px solid var(--line,#E6DCCB);background:var(--card,#fff);color:var(--muted,#5F7681);font-size:18px;line-height:1;cursor:pointer;flex:none}
.tr-bar{height:4px;background:var(--soft,#F7F3EA);border-radius:9px;margin-top:9px;overflow:hidden}.tr-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold,#DC9C47),var(--terra,#D2652A));border-radius:9px;transition:width .3s}
.tr-card h4{margin:11px 0 6px;color:var(--deep,#082A37);font-size:16.5px;line-height:1.45}
.tr-b{font-size:13.8px;line-height:1.8}.tr-b b{color:var(--navy,#15556B)}
.tr-f{display:flex;align-items:center;gap:8px;margin-top:13px;flex-wrap:wrap}.tr-f .sp{flex:1}
.tr-skip{background:none;border:0;color:var(--muted,#5F7681);font:inherit;font-size:12.5px;cursor:pointer;text-decoration:underline;padding:4px}
.tr-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.tr-opts{display:grid;gap:7px;margin-top:10px}
.tr-opts button{text-align:start;padding:9px 12px;border:1px solid var(--line,#E6DCCB);border-radius:12px;background:var(--card,#fff);color:var(--ink,#10303C);font:inherit;font-size:13.5px;cursor:pointer;line-height:1.5}
.tr-opts button:hover:not(:disabled){border-color:var(--navy,#15556B)}
.tr-opts button:disabled{cursor:default}
.tr-opts .ok{border-color:var(--teal,#308D8B);background:rgba(48,141,139,.13);font-weight:600}
.tr-opts .no{border-color:var(--terra,#D2652A);background:rgba(210,101,42,.10)}
.tr-fb{margin-top:9px;font-size:13px;padding:8px 11px;border-radius:11px;background:var(--soft,#F7F3EA);line-height:1.7}
.tr-fb.ok{border-inline-start:4px solid var(--teal,#308D8B)}.tr-fb.no{border-inline-start:4px solid var(--terra,#D2652A)}
.tr-chain{display:flex;flex-wrap:wrap;gap:4px 3px;align-items:center;margin-top:9px;font-size:12px}
.tr-chain .ar{color:var(--muted,#5F7681)}.tr-chain .me{outline:2px solid var(--gold,#DC9C47);outline-offset:1px}
.tr-tbl{width:100%;border-collapse:collapse;font-size:12.6px;margin-top:6px}.tr-tbl td{padding:5px 3px;border-bottom:1px dashed var(--line,#E6DCCB);vertical-align:top}
.tr-tbl td:last-child{white-space:nowrap;font-weight:700;color:var(--navy,#15556B);text-align:end;padding-inline-start:8px}
.tr-list{margin:6px 0 0;padding:0;list-style:none;display:grid;gap:4px;font-size:13.3px}
.tr-list li{display:flex;gap:7px;align-items:flex-start}.tr-list li i{font-style:normal;flex:none;width:18px;text-align:center}.tr-list li.ok{color:var(--muted,#5F7681)}.tr-list li.ok i{color:var(--teal,#308D8B)}
.tr-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.tr-chips span{background:var(--soft,#F7F3EA);border:1px solid var(--line,#E6DCCB);border-radius:99px;padding:2px 10px;font-size:12.3px;font-weight:600;color:var(--navy,#15556B)}
.tr-score{font-size:34px;font-weight:800;color:var(--navy,#15556B);text-align:center;margin:6px 0 2px;font-family:"IBM Plex Sans",sans-serif}
.tr-prev{display:inline-block;margin-top:8px;font-size:11.5px;color:var(--terra,#D2652A);font-weight:700}
.tr-page{max-width:980px;margin:0 auto}
.tr-hero{display:flex;gap:16px;align-items:center;background:var(--g-brand,#15556B);color:#fff;border-radius:var(--r,18px);padding:20px 22px;margin-bottom:14px}
.tr-hero .em{font-size:44px;line-height:1}.tr-hero h3{margin:0 0 4px;color:#fff;font-size:20px}.tr-hero p{margin:0;opacity:.9;font-size:13.5px;line-height:1.7}
.tr-chap{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin-top:8px}
.tr-chap div{border:1px solid var(--line,#E6DCCB);border-radius:12px;padding:9px 12px;background:var(--card,#fff);font-size:13px}.tr-chap b{display:block;color:var(--deep,#082A37);margin-bottom:2px}
.tr-st{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap}
.jd h4{margin:14px 0 6px;color:var(--deep,#082A37)}.jd ul{margin:0;padding-inline-start:20px;line-height:1.85;font-size:13.5px}.jd p{line-height:1.85;font-size:13.5px;margin:4px 0}
.jd .card-t td:first-child{color:var(--muted,#5F7681);white-space:nowrap;padding-inline-end:10px}
@media (max-width:600px){.tr-card{padding:12px 14px 10px}.tr-hero{flex-direction:column;text-align:center}}
@media (prefers-reduced-motion:reduce){.tr-hole,.tr-card{transition:none;animation:none}}`;
  const st0 = document.createElement('style'); st0.textContent = css; document.head.appendChild(st0);

  I.cap = P('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/><path d="M22 9v6"/>');
  const MOB = () => window.matchMedia('(max-width:600px)').matches;
  const DRAWER = () => window.matchMedia('(max-width:860px)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const firstName = (n) => { const w = String(n || '').trim().split(/\s+/); return /^(عبد|عبدال|أبو|ابو|أم|ام|آل)$/.test(w[0]) && w[1] ? `${w[0]} ${w[1]}` : (w[0] || ''); };
  const BOSS = () => ['admin', 'manager'].includes(me().role);

  // ---------- حالة الخادم ----------
  const T = { info: null, offered: false, run: null };
  async function info(force) { if (!force && T.info) return T.info; T.info = await api('tour'); return T.info; }
  const designerUser = () => (me().role === 'designer' ? me() : (S.meta.users || []).find((u) => u.role === 'designer' && u.active) || me());
  const nav = (r) => `.side a.nav-a[data-r="${r}"]`;

  // ---------- الوصف الوظيفي كاملاً (من DESIGNER_JD في الخادم) ----------
  async function jdModal() {
    let jd = T.info?.jd; if (!jd) { try { jd = (await info(true)).jd; } catch { /* */ } }
    if (!jd) return toast('الوصف الوظيفي غير متاح لدورك', 1);
    const m = modal({ title: '📄 الوصف الوظيفي المعتمد', wide: true, body: `<div class="jd">
      <h3 style="margin:0">${esc(jd.title)}</h3><div class="small muted" dir="ltr" style="text-align:end">${esc(jd.title_en || '')}</div>
      <p>${esc(jd.intro)}</p>
      <table class="tr-tbl card-t">${(jd.card || []).map(([k, v]) => `<tr><td>${esc(k)}</td><td style="text-align:start;white-space:normal;font-weight:500;color:inherit">${esc(v)}</td></tr>`).join('')}</table>
      <h4>🎯 الهدف من الوظيفة</h4><p>${esc(jd.objective)}</p>
      ${(jd.sections || []).map((s) => `<h4>${esc(s.h)}</h4><ul>${s.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}
      <h4>🧰 المهارات</h4><ul>${(jd.skills || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h4>📊 مؤشرات الأداء</h4><table class="tr-tbl"><tr><td><b>المؤشر</b></td><td><b>المستهدف</b></td><td><b>القياس</b></td></tr>${(jd.kpis || []).map(([a, b, c]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td style="font-weight:400;color:var(--muted)">${esc(c)}</td></tr>`).join('')}</table>
      <h4>⚖️ الطاقة</h4><p>${esc(jd.capacity)}</p><h4>🧪 فترة التجربة</h4><p>${esc(jd.probation)}</p>
      <p class="small muted">${esc(jd.source || '')}</p></div>`, foot: '<button class="btn btn-g" data-cl>إغلاق</button>' });
    m.el.style.zIndex = 480; m.el.dataset.jd = '1'; $('[data-cl]', m.el).onclick = m.close;
  }
  window.nublJD = jdModal;

  // ---------- المحتوى ----------
  const STATUSES = () => L.contentStatus.filter((s) => s !== 'ملغي');
  const chain = (hi) => `<div class="tr-chain">${STATUSES().map((s, i) => `${i ? '<span class="ar">←</span>' : ''}<span class="pill ${PILL[s] || ''} ${hi.includes(s) ? 'me' : ''}">${esc(s)}</span>`).join('')}</div>`;
  const jdBtn = '<div class="tr-acts"><button type="button" class="btn btn-g btn-s" data-jd>📄 عرض الوصف الوظيفي كاملاً</button></div>';
  const FINAL = { id: 'final', ch: 'الختام', final: true };

  function designerSteps(c) {
    const jd = c.jd || {};
    const q = c.queue; const n = q.length;
    const qFirst = q[0]; const qLast = q[n - 1];
    const span = n ? `من ${fdate(qFirst.publish_date)} إلى ${fdate(qLast.publish_date)}` : '';
    const kpis = (jd.kpis || []).map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');
    const cap = String(jd.capacity || '').split('.')[0];
    return [
      // أ) الترحيب
      { ch: 'الترحيب', title: `أهلاً ${esc(c.name)} 🌟`, body: `هذه جولتك الأولى في منصة <b>نُبل وابتكار للتسويق</b>: دقائق تعرفين بعدها أين عملك، وكيف يسير، وما المطلوب منك.<br><small class="muted">خطوتك تُحفظ تلقائياً — أكملي من أي جهاز.</small>` },
      { ch: 'الترحيب', title: 'من نحن', body: 'الذراع التسويقية لمؤسسة نُبل وابتكار في جدة: استراتيجية، ومحتوى، وإعلانات، وإنتاج، ومتاجر، وأتمتة.<br><b>«نتعامل بنُبل… ونعمل بابتكار»</b>' },
      { ch: 'الترحيب', title: 'دورك: الحلقة الإنتاجية للقطاع 🎨', body: 'ما يُخطَّط مع العميل يتحوّل على يديك إلى <b>تصميم وفيديو ونص</b> — في موعده، وبهوية صاحبه.' },
      // ب) خطوط العمل
      { ch: 'خطوط العمل', title: 'لمن ترجعين إدارياً؟', body: 'إلى مدير قطاع التسويق <b>إياد المغيرة</b>.<br>وكل الاعتمادات — أعمالك قبل إرسالها، وإجازاتك، وأي استثناء — منه وحده.' },
      { ch: 'خطوط العمل', title: 'التنسيق اليومي', body: 'مع <b>فيصل النهدي</b> مدير حسابات العملاء: منه تستلمين المهام والمواعيد وملاحظات العملاء كل يوم.<br>تنسيق تشغيلي بين زميلين — والاعتماد يبقى لإياد.' },
      // ج) جولة في المنصة
      { ch: 'جولة في المنصة', title: 'يومي ☀️', target: nav('myday'), need: 1, body: 'ابدئي يومك من هنا: مهامك المستحقة، والمحتوى المطلوب خلال 3 أيام.' },
      { ch: 'جولة في المنصة', title: 'تقويمي', target: nav('agenda'), need: 1, body: 'مواعيدك ومهامك على تقويم واحد، بالأسبوع أو بالشهر.' },
      { ch: 'جولة في المنصة', title: 'المهام', target: nav('tasks'), need: 1, body: 'كل مهمة تُسند إليك بطاقة: جديدة ← قيد التنفيذ ← مراجعة ← تعديلات ← منجزة. حرّكيها بنفسك أولاً بأول.' },
      { ch: 'جولة في المنصة', title: 'تقويم المحتوى 📅', target: nav('content'), need: 1, body: 'قلب عملك: كل منشور لكل عميل، بتاريخه وحالته ونصه ورابط تصميمه.' },
      { ch: 'جولة في المنصة', title: 'ملفي الشخصي', target: nav('me'), need: 1, body: 'بياناتك ومستنداتك وتنبيهاتك ونسبة اكتمال ملفك — أكمليه أولاً.' },
      { ch: 'جولة في المنصة', title: 'الإشعارات 🔔', target: '#bell', body: 'كل إسناد أو ملاحظة أو اعتماد يصلك هنا فوراً. راجعيه أول اليوم وآخره.' },
      { ch: 'جولة في المنصة', title: 'تنبيهات على جوالك ✈️', target: '#tglink', body: 'اربطي تلجرام لتصلك التنبيهات خارج المنصة، واضبطي واتساب من «ملفي الشخصي ← التنبيهات».' },
      // د) سير المحتوى
      { ch: 'سير المحتوى', title: 'رحلة كل منشور', body: `كل منشور يمر بهذه المراحل، ومحطتك الأساسية <b>«تصميم»</b>:${chain(['تصميم'])}` },
      { ch: 'سير المحتوى', title: 'التقويم بالشهر', route: '#/content', prep: () => { S.ct = { month: c.month, client: '' }; }, rerender: 1, target: '#view .cal', need: 1,
        body: 'اضغطي أي منشور لفتحه. لون البطاقة يدل على حالته، والمواسم تظهر في أيامها.' },
      { ch: 'سير المحتوى', title: 'عند «تصميم»: ماذا تفعلين؟', when: () => !!c.item, route: '#/content', open: 1, target: () => $('.modal [name="brief"]')?.closest('label') || $('.modal [name="caption"]')?.closest('label'),
        body: '1) افتحي المنشور واقرئي الفكرة والنص والموجز والملاحظات.<br>2) أنتجي التصميم أو الفيديو بهوية العميل.' },
      { ch: 'سير المحتوى', title: 'سلّمي في المنصة', when: () => !!c.item, open: 1, target: () => $('.modal [name="asset_link"]')?.closest('label'),
        body: '3) ضعي رابط الملف النهائي في <b>«رابط التصميم»</b>.<br>4) غيّري الحالة إلى <b>«مراجعة»</b> واحفظي.' },
      { ch: 'سير المحتوى', title: 'جولتا تعديل كحد أقصى', when: () => !!c.item, open: 1, target: () => $('.modal [name="revisions"]')?.closest('label'),
        body: 'إن عاد المنشور «تعديلات» تُحسب جولة. الحد <b>جولتان</b> — والهدف أن يُعتمد من أول مرة.' },
      { ch: 'سير المحتوى', title: 'بعد الاعتماد', body: `ما يُعتمد يُجدول على <b>Metricool</b> في موعده (الحالة «مجدول»)، ويُسلَّم رابطه في المنصة حتى «منشور».${chain(['معتمد', 'مجدول', 'منشور'])}` },
      // هـ) المطلوب منك
      { ch: 'المطلوب منك', title: 'مهامك في أربعة محاور', body: `${(jd.sections || []).length ? `<div class="tr-chips">${jd.sections.map((s) => `<span>${esc(s.h)} · <span class="num">${s.items.length}</span></span>`).join('')}</div>` : ''}<div style="margin-top:8px">${esc(cap)}.</div>${jdBtn}` },
      { ch: 'المطلوب منك', title: `مؤشرات أدائك (${(jd.kpis || []).length})`, body: `<table class="tr-tbl">${kpis}</table><small class="muted">تُقاس شهرياً خلال فترة التجربة ويُبنى عليها تقييم التثبيت.</small>${jdBtn}` },
      // و) قواعد الجودة
      { ch: 'قواعد الجودة', title: 'قبل كل تسليم ✅', body: `افحصي الخمسة دائماً:<div class="tr-chips"><span>الهوية</span><span>الإملاء</span><span>الأسعار</span><span>المقاسات</span><span>موافقة العميل</span></div>` },
      { ch: 'قواعد الجودة', title: 'خطوط حمراء 🚫', body: 'لا نص عربي مولّد بالذكاء الاصطناعي داخل صورة أو فيديو — يُركَّب دائماً في برامج التصميم.<br>لا رقم لا يُثبت، ولا اسم عميل أو أرقامه دون موافقة مكتوبة.' },
      { ch: 'قواعد الجودة', title: 'السرية والأرشفة', target: () => [...$$('.side a.nav-a[target=_blank]')].find((a) => /العملاء/.test(a.textContent)),
        body: 'ملفات المؤسسة والعملاء سرية. احفظي الخام والنهائي في مجلد العميل بالدرايف، وسجّلي حالة كل مهمة يومياً في المنصة.' },
      // ز) أسبوعك الأول
      { ch: 'أسبوعك الأول', title: 'أول قائمة تصاميمك 🎯', when: () => n > 0, route: '#/content', list: 1, target: '#view [data-f="designer_id"]', need: 1,
        body: `<b class="num">${n}</b> منشورات أُسندت إليك ${span}. اختاري نفسك في فلتر «المصمم» لتري ما يخصك فقط.` },
      { ch: 'أسبوعك الأول', title: 'قائمة أسبوعك الأول', body: () => `<ul class="tr-list">${[
        [c.pct === 100, 'أكملي ملفك الشخصي (الهوية، الآيبان…)'], [!!c.tg, 'اربطي تلجرام للتنبيهات'], [false, 'راجعي دليل الهوية في «مجلد التسويق»'],
        [false, qFirst ? `ابدئي بأول منشور: «${esc(qFirst.title)}» (${fdate(qFirst.publish_date)})` : 'ابدئي بأول منشور في تقويمك']].map(([ok, t]) => `<li class="${ok ? 'ok' : ''}"><i>${ok ? '✓' : '○'}</i><span>${t}</span></li>`).join('')}</ul>` },
      { ch: 'أسبوعك الأول', title: 'الجولة هنا دائماً 🎓', target: nav('tour'), body: 'تعودين إليها متى شئتِ، ومنها الوصف الوظيفي كاملاً. والآن: اختبار قصير من 5 أسئلة.' },
      // ح) الاختبار الذاتي
      { ch: 'اختبار ذاتي', quiz: { q: 'من يعتمد أعمالك وطلباتك؟', o: ['فيصل النهدي', 'إياد المغيرة — مدير قطاع التسويق', 'أي زميل في الفريق', 'العميل وحده'], a: 1, why: 'كل الاعتمادات لإياد وحده؛ وفيصل للتنسيق اليومي.' } },
      { ch: 'اختبار ذاتي', quiz: { q: 'كم جولة تعديل كحد أقصى لكل مادة؟', o: ['جولتان', 'جولة واحدة', 'ثلاث جولات', 'بلا حد'], a: 0, why: 'جولتان على الأكثر، والهدف الاعتماد من أول مرة.' } },
      { ch: 'اختبار ذاتي', quiz: { q: 'أين تضعين الملف النهائي للمنشور؟', o: ['أرسله للعميل على واتساب مباشرة', 'في «رابط التصميم» داخل المنشور بالمنصة، مع أرشفته في مجلد العميل', 'أحتفظ به على جهازي', 'في محادثة الفريق'], a: 1, why: 'التسليم داخل المنصة في «رابط التصميم»، والخام والنهائي في مجلد العميل بالدرايف.' } },
      { ch: 'اختبار ذاتي', quiz: { q: 'هل يجوز وضع نص عربي مولّد بالذكاء الاصطناعي داخل صورة أو فيديو؟', o: ['نعم إن بدا سليماً', 'في القصص فقط', 'لا — يُركَّب النص دائماً في برامج التصميم', 'إن وافق العميل'], a: 2, why: 'أبداً: النص العربي يُركَّب يدوياً في برامج التصميم.' } },
      { ch: 'اختبار ذاتي', quiz: { q: 'متى يُجدول المنشور على Metricool؟', o: ['فور انتهاء التصميم', 'قبل كتابة النص', 'بعد نشره', 'بعد اعتماده، وفي موعده'], a: 3, why: 'لا جدولة قبل الاعتماد — ثم في الموعد المحدد بالتقويم.' } },
      FINAL,
    ];
  }
  function generalSteps(c) {
    return [
      { ch: 'الترحيب', title: `أهلاً ${esc(c.name)} 🌟`, body: 'جولة سريعة في منصة <b>نُبل وابتكار للتسويق</b>: أين تجد عملك، وكيف تتابعه.<br><b>«نتعامل بنُبل… ونعمل بابتكار»</b>' },
      { ch: 'جولة في المنصة', title: 'لوحة القيادة', target: nav('dashboard'), need: 1, body: 'ملخص ما يخص دورك: الأرقام والمستحقات والتنبيهات.' },
      { ch: 'جولة في المنصة', title: 'يومي ☀️', target: nav('myday'), need: 1, body: 'مهامك ومتابعاتك المستحقة اليوم — ابدأ يومك منها.' },
      { ch: 'جولة في المنصة', title: 'المهام', target: nav('tasks'), need: 1, body: 'كل مهمة تُسند إليك بطاقة تحرّكها حتى «منجزة».' },
      { ch: 'جولة في المنصة', title: 'تقويم المحتوى', target: nav('content'), need: 1, body: `منشورات العملاء بحالاتها:${chain([])}` },
      { ch: 'جولة في المنصة', title: 'ملفي الشخصي', target: nav('me'), need: 1, body: 'بياناتك ومستنداتك وتنبيهاتك — أكمل ملفك.' },
      { ch: 'جولة في المنصة', title: 'الإشعارات 🔔', target: '#bell', body: 'كل إسناد أو ملاحظة أو اعتماد يصلك هنا فوراً.' },
      { ch: 'جولة في المنصة', title: 'تنبيهات على جوالك ✈️', target: '#tglink', body: 'اربط تلجرام لتصلك التنبيهات خارج المنصة.' },
      { ch: 'جولة في المنصة', title: 'الجولة هنا دائماً 🎓', target: nav('tour'), body: 'تعود إليها متى شئت من «الرئيسية».' },
      FINAL,
    ];
  }

  async function makeCtx(tour) {
    const inf = await info().catch(() => ({}));
    const du = tour === 'designer' ? designerUser() : me();
    const c = { tour, uid: du.id, name: firstName(du.name), jd: inf.jd, pct: me().profile_pct, tg: !!me().tg_linked, queue: [], item: null, month: todayStr().slice(0, 7) };
    if (tour === 'designer' && can('content')) {
      try {
        const d = await api(`e/content?limit=200&f_designer_id=${du.id}&gte_publish_date=${addDays(todayStr(), -7)}`);
        c.queue = (d.rows || []).filter((r) => !['منشور', 'ملغي'].includes(r.status)).sort((a, b) => String(a.publish_date).localeCompare(String(b.publish_date)));
        c.item = c.queue.find((r) => r.status === 'تصميم') || c.queue[0] || null;
        if (c.queue[0]) c.month = String(c.queue[0].publish_date).slice(0, 7);
      } catch { /* */ }
    }
    return c;
  }

  // ---------- المحرك ----------
  async function waitRoute(name, ms = 5000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (S.route === name && S.renderDone === S.renderSeq && $('#view')?.children.length) return true; await sleep(60); }
    return false;
  }
  async function findTarget(t, ms = 2500) {
    if (!t) return null;
    const t0 = Date.now();
    do { const el = typeof t === 'function' ? t() : $(t); if (el && el.getClientRects().length) return el; await sleep(80); } while (Date.now() - t0 < ms);
    return null;
  }
  // انتظر حتى يستقر موضع العنصر (انزلاق الدرج الجانبي أو التمرير الناعم)
  async function settle(el, ms = 1200) {
    const t0 = Date.now(); let last = '';
    while (Date.now() - t0 < ms) { await sleep(70); const r = el.getBoundingClientRect(); const k = [r.left, r.top, r.width].map(Math.round).join(','); if (k === last) return; last = k; }
  }
  function sideOpen(on) {
    const side = $('.side'); if (!side) return;
    side.classList.toggle('open', on); $('#sidedim')?.classList.toggle('on', on);
  }

  async function start(tour, opts = {}) {
    if (T.run) stop(true);
    const inf = await info().catch(() => null);
    tour = tour || inf?.tour || 'general';
    const preview = !!opts.preview;
    const c = await makeCtx(tour);
    const steps = (tour === 'designer' ? designerSteps(c) : generalSteps(c)).filter((s) => !s.when || s.when());
    const state = !preview && inf?.states?.[tour];
    let i = opts.from != null ? opts.from : state && state.status === 'جارية' && state.step > 0 && state.step < steps.length - 1 ? state.step : 0;
    const answers = !preview && state && state.status === 'جارية' && Array.isArray(state.answers) ? state.answers.slice() : [];
    const R = T.run = { tour, preview, c, steps, i, answers, form: null, completed: false, dir: 1 };
    R.block = document.createElement('div'); R.block.className = 'tr-block';
    R.hole = document.createElement('div'); R.hole.className = 'tr-hole none';
    R.card = document.createElement('div'); R.card.className = 'tr-card'; R.card.setAttribute('role', 'dialog'); R.card.setAttribute('aria-modal', 'true');
    document.body.append(R.block, R.hole, R.card);
    R.onKey = (e) => { if (T.run !== R || $('.modal-bg[data-jd]')) return;
      if (e.key === 'Escape') { e.stopPropagation(); stop(); } else if (e.key === 'ArrowLeft') next(); else if (e.key === 'ArrowRight') prev(); };
    R.onMove = () => { cancelAnimationFrame(R.raf); R.raf = requestAnimationFrame(place); };
    document.addEventListener('keydown', R.onKey, true); window.addEventListener('resize', R.onMove); window.addEventListener('scroll', R.onMove, true); document.addEventListener('transitionend', R.onMove, true);
    await show(i);
  }

  function closeForm(R) { if (R.form) { try { R.form.close(); } catch { /* */ } R.form = null; } }
  async function show(i) {
    const R = T.run; if (!R) return;
    i = Math.max(0, Math.min(R.steps.length - 1, i)); R.i = i;
    const s = R.steps[i];
    if (!s.open) closeForm(R);
    R.card.style.visibility = 'hidden';
    try {
      if (s.prep) s.prep();
      if (s.route) {
        const name = s.route.replace(/^#\/?/, '').split('/')[0];
        if (location.hash !== s.route || s.rerender) { go(s.route); await sleep(30); }
        await waitRoute(name);
        if (s.list) { S.list = S.list || {}; S.list.content = { q: '', f: { designer_id: String(R.c.uid) }, offset: 0 }; await listView('content', {}); }
      }
      if (s.open && !R.form && R.c.item) {
        if (S.route !== 'content') { go('#/content'); await waitRoute('content'); }
        R.form = await openForm('content', R.c.item, {}, () => {});
        if (R.form?.el) R.form.el.dataset.tour = '1';
      }
    } catch (e) { console.warn('tour step', e); }
    if (T.run !== R || R.i !== i) return;
    let el = await findTarget(s.target, s.target ? 400 : 0);
    if (el && el.closest('.side') && DRAWER()) { sideOpen(true); await settle(el); }
    else if (DRAWER()) sideOpen(false);
    if (!el && s.target) el = await findTarget(s.target, 2200);
    if (T.run !== R || R.i !== i) return;
    if (!el && s.need) { R.steps.splice(i, 1); return show(R.dir < 0 ? i - 1 : i); }
    R.el = el;
    if (el) {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      await settle(el);
    }
    render();
    place();
    R.card.style.visibility = '';
    [200, 500, 900].forEach((ms) => setTimeout(() => { if (T.run === R && R.i === i) place(); }, ms)); // بعد انتهاء حركة الدرج/التمرير
    $('[data-next]', R.card)?.focus({ preventScroll: true });
    if (!R.preview && !s.final) api('tour/progress', { method: 'POST', body: { tour: R.tour, step: i, total: R.steps.length, answers: R.answers } }).catch(() => {});
    if (s.final) finish();
  }

  function render() {
    const R = T.run; const s = R.steps[R.i]; const n = R.steps.length;
    const quizIdx = R.steps.filter((x, k) => x.quiz && k < R.i).length;
    let title = typeof s.title === 'function' ? s.title() : s.title; let body = typeof s.body === 'function' ? s.body() : (s.body || ''); let extra = '';
    if (s.quiz) {
      const a = R.answers[quizIdx]; const done = a != null && a !== -1;
      title = `سؤال ${quizIdx + 1}: ${esc(s.quiz.q)}`;
      extra = `<div class="tr-opts">${s.quiz.o.map((o, k) => `<button type="button" data-o="${k}" ${done ? 'disabled' : ''} class="${done && k === s.quiz.a ? 'ok' : done && k === a ? 'no' : ''}">${esc(o)}</button>`).join('')}</div>
        ${done ? `<div class="tr-fb ${a === s.quiz.a ? 'ok' : 'no'}">${a === s.quiz.a ? '✅ إجابة صحيحة.' : '❌ ليست هذه.'} ${esc(s.quiz.why)}</div>` : ''}`;
    }
    if (s.final) {
      const qs = R.steps.filter((x) => x.quiz); const score = qs.reduce((t, q, k) => t + (R.answers[k] === q.quiz.a ? 1 : 0), 0);
      R.score = score; R.of = qs.length;
      title = 'تمت الجولة 🎉';
      body = `${qs.length ? `<div class="tr-score">${score} / ${qs.length}</div><div style="text-align:center">${score === qs.length ? 'ممتاز! استوعبتِ أساسيات عملك كاملة.' : score >= qs.length - 1 ? 'أحسنتِ — راجعي السؤال الذي فاتك في الوصف الوظيفي.' : 'بداية طيبة — أعيدي الجولة متى شئتِ من «🎓 الجولة التدريبية».'}</div>` : ''}
        <div style="margin-top:8px">${R.tour === 'designer' ? `بالتوفيق يا ${esc(R.c.name)} — فريق نُبل وابتكار سعيد بانضمامك.` : 'أصبحت تعرف أين تجد كل شيء في المنصة.'}</div>
        ${R.tour === 'designer' ? jdBtn : ''}${R.preview ? '<span class="tr-prev">معاينة — لم يُحفظ تقدّم ولم يُرسل إشعار</span>' : ''}`;
      if (R.tour !== 'designer') body = body.replace('استوعبتِ', 'استوعبت').replace('أحسنتِ', 'أحسنت').replace('راجعي', 'راجع').replace('أعيدي', 'أعد').replace('شئتِ', 'شئت');
    }
    const quizPending = s.quiz && (R.answers[quizIdx] == null || R.answers[quizIdx] === -1);
    R.card.innerHTML = `<div class="tr-top"><span class="tr-ch">${esc(s.ch || '')}</span><span class="tr-n">${R.i + 1} / ${n}</span><button type="button" class="tr-x" aria-label="إغلاق الجولة" data-x>×</button></div>
      <div class="tr-bar"><i style="width:${Math.round(((R.i + 1) / n) * 100)}%"></i></div>
      <h4>${title}</h4><div class="tr-b">${body}</div>${extra}
      <div class="tr-f">${R.i > 0 && !s.final ? '<button type="button" class="btn btn-g btn-s" data-prev>→ السابق</button>' : ''}<span class="sp"></span>
        ${s.final ? '' : '<button type="button" class="tr-skip" data-skip>تخطَّ الجولة</button>'}
        <button type="button" class="btn btn-p btn-s" data-next ${quizPending ? 'disabled title="اختاري إجابة"' : ''}>${s.final ? 'إنهاء' : R.steps[R.i + 1]?.final ? 'النتيجة ←' : 'التالي ←'}</button></div>`;
    $('[data-next]', R.card).onclick = next; $('[data-prev]', R.card) && ($('[data-prev]', R.card).onclick = prev);
    $('[data-x]', R.card).onclick = () => stop(); $('[data-skip]', R.card) && ($('[data-skip]', R.card).onclick = () => stop());
    $$('[data-jd]', R.card).forEach((b) => b.onclick = jdModal);
    $$('[data-o]', R.card).forEach((b) => b.onclick = () => { R.answers[quizIdx] = +b.dataset.o; render(); place(); });
  }

  function place() {
    const R = T.run; if (!R) return;
    const el = R.el && R.el.isConnected ? R.el : null; const c = R.card; const pad = 6;
    let r = el ? el.getBoundingClientRect() : null;
    if (r && (r.width === 0 || r.bottom < 0 || r.top > innerHeight)) r = null;
    R.block.classList.toggle('dim', !r); // بلا هدف: تعتيم كامل (ظل عنصر صغير لا يُرسم في بعض المتصفحات)
    if (r) { R.hole.classList.remove('none'); Object.assign(R.hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' }); }
    else { R.hole.classList.add('none'); Object.assign(R.hole.style, { left: innerWidth / 2 + 'px', top: innerHeight / 2 + 'px', width: '1px', height: '1px' }); }
    const W = innerWidth; const H = innerHeight; const g = 16;
    if (MOB()) {
      Object.assign(c.style, { width: 'auto', left: g + 'px', right: g + 'px', top: 'auto', bottom: `calc(12px + env(safe-area-inset-bottom))`, transform: '' });
      const ch = c.offsetHeight;
      if (r && r.bottom > H - ch - 24 && r.top > ch + 24) Object.assign(c.style, { top: `calc(12px + env(safe-area-inset-top))`, bottom: 'auto' });
      return;
    }
    Object.assign(c.style, { width: '', right: 'auto', bottom: 'auto' });
    const w = c.offsetWidth; const h = c.offsetHeight;
    let left; let top;
    if (!r) { left = (W - w) / 2; top = Math.max(g, (H - h) / 2); }
    else {
      const inSide = !!el.closest('.side');
      if (inSide && r.left - w - 18 > g) { left = r.left - w - 18; top = r.top + r.height / 2 - h / 2; } // القائمة يمين الشاشة (RTL): البطاقة إلى يسارها
      else if (r.bottom + 14 + h < H - g) { top = r.bottom + 14; left = r.left + r.width / 2 - w / 2; }
      else if (r.top - 14 - h > g) { top = r.top - 14 - h; left = r.left + r.width / 2 - w / 2; }
      else if (r.left - w - 18 > g) { left = r.left - w - 18; top = r.top + r.height / 2 - h / 2; }
      else { left = (W - w) / 2; top = H - h - g; }
    }
    left = Math.max(g, Math.min(W - w - g, left)); top = Math.max(g, Math.min(H - h - g, top));
    Object.assign(c.style, { left: left + 'px', top: top + 'px' });
  }

  function next() { const R = T.run; if (!R) return; if (R.steps[R.i].final) return stop(false, true); R.dir = 1; show(R.i + 1); }
  function prev() { const R = T.run; if (!R) return; R.dir = -1; show(R.i - 1); }
  async function finish() {
    const R = T.run; if (!R || R.completed) return; R.completed = true;
    if (R.preview) return;
    try { await api('tour/complete', { method: 'POST', body: { tour: R.tour, score: R.score || 0, of: R.of || 0, answers: R.answers, total: R.steps.length } }); await info(true); }
    catch (e) { toast('تعذّر حفظ إكمال الجولة: ' + e.message, 1); }
  }
  function stop(silent, done) {
    const R = T.run; if (!R) return; T.run = null;
    closeForm(R); sideOpen(false); document.body.style.overflow = '';
    R.block.remove(); R.hole.remove(); R.card.remove();
    document.removeEventListener('keydown', R.onKey, true); window.removeEventListener('resize', R.onMove); window.removeEventListener('scroll', R.onMove, true); document.removeEventListener('transitionend', R.onMove, true);
    if (silent) return;
    if (!done && !R.preview) { api('tour/snooze', { method: 'POST', body: { tour: R.tour } }).catch(() => {}); toast(R.tour === 'designer' ? 'حُفظت خطوتك — أكملي الجولة متى شئتِ من «🎓 الجولة التدريبية»' : 'حُفظت خطوتك — أكمل الجولة متى شئت من «🎓 الجولة التدريبية»'); }
    if (done && !R.preview) toast(R.tour === 'designer' ? 'أحسنتِ — اكتملت الجولة التدريبية 🎓' : 'أحسنت — اكتملت الجولة التدريبية 🎓');
    info(true).then(() => { if (S.route === 'tour') rerender(); }).catch(() => {});
  }
  window.nublTour = { start, stop, jd: jdModal };

  // ---------- العرض المقترح (ابدئي الآن / لاحقاً) ----------
  async function offer() {
    if (T.offered || T.run || !S.meta) return; T.offered = true;
    let inf; try { inf = await info(true); } catch { return; }
    const st = inf.state || {};
    if (st.status === 'مكتملة') return;
    if (st.status !== 'مسندة' && inf.tour !== 'designer') return; // الجولة العامة تُعرض آلياً فقط إن أسندتها الإدارة
    if (st.status !== 'مسندة' && st.snoozed_at && Date.now() - Date.parse(String(st.snoozed_at).replace(' ', 'T') + 'Z') < 20 * 3600e3) return;
    for (let k = 0; k < 20 && $('.modal-bg'); k++) await sleep(500);
    if (T.run) return;
    const f = inf.tour === 'designer';
    const resume = st.status === 'جارية' && st.step > 0;
    const txt = resume ? `${f ? 'توقفتِ' : 'توقفت'} عند الخطوة <b class="num">${st.step + 1}</b> — نكمل؟`
      : f ? 'جولة قصيرة (نحو 8 دقائق) تعرّفك بالمنصة، وبسير عملك، وبالمطلوب منك — وتنتهي باختبار ذاتي من 5 أسئلة.'
        : 'جولة قصيرة (نحو 3 دقائق) تعرّفك بأقسام المنصة التي تخص دورك.';
    const m = modal({ title: '🎓 الجولة التدريبية', body: `<p style="line-height:1.9;margin:0">${f ? `أهلاً ${esc(firstName(me().name))}! ` : ''}${txt}</p>
      <p class="small muted" style="margin:8px 0 0">${f ? 'تستطيعين' : 'تستطيع'} العودة إليها في أي وقت من «🎓 الجولة التدريبية» في القائمة.</p>`,
    foot: `<button class="btn btn-p" data-y>${resume ? (f ? 'أكملي الجولة' : 'أكمل الجولة') : f ? 'ابدئي الجولة الآن' : 'ابدأ الجولة الآن'}</button><button class="btn btn-g" data-n>لاحقاً</button>` });
    $('[data-y]', m.el).onclick = () => { m.close(); start(inf.tour); };
    $('[data-n]', m.el).onclick = () => { m.close(); api('tour/snooze', { method: 'POST', body: { tour: inf.tour } }).catch(() => {}); };
  }

  // بعد حفظ بيانات #/me/welcome: اعرض الجولة (لا تمنع إكمال الملف)
  const api0 = api;
  api = async function (path, opts = {}) {
    const r = await api0(path, opts);
    if (path === 'profile' && (opts.method || 'GET') === 'POST' && /^#\/me\/welcome/.test(location.hash) && !T.offered) setTimeout(offer, 1100);
    return r;
  };

  // ---------- القائمة + المسار #/tour ----------
  const g0 = NAV.find((x) => x[0] === 'الرئيسية');
  if (g0 && !g0[1].some((i) => i[0] === 'tour')) g0[1].push(['tour', '🎓 الجولة التدريبية', 'cap']);

  const stLabel = (s, steps) => {
    if (!s || s.status === 'لم تبدأ') return '<span class="pill x">لم تبدأ</span>';
    if (s.status === 'مكتملة') return `<span class="pill t">مكتملة ✓</span>${s.of ? ` <b class="num">${s.score}/${s.of}</b>` : ''} <small class="muted">${fdate(s.completed_at)}</small>`;
    if (s.status === 'مسندة') return `<span class="pill o">مسندة — لم تبدأ</span>${s.assigned_at ? ` <small class="muted">${fdate(s.assigned_at)}</small>` : ''}`;
    return `<span class="pill g">جارية — خطوة <span class="num">${(s.step || 0) + 1}</span>${s.total || steps ? ` من <span class="num">${s.total || steps}</span>` : ''}</span>`;
  };

  ROUTES.tour = { title: 'الجولة التدريبية', render: async (id, sub, seq) => {
    const inf = await info(true);
    if (seq !== S.renderSeq) return;
    const tour = inf.tour; const s = inf.state || {};
    const c = { name: firstName(me().name), jd: inf.jd, queue: [], item: null };
    const steps = tour === 'designer' ? designerSteps(c) : generalSteps(c);
    const chaps = []; for (const x of steps) { const k = x.ch; const e = chaps.find((y) => y[0] === k); if (e) e[1]++; else chaps.push([k, 1]); }
    const f = tour === 'designer';
    const btn = s.status === 'جارية' && s.step > 0 ? (f ? 'أكملي الجولة' : 'أكمل الجولة') : s.status === 'مكتملة' ? (f ? 'أعيدي الجولة' : 'أعد الجولة') : f ? 'ابدئي الجولة' : 'ابدأ الجولة';
    V().innerHTML = `<div class="tr-page">
      <div class="tr-hero"><div class="em">🎓</div><div><h3>${esc(inf.tours[tour])} — أهلاً ${esc(c.name)}</h3>
        <p>${f ? 'تعرّفي بالمنصة، وبمن ترجعين إليه، وبسير المحتوى من «فكرة» إلى «منشور»، وبمهامك ومؤشرات أدائك وقواعد الجودة — وتنتهي باختبار ذاتي قصير.' : 'تعرّف بأقسام المنصة التي تخص دورك وأين تجد مهامك وتنبيهاتك.'}</p></div></div>
      <div class="card"><div class="toolbar" style="margin-bottom:6px"><span class="tr-st">حالتك: ${stLabel(s, steps.length)}</span><span class="sp"></span>
        ${inf.jd && (f || BOSS()) ? '<button class="btn btn-g" id="tr-jd">📄 الوصف الوظيفي كاملاً</button>' : ''}
        ${s.status === 'جارية' && s.step > 0 ? `<button class="btn btn-g" id="tr-restart">${f ? 'ابدئي من الأول' : 'من البداية'}</button>` : ''}
        <button class="btn btn-p" id="tr-go">${btn} ←</button></div>
        <div class="tr-chap">${chaps.map(([k, n], i) => `<div><b>${i + 1}. ${esc(k)}</b><span class="small muted"><span class="num">${n}</span> ${n > 2 ? 'خطوات' : n === 2 ? 'خطوتان' : 'خطوة'}</span></div>`).join('')}</div></div>
      ${BOSS() ? `<div class="card" style="margin-top:14px"><h3>👁️ معاينة جولة دور…</h3>
        <p class="small muted">تعرض الجولة كما يراها العضو (جولة المصمم/ة تخاطب المصممة باسمها وتعرض قائمتها) — بلا حفظ تقدّم ولا إشعارات.</p>
        <div class="toolbar"><select class="inp" id="tr-pv">${Object.entries(inf.tours).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>
        <button class="btn btn-n" id="tr-pvgo">معاينة</button><span class="sp"></span><a class="btn btn-g btn-s" href="#/team">حالة الفريق في «الفريق» ←</a></div></div>` : ''}
    </div>`;
    $('#tr-go').onclick = () => start(tour, s.status === 'جارية' ? {} : { from: 0 });
    $('#tr-restart') && ($('#tr-restart').onclick = () => start(tour, { from: 0 }));
    $('#tr-jd') && ($('#tr-jd').onclick = jdModal);
    $('#tr-pvgo') && ($('#tr-pvgo').onclick = () => start($('#tr-pv').value, { preview: true, from: 0 }));
  } };

  // ---------- الفريق: حالة الجولات + إسناد/إعادة (admin/manager) ----------
  async function teamCard() {
    if (!BOSS() || $('#tr-team')) return;
    const box = document.createElement('div'); box.className = 'card'; box.id = 'tr-team'; box.style.marginTop = '14px';
    $('#view').appendChild(box);
    const draw = async () => {
      let d; try { d = await api('tour/status'); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      if (!box.isConnected) return;
      box.innerHTML = `<div class="toolbar" style="margin-bottom:6px"><h3 style="margin:0">🎓 الجولات التدريبية</h3><span class="sp"></span><a class="btn btn-g btn-s" href="#/tour">معاينة الجولات</a></div>
        <div class="tbl-wrap"><table class="t"><thead><tr><th>العضو</th><th>الجولة</th><th>الحالة</th><th></th></tr></thead><tbody>${d.rows.map((u) => `<tr>
          <td><b>${esc(u.name)}</b><div class="small muted">${esc(u.title || (S.meta.roles[u.role] || u.role))}</div></td><td>${esc(d.tours[u.tour])}</td><td>${stLabel(u.state)}${u.state.attempts ? ` <small class="muted">· محاولات سابقة ${u.state.attempts}</small>` : ''}</td>
          <td class="n"><button class="btn btn-g btn-s" data-as="${u.id}">${u.state.status === 'لم تبدأ' ? 'إسناد' : 'إعادة الجولة'}</button></td></tr>`).join('')}</tbody></table></div>
        <p class="small muted" style="margin-top:6px">«إسناد» يعرض الجولة على العضو آلياً عند دخوله التالي، و«إعادة» تصفّر خطوته مع حفظ المحاولة السابقة ودرجتها.</p>`;
      $$('[data-as]', box).forEach((b) => b.onclick = async () => {
        const u = d.rows.find((x) => x.id == b.dataset.as);
        if (!(await confirmBox(`${u.state.status === 'لم تبدأ' ? 'إسناد' : 'إعادة'} «${esc(d.tours[u.tour])}» إلى ${esc(u.name)}؟`))) return;
        try { await api('tour/assign', { method: 'POST', body: { user_id: u.id, tour: u.tour } }); toast('تم — تُعرض عليه الجولة عند دخوله'); draw(); } catch (e) { toast(e.message, 1); }
      });
    };
    draw();
  }
  if (ROUTES.team) { const base = ROUTES.team.render; ROUTES.team.render = async (...a) => { await base(...a); await teamCard(); }; }

  // صفحة الترحيب: زر غير مُلزم لبدء الجولة · أول زيارة للوحة/يومي: عرض الجولة إن لم تكتمل
  if (ROUTES.me) {
    const baseMe = ROUTES.me.render;
    ROUTES.me.render = async (id, ...a) => {
      await baseMe(id, ...a);
      const w = id === 'welcome' && $('.pf-welcome');
      if (w && !$('#tr-wel', w)) { w.insertAdjacentHTML('beforeend', `<div style="margin-top:10px"><button class="btn btn-g btn-s" id="tr-wel" type="button">🎓 ${me().role === 'designer' ? 'ابدئي' : 'ابدأ'} الجولة التدريبية</button> <small class="muted">— يمكنك إكمال الملف أولاً</small></div>`); $('#tr-wel').onclick = () => start(); }
    };
  }
  const rr0 = rerender;
  rerender = async function () {
    const r = await rr0.apply(this, arguments);
    if (!T.offered && !T.run && ['dashboard', 'myday'].includes(S.route) && me().role !== 'admin') setTimeout(offer, 700);
    return r;
  };
  if (S.meta && $('.side')) { renderShell(); rerender(); }
})();
