# مستودع nubl-ebtikar.online — دليل العمل للمطوّر ولـ Claude Code

الرد على إياد بالعربية دائماً. هذا المستودع يخدم **نُبل وابتكار للتسويق** فقط؛ مروج الحجاز نظام منفصل تماماً (مستودع وحساب Cloudflare مستقلان)، وأرقام الدعاية والإعلان لا تدخل هنا.

## النشر
- Cloudflare Pages (مشروع `nubl-ebtikar-online`، حساب Marketing@nublandebtikar.com — Workers Paid) يُنشر آلياً عند أي push إلى `main`.
- على جهاز إياد: شغّل `publish.bat` من جذر المجلد (يسحب آخر نسخة، يحفظ التعديلات، ويرفعها).
- الإعدادات في `wrangler.toml` (مصدر الحقيقة)، والأسرار من لوحة Cloudflare فقط: `ANTHROPIC_API_KEY` (محرك الذكاء الأساسي، واختيارياً `CLAUDE_MODEL`)، `GEMINI_API_KEY` (احتياطي)، `META_APP_SECRET`, `WA_TOKEN`, `WA_VERIFY_TOKEN`. لا تُكتب أي أسرار في الكود.

## البنية
| المسار | الوظيفة |
|---|---|
| `index.html`, `nd/`, `nd96/`, `catalog/` | صفحة اليوم الوطني والكتالوج |
| `marketing/` | موقع كيان التسويق `/marketing` |
| `marketing/hub/` | واجهة المنصة الإدارية (JS بلا خطوة بناء) |
| `functions/marketing/hub/api/` | خادم المنصة (Pages Functions + D1 `DB`) |
| `functions/wa/` | مساعد واتساب + الجسر + فحص الصحة (D1 `WA_DB`) |

### واجهة المنصة `marketing/hub/`
ترتيب التحميل في `index.html`: `hub.js` (النواة: `$`, `api`, `I`, `ENT`, `NAV`, `ROUTES`, `modal`, `openForm`, `listView`, `renderShell`, `rerender`) ← `views.js` ← `notif.js` ← `agent.js` ← `debts.js` ← `xreq.js` ← `tpl.js` (يستدعي `boot()`) ← `wainbox.js` ← `fields.js` ← `ops.js` ← `commissions.js` ← `studio.js` ← `ui.js`.
- الوحدات الإضافية تغلّف `renderShell`/`rerender` ولا تعدّل النواة.
- **`theme.css` + `ui.js` = نظام الواجهة 3.0 «نُبل موشن»**: أيقونات متحركة ثنائية اللون تستبدل `I.*` (أضف أي أيقونة جديدة في `ICONS` داخل ui.js بنفس الأسلوب: `.s` خط، `.f/.f2` تعبئة الهوية، `.t` ظل، وفئات الحركة `m-*`)، درج جانبي آمن للجوال، شريط سفلي وزر إنشاء سريع، لوحة أوامر Ctrl+K، انتقالات، وعدّ الأرقام.
- عند تعديل أي ملف واجهة ارفع رقم الإصدار `?v=` في `index.html` لكسر التخزين المؤقت.
- الهوية: `#082A37` `#15556B` `#308D8B` `#DC9C47` `#D2652A` `#F4EDE1` `#FCFAF6`، خط IBM Plex Sans Arabic، النجمة الرباعية.

### الخادم
- `[[path]].js` يوجّه كل `/marketing/hub/api/*`. المخطط في `_lib/schema.js` (`SCHEMA_VERSION` + `MIGRATIONS` تُطبَّق آلياً عند أول طلب). البيانات الأولية في `_lib/seed.js`.
- إنشاء المهام مقفل: كل مهمة عبر قالب `POST /templates/:id/run`.
- **استوديو الذكاء** (`_lib/studio.js` + `ai.js` + `docs.js` + `docx.js` + `letterhead.js` + `zip.js`، والواجهة `studio.js`): عرض سعر ذكي بنموذج عرض BBR ← اعتماد الأسعار ← عقد ذكي ← خطة تسويقية ← منشورات الشهر في تقويم المحتوى. أسعار الكتالوج مقفلة، والبنود الخاصة `review` حتى يعتمدها admin/manager/finance. المجاميع والضريبة تُحسب في `docs.js` لا في الذكاء. ملفات Word تُبنى على أوراق الكيان من `letterhead.js` (مستخرج من نموذج BBR — لتحديث الأوراق أعد توليده من ملف Word معتمد). البنود القانونية للعقد ثابتة في `contractBlocks`.
- **المناديب والعمولات** (`_lib/reps.js` + `commissions.js` + `rep.html`): استحقاق آلي عند كل تحصيل، أول عقد + التجديدات لمدة المندوب، اعتماد وصرف، ورابط كشف حساب خاص.
- الإشعارات: `notifyUser` (المنصة + واتساب + تلجرام، لا واتساب 23:00–07:00 بتوقيت الرياض).
- الجدولة: Worker منفصل `nubl-scheduler` (كل 10 دقائق `/wa/health`، ويومياً 7:30 ص ملخص تلجرام).

## التشغيل والاختبار محلياً
```
npm i -g wrangler
wrangler pages dev . --port 8788 --local --persist-to .d1
```
ثم أنشئ مستخدماً تجريبياً في D1 المحلي، وافتح `http://localhost:8788/marketing/hub/`. اختبر دائماً على عرض 390px (جوال) و1366px (حاسوب) قبل الرفع، وتأكد أن `document.documentElement.scrollWidth === innerWidth` (لا تمدد أفقي).

## قواعد ثابتة
- لا تُدخل كلمات مرور أو رموزاً في الكود أو الحقول. لا حذف نهائي للبيانات من المنصة دون تأكيد.
- خطة التطوير المعتمدة: وثيقة المشروع «خطة تطوير منصة التسويق — المواءمة والإشعارات والأتمتة» + «خارطة المرحلة 2026-Q4» في `docs/roadmap.md`.
