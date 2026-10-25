# مواصفة: الدفع بالتقسيط (تابي وتمارا) وشروط الدفع الموحّدة

- **أعدّها:** Cowork، بتاريخ 25 أكتوبر 2026.
- **الأولوية:** بعد docx-rtl وpartners-v2.
- **البروتوكول:** `docs/BRIDGE.md`، والحالة في `docs/specs/payments-bnpl.status.md`.

## القرار (إياد، دائم)
كل عرض سعر وعقد يذكر خيارَي دفع بوضوح للعميل:
1. **دفعتان:** 70% عند التوقيع، و30% عند التسليم أو نهاية الشهر الأول.
2. **التقسيط عبر تابي أو تمارا:** يدفع العميل بالتقسيط، وتستلم نُبل المبلغ كاملاً من مزوّد التقسيط بعد خصم عمولته.

النص المعتمد للشروط (يُدرج تلقائياً في القوالب):
> (١) دفعتان: ٧٠٪ عند توقيع العقد، و٣٠٪ عند التسليم. (٢) أو التقسيط عبر تابي أو تمارا دون أي رسوم إضافية على العميل، بمسح رمز QR أو فتح رابط الدفع المرسل مع الفاتورة.

الاستثناءات القائمة تبقى كما هي (مثل BBR بنظام 50/50)، ولا يُعدَّل عرض أو عقد مقبول.

## تحديث 25 أكتوبر: الحساب والربط قائمان
- لدى المجموعة حسابا تاجر فعّالان في تمارا وتابي، والربط منفّذ في نظام الطلبات `nubl-platform`:
  - `SYS/bnpl.php`: الجلسات، والرسوم، والضريبة، والقفل لكل أمر.
  - `AJAX/bnpl_webhook.php`.
  - الثوابت في `SYS/secrets.php` على الخادم فقط: `NUBL_TAMARA_API_TOKEN`، `NUBL_TABBY_SECRET`، `NUBL_TABBY_MERCHANT_CODE`، `NUBL_BNPL_WEBHOOK_SECRET`، `NUBL_BNPL_ENABLED`، `NUBL_BNPL_SURCHARGE_PCT`.
- **المطلوب:** انقل منطق `bnpl.php` و`bnpl_webhook.php` كما هو إلى Pages Functions، ولا تعِد تصميمه. الفرق الوحيد:
  - مرجع الطلب يكون `marketing:INV-…` حتى لا يتعارض مع طلبات الدعاية في الحساب نفسه.
  - عنوان webhook مستقل للتسويق يُضاف في لوحتي المزوّدين.
- **الأسرار:** يضيفها إياد بنفسه في Cloudflare من secrets.php أو من لوحتي التاجر، بالأسماء أدناه. لا يقرؤها Claude ولا يكتبها.

## المرحلة 0 — قبل أي كود (مهام إياد، لا تُنفَّذ آلياً)
- تسجيل حساب تاجر في تمارا (tamara.co/business) وتابي (tabby.ai/business): السجل التجاري، الآيبان، الرقم الضريبي، الموقع.
- استلام مفاتيح Sandbox ثم Live.
- إضافتها كأسرار في Cloudflare Pages (لا في الكود): `TAMARA_API_TOKEN`، `TAMARA_NOTIFICATION_TOKEN`، `TABBY_SECRET_KEY`، `TABBY_PUBLIC_KEY`، `TABBY_MERCHANT_CODE`، و`BNPL_ENV=sandbox|live`.
- التحقق: هل تمارا مفعّلة سابقاً عبر متجر سلة؟ إن كانت كذلك فالحساب الحالي خاص بسلة، ونحتاج حساباً مباشراً (Direct/POS) أو ربطاً عبر روابط الدفع.

## المرحلة 1 — الكود
### 1) الجداول (D1 migration)
`bnpl_sessions(id, invoice_id, provider ['tamara'|'tabby'], provider_ref, checkout_url, amount, currency, status ['created'|'approved'|'captured'|'expired'|'declined'|'refunded'], expires_at, raw_json, created_at, updated_at)`.

### 2) API تحت `functions/marketing/hub/api/bnpl/`
- `POST /bnpl/tamara/:invoiceId`: ينشئ جلسة عبر `POST /checkout/in-store` (أو `/checkout` لرابط دفع). يُرجع `checkout_url`، وتنتهي الجلسة بعد 15 دقيقة.
- `POST /bnpl/tabby/:invoiceId`: ينشئ رابط دفع مخصصاً (Custom payment link / POS).
- `GET /bnpl/:id/qr.svg`: يولّد QR من `checkout_url` محلياً (مكتبة qrcode بلا خدمات خارجية).
- `POST /bnpl/webhook/tamara` و`/bnpl/webhook/tabby`:
  - تحقق من التوقيع أو التوكن.
  - عند الموافقة نفّذ authorise ثم capture حسب المزوّد.
  - حدّث الفاتورة إلى «مدفوعة» وسجّل الدفعة بطريقة «تمارا» أو «تابي».
  - أرسل إشعار واتساب للفريق المالي (محمود مهدي) ولإياد.
- **احتياط:** استعلام دوري (polling) عبر `GET /merchants/orders/{id}` إذا لم يصل الـ webhook خلال 15 دقيقة.

### 3) الواجهة
- في صفحة الفاتورة: زر «تقسيط عبر تمارا» وزر «تقسيط عبر تابي».
  - يعرض كل منهما QR كبيراً للعرض الحضوري، ورابطاً للنسخ والإرسال عبر واتساب.
  - يعرض عدّاداً لانتهاء الجلسة.
- في صفحة تتبّع الفاتورة العامة للعميل: الخياران نفسيهما، بشرط أن يكون المبلغ ضمن حدود المزوّد.
- في مستند Word وPDF للعرض والعقد: فقرة شروط الدفع أعلاه، مع شعارَي تابي وتمارا (الأصول الرسمية من المزوّدين).

### 4) الإعدادات
لوحة «طرق الدفع» فيها:
- تفعيل أو تعطيل كل مزوّد.
- الحد الأدنى والأقصى للمبلغ.
- نسبة عمولة المزوّد، لتظهر في تقرير الربحية لا للعميل.

## معايير القبول
1. في Sandbox: تُنشأ فاتورة، ويُولَّد QR، ويُكمل الدفع بحساب الاختبار، فتتحول الفاتورة إلى «مدفوعة» تلقائياً ويصل الإشعار.
2. لا يظهر أي مفتاح في المستودع، ويُفحص ذلك بـ `git grep -iE "tamara|tabby" -- ':!docs'` بحثاً عن قيم سرية.
3. انتهاء الجلسة يغيّر الحالة إلى expired ويسمح بإعادة التوليد.
4. التوقيع غير الصحيح في الـ webhook يُرفض بالرمز 401.

## مراجع
- تمارا QR: docs.tamara.co/docs/qr-code-pos-integration
- تمارا روابط الدفع: docs.tamara.co/docs/payment-link-pos-integration
- تابي روابط مخصصة: docs.tabby.ai/offline-payment-methods/custom-payment-links
- تابي POS: docs.tabby.ai/offline-payment-methods/pos-integration
