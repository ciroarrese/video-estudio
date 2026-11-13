// Runs INSIDE the page: median colour of the pixels under each rect of a screenshot (taken with the text hidden).
(async function qaSample(dataUrl, rects) {
  var img = new Image();
  img.src = dataUrl;
  await img.decode();
  var cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  var ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  var data = ctx.getImageData(0, 0, cv.width, cv.height).data;
  function med(a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1]; }
  return rects.map(function (r) {
    var x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
    var x1 = Math.min(cv.width, Math.ceil(r.x + r.w)), y1 = Math.min(cv.height, Math.ceil(r.y + r.h));
    if (x1 <= x0 || y1 <= y0) return null;
    var stepX = Math.max(1, Math.floor((x1 - x0) / 40)), stepY = Math.max(1, Math.floor((y1 - y0) / 20));
    var R = [], G = [], B = [];
    for (var y = y0; y < y1; y += stepY) for (var x = x0; x < x1; x += stepX) {
      var o = (y * cv.width + x) * 4;
      R.push(data[o]); G.push(data[o + 1]); B.push(data[o + 2]);
    }
    return { r: med(R), g: med(G), b: med(B), samples: R.length };
  });
})
