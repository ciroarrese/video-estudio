// Runs INSIDE the page (serialised and evaluated by qa/page.ts); plain JS on purpose so no transpiler helper leaks in.
// Returns serialisable data about every visible text node; the rules (qa/rules) are pure functions over it.
(function qaCollect(opts) {
  var stage = document.getElementById('stage') || document.body;
  var W = opts.width, H = opts.height;
  var onlyKeys = opts.onlyKeys ? new Set(opts.onlyKeys) : null;
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
  // Alfa minimo entre los colores de una cadena CSS (rgba/hsla/color()/oklab()/transparent): para saber si un degradado tiene partes transparentes.
  function minAlpha(str) {
    var toks = (str || '').match(/rgba?\([^)]*\)|hsla?\([^)]*\)|color\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\)|lab\([^)]*\)|lch\([^)]*\)|\btransparent\b/g) || [];
    var m = 1;
    toks.forEach(function (t) {
      var a = 1;
      if (t === 'transparent') a = 0;
      else if (t.indexOf('/') >= 0) { var q = t.slice(t.indexOf('/') + 1).replace(')', '').trim(); a = q.slice(-1) === '%' ? parseFloat(q) / 100 : parseFloat(q); }
      else if (/^(rgba|hsla)\(/.test(t)) { var parts = t.slice(t.indexOf('(') + 1, -1).split(','); if (parts.length >= 4) a = parseFloat(parts[3]); }
      if (!isNaN(a) && a < m) m = a;
    });
    return m;
  }
  // Imagen de fondo con partes transparentes (una viñeta, una grilla, un degradado que se apaga): NO es una capa opaca ni un velo, deja ver lo de abajo.
  // Una imagen `url(...)` se asume opaca. Ante la duda, el control JUZGA (nunca descarta texto por una capa que quiza no tapa).
  function translucentImage(ccs) {
    var bi = ccs.backgroundImage;
    if (!bi || bi === 'none' || /url\(/.test(bi)) return false;
    return minAlpha(bi) < 0.9;
  }
  function opacityUp(el) {
    var o = 1;
    for (var e = el; e && e !== stage.parentElement; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o;
  }
  // Un ancestro (o el propio elemento) con opacidad < 1 que, a su altura o por debajo, pinta una superficie (color de fondo o imagen/degradado)
  // detras del texto: el fondo muestreado esta a medio fundido junto con el texto (p. ej. un panel oscuro que entra con su contenido).
  function fadingSurface(el) {
    var paints = false;
    for (var e = el; e && e !== stage.parentElement; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (parseRgba(cs.backgroundColor).a > 0.02 || (cs.backgroundImage && cs.backgroundImage !== 'none' && !translucentImage(cs) && cs.backgroundClip !== 'text' && cs.webkitBackgroundClip !== 'text')) paints = true;
      if (paints && parseFloat(cs.opacity) < 0.99) return true;
    }
    return false;
  }
  function ignoreOf(el) {
    var out = [];
    for (var e = el; e; e = e.parentElement) {
      var v = e.getAttribute && e.getAttribute('data-qa-ignore');
      if (v) out = out.concat(v.split(/[\s,]+/).filter(Boolean));
    }
    return out;
  }
  // Una capa con `data-qa-ignore="covered"` (propio o heredado) NO cuenta como tapa de texto: se descarta ANTES de elegir la tapa ganadora, para que
  // una viñeta o un fondo de cuadro completo (que tapan "todos los puntos") no enmascaren la tapa real (una pastilla que tapa 4 de 5).
  var ignCache = new Map();
  function coverIgnorable(el) {
    var l = ignCache.get(el);
    if (!l) { l = ignoreOf(el); ignCache.set(el, l); }
    return l.indexOf('covered') >= 0 || l.indexOf('all') >= 0;
  }
  // data-qa-decor en el elemento o un ancestro: texto de adorno de una interfaz recreada. "main" marca el adorno que ES el contenido principal del cuadro.
  function decorOf(el) {
    var decor = false, main = false;
    for (var e = el; e; e = e.parentElement) {
      var v = e.getAttribute && e.getAttribute('data-qa-decor');
      if (v !== null && v !== undefined) { decor = true; if (v.split(/[\s,]+/).indexOf('main') >= 0) main = true; }
    }
    return { decor: decor, main: main };
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
  // Una imagen de fondo con partes transparentes (viñeta, grilla) no es un velo: deja el texto como esta (alfa 0); una imagen opaca o un color si.
  function veilAlpha(c) {
    var ccs = getComputedStyle(c);
    var bg = parseRgba(ccs.backgroundColor);
    var a = ccs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? bg.a : (ccs.backgroundImage !== 'none' ? (translucentImage(ccs) ? 0 : 1) : 0);
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

  // Color con el que se PINTA un texto. En HTML es `-webkit-text-fill-color` (que por defecto sigue a `color`); en SVG (`<text>`, `<tspan>`)
  // `color` no pinta nada: manda `fill` (con `fill-opacity`) y, si el relleno es `none`, el trazo (`stroke`, texto "hueco" o solo contorno).
  // Un degradado o patron (`url(#...)`) no se puede evaluar: se trata como relleno transparente (como el texto con degradado en HTML).
  function paintOf(v, o) {
    if (!v || v === 'none') return null;
    if (/^url\(/.test(v)) return { grad: true };
    var c = parseRgba(v);
    c.a = c.a * (isNaN(o) ? 1 : o);
    return c;
  }
  function textFill(el, cs) {
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') {
      var f = paintOf(cs.fill, parseFloat(cs.fillOpacity));
      if (f && !f.grad) return f;
      var st = paintOf(cs.stroke, parseFloat(cs.strokeOpacity));
      if (f === null && st && !st.grad) return st;
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    return parseRgba(cs.webkitTextFillColor || cs.color);
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
    // modo liviano (`opts.onlyKeys`): solo mide el tamaño en pantalla y la opacidad de los textos pedidos (qa/zoom.ts)
    if (onlyKeys && !onlyKeys.has(keyOf(el) + '#' + Array.prototype.indexOf.call(el.childNodes, node))) continue;
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
    var fill = textFill(el, cs);
    var weight = parseInt(cs.fontWeight, 10) || 400;

    var runKey = keyOf(el) + '#' + Array.prototype.indexOf.call(el.childNodes, node);
    var run = {
      id: runs.length, key: runKey, elId: idOf(el), chain: chain, tag: tag.toLowerCase(), testid: testidOf(el),
      text: excerpt(node.data),
      rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, lines: rects,
      opacity: opacityUp(el), fontPx: fontPx, scale: scale, transformed: transformed, screenPx: fontPx * scale, bold: weight >= 700,
      color: 'rgba(' + fill.r + ',' + fill.g + ',' + fill.b + ',' + fill.a + ')', transparentFill: fill.a < 0.05,
      fadingBg: fadingSurface(el), ignore: ignoreOf(el), decor: decorOf(el).decor, decorMain: decorOf(el).main, clips: clips,
      own: {
        sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight,
        ox: cs.overflowX, oy: cs.overflowY, ellipsis: cs.textOverflow === 'ellipsis',
      },
      cover: null,
      veil: null,
      hiddenBy: null,
      skippedCovers: 0,
    };

    if (onlyKeys) { runs.push(run); continue; }

    // covered: se muestrean hasta 5 puntos por linea (10/30/50/70/90 % del ancho, al medio de la altura) y se mira con elementsFromPoint
    // si hay encima un elemento solido que no es ancestro ni descendiente. Gana el que tapa mas puntos; `frac` = puntos tapados / muestreados.
    // Las capas con `data-qa-ignore="covered"` (propio o heredado) se DESCARTAN antes de contar (ver coverIgnorable): una viñeta o un fondo de
    // cuadro completo estan "encima" de todos los puntos y, contados primero, ganaban y dejaban ciego al control. Una capa de cuadro completo,
    // de color liso y opaca del todo (un `Wash` cerrado) que tapa TODOS los puntos si esconde el texto: `hiddenBy` (la tapa, sin informarla).
    if (run.opacity >= 0.05) {
      var counts = new Map();
      var order = [];
      var total = 0;
      var hiddenN = 0;
      var hiddenBy = null;
      var skippedCover = false;
      var maxLines = Math.min(rects.length, 8);
      for (var li = 0; li < maxLines; li++) {
        var ln = rects[li];
        for (var pi = 0; pi < 5; pi++) {
          var px = ln.x + ln.w * (0.1 + 0.2 * pi), py = ln.y + ln.h / 2;
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          total++;
          var stack = document.elementsFromPoint(px, py);
          var at = stack.indexOf(el);
          if (at < 0) at = stack.findIndex(function (e) { return el.contains(e); });
          for (var j = 0; j < at; j++) {
            var c = stack[j];
            if (el.contains(c) || c.contains(el)) continue;
            var ccs = getComputedStyle(c);
            if (ccs.visibility !== 'visible') continue;
            var bg = parseRgba(ccs.backgroundColor);
            var op = opacityUp(c);
            var clipText = clipText0(ccs);
            var solidColor = bg.a * op >= 0.9 && ccs.backgroundColor !== 'rgba(0, 0, 0, 0)' && !clipText;
            // una imagen o un degradado de fondo tambien tapan (se asume opaco: con opacidad propia >= 0.9), salvo que tenga partes
            // transparentes (viñeta, grilla: deja ver lo de abajo). Un degradado recortado al texto (background-clip:text) solo pinta las letras.
            var solidImage = ccs.backgroundImage !== 'none' && op >= 0.9 && !clipText && !translucentImage(ccs);
            // img, video y canvas tapan si se ven: con opacidad (propia o heredada) casi 0 no tapan nada (visibility ya se descartó arriba)
            var solidMedia = (c.tagName === 'IMG' || c.tagName === 'VIDEO' || c.tagName === 'CANVAS') && op >= 0.9;
            var solid = solidColor || solidImage || solidMedia;
            if (!solid) continue;
            if (coverIgnorable(c)) {
              skippedCover = true;
              var cr = c.getBoundingClientRect();
              if (solidColor && bg.a * op >= 0.99 && cr.width * cr.height >= 0.9 * W * H) {
                hiddenN++;
                if (!hiddenBy) hiddenBy = { key: keyOf(c), testid: testidOf(c) };
                break;
              }
              continue;
            }
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
      if (total > 0 && hiddenN === total) run.hiddenBy = hiddenBy;
      if (skippedCover) run.skippedCovers = 1;
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
