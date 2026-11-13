// Runs INSIDE the page (serialised and evaluated by qa/page.ts); plain JS on purpose so no transpiler helper leaks in.
// Returns serialisable data about every visible text node; the rules (qa/rules) are pure functions over it.
(function qaCollect(opts) {
  var stage = document.getElementById('stage') || document.body;
  var W = opts.width, H = opts.height;
  var ids = new Map();
  function idOf(el) { if (!ids.has(el)) ids.set(el, ids.size); return ids.get(el); }
  function rectOf(r) { return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function testidOf(el) { var e = el.closest ? el.closest('[data-testid]') : null; return e ? e.getAttribute('data-testid') : null; }
  function excerpt(s) { s = s.replace(/\s+/g, ' ').trim(); return s.length > 40 ? s.slice(0, 39) + '…' : s; }
  function parseRgba(s) {
    var m = /rgba?\(([^)]+)\)/.exec(s || '');
    if (!m) return { r: 0, g: 0, b: 0, a: 1 };
    var p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function opacityUp(el) {
    var o = 1;
    for (var e = el; e && e !== stage.parentElement; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o;
  }
  function ignoreOf(el) {
    var out = [];
    for (var e = el; e; e = e.parentElement) {
      var v = e.getAttribute && e.getAttribute('data-qa-ignore');
      if (v) out = out.concat(v.split(/[\s,]+/).filter(Boolean));
    }
    return out;
  }
  function pathOf(el) {
    var p = [];
    for (var e = el; e && e !== stage; e = e.parentElement) p.push(Array.prototype.indexOf.call(e.parentElement.children, e));
    return p.reverse().join('.');
  }
  // Identity of an element across frames: DOM path + tag + test id + text (so a different scene at the same path never matches).
  function keyOf(el) {
    var t = el.closest ? el.closest('[data-testid]') : null;
    return pathOf(el) + '|' + el.tagName.toLowerCase() + '|' + (t ? t.getAttribute('data-testid') : '') + '|' + excerpt(el.textContent || '');
  }
  // Cuanto tapa un elemento por si solo: su opacidad efectiva por el alfa de su color de fondo (1 si el fondo es imagen o degradado).
  function veilAlpha(c) {
    var ccs = getComputedStyle(c);
    var bg = parseRgba(ccs.backgroundColor);
    var a = ccs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? bg.a : (ccs.backgroundImage !== 'none' ? 1 : 0);
    return a * opacityUp(c);
  }
  function infoOf(el) {
    return { tag: el.tagName.toLowerCase(), testid: testidOf(el), text: excerpt(el.textContent || ''), rect: rectOf(el.getBoundingClientRect()) };
  }
  function resolveKey(key) {
    var path = key.split('|')[0];
    var el = stage;
    if (path !== '') {
      var idx = path.split('.');
      for (var i = 0; i < idx.length; i++) { el = el && el.children[Number(idx[i])]; }
    }
    return el && el !== stage && keyOf(el) === key ? el : null;
  }

  function clipText0(cs) { return (cs.backgroundClip || cs.webkitBackgroundClip) === 'text' || cs.webkitBackgroundClip === 'text'; }
  // elementsFromPoint skips pointer-events:none; make everything hit-testable while we measure.
  var probe = document.createElement('style');
  probe.textContent = '*{pointer-events:auto !important}';
  document.head.appendChild(probe);

  var runs = [];
  var walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  var range = document.createRange();
  var node;
  while ((node = walker.nextNode())) {
    if (!node.data.trim()) continue;
    var el = node.parentElement;
    if (!el) continue;
    var tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
    var cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none') continue;
    range.selectNodeContents(node);
    var rects = [];
    var list = range.getClientRects();
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      if (q.width < 0.5 || q.height < 0.5) continue;
      rects.push(rectOf(q));
    }
    if (!rects.length) continue;
    var x0 = Math.min.apply(null, rects.map(function (r) { return r.x; }));
    var y0 = Math.min.apply(null, rects.map(function (r) { return r.y; }));
    var x1 = Math.max.apply(null, rects.map(function (r) { return r.x + r.w; }));
    var y1 = Math.max.apply(null, rects.map(function (r) { return r.y + r.h; }));

    // ancestors: ids, clip boxes, cumulative transform scale
    var chain = [];
    var clips = [];
    var elems = [];
    for (var a = el; a && a !== stage && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      elems.push(a);
      chain.push(idOf(a));
      var acs = getComputedStyle(a);
      var ox = acs.overflowX, oy = acs.overflowY;
      if (ox !== 'visible' || oy !== 'visible') {
        var br = a.getBoundingClientRect();
        var k = a.offsetWidth > 0 ? br.width / a.offsetWidth : 1;
        var kh = a.offsetHeight > 0 ? br.height / a.offsetHeight : 1;
        var bl = parseFloat(acs.borderLeftWidth) * k, bt = parseFloat(acs.borderTopWidth) * kh;
        var brr = parseFloat(acs.borderRightWidth) * k, bb = parseFloat(acs.borderBottomWidth) * kh;
        clips.push({
          id: idOf(a), tag: a.tagName.toLowerCase(), testid: testidOf(a),
          rect: { x: br.left + bl, y: br.top + bt, w: br.width - bl - brr, h: br.height - bt - bb },
          ox: ox !== 'visible', oy: oy !== 'visible',
        });
      }
    }
    var m = new DOMMatrix();
    for (var n = elems.length - 1; n >= 0; n--) {
      var t = getComputedStyle(elems[n]).transform;
      if (t && t !== 'none') m = m.multiply(new DOMMatrix(t));
    }
    var transformed = Math.abs(Math.hypot(m.a, m.b) - 1) > 0.01 || Math.abs(Math.hypot(m.c, m.d) - 1) > 0.01 || Math.abs(m.b) > 0.01 || Math.abs(m.c) > 0.01;
    var scale = Math.hypot(m.c, m.d);
    if (!(scale > 0)) scale = 0;
    var fontPx = parseFloat(cs.fontSize);
    var fill = parseRgba(cs.webkitTextFillColor || cs.color);
    var weight = parseInt(cs.fontWeight, 10) || 400;

    var run = {
      id: runs.length, key: keyOf(el) + '#' + Array.prototype.indexOf.call(el.childNodes, node), elId: idOf(el), chain: chain, tag: tag.toLowerCase(), testid: testidOf(el),
      text: excerpt(node.data),
      rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, lines: rects,
      opacity: opacityUp(el), fontPx: fontPx, scale: scale, transformed: transformed, screenPx: fontPx * scale, bold: weight >= 700,
      color: 'rgba(' + fill.r + ',' + fill.g + ',' + fill.b + ',' + fill.a + ')', transparentFill: fill.a < 0.05,
      ignore: ignoreOf(el), clips: clips,
      own: {
        sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight,
        ox: cs.overflowX, oy: cs.overflowY, ellipsis: cs.textOverflow === 'ellipsis',
      },
      cover: null,
      veil: null,
    };

    // covered: se muestrean hasta 5 puntos por linea (10/30/50/70/90 % del ancho, al medio de la altura) y se mira con elementsFromPoint
    // si hay encima un elemento solido que no es ancestro ni descendiente. Gana el que tapa mas puntos; `frac` = puntos tapados / muestreados.
    if (run.opacity >= 0.05) {
      var counts = new Map();
      var order = [];
      var total = 0;
      var maxLines = Math.min(rects.length, 8);
      for (var li = 0; li < maxLines; li++) {
        var ln = rects[li];
        for (var pi = 0; pi < 5; pi++) {
          var px = ln.x + ln.w * (0.1 + 0.2 * pi), py = ln.y + ln.h / 2;
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          total++;
          var stack = document.elementsFromPoint(px, py);
          var at = stack.indexOf(el);
          for (var j = 0; j < at; j++) {
            var c = stack[j];
            if (el.contains(c) || c.contains(el)) continue;
            var ccs = getComputedStyle(c);
            if (ccs.visibility !== 'visible') continue;
            var bg = parseRgba(ccs.backgroundColor);
            var op = opacityUp(c);
            var solidColor = bg.a * op >= 0.9 && ccs.backgroundColor !== 'rgba(0, 0, 0, 0)' && !clipText0(ccs);
            // una imagen o un degradado de fondo tambien tapan (se asume opaco: con opacidad propia >= 0.9)
            // (un degradado recortado al texto, background-clip:text, solo pinta las letras: no tapa nada)
            var clipText = clipText0(ccs);
            var solidImage = ccs.backgroundImage !== 'none' && op >= 0.9 && !clipText;
            var solid = solidColor || solidImage || c.tagName === 'IMG' || c.tagName === 'VIDEO' || c.tagName === 'CANVAS';
            if (!solid) continue;
            if (!counts.has(c)) { counts.set(c, 0); order.push(c); }
            counts.set(c, counts.get(c) + 1);
            break;
          }
        }
      }
      var bestEl = null, bestN = 0;
      for (var oi = 0; oi < order.length; oi++) { if (counts.get(order[oi]) > bestN) { bestN = counts.get(order[oi]); bestEl = order[oi]; } }
      if (bestEl) {
        var info = infoOf(bestEl);
        info.id = idOf(bestEl);
        info.key = keyOf(bestEl);
        info.ignore = ignoreOf(bestEl);
        info.frac = total ? bestN / total : 1;
        info.opacity = opacityUp(bestEl);
        run.cover = info;
      }
    }
    // veil: un velo de cuadro completo TRANSLUCIDO (no llega a ser `cover`, que pide >= 0.9) por encima del texto, p. ej. un `Wash` a medio fundido.
    // Se mide al medio de la primera linea; `qa/motion.ts` le agrega `fade` (cambio de su opacidad entre cuadros vecinos) para distinguir un
    // velo que cruza (transicion) de uno quieto (defecto).
    if (!run.cover && run.opacity >= 0.05) {
      var ln0 = rects[0];
      var vx = ln0.x + ln0.w / 2, vy = ln0.y + ln0.h / 2;
      if (vx >= 0 && vy >= 0 && vx < W && vy < H) {
        var vstack = document.elementsFromPoint(vx, vy);
        var vat = vstack.indexOf(el);
        for (var vj = 0; vj < vat; vj++) {
          var vc = vstack[vj];
          if (el.contains(vc) || vc.contains(el)) continue;
          if (getComputedStyle(vc).visibility !== 'visible') continue;
          var vr = vc.getBoundingClientRect();
          if (vr.width * vr.height < 0.9 * W * H) continue;
          var va = veilAlpha(vc);
          if (va < 0.02 || va >= 0.9) continue;
          run.veil = { key: keyOf(vc), opacity: va, testid: testidOf(vc) };
          break;
        }
      }
    }
    runs.push(run);
  }
  var elems = {};
  var opac = {};
  (opts.elemKeys || []).forEach(function (k) { var e = resolveKey(k); if (e) { elems[k] = rectOf(e.getBoundingClientRect()); opac[k] = veilAlpha(e); } });
  probe.remove();
  return { width: W, height: H, runs: runs, elems: elems, opac: opac };
})
