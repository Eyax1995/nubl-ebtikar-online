// مولّد ملفات Word على أوراق «نُبل وابتكار للتسويق» — بنفس تنسيق عرض BBR المعتمد (14 أكتوبر 2026)
// هوية 3.0: العناوين كحلي #18566D بخط سفلي برتقالي #D06429، الجداول برأس كحلي ونص أبيض، صناديق تنبيه بخلفية تركوازي 25٪ وحد برتقالي، خط DG Agnadeen مضمّن، من اليمين لليسار.
// صور الورق الرسمي (~450KB base64) تُحمَّل عند بناء ملف Word فقط لا مع كل طلب للمنصة (26 أكتوبر 2026)
const letterheads = async () => {
  const [{ LETTERHEAD }, { MOROOJ_LETTERHEAD_PNG }] = await Promise.all([import('./letterhead.js'), import('./letterhead-morooj.js')]);
  return { LETTERHEAD, MOROOJ_LETTERHEAD_PNG };
};
import { zip, b64ToU8 } from './zip.js';

// هوية 3.0: كحلي 18566D · برتقالي D06429 · بطاقات تركوازي 25% CCE2E2 · صفوف كحلي 25% · خط DG Agnadeen مضمّن
const NAVY = '18566D', ORANGE = 'D06429', INK = '1E3E4A', GREY = '3E5A66', SHADE = 'E8EEF0', BOX = 'CCE2E2', LINE = 'C5D5DA';
const FONT = '<w:rFonts w:ascii="DG Agnadeen" w:hAnsi="DG Agnadeen" w:eastAsia="DG Agnadeen" w:cs="DG Agnadeen"/>';
const WIDTH = 9468;
const x = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const AR = '٠١٢٣٤٥٦٧٨٩';
export const arDigits = (s) => String(s ?? '').replace(/[0-9]/g, (d) => AR[d]);
export function arMoney(n, frac = 2) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const [i, f] = Math.abs(v).toFixed(frac).split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const dec = f && Number(f) ? '٫' + f.replace(/0+$/, '') : '';
  return (v < 0 ? '-' : '') + arDigits(int + dec);
}
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export function arDate(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  if (!y || !m) return '';
  return `${arDigits(+d)} ${MONTHS[+m - 1]} ${arDigits(y)}م`;
}
export const ORD = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً', 'حادي عشر', 'ثاني عشر', 'ثالث عشر', 'رابع عشر', 'خامس عشر', 'سادس عشر', 'سابع عشر', 'ثامن عشر', 'تاسع عشر', 'عشرون'];

// ---------- عناصر XML ----------
function rPr({ b, color = INK, sz = 18 } = {}) {
  return `<w:rPr>${FONT}${b ? '<w:b/><w:bCs/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/></w:rPr>`;
}
const run = (text, o) => `<w:r>${rPr(o)}<w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
// **نص** يصبح غامقاً داخل الفقرة
function runs(text, o = {}) {
  const parts = String(text ?? '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p) => (p.startsWith('**') ? run(p.slice(2, -2), { ...o, b: true }) : run(p, o))).join('');
}
function para(inner, { jc = 'both', before = 0, after = 100, shade, keepNext, border, ind } = {}) {
  return `<w:p><w:pPr>${keepNext ? '<w:keepNext/>' : ''}${border ? `<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="${border}"/></w:pBdr>` : ''}${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ''}<w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>${ind || ''}${jc ? `<w:jc w:val="${jc}"/>` : ''}<w:rPr><w:sz w:val="18"/><w:szCs w:val="22"/></w:rPr></w:pPr>${inner}</w:p>`;
}
const borders = (c = LINE) => `<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="${c}"/><w:left w:val="single" w:sz="4" w:space="0" w:color="${c}"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="${c}"/><w:right w:val="single" w:sz="4" w:space="0" w:color="${c}"/></w:tcBorders>`;
const cellP = (inner, jc = 'right') => `<w:p><w:pPr><w:spacing w:before="20" w:after="20" w:line="264" w:lineRule="auto"/><w:jc w:val="${jc}"/><w:rPr><w:sz w:val="18"/><w:szCs w:val="22"/></w:rPr></w:pPr>${inner}</w:p>`;

function table(b) {
  const cols = b.cols; const total = cols.reduce((a, c) => a + (c.w || 1), 0);
  const ws = cols.map((c) => Math.round(((c.w || 1) / total) * WIDTH));
  const head = `<w:tr><w:trPr><w:tblHeader/><w:jc w:val="center"/></w:trPr>${cols.map((c, i) => `<w:tc><w:tcPr><w:tcW w:w="${ws[i]}" w:type="dxa"/>${borders()}<w:shd w:val="clear" w:color="auto" w:fill="${NAVY}"/></w:tcPr>${cellP(run(c.label, { b: true, color: 'FFFFFF', sz: 16 }), 'center')}</w:tc>`).join('')}</w:tr>`;
  const body = (b.rows || []).map((row) => {
    const r = Array.isArray(row) ? { cells: row } : row;
    return `<w:tr><w:trPr><w:cantSplit/><w:jc w:val="center"/></w:trPr>${r.cells.map((cell, i) => {
      const c = cell && typeof cell === 'object' ? cell : { text: cell };
      const first = i === 0;
      const bold = c.bold ?? (first || r.total);
      const color = r.total || first ? NAVY : INK;
      const jc = c.align || cols[i].align || 'right';
      const lines = [c.text, ...(c.sub ? [c.sub] : [])].map((t, k) => cellP(runs(t, { b: k === 0 ? bold : false, color: k === 0 ? color : GREY, sz: k === 0 ? 15 : 14 }), jc)).join('');
      return `<w:tc><w:tcPr><w:tcW w:w="${ws[i]}" w:type="dxa"/>${borders()}${r.total || r.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${SHADE}"/>` : ''}</w:tcPr>${lines}</w:tc>`;
    }).join('')}</w:tr>`;
  }).join('');
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${ws.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${head}${body}</w:tbl>${para('', { after: 60 })}`;
}
function callout(label, text) {
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="5000" w:type="pct"/><w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid><w:gridCol w:w="${WIDTH}"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="${WIDTH}" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="single" w:sz="24" w:space="0" w:color="${ORANGE}"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${BOX}"/></w:tcPr>${cellP((label ? run(label + ': ', { b: true, sz: 17 }) : '') + runs(text, { sz: 17 }), 'both')}</w:tc></w:tr></w:tbl>${para('', { after: 60 })}`;
}

// ---------- كتل المستند ----------
export function render(blocks) {
  return blocks.filter(Boolean).map((b) => {
    switch (b.t) {
      case 'date': return para(run(b.text, { color: GREY, sz: 18 }), { jc: 'right', after: 200 });
      case 'title': return para(run(b.text, { b: true, color: NAVY, sz: 38 }), { jc: 'center', after: 40 });
      case 'subtitle': return para(run(b.text, { b: true, color: ORANGE, sz: 23 }), { jc: 'center', after: 120 });
      case 'meta': return para(run(b.label + ': ', { b: true, color: b.shade ? ORANGE : INK, sz: b.shade ? 19 : 16 }) + run(b.text, { sz: b.shade ? 19 : 16 }), { jc: null, after: b.shade ? 60 : 100, shade: b.shade ? BOX : null });
      case 'p': return para(runs(b.text, { sz: b.sz || 18, color: b.color || INK }), { jc: b.jc || 'both', after: b.after ?? 100 });
      case 'h1': return para(run(b.text, { b: true, color: NAVY, sz: 26 }), { before: 240, after: 100, border: ORANGE, keepNext: true, jc: 'right' });
      case 'h2': return para(run(b.text, { b: true, color: ORANGE, sz: 21 }), { before: 160, after: 60, keepNext: true, jc: 'right' });
      case 'table': return table(b);
      case 'callout': return callout(b.label, b.text);
      case 'bullets': return (b.items || []).map((it) => {
        const o = typeof it === 'string' ? { text: it } : it;
        return para(run('●  ', { b: true, color: ORANGE, sz: 12 }) + (o.lead ? run(o.lead + ': ', { b: true, sz: 18 }) : '') + runs(o.text, { sz: 18 }), { after: 60, ind: '<w:ind w:left="360" w:hanging="240"/>' });
      }).join('');
      case 'small': return para(runs(b.text, { sz: 15 }), { after: 100, jc: b.jc || 'both' });
      case 'closing': return para(run('وتفضلوا بقبول فائق الود والتقدير', { b: true, color: NAVY, sz: 17 }), { jc: 'center', before: 60, after: 80 }) + para('', { after: 80 }) + para('', { after: 80 });
      case 'sign': return para(run(b.name || 'إياد المغيرة', { b: true, color: NAVY, sz: 21 }), { jc: 'center', after: 0 })
        + para(run(b.title || 'مدير قطاع التسويق', { color: GREY, sz: 17 }), { jc: 'center', after: 0 })
        + para(run(b.org || 'نُبل وابتكار للخدمات التسويقية', { color: GREY, sz: 17 }), { jc: 'center', after: 0 });
      case 'signatures': return table({ cols: [{ label: b.left || 'الطرف الأول', align: 'center' }, { label: b.right || 'الطرف الثاني', align: 'center' }],
        rows: [[{ text: b.leftName || '', sub: 'الاسم والصفة', bold: true }, { text: b.rightName || '', sub: 'الاسم والصفة', bold: true }],
          [{ text: ' ', sub: 'التوقيع' }, { text: ' ', sub: 'التوقيع' }], [{ text: ' ', sub: 'الختم والتاريخ' }, { text: ' ', sub: 'الختم والتاريخ' }]] });
      case 'esign': return para(run('توقيع إلكتروني معتمد: ', { b: true, color: NAVY, sz: 17 }) + run(`${b.name || ''}${b.title ? ' — ' + b.title : ''} · ${b.at || ''} · رمز التحقق ${b.code || ''}`, { color: GREY, sz: 17 }), { jc: 'right', before: 120, after: 60 });
      case 'pagebreak': return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      case 'spacer': return para('', { after: b.after || 100 });
      default: return '';
    }
  }).join('');
}

const NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14"';
// الهامش السفلي بحسب ورق الجهة: تذييل مروج الحجاز أعلى (خطه عند 262 مم) فيبدأ هامشها السفلي عند 38 مم بدل 28
const SECT = (bottom) => `<w:sectPr><w:headerReference w:type="default" r:id="rId7"/><w:footerReference w:type="default" r:id="rId8"/><w:pgSz w:w="11906" w:h="16838" w:code="9"/><w:pgMar w:top="2948" w:right="1304" w:bottom="${bottom}" w:left="1134" w:header="709" w:footer="1134" w:gutter="0"/><w:cols w:space="708"/><w:bidi/><w:rtlGutter/><w:docGrid w:linePitch="360"/></w:sectPr>`;

export async function buildDocx(blocks, { title = '', subject = '', org = 'nubl' } = {}) {
  const morooj = org === 'morooj';
  const { LETTERHEAD, MOROOJ_LETTERHEAD_PNG } = await letterheads();
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${render(blocks)}${SECT(morooj ? 2160 : 1588)}</w:body></w:document>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(title)}</dc:title><dc:subject>${x(subject)}</dc:subject><dc:creator>إياد المغيرة — ${morooj ? 'مروج الحجاز للأعمال التجارية' : 'نُبل وابتكار للخدمات التسويقية'}</dc:creator><cp:lastModifiedBy>منصة نُبل وابتكار للتسويق</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const files = [{ name: '[Content_Types].xml', data: b64ToU8(LETTERHEAD['[Content_Types].xml']) }, { name: 'word/document.xml', data: doc }, { name: 'docProps/core.xml', data: core }];
  for (const [name, b64] of Object.entries(LETTERHEAD)) {
    if (name === '[Content_Types].xml') continue;
    files.push({ name, data: b64ToU8(morooj && name === 'word/media/image1.png' ? MOROOJ_LETTERHEAD_PNG : b64) });
  }
  return zip(files);
}

// ---------- نسخة HTML مطابقة لملف Word (للطباعة وحفظ PDF على الأوراق الرسمية) ----------
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hr = (s) => h(s).split(/(\*\*[^*]+\*\*)/g).map((p) => (p.startsWith('**') && p.endsWith('**') ? `<b>${p.slice(2, -2)}</b>` : p)).join('').replace(/\n/g, '<br>');
function htable(b) {
  const head = `<tr>${b.cols.map((c) => `<th style="text-align:${c.align === 'center' ? 'center' : 'start'}">${h(c.label)}</th>`).join('')}</tr>`;
  const body = (b.rows || []).map((row) => {
    const r = Array.isArray(row) ? { cells: row } : row;
    return `<tr class="${r.total ? 'tt' : r.shade ? 'sh' : ''}">${r.cells.map((cell, i) => {
      const c = cell && typeof cell === 'object' ? cell : { text: cell };
      const al = c.align || b.cols[i]?.align; const bold = c.bold ?? (i === 0 || r.total);
      return `<td class="${i === 0 ? 'k' : ''}" style="text-align:${al === 'center' ? 'center' : al === 'left' ? 'left' : 'start'}">${bold ? `<b>${hr(c.text)}</b>` : hr(c.text)}${c.sub ? `<small>${hr(c.sub)}</small>` : ''}</td>`;
    }).join('')}</tr>`;
  }).join('');
  return `<table class="dt"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}
export function renderHtml(blocks) {
  return blocks.filter(Boolean).map((b) => {
    switch (b.t) {
      case 'date': return `<p class="d-date">${h(b.text)}</p>`;
      case 'title': return `<h1 class="d-title">${h(b.text)}</h1>`;
      case 'subtitle': return `<p class="d-sub">${h(b.text)}</p>`;
      case 'meta': return `<p class="d-meta${b.shade ? ' sh' : ''}"><b>${h(b.label)}:</b> ${h(b.text)}</p>`;
      case 'p': return `<p class="d-p" style="text-align:${b.jc === 'center' ? 'center' : 'justify'}">${hr(b.text)}</p>`;
      case 'h1': return `<h2 class="d-h1">${h(b.text)}</h2>`;
      case 'h2': return `<h3 class="d-h2">${h(b.text)}</h3>`;
      case 'table': return htable(b);
      case 'callout': return `<div class="d-call">${b.label ? `<b>${h(b.label)}:</b> ` : ''}${hr(b.text)}</div>`;
      case 'bullets': return `<ul class="d-ul">${(b.items || []).map((it) => { const o = typeof it === 'string' ? { text: it } : it; return `<li>${o.lead ? `<b>${h(o.lead)}:</b> ` : ''}${hr(o.text)}</li>`; }).join('')}</ul>`;
      case 'small': return `<p class="d-small" style="text-align:${b.jc === 'center' ? 'center' : 'justify'}">${hr(b.text)}</p>`;
      case 'closing': return '<p class="d-close">وتفضلوا بقبول فائق الود والتقدير</p>';
      case 'sign': return `<p class="d-sign"><b>${h(b.name || 'إياد المغيرة')}</b><br>${h(b.title || 'مدير قطاع التسويق')}<br>${h(b.org || 'نُبل وابتكار للخدمات التسويقية')}</p>`;
      case 'signatures': return `<div class="d-sigs"><div><b>${h(b.left || 'الطرف الأول')}</b><span>${h(b.leftName || '')}</span><small>الاسم والصفة</small><i></i><small>التوقيع</small><i></i><small>الختم والتاريخ</small></div><div><b>${h(b.right || 'الطرف الثاني')}</b><span>${h(b.rightName || '')}</span><small>الاسم والصفة</small><i></i><small>التوقيع</small><i></i><small>الختم والتاريخ</small></div></div>`;
      case 'esign': return `<div class="d-esign" style="margin-top:14px;padding:10px 14px;border:1px solid #CFE3DF;border-radius:10px;background:#F3FAF8;display:flex;gap:14px;align-items:center;flex-wrap:wrap;page-break-inside:avoid">${/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(b.img || '') ? `<img src="${b.img}" alt="التوقيع" style="height:70px;max-width:220px;object-fit:contain;background:#fff;border-radius:6px">` : ''}<div style="font-size:13px"><b>وُقّع إلكترونياً من الطرف الثاني</b> — ${h(b.name)}${b.title ? ' — ' + h(b.title) : ''}<br><small>${h(b.at)} · رمز التحقق <span dir="ltr">${h(b.code)}</span></small></div></div>`;
      case 'pagebreak': return '<div class="d-pb"></div>';
      case 'spacer': return '<div style="height:8px"></div>';
      default: return '';
    }
  }).join('');
}
