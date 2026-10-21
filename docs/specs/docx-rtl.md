# مواصفة: قاعدتا Word الثابتتان في مستندات المنصة

- **أعدّها:** Cowork، بتاريخ 21 أكتوبر 2026.
- **الأولوية:** قبل partners-v2.
- **البروتوكول:** `docs/BRIDGE.md`، والحالة في `docs/specs/docx-rtl.status.md`.

## القاعدتان (قرار إياد، دائم، على كل ملف يخرج من المنصة)
1. الكتابة من اليمين إلى اليسار دائماً في Word وفي PDF، ويشمل ذلك الأسطر المكسورة والنقاط والجداول.
2. لا تظهر في Word أي علامات تدقيق إملائي حمراء.

## الخلل الحالي في `functions/marketing/hub/api/_lib/docx.js`
- **`h1` و`h2` و`date`:** تستخدم `jc: 'right'`، والخلايا تستخدم `cellP(..., jc='right')`.
  - داخل فقرة bidi يقلب Word معنى right وleft، فتنحاز الأسطر المكسورة إلى اليسار.
  - LibreOffice وPDF يعرضانها سليمة، فلا يظهر الخلل إلا في Word.
- **`cellP`:** لا يضع `<w:bidi/>` في فقرة الخلية.
- **التشغيلات:** لا يوجد فيها `<w:noProof/>` ولا `<w:lang w:val="ar-SA" w:bidi="ar-SA"/>`.
- **`word/settings.xml`:** لا يوجد فيه `hideSpellingErrors` ولا `hideGrammaticalErrors`.

## المطلوب
1. **`para()` و`cellP()`:**
   - أضف `<w:bidi/>` دائماً في موضعه الصحيح من مخطط pPr، أي بعد pBdr/shd وقبل spacing وind وjc.
   - لا تكتب `jc` بقيمة right أو left أبداً:
     - فقرات النص `both`.
     - الخلايا والعناوين والتاريخ بلا `jc`، أي تبدأ من اليمين تلقائياً.
     - `center` يبقى كما هو.
   - أي `align: 'right'` قادم من الأعمدة يُحوَّل إلى «بلا jc».
   - `align: 'left'`، كأعمدة الأرقام، يصبح `end`.
2. **`rPr()` في السطر 30:** أضف `<w:noProof/>` بعد bCs، و`<w:lang w:val="ar-SA" w:eastAsia="en-US" w:bidi="ar-SA"/>` بعد rtl، وفق ترتيب المخطط:
   `rFonts b bCs … noProof … color … sz szCs … rtl … lang`.
3. **settings.xml المولَّد:**
   - أضف `<w:hideSpellingErrors/><w:hideGrammaticalErrors/>` بعد zoom.
   - أضف `<w:themeFontLang w:val="en-US" w:bidi="ar-SA"/>`.
4. **styles.xml:**
   - في docDefaults: `rPrDefault` يحمل `noProof` و`lang bidi="ar-SA"`.
   - `pPrDefault` يحمل `bidi`.
5. **sectPr:** أضف `<w:bidi/>`.
6. **`letterhead.js`:** الترويسة والتذييل، إن كان فيهما نص، بالقواعد نفسها.
7. **طباعة PDF من `docShell` (views.js):**
   - تأكد من وجود `dir="rtl"` و`text-align: start` لكل عنصر نصي.
   - لا `text-align: right` أو `left` ثابتة على فقرات عربية.
   - عناصر `li` تبدأ من اليمين.

## معايير القبول
1. **عرض سعر وعقد وفاتورة بصيغة Word:** فيها فقرة طويلة تنكسر على سطرين، ونقاط، وجدول. تُفتح في Word على Windows، فتبدأ كل الأسطر المكسورة من اليمين، ولا تظهر أي علامة حمراء أو خضراء.
   - يصوّر إياد الشاشة ويرسلها.
   - في بيئتك يكفي التحقق النصي في المعيار 2.
2. **فحص `document.xml`:**
   - صفر نتائج لـ `w:jc w:val="right"` و`w:jc w:val="left"`.
   - كل `<w:r>` يحتوي `<w:noProof/>`.
   - `settings.xml` يحتوي `hideSpellingErrors`.
3. **التحقق بأداة validate:** إن توفرت، وإلا فبفتح الملف بـ python-docx أو LibreOffice، دون أخطاء.
4. **PDF المطبوع من المنصة:** النص فيه من اليمين، والنقاط على اليمين.

## ملاحظة
النسخة المرجعية لهذه القواعد في Python موجودة في `nubl_docx.py` 3.1 و`nubl_finalize.py` في الدرايف، تحت `التسويق/04_الهوية والقوالب/أدوات/`، ويمكن الاسترشاد بترتيب العناصر فيهما.
