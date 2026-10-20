/* نُبل وابتكار للتسويق — أدوات تفاعلية: أسئلة بأيقونات متحركة (الزوايا ^ هي الشكل الخاص بالتسويق)
   يُحمَّل من app.js عند وجود #quiz فقط. يعتمد على أنماط .ai من motion.css (s/f/f2/t/x + m-*) ويضيف أنماطه في quiz.css */
(function () {
  'use strict';
  var NB = window.NB = window.NB || {};
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- أدوات رسم الأيقونات ---------- */
  var DASH = 'stroke-dasharray="2.4 2.6"';
  function A(b, c) { return '<svg class="ai' + (c ? ' ' + c : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + b + '</svg>'; }
  function P(d, c, x) { return '<path class="' + (c || 's') + '"' + (x ? ' ' + x : '') + ' d="' + d + '"/>'; }
  function D(d, m, c) { return '<path class="' + (c || 'x') + ' ' + m + '" pathLength="1" d="' + d + '"/>'; }
  function C(x, y, r, c, m, e) { return '<circle class="' + (c || 's') + (m ? ' ' + m : '') + '" cx="' + x + '" cy="' + y + '" r="' + r + '"' + (e ? ' ' + e : '') + '/>'; }
  function R(x, y, w, h, r, c, m, e) { return '<rect class="' + (c || 's') + (m ? ' ' + m : '') + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '"' + (e ? ' ' + e : '') + '/>'; }
  var STAR = 'M0 -5L1.18 -1.62L4.76 -1.55L1.9 .62L2.94 4.05L0 2L-2.94 4.05L-1.9 .62L-4.76 -1.55L-1.18 -1.62Z';
  function ST(x, y, s, c, m) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path class="' + (c || 'f') + (m ? ' ' + m : '') + '" d="' + STAR + '"/></g>'; }
  var PIN = 'M12 21s-6.5-5.8-6.5-10.6a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z';
  var DOC = 'M6 3h9l4 4v14H6z';
  var PHONE = function (c) { return R(7, 2.5, 10, 19, 2.5, c || 's'); };
  var MEGA = 'M3 11v2a2 2 0 0 0 2 2h2l6 4V5L7 9H5a2 2 0 0 0-2 2z';
  function coins(n) {
    var o = '', i, y;
    for (i = 0; i < n; i++) {
      y = 19 - i * 3.4;
      o += '<path class="t" d="M6 ' + y + 'v-2.2c0-1.3 2.7-2.3 6-2.3s6 1 6 2.3V' + y + 'c0 1.3-2.7 2.3-6 2.3S6 ' + (y + 1.3) + ' 6 ' + y + 'z"/>'
        + '<path class="s" d="M6 ' + (y - 2.2) + 'v2.2c0 1.3 2.7 2.3 6 2.3s6-1 6-2.3v-2.2"/>'
        + '<ellipse class="' + (i === n - 1 ? 'f' : 'f2') + (i === n - 1 ? ' m-pulse' : '') + '" cx="12" cy="' + (y - 2.2) + '" rx="6" ry="2.3"/>';
    }
    if (n >= 4) o += C(19, 5.5, 1.2, 'f2', 'm-sp1') + C(5, 3.5, .9, 'f', 'm-sp2');
    return A(o);
  }

  /* ---------- مكتبة الأيقونات (24×24، بأسلوب نُبل موشن) ---------- */
  var IC = {
    /* رؤوس الأسئلة */
    store: A(P('M3 9h18v11H3z', 't') + P('M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18') + '<g class="m-swing" style="transform-origin:50% 0">' + P('M9.5 20v-6h5v6') + '</g>' + C(6.5, 12.5, 1.1, 'f', 'm-pulse') + C(17.5, 12.5, 1.1, 'f2', 'm-pulse')),
    rocket: A(P('M12 2.5c3 2 4.5 5 4.5 9L12 17 7.5 11.5c0-4 1.5-7 4.5-9z', 't') + P('M12 2.5c3 2 4.5 5 4.5 9L12 17 7.5 11.5c0-4 1.5-7 4.5-9z') + C(12, 9, 1.7, 'f', 'm-pulse') + P('M7.7 12L5 15l2.8.7M16.3 12L19 15l-2.8.7') + D('M10.6 19.2L12 22.5l1.4-3.3', 'm-up')),
    target: A(C(11, 13, 8, 't') + C(11, 13, 8, 's') + C(11, 13, 4.4, 's') + C(11, 13, 1.6, 'f', 'm-pulse') + D('M11 13l8-8', 'm-draw') + P('M16 3.5V8h4.5', 'x')),
    wallet: A(P('M4 7.5h14a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19z', 't') + P('M4 7.5V6a2 2 0 0 1 2-2h10l-2 3.5') + P('M4 7.5h14a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19z') + C(16, 14.2, 1.5, 'f', 'm-pulse') + '<g class="m-up">' + C(9, 4.4, 1.2, 'f2') + '</g>'),
    badge: A(R(4, 4, 16, 16, 4, 't') + R(4, 4, 16, 16, 4) + D('M8 15.5l4-7 4 7', 'm-draw') + C(12, 18, 1, 'f2', 'm-pulse')),
    phoneheart: A(PHONE('t') + PHONE() + P('M10.3 5h3.4') + P('M12 15.3s-3.2-1.9-3.2-4.2a1.8 1.8 0 0 1 3.2-1.1 1.8 1.8 0 0 1 3.2 1.1c0 2.3-3.2 4.2-3.2 4.2z', 'f', 'm-pulse') + C(15.8, 6.5, .9, 'f2', 'm-sp1')),
    camera: A(P('M4 8h3l2-3h6l2 3h3v11H4z', 't') + P('M4 8h3l2-3h6l2 3h3v11H4z') + C(12, 13, 3.7) + C(12, 13, 1.8, 'f', 'm-pulse') + C(17.6, 10.4, 1, 'f2', 'm-blink')),
    mega: A('<g class="m-wig" style="transform-origin:20% 50%">' + P(MEGA, 't') + P(MEGA) + '</g>' + D('M17 8.5a5 5 0 0 1 0 7', 'm-draw') + D('M19.5 6a8.5 8.5 0 0 1 0 12', 'm-draw2')),
    seasoncal: A(R(3, 5, 18, 16, 2.5, 't') + R(3, 5, 18, 16, 2.5) + P('M3 10h18M8 3v4M16 3v4') + P('M15.5 12.4a3.4 3.4 0 1 0 2.4 5.7 4.4 4.4 0 0 1-2.4-5.7z', 'f', 'm-pulse') + ST(9, 15.5, .55, 'f2', 'm-tw')),
    printer: A(P('M7 9V3.5h10V9', 's') + R(3, 9, 18, 8, 2, 't') + R(3, 9, 18, 8, 2) + R(7, 14, 10, 7, 1, 'f', 'm-slide') + C(17.5, 11.6, .8, 'f2')),
    report: A(P(DOC, 't') + P(DOC) + P('M14 3v5h5') + D('M9 16l2.2-2.6 2 1.5 3-3.7', 'm-draw') + C(9, 11, .9, 'f2')),

    /* خيارات: القطاع */
    flower: A(C(12, 5.4, 2.4, 'f') + C(16.4, 8.6, 2.4, 'f') + C(14.7, 13.5, 2.4, 'f') + C(9.3, 13.5, 2.4, 'f') + C(7.6, 8.6, 2.4, 'f') + C(12, 10, 2.2, 'f', 'm-pulse') + P('M12 15.8V21') + P('M12 19c-3 0-4.5-1.6-4.5-3.6 3 0 4.5 1.4 4.5 3.6z', 'f2')),
    cup: A(P('M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z', 't') + P('M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z') + P('M16 10.5h1.4a2.4 2.4 0 0 1 0 4.8H15.6') + D('M8.5 3.2c-1.2 1.2 1.2 2.1 0 3.6', 'm-up') + D('M12.2 3.2c-1.2 1.2 1.2 2.1 0 3.6', 'm-up2') + P('M3.5 21h14', 'x')),
    bag: A(P('M5 8h14l-1 12H6z', 't') + P('M5 8h14l-1 12H6z') + '<g class="m-bob">' + P('M9 11V7.5a3 3 0 0 1 6 0V11') + '</g>' + C(12, 15, 1.2, 'f', 'm-pulse')),
    building: A(R(4.5, 3, 10, 18, 1, 't') + R(4.5, 3, 10, 18, 1) + P('M14.5 10H19a.5.5 0 0 1 .5.5V21h-5') + P('M7.5 7h1.6M10.8 7h1.6M7.5 11h1.6M10.8 11h1.6M7.5 15h1.6M10.8 15h1.6', 'x') + R(8.4, 17.6, 2.4, 3.4, 0, 'f2') + C(17, 14, .9, 'f', 'm-pulse')),
    handheart: A(P('M12 13.6s-4.8-2.9-4.8-6.3a2.7 2.7 0 0 1 4.8-1.7 2.7 2.7 0 0 1 4.8 1.7c0 3.4-4.8 6.3-4.8 6.3z', 'f', 'm-pulse') + P('M3.5 15.5c3 3.7 5.7 5 8.5 5s5.5-1.3 8.5-5') + P('M7.5 17.6c1.4.8 2.9 1.2 4.5 1.2s3.1-.4 4.5-1.2', 'x')),
    party: A(P('M4 20.5l4.3-11 6.7 6.7z', 't') + P('M4 20.5l4.3-11 6.7 6.7z') + P('M7 14.5l3.5 3.5', 'x') + D('M13.5 4v2.6', 'm-sp1') + D('M19.5 10h-2.6', 'm-sp2') + D('M17.6 5.4l-1.8 1.8', 'm-sp1') + C(18.5, 16.5, 1.1, 'f2', 'm-sp2') + C(10, 4.8, 1, 'f', 'm-sp1') + P('M11.5 8c1.5-1 3-.5 3.8.7', 's')),
    factory: A(P('M3 21V11.5l5.5 3V11.5l5.5 3V8h4.5a.5.5 0 0 1 .5.5V21z', 't') + P('M3 21V11.5l5.5 3V11.5l5.5 3V8h4.5a.5.5 0 0 1 .5.5V21z') + P('M7 18h1.4M11 18h1.4M15.5 18h1.4', 'x') + D('M15.6 5.8c0-1.4 1.8-1.4 1.8-3', 'm-up') + C(19.4, 14, .9, 'f2', 'm-pulse')),

    /* خيارات: المرحلة */
    sprout: A(P('M12 21v-8.5') + P('M12 13c0-3.6-2.6-5.3-6.3-5.3 0 3.6 2.6 5.3 6.3 5.3z', 'f2') + '<g class="m-bob">' + P('M12 11c0-3.2 2.1-5.3 6.3-5.3 0 3.2-2.1 5.3-6.3 5.3z', 'f', 'm-pulse') + '</g>' + P('M7 21h10', 'x')),
    sliders: A(P('M4 7h16M4 12h16M4 17h16') + C(9, 7, 2.2, 'f', 'm-bob') + C(16, 12, 2.2, 'f2', 'm-bob2') + C(8, 17, 2.2, 'f', 'm-bob')),
    team: A(C(12, 8, 3.2, 'f') + P('M6.2 20c.6-3.6 2.8-5.6 5.8-5.6s5.2 2 5.8 5.6') + C(5, 10.2, 2, 't') + C(5, 10.2, 2) + C(19, 10.2, 2, 't') + C(19, 10.2, 2) + D('M12 3.4V1.6M10.6 2.8L12 1.4l1.4 1.4', 'm-up')),

    /* خيارات: الأولوية */
    cartchart: A(P('M3 4h2.4l2 10.5h9.2l1.9-7.5H6.8') + C(9.6, 18.5, 1.4, 'f') + C(16.4, 18.5, 1.4, 'f') + D('M9.6 11.6l2.4-2.2 2 1.6 3.4-3.6', 'm-draw') + P('M16.2 6.8h2.4v2.4', 'x')),
    chatphone: A(PHONE('t') + PHONE() + P('M10.3 5h3.4') + '<g>' + C(9.6, 13, 1, 'f', 'm-t1') + C(12, 13, 1, 'f', 'm-t2') + C(14.4, 13, 1, 'f', 'm-t3') + '</g>' + P('M10 17.6h4', 'x')),
    brand: A(R(4, 4, 16, 16, 4, 't') + R(4, 4, 16, 16, 4) + D('M8 15.5l4-7 4 7', 'm-draw') + C(12, 18, 1, 'f2', 'm-pulse')),

    /* خيارات: الميزانية */
    coin1: coins(1), coin2: coins(2), coin3: coins(3), coin4: coins(4),

    /* الهوية */
    b0: A(C(12, 12, 8.2, 's', '', DASH) + P('M9.6 9.7a2.4 2.4 0 1 1 3.5 2.1c-.8.5-1.1.9-1.1 1.8', 'x m-wig') + C(12, 16.7, .9, 'f', 'm-pulse')),
    b1: A(C(12, 12, 8.5, 't') + C(12, 12, 8.5) + D('M8 14.8l4-6.6 4 6.6', 'm-draw')),
    b2: A(C(8, 7.5, 4, 't') + C(8, 7.5, 4) + P('M6.2 9l1.8-3 1.8 3', 'x') + C(8, 18, 2, 'f') + C(13, 18, 2, 'f2') + C(18, 18, 2, 't', 'm-pulse') + P('M14.2 12.5l3.4-8.5 3.4 8.5M15.3 10.2h4.6', 's')),
    b3: A(R(2.5, 3.5, 10, 6.5, 1.2, 't') + R(2.5, 3.5, 10, 6.5, 1.2) + P('M5.4 8l1.6-2.6L8.6 8', 'x') + R(15, 3, 6.5, 11.5, 1.6, 't') + R(15, 3, 6.5, 11.5, 1.6) + P('M16.7 9.6l1.5-2.4 1.5 2.4', 'x') + P('M3.5 14.5h8.5l-1 6.5H4.6z', 'f2') + P('M14.2 17.5h6M14.2 20h4', 'x') + C(9, 17, .9, 'f', 'm-pulse')),

    /* الحضور الاجتماعي */
    s0: A(R(7, 2.5, 10, 19, 2.5, 's', '', DASH) + P('M9.8 12h4.4', 'x') + C(12, 18.6, .8, 'f', 'm-pulse')),
    s1: A(R(3.5, 4.5, 7, 6.2, 1.2, 'f') + R(13.5, 4.5, 7, 6.2, 1.2, 's', '', DASH) + R(3.5, 13.3, 7, 6.2, 1.2, 's', '', DASH) + R(13.5, 13.3, 7, 6.2, 1.2, 'f2', 'm-pulse')),
    s2: A(R(3.5, 4.5, 7, 6.2, 1.2, 'f') + R(13.5, 4.5, 7, 6.2, 1.2, 'f2') + R(3.5, 13.3, 7, 6.2, 1.2, 'f2') + R(13.5, 13.3, 7, 6.2, 1.2, 'f', 'm-pulse') + P('M9.6 21.2h4.8', 'x')),
    s3: A(R(3, 5, 18, 16, 2.5, 't') + R(3, 5, 18, 16, 2.5) + P('M3 10h18M8 3v4M16 3v4') + P('M7 14h.01M11 14h.01M15 14h.01M7 18h.01M11 18h.01', 'x', 'style="stroke-width:2.6"') + C(17.6, 17.8, 3.4, 'f', 'm-pulse') + P('M16 17.8l1.2 1.2 2.1-2.4', 's')),

    /* المحتوى البصري */
    p0: A(PHONE() + C(12, 9.5, 2.4, 's') + C(12, 9.5, .9, 'f', 'm-pulse') + P('M10 17h4', 'x')),
    p1: A('<g transform="rotate(-6 12 12)">' + R(5, 3.5, 14, 17, 1.5, 't') + R(5, 3.5, 14, 17, 1.5) + R(7.2, 5.7, 9.6, 8.8, 1, 's') + P('M7.5 13.5l2.8-3 2 2 1.4-1.4 2.6 2.4', 'x') + C(14.6, 7.9, .9, 'f', 'm-pulse') + '</g>'),
    p2: A(P('M4 8h3l2-3h6l2 3h3v11H4z', 't') + P('M4 8h3l2-3h6l2 3h3v11H4z') + C(12, 13.4, 3.6) + C(12, 13.4, 1.7, 'f', 'm-pulse') + D('M2.6 3.2l1.4 1.6M6.2 2l.4 1.8M9.6 2.8l-.7 1.7', 'm-sp1')),
    p3: A(R(8, 3, 13, 10, 1.5, 's') + R(3, 7.5, 13, 10, 1.5, 't') + R(3, 7.5, 13, 10, 1.5) + P('M8.3 10.8v4l3.4-2z', 'f', 'm-pulse') + P('M18.5 15.5a3.6 3.6 0 0 1-3.2 4.2M17.2 21l-1.9-1.3 1.7-1.7', 'x') + ST(19, 16.6, .45, 'f2', 'm-sp1')),

    /* الإعلانات */
    a0: A('<g>' + P(MEGA, 't') + P(MEGA) + '</g>' + P('M3.5 3.5l17 17', 'x')),
    a1: A(R(4, 4, 16, 16, 3.2, 't') + R(4, 4, 16, 16, 3.2) + C(8.6, 8.6, 1.4, 'f') + C(15.4, 15.4, 1.4, 'f') + C(12, 12, 1.4, 'f2', 'm-pulse') + C(15.4, 8.6, 1.4, 'f') + C(8.6, 15.4, 1.4, 'f')),
    a2: A('<g class="m-wig" style="transform-origin:20% 50%">' + P(MEGA, 't') + P(MEGA) + '</g>' + D('M17 8.5a5 5 0 0 1 0 7', 'm-draw') + D('M19.5 6a8.5 8.5 0 0 1 0 12', 'm-draw2')),
    a3: A(C(10, 13, 7.5, 't') + C(10, 13, 7.5) + C(10, 13, 4) + C(10, 13, 1.5, 'f', 'm-pulse') + D('M10 13l8.5-8.5', 'm-draw') + P('M15.5 3.5h4v4', 'x') + R(18, 14, 3, 6, .8, 'f2', 'm-g1') + R(14.5, 17, 3, 3, .8, 'f', 'm-g2')),

    /* القياس */
    m0: A(C(10.5, 10.5, 6.5, 't') + C(10.5, 10.5, 6.5) + P('M15.4 15.4L21 21') + P('M8.8 9a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.6-.9 1.4', 'x m-wig') + C(10.5, 14.2, .8, 'f', 'm-pulse')),
    m1: A(P('M12 3v9h9a9 9 0 0 0-9-9z', 'f', 'm-pulse') + P('M12 12L5.6 18.4A9 9 0 0 1 12 3', 's', DASH) + P('M12 12h9a9 9 0 0 1-2.6 6.4L12 12z', 's', DASH) + P('M5.6 18.4A9 9 0 0 0 18.4 18.4', 's', DASH)),
    m2: A(P('M4 5h16v11H9l-5 4z', 't') + P('M4 5h16v11H9l-5 4z') + P('M10.2 8.9a1.9 1.9 0 1 1 2.7 1.7c-.5.3-.9.6-.9 1.2', 'x m-wig') + C(12, 14.2, .7, 'f', 'm-pulse')),
    m3: A(C(5, 5.5, 2, 'f') + C(12, 5.5, 2, 'f2') + C(19, 5.5, 2, 'f') + P('M5 7.5l5.2 6.6M12 7.5v6.6M19 7.5l-5.2 6.6') + C(12, 17.6, 3.6, 't') + C(12, 17.6, 3.6) + C(12, 17.6, 1.2, 'f', 'm-pulse') + D('M5 7.5l5.2 6.6', 'm-draw2')),

    /* المواسم */
    se0: A(C(12, 13.2, 7.8, 't') + C(12, 13.2, 7.8) + '<g class="m-spin" style="transform-box:view-box;transform-origin:12px 13.2px">' + P('M12 8.8v4.4', 'x') + '</g>' + P('M12 13.2l2.8 1.7', 'x') + P('M4.6 5.2L2.8 7M19.4 5.2L21.2 7', 's') + P('M9 3h6', 's')),
    se1: A(R(3, 5, 18, 16, 2.5, 't') + R(3, 5, 18, 16, 2.5) + P('M3 10h18M8 3v4M16 3v4') + R(5.5, 12.3, 13, 3, 1, 'f', 'm-pulse') + P('M7 18.6h.01M11 18.6h.01M15 18.6h.01', 'x', 'style="stroke-width:2.6"')),
    se2: A(R(3, 5, 18, 16, 2.5, 't') + R(3, 5, 18, 16, 2.5) + P('M3 10h18M8 3v4M16 3v4') + R(5.2, 11.8, 13.6, 6.8, 1.2, 'f2', 'm-pulse') + P('M7.5 14.2h9M7.5 16.4h6', 'x')),
    se3: A(R(3, 5, 18, 16, 2.5, 't') + R(3, 5, 18, 16, 2.5) + P('M3 10h18M8 3v4M16 3v4') + P('M10 12.6a3.4 3.4 0 1 0 2.6 5.8 4.4 4.4 0 0 1-2.6-5.8z', 'f', 'm-pulse') + ST(16.2, 15.4, .62, 'f2', 'm-tw') + C(14.2, 19.2, .6, 'f', 'm-sp1')),

    /* المطبوعات */
    pr0: A(P(DOC, 's', DASH) + P('M14 3v5h5', 's') + P('M10 13l4 4M14 13l-4 4', 'x')),
    pr1: A(R(2.5, 5, 11.5, 7.5, 1.4, 'f') + R(10, 12, 11.5, 7.5, 1.4, 'f2') + P('M5.2 9.6l2-3.2 2 3.2', 's', 'style="stroke:#fff"') + D('M13.8 5.6l3.6 3.2', 'm-wig')),
    pr2: A(R(3, 3.8, 9, 6, 1.2, 'f') + R(12, 3.8, 9, 6, 1.2, 'f2') + R(3, 13, 9, 7, 1.2, 'f', 'm-pulse') + R(12, 13, 9, 7, 1.2, 's', '', DASH)),
    pr3: A(R(3, 3.5, 11, 7, 1.4, 'f') + P('M5.6 8.4l2.4-3.8 2.4 3.8', 's', 'style="stroke:#fff"') + P('M15.5 3.5h5v11h-5z', 't') + P('M15.5 3.5h5v11h-5z') + P('M3 13.5h6.5l-.8 7H3.8z', 'f2') + P('M12 17.5h9M12 20.5h6', 'x') + C(18, 7, .9, 'f', 'm-pulse')),

    /* الظهور المحلي */
    l0: A(P(PIN, 's', DASH) + P('M4 4l16 16', 'x')),
    l1: A('<g class="m-bob">' + P(PIN, 't') + P(PIN) + C(12, 10.2, 2.4, 's', '', DASH) + '</g>' + P('M8.5 21.5h7', 'x')),
    l2: A('<g class="m-bob">' + P(PIN, 'f2') + P(PIN) + C(12, 10.2, 2.5, 'f') + '</g>' + ST(5, 4, .5, 't') + ST(19, 4, .5, 't')),
    l3: A('<g class="m-bob">' + P(PIN, 'f2') + P(PIN) + C(12, 10.2, 2.5, 'f') + '</g>' + ST(4.6, 4.4, .62, 'f', 'm-sp1') + ST(19.4, 4.4, .62, 'f', 'm-sp2') + P('M15.5 16.6h5a1 1 0 0 1 1 1v2.2a1 1 0 0 1-1 1h-2.4l-1.8 1.4v-1.4h-.8a1 1 0 0 1-1-1v-2.2a1 1 0 0 1 1-1z', 'f', 'm-pulse')),

    /* التقارير */
    r0: A(P(DOC, 's', DASH) + P('M14 3v5h5', 's') + P('M9.5 13.5h5M9.5 17h3', 'x', 'style="opacity:.4"')),
    r1: A(R(3, 5, 18, 14, 2, 't') + R(3, 5, 18, 14, 2) + P('M7 9.5V8h1.5M17 9.5V8h-1.5M7 14.5V16h1.5M17 14.5V16h-1.5', 'x') + C(12, 12, 2.6, 's') + C(12, 12, .9, 'f', 'm-pulse')),
    r2: A(P(DOC, 't') + P(DOC) + P('M14 3v5h5') + R(8.6, 15.4, 1.8, 3, .4, 'f2', 'm-g1') + R(11.6, 13, 1.8, 5.4, .4, 'f', 'm-g2') + R(14.6, 14.4, 1.8, 4, .4, 'f2', 'm-g3') + P('M8.6 11.5h4', 'x')),
    r3: A(P(DOC, 't') + P(DOC) + P('M14 3v5h5') + D('M8.6 15.5l2.2-2.6 2 1.4 2.8-3.4', 'm-draw') + C(17, 18.2, 3.2, 'f', 'm-pulse') + P('M17 16.6v1.8M17 19.7v.1', 's'))
  };
  /* تصحيحات أيقونات تحتاج تركيباً خاصاً */
  IC.magnify = A(C(10.5, 10.5, 6.5, 't') + C(10.5, 10.5, 6.5) + P('M15.4 15.4L21 21') + D('M7.4 12.6l2.2-2.6 1.8 1.4 2.4-3', 'm-draw') + '');
  IC.pin = A('<ellipse class="t m-pulse" cx="12" cy="21.4" rx="4.5" ry="1.1"/><g class="m-bob">' + P(PIN, 't') + P(PIN) + C(12, 10.2, 2.4, 'f') + '</g>');

  /* ---------- خرائط الأسئلة ---------- */
  var SETS = {
    find: [
      { hero: 'store', hint: 'نبني الترشيح على قطاعك لأن لكل قطاع موسمه وقنواته وأسلوب بيعه.', opts: ['flower', 'cup', 'bag', 'building', 'handheart', 'party', 'factory'] },
      { hero: 'rocket', hint: 'المرحلة تحدد هل نبدأ بالأساس أم بالنمو.', opts: ['sprout', 'rocket', 'sliders', 'team'], lv: 1 },
      { hero: 'target', hint: 'اختر الأهم الآن — يمكن للباقة أن تتسع لاحقاً.', opts: ['cartchart', 'chatphone', 'brand', 'seasoncal'] },
      { hero: 'wallet', hint: 'الميزانية الشهرية لخدماتنا فقط، دون ميزانية الإعلانات.', opts: ['coin1', 'coin2', 'coin3', 'coin4'], lv: 1 }
    ],
    ready: [
      { hero: 'badge', hint: 'الهوية ليست الشعار وحده: ألوان وخطوط وأسلوب يظهر موحّداً في كل مكان.', opts: ['b0', 'b1', 'b2', 'b3'], lv: 1 },
      { hero: 'phoneheart', hint: 'نقيس الإيقاع والتخطيط، لا عدد المتابعين.', opts: ['s0', 's1', 's2', 's3'], lv: 1 },
      { hero: 'camera', hint: 'الصورة الاحترافية أول ما يحكم به العميل على جودتك.', opts: ['p0', 'p1', 'p2', 'p3'], lv: 1 },
      { hero: 'mega', hint: 'الإعلان بلا قياس مصروف، ومع القياس استثمار.', opts: ['a0', 'a1', 'a2', 'a3'], lv: 1 },
      { hero: 'magnify', hint: 'من لا يعرف مصدر عميله لا يعرف أين يضاعف ميزانيته.', opts: ['m0', 'm1', 'm2', 'm3'], lv: 1 },
      { hero: 'seasoncal', hint: 'المواسم من أقوى فرص البيع — والاستعداد المبكر يصنع الفرق.', opts: ['se0', 'se1', 'se2', 'se3'], lv: 1 },
      { hero: 'printer', hint: 'المطبوع وجه علامتك خارج الشاشة، ويجب أن يشبه حضورك الرقمي.', opts: ['pr0', 'pr1', 'pr2', 'pr3'], lv: 1 },
      { hero: 'pin', hint: 'بطاقة النشاط على خرائط جوجل من أقرب نقاط الوصول للعميل المحلي.', opts: ['l0', 'l1', 'l2', 'l3'], lv: 1 },
      { hero: 'report', hint: 'التقرير الجيد يخبرك ماذا تفعل بعد ذلك، لا ما حدث فقط.', opts: ['r0', 'r1', 'r2', 'r3'], lv: 1 }
    ]
  };
  var CHECK = '<svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path pathLength="1" d="M7 12.6l3.3 3.2L17 8.8"/></svg>';
  var CHEV = '<svg viewBox="0 0 22 13" aria-hidden="true"><polyline points="3,10.5 11,2.5 19,10.5"/></svg>';

  function pick(Q) {
    var t = Q.questions[0][0];
    if (/قطاع/.test(t)) return SETS.find;
    if (/هويتك/.test(t)) return SETS.ready;
    return null;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lvMeter(n, tot) {
    var o = '<span class="lv" aria-hidden="true">', k;
    for (k = 0; k < tot; k++) o += '<i class="' + (k <= n ? 'on' : '') + '"></i>';
    return o + '</span>';
  }

  /* ---------- المحرّك ---------- */
  var cur = null;
  function mount(quiz, Q, res) {
    var map = pick(Q);
    if (!map) return false;
    var N = Q.questions.length, i = 0, ans = [], timer = 0, busy = false;

    quiz.classList.add('nbq');
    quiz.innerHTML =
      '<div class="nbq-top"><div class="nbq-steps" role="group" aria-label="خطوات الأداة"></div><div class="nbq-meta"><span class="nbq-step"></span><span class="nbq-pct num"></span></div></div>' +
      '<div class="nbq-bar" aria-hidden="true"><i></i></div>' +
      '<div class="nbq-stage" aria-live="polite"></div>' +
      '<div class="tool-actions"><button class="btn btn-g back" type="button">رجوع</button><span class="nbq-kb" aria-hidden="true"></span><button class="btn btn-p next" type="button">التالي</button></div>';

    var steps = quiz.querySelector('.nbq-steps'), stepL = quiz.querySelector('.nbq-step'), pct = quiz.querySelector('.nbq-pct'),
      bar = quiz.querySelector('.nbq-bar i'), stage = quiz.querySelector('.nbq-stage'),
      back = quiz.querySelector('.back'), next = quiz.querySelector('.next'), kb = quiz.querySelector('.nbq-kb');

    var sh = ''; for (var s = 0; s < N; s++) sh += '<button type="button" class="st" data-s="' + s + '" aria-label="الخطوة ' + (s + 1) + '">' + CHEV + '</button>';
    steps.innerHTML = sh;

    function head(cfg, q) {
      var ico = IC[cfg.hero] || '';
      return '<div class="qhead"><div class="qhero" aria-hidden="true"><i class="ring1"></i>' + ico + '<b class="ch c1"></b><b class="ch c2"></b><b class="ch c3"></b></div>' +
        '<div class="qtxt"><h3 class="qt" id="nbq-q">' + esc(q[0]) + '</h3><p class="qh">' + esc(cfg.hint || '') + '</p></div></div>';
    }
    function paint(dir) {
      var q = Q.questions[i], cfg = map[i] || { opts: [] }, o = q[1];
      var h = '<div class="qx" style="--dx:' + (dir > 0 ? 34 : dir < 0 ? -34 : 0) + 'px">' + head(cfg, q) +
        '<div class="qopts' + (o.length % 2 ? ' odd' : '') + (o.length > 4 ? ' many' : '') + '" role="radiogroup" aria-labelledby="nbq-q">';
      for (var k = 0; k < o.length; k++) {
        h += '<button type="button" class="opt' + (ans[i] === k ? ' on' : '') + '" role="radio" aria-checked="' + (ans[i] === k) + '" data-k="' + k + '" style="--i:' + k + '">' +
          '<span class="oi" aria-hidden="true">' + (IC[cfg.opts[k]] || IC.brand) + '</span>' +
          '<span class="ot"><span class="on-n num">' + (k + 1) + '</span>' + esc(o[k]) + '</span>' +
          (cfg.lv ? lvMeter(k, o.length) : '') + CHECK + '</button>';
      }
      h += '</div></div>';
      stage.innerHTML = h;
      var d = steps.children, k2;
      for (k2 = 0; k2 < N; k2++) { d[k2].className = 'st' + (k2 < i || ans[k2] !== undefined && k2 !== i ? ' done' : '') + (k2 === i ? ' cur' : ''); d[k2].disabled = !(k2 <= i || ans[k2 - 1] !== undefined); }
      stepL.textContent = 'الخطوة ' + (i + 1) + ' من ' + N;
      pct.textContent = Math.round(i / N * 100) + '%';
      bar.style.width = (i / N * 100) + '%';
      back.disabled = i === 0;
      next.textContent = i === N - 1 ? 'اعرض النتيجة' : 'التالي';
      next.disabled = ans[i] === undefined;
      next.classList.remove('arming');
      kb.textContent = ans[i] === undefined ? 'اختر إجابة للمتابعة — أو اضغط الرقم المقابل' : '';
    }
    function go(dir) {
      if (busy) return; clearTimeout(timer);
      var ni = i + dir; if (ni < 0 || ni >= N) return;
      busy = true;
      var old = stage.firstElementChild;
      if (old && !reduce) { old.style.setProperty('--ox', (dir > 0 ? -34 : 34) + 'px'); old.classList.add('leaving'); }
      setTimeout(function () { i = ni; paint(dir); busy = false; if (innerWidth < 760) { var r = quiz.getBoundingClientRect(); if (r.top < 60 || r.top > innerHeight * .5) window.scrollTo({ top: r.top + scrollY - 90, behavior: reduce ? 'auto' : 'smooth' }); } }, old && !reduce ? 190 : 0);
    }
    function burst(btn) {
      if (reduce) return;
      var host = btn.querySelector('.oi'); if (!host) return;
      var n = 9, k, o = document.createElement('span'); o.className = 'bur'; o.setAttribute('aria-hidden', 'true');
      for (k = 0; k < n; k++) {
        var a = (k / n) * Math.PI * 2 + Math.random() * .5, r = 34 + Math.random() * 22, b = document.createElement('b');
        b.style.cssText = '--dx:' + Math.cos(a) * r + 'px;--dy:' + Math.sin(a) * r + 'px;--r:' + (a * 57.3 + 90) + 'deg;--c:' + ['#DB9C47', '#338C89', '#D06429', '#18566D'][k % 4];
        o.appendChild(b);
      }
      host.appendChild(o); setTimeout(function () { o.remove(); }, 900);
    }
    function choose(k, btn) {
      ans[i] = k;
      var all = stage.querySelectorAll('.opt'), j;
      for (j = 0; j < all.length; j++) { all[j].classList.toggle('on', j === k); all[j].setAttribute('aria-checked', j === k); }
      btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
      burst(btn);
      next.disabled = false; kb.textContent = '';
      steps.children[i].classList.add('done');
      if (NB.pulse) NB.pulse(4);
      clearTimeout(timer);
      if (i < N - 1) {
        next.classList.remove('arming'); void next.offsetWidth; next.classList.add('arming');
        timer = setTimeout(function () { if (ans[i] === k && cur && cur.quiz === quiz && quiz.isConnected) go(1); }, reduce ? 450 : 1000);
      }
    }
    function finish() {
      clearTimeout(timer);
      quiz.style.display = 'none'; res.classList.add('show'); res.innerHTML = Q.result(ans);
      decorate(res);
      if (NB.pulse) NB.pulse(14);
      res.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    stage.onclick = function (e) { var b = e.target.closest('.opt'); if (b) choose(+b.dataset.k, b); };
    steps.onclick = function (e) { var b = e.target.closest('.st'); if (!b || b.disabled) return; var t = +b.dataset.s; if (t === i) return; clearTimeout(timer); go(t - i); };
    back.onclick = function () { go(-1); };
    next.onclick = function () { if (ans[i] === undefined) return; clearTimeout(timer); if (i < N - 1) go(1); else finish(); };
    NB.quizRestart = function () {
      clearTimeout(timer); i = 0; ans = []; res.classList.remove('show'); res.innerHTML = ''; quiz.style.display = ''; paint(0);
      window.scrollTo({ top: quiz.getBoundingClientRect().top + scrollY - 120, behavior: reduce ? 'auto' : 'smooth' });
    };
    cur = { quiz: quiz, key: function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || !quiz.isConnected || quiz.style.display === 'none') return;
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      var n = parseInt(e.key, 10), opts = stage.querySelectorAll('.opt');
      if (n >= 1 && n <= opts.length) { e.preventDefault(); choose(n - 1, opts[n - 1]); }
      else if (e.key === 'Enter' && ans[i] !== undefined && document.activeElement && !document.activeElement.closest('.opt,.btn,.st')) { e.preventDefault(); next.click(); }
      else if (e.key === 'ArrowLeft') { if (ans[i] !== undefined) next.click(); }
      else if (e.key === 'ArrowRight') { back.click(); }
    } };
    paint(0);
    return true;
  }
  if (!NB._qk) { NB._qk = 1; document.addEventListener('keydown', function (e) { if (cur) cur.key(e); }); }

  /* ---------- لمسات النتيجة: عدّاد الحلقة، ظهور متتابع، وزوايا ^ احتفالية ---------- */
  function decorate(res) {
    var ring = res.querySelector('.ring'), b = ring && ring.querySelector('b');
    if (ring && b) {
      var to = parseFloat(ring.style.getPropertyValue('--v')) || 0;
      var small = b.querySelector('small'), sm = small ? small.outerHTML : '';
      if (!reduce) {
        ring.style.setProperty('--v', 0);
        var t0 = performance.now(), d = 1500;
        (function tick(t) {
          var p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3), v = to * e;
          ring.style.setProperty('--v', v.toFixed(2)); b.innerHTML = Math.round(v) + sm;
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      }
    }
    var pr = res.querySelector('.pr.num');
    if (pr && !reduce) { pr.classList.add('nbq-pop'); }
    if (reduce) return;
    var host = res.querySelector('.score') || res.querySelector('.rec') || res, o = document.createElement('span');
    o.className = 'nbq-conf'; o.setAttribute('aria-hidden', 'true');
    for (var k = 0; k < 22; k++) {
      var c = document.createElement('b'), a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 150;
      c.style.cssText = '--dx:' + (Math.cos(a) * r).toFixed(0) + 'px;--dy:' + (Math.sin(a) * r * .75 - 40).toFixed(0) + 'px;--r:' + (Math.random() * 360 | 0) + 'deg;--c:' + ['#DB9C47', '#338C89', '#D06429', '#18566D'][k % 4] + ';--s:' + (.7 + Math.random() * .9).toFixed(2) + ';animation-delay:' + (Math.random() * .25).toFixed(2) + 's';
      o.appendChild(c);
    }
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(o); setTimeout(function () { o.remove(); }, 2600);
  }

  window.NBQ = { mount: mount, icons: IC, sets: SETS };
  document.dispatchEvent(new CustomEvent('nbq-ready'));
})();
