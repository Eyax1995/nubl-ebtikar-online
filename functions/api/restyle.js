/**
 * استوديو الأطباع — إعادة بناء صورة الزائر داخل عالم طبعه.
 *
 * يعمل على Cloudflare Pages Functions بربط Workers AI باسم AI.
 * النموذج: FLUX.2 [klein] 4B من Black Forest Labs — يولّد ويعدّل في آنٍ واحد،
 * ويقبل حتى أربع صور مرجعية (كل واحدة أصغر من 512×512).
 *
 * المدخل: multipart/form-data فيه trait + photo
 * المخرج: image/png
 *
 * لا يُخزَّن شيء: الصورة تمرّ في الذاكرة وتُعاد النتيجة مباشرة.
 */

const MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const MAX_BYTES = 1400000;   /* الصورة تُصغَّر في المتصفح إلى 512px قبل الإرسال */

const BASE =
  'Keep the person from image 0 exactly as they are: identical face, identical facial features, ' +
  'identical identity, same age and same clothing shape. Do not change or beautify the face. ' +
  'Re-light and recompose them as a premium editorial portrait. ';

const TAIL =
  ' Use the geometric Saudi sadu weaving motifs and the colour palette of image 1 for the background ' +
  'textiles. Soft directional studio key light from the upper left, clean rim light separating the ' +
  'person from the background, shallow depth of field. National day campaign photography, highly ' +
  'detailed, photorealistic. No text, no lettering, no logos, no watermark, no extra people.';

const SCENES = {
  karam:
    'Place them in a warm Saudi majlis: layered hand-woven wall hangings in deep royal blue (#2C4EA7), ' +
    'a brass dallah and small coffee cups softly out of focus on a low table beside them.',
  jood:
    'Place them in a softly lit reception hall: violet and lilac (#5F5BB2) woven hangings, a glowing ' +
    'traditional incense burner releasing thin smoke behind them, wrapped gifts blurred in the background.',
  himma:
    'Place them outdoors at first light: a distant sandstone mountain ridge, fine dust in the air, the ' +
    'whole scene graded toward deep crimson and magenta (#95144A).',
  asala:
    'Place them in an old Saudi courtyard: carved wooden door, a lone acacia tree, palm shade, the whole ' +
    'scene graded toward fresh green (#54BE36).',
  shajaa:
    'Place them in front of an old stone fortress wall with narrow windows and long hanging banners, the ' +
    'whole scene graded toward olive green (#577C48).',
  ruya:
    'Place them in front of a modern Saudi skyline at golden hour seen through a geometric mashrabiya ' +
    'screen, the whole scene graded toward warm bronze and amber (#75561D).'
};

function err(code, status, extra) {
  return new Response(JSON.stringify(Object.assign({ error: code }, extra || {})), {
    status: status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export async function onRequestGet(context) {
  /* فحص جاهزية — تستخدمه الصفحة لتُظهر الزر أو تخفيه */
  return new Response(JSON.stringify({ ready: !!context.env.AI, model: MODEL }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.AI) return err('not_configured', 503);

  let form;
  try { form = await request.formData(); }
  catch (e) { return err('bad_form', 400); }

  const trait = String(form.get('trait') || '');
  const photo = form.get('photo');

  if (!SCENES[trait]) return err('bad_trait', 400);
  if (!photo || typeof photo === 'string') return err('no_photo', 400);
  if (photo.size > MAX_BYTES) return err('too_large', 413, { max: MAX_BYTES });

  const out = new FormData();
  out.append('prompt', BASE + SCENES[trait] + TAIL);
  out.append('input_image_0', photo, 'photo.png');

  /* بلاطة الطبع الرسمية كمرجع أسلوب — 440×440 فهي تحت حدّ 512 */
  try {
    const refUrl = new URL('/nd/trait-' + trait + '-icon.jpg', request.url);
    const ref = await fetch(refUrl.toString(), { cf: { cacheTtl: 86400 } });
    if (ref.ok) out.append('input_image_1', await ref.blob(), 'ref.jpg');
  } catch (e) { /* المرجع اختياري */ }

  out.append('width', '1024');
  out.append('height', '1024');

  const packed = new Response(out);

  let res;
  try {
    res = await env.AI.run(MODEL, {
      multipart: {
        body: packed.body,
        contentType: packed.headers.get('content-type')
      }
    });
  } catch (e) {
    return err('model_failed', 502, { detail: String(e && e.message || e).slice(0, 200) });
  }

  /* المخرجات تختلف بحسب النموذج: تدفّق ثنائي، أو كائن فيه صورة base64 */
  if (res && typeof res.getReader === 'function') {
    return new Response(res, {
      headers: { 'content-type': 'image/png', 'cache-control': 'no-store' }
    });
  }
  if (res instanceof Response) {
    return new Response(res.body, {
      headers: { 'content-type': 'image/png', 'cache-control': 'no-store' }
    });
  }
  if (res && typeof res === 'object') {
    const b64 = res.image || res.result || res.data;
    if (typeof b64 === 'string') {
      const bin = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
      return new Response(bin, {
        headers: { 'content-type': 'image/png', 'cache-control': 'no-store' }
      });
    }
  }
  return err('unexpected_output', 502);
}
