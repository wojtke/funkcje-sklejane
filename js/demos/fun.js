/* fun.js — dema: coaster (kolejka górska: C¹ vs C²), tps (thin-plate spline — wyginanie obrazu). */
(function () {
  'use strict';
  const Sp = window.Splines;
  const C = SPL.c;

  function niceCeil(m) {
    const p = Math.pow(10, Math.floor(Math.log10(m)));
    for (const f of [1, 2, 2.5, 5, 10]) if (f * p >= m) return f * p;
    return 10 * p;
  }

  // =================================================================== coaster
  SPL.register('coaster', function (el, o) {
    const W = +o.w || 790, H = +o.h || 470;
    const st = SPL.stage(el, W, H);
    const G = 9.81, V0 = 3;                       // przyspieszenie [m/s²], prędkość startowa [m/s]
    const TR = { x: 10, y: 6, w: W - 20, h: 228 }; // tor: równa skala w obu osiach
    const YMAX = 34, XMAX = TR.w * YMAX / TR.h;
    const pT = SPL.plot(st, TR, { xmin: 0, xmax: XMAX, ymin: 0, ymax: YMAX });
    const pG = SPL.plot(st, { x: 50, y: 252, w: W - 64, h: H - 252 - 24 }, { xmin: 0, xmax: 1, ymin: -1, ymax: 3 });
    // kształt dobrany tak, by przeciążenia były realistyczne (splajn C²: 0–3 g)
    const init = [[4, 28], [16, 24], [30, 14], [46, 9], [62, 13], [76, 19], [91, 17], [103, 12], [113, 9]];
    let P = init.map(p => p.slice());
    let method = 'cr';
    let track = null, other = null;
    let s = 0, v = V0;        // położenie (długość łuku) i prędkość ze znakiem
    let gRange = { lo: -1, hi: 3 };

    const ui = SPL.ui.panel(el);
    SPL.ui.segmented(ui, [
      { value: 'cr', label: 'krzywa C¹' },
      { value: 'nat', label: 'splajn C²' }
    ], method, m => { method = m; rebuild(); render(); });
    SPL.ui.button(ui, 'start', () => { s = 0; v = V0; render(); });
    const gOut = SPL.ui.readout(ui, 'n');
    const vOut = SPL.ui.readout(ui, 'v');
    const jOut = SPL.ui.readout(ui, 'max skok n w węzłach');

    const colOf = m => m === 'cr' ? C.orange : C.blue;

    /** Gęste próbkowanie toru. Krzywizna liczona osobno w każdym segmencie, więc skoki w węzłach zostają widoczne. */
    function build(m) {
      const n = P.length, PER = 56;
      const smp = [];
      const push = (p, d1, d2, seg) => {
        const sp = Math.hypot(d1[0], d1[1]) || 1e-9;
        smp.push({ x: p[0], y: p[1], tx: d1[0] / sp, ty: d1[1] / sp, k: (d1[0] * d2[1] - d1[1] * d2[0]) / (sp * sp * sp), seg });
      };
      if (m === 'cr') {
        const get = i => i < 0 ? [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]]
          : i >= n ? [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1]] : P[i];
        const e = 1e-3;
        for (let i = 0; i < n - 1; i++) {
          const f = t => Sp.catmullRomPoint(get(i - 1), get(i), get(i + 1), get(i + 2), t, 0.5);
          for (let j = 0; j <= PER; j++) {
            const t = j / PER, a = f(t - e), b = f(t), c = f(t + e);
            push(b, [(c[0] - a[0]) / (2 * e), (c[1] - a[1]) / (2 * e)],
              [(c[0] - 2 * b[0] + a[0]) / (e * e), (c[1] - 2 * b[1] + a[1]) / (e * e)], i);
          }
        }
      } else {
        const sp = Sp.paramSpline(P, 'natural', 1);
        for (let i = 0; i < n - 1; i++) {
          for (let j = 0; j <= PER; j++) {
            const u = sp.u[i] + (sp.u[i + 1] - sp.u[i]) * j / PER;
            push(sp.at(u), sp.d1(u), sp.d2(u), i);
          }
        }
      }
      let acc = 0;
      smp.forEach((q, i) => { if (i > 0) acc += Math.hypot(q.x - smp[i - 1].x, q.y - smp[i - 1].y); q.s = acc; });
      // orientacja siedzenia: normalna „w górę” na starcie (tor jedzie w prawo lub w lewo)
      const sigma = P[n - 1][0] >= P[0][0] ? 1 : -1;
      const h0 = smp[0].y;
      const knots = [];
      for (let i = 1; i < smp.length; i++) if (smp[i].seg !== smp[i - 1].seg) knots.push(i);
      return { smp, L: acc, sigma, h0, knots };
    }
    const v2At = (T, y) => Math.max(0, V0 * V0 + 2 * G * (T.h0 - y));
    const gForce = (T, q) => T.sigma * (q.tx + v2At(T, q.y) * q.k / G);

    /** Interpolacja stanu toru w długości łuku s (wyszukiwanie binarne). */
    function at(T, sArc) {
      const a = T.smp;
      let lo = 0, hi = a.length - 1;
      sArc = Sp.clamp(sArc, 0, T.L);
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (a[mid].s <= sArc) lo = mid; else hi = mid; }
      const A = a[lo], B = a[hi], ds = B.s - A.s, t = ds > 1e-12 ? (sArc - A.s) / ds : 0;
      const L = (p, q) => p + (q - p) * t;
      return { x: L(A.x, B.x), y: L(A.y, B.y), tx: L(A.tx, B.tx), ty: L(A.ty, B.ty), k: L(A.k, B.k) };
    }

    function rebuild() {
      const oldL = track ? track.L : 0;
      track = build(method);
      other = build(method === 'cr' ? 'nat' : 'cr');
      if (oldL > 0) s = Sp.clamp(s * track.L / oldL, 0, track.L);
      // zakres osi przeciążenia z histerezą
      let lo = 0, hi = 1;
      for (const q of track.smp) { const g = gForce(track, q); lo = Math.min(lo, g); hi = Math.max(hi, g); }
      lo = Math.max(lo, -4); hi = Math.min(hi, 7);
      const nlo = -Math.ceil(-lo - 1e-9 + 0.25), nhi = Math.ceil(hi + 0.25);
      if (nlo < gRange.lo || nhi > gRange.hi || nlo > gRange.lo + 1 || nhi < gRange.hi - 1) gRange = { lo: Math.min(-1, nlo), hi: Math.max(2, nhi) };
    }

    function step(dt) {
      const T = track, sub = 10, h = dt / sub;
      for (let k = 0; k < sub; k++) {
        const q = at(T, s);
        v += -G * q.ty * h;          // składowa styczna grawitacji
        s += v * h;
        if (s < 0) { s = -s; v = Math.abs(v); }
        if (s > T.L) { s = 2 * T.L - s; v = -Math.abs(v); }
        const vm = Math.sqrt(v2At(T, at(T, s).y)); // korekta energii (bez dryfu numerycznego)
        if (vm > 0.4) v = Math.sign(v || 1) * vm;
      }
    }

    function drawCart(c, q) {
      const p = pT.P([q.x, q.y]);
      const ang = Math.atan2(-q.ty, q.tx) + (track.sigma < 0 ? Math.PI : 0);
      c.save();
      c.translate(p[0], p[1]); c.rotate(ang);
      c.fillStyle = C.purple; c.strokeStyle = C.card; c.lineWidth = 2;
      c.beginPath();
      if (c.roundRect) c.roundRect(-15, -19, 30, 13, 4); else c.rect(-15, -19, 30, 13);
      c.fill(); c.stroke();
      c.fillStyle = C.ink;
      [-9, 9].forEach(x => { c.beginPath(); c.arc(x, -5, 3.6, 0, 2 * Math.PI); c.fill(); });
      c.fillStyle = C.card;
      c.beginPath(); c.arc(4, -23, 4, 0, 2 * Math.PI); c.fill();
      c.strokeStyle = C.purple; c.lineWidth = 1.6; c.stroke();
      c.restore();
    }

    function render() {
      st.clear();
      const c = st.ctx, T = track, col = colOf(method);
      // ziemia
      c.save(); c.fillStyle = SPL.alpha(C.green, C.dark ? 0.12 : 0.08);
      c.fillRect(TR.x, pT.Y(0) - 6, TR.w, 6); c.restore();
      // podpory
      c.save(); c.strokeStyle = SPL.alpha(C.faint, 0.6); c.lineWidth = 1.2;
      c.beginPath();
      let lastX = -1e9;
      for (const q of T.smp) {
        if (Math.abs(q.x - lastX) < 5.5) continue;
        lastX = q.x;
        c.moveTo(pT.X(q.x), pT.Y(q.y) + 4); c.lineTo(pT.X(q.x), pT.Y(0));
      }
      c.stroke(); c.restore();
      // tor nieaktywny i aktywny
      pT.path(other.smp.map(q => [q.x, q.y]), { color: colOf(method === 'cr' ? 'nat' : 'cr'), width: 2, alpha: 0.4, dash: [6, 6] });
      pT.path(T.smp.map(q => [q.x, q.y]), { color: C.ink, width: 7 });
      pT.path(T.smp.map(q => [q.x, q.y]), { color: col, width: 4 });
      P.forEach(p => pT.dot(p, { r: 6, hollow: true, fill: col }));
      const q = at(T, s);
      drawCart(c, q);

      // --- wykres przeciążenia
      pG.xmax = T.L; pG.ymin = gRange.lo; pG.ymax = gRange.hi;
      c.save(); c.strokeStyle = C.grid; c.lineWidth = 1;
      c.strokeRect(pG.r.x + 0.5, pG.r.y + 0.5, pG.r.w, pG.r.h);
      const gStep = pG.ymax - pG.ymin > 7 ? 2 : 1;
      for (let g = Math.ceil(pG.ymin); g <= pG.ymax; g++) {
        if (g % gStep !== 0 && g !== 1) continue;
        const Y = Math.round(pG.Y(g)) + 0.5;
        c.strokeStyle = g === 0 || g === 1 ? C.faint : C.grid;
        c.setLineDash(g === 1 ? [5, 4] : []);
        c.beginPath(); c.moveTo(pG.r.x, Y); c.lineTo(pG.r.x + pG.r.w, Y); c.stroke();
        c.setLineDash([]);
        SPL.text(c, g + ' g', pG.r.x - 6, Y + 4, { size: 11.5, color: g === 0 || g === 1 ? C.ink : C.faint, align: 'right' });
      }
      // węzły
      c.strokeStyle = SPL.alpha(C.faint, 0.5); c.setLineDash([2, 4]);
      T.knots.forEach(i => { const X = Math.round(pG.X(T.smp[i].s)) + 0.5; c.beginPath(); c.moveTo(X, pG.r.y); c.lineTo(X, pG.r.y + pG.r.h); c.stroke(); });
      c.restore();
      pG.path(T.smp.map(qq => [qq.s, gForce(T, qq)]), { color: col, width: 2.4 });
      const gNow = gForce(T, q);
      c.save(); c.strokeStyle = C.purple; c.lineWidth = 1.5;
      const Xc = pG.X(s); c.beginPath(); c.moveTo(Xc, pG.r.y); c.lineTo(Xc, pG.r.y + pG.r.h); c.stroke(); c.restore();
      pG.dot([s, Sp.clamp(gNow, pG.ymin, pG.ymax)], { r: 5, fill: C.purple });
      SPL.text(c, 'przeciążenie n vs droga s', pG.r.x + 8, pG.r.y + 16, { size: 12.5, color: C.muted, weight: 600 });
      SPL.text(c, 's [m] →', pG.r.x + pG.r.w, pG.r.y + pG.r.h + 17, { size: 12, color: C.faint, align: 'right' });

      // skoki przeciążenia w węzłach (przy prędkości w danym punkcie)
      let jmax = 0;
      T.knots.forEach(i => { jmax = Math.max(jmax, Math.abs(gForce(T, T.smp[i]) - gForce(T, T.smp[i - 1]))); });
      const gc = gNow > 4 || gNow < -0.5 ? 'var(--red)' : 'var(--ink)';
      gOut.set(`<span style="color:${gc}">${gNow.toFixed(2)} g</span>`);
      vOut.set((Math.abs(v) * 3.6).toFixed(0) + ' km/h');
      jOut.set(`<span style="color:${jmax > 0.05 ? 'var(--orange)' : 'var(--green)'}">${jmax.toFixed(2)} g</span>`);
    }

    SPL.drag(st, {
      points: () => P.map(p => pT.P(p)),
      move(i, qq) {
        P[i] = [Sp.clamp(pT.ix(qq[0]), 2, XMAX - 2), Sp.clamp(pT.iy(qq[1]), 1, YMAX - 1)];
        for (let j = 0; j < P.length; j++) if (j !== i && Sp.dist(P[i], P[j]) < 1.5) P[i][0] += j < i ? 1.5 : -1.5;
        rebuild(); render();
      }
    });
    const loop = SPL.loop(dt => { step(dt); render(); });
    rebuild();
    if (SPL.print) { s = track.L * 0.47; v = Math.sqrt(v2At(track, at(track, s).y)); }
    return { render, activate: () => loop.start(), deactivate: () => loop.stop() };
  });

  // ======================================================================= tps
  SPL.register('tps', function (el, o) {
    const W = +o.w || 736, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    // punkty przypięte (narożniki i środki boków) + ruchome
    const pinned = [[0, 0], [W / 2, 0], [W, 0], [0, H / 2], [W, H / 2], [0, H], [W / 2, H], [W, H]];
    // ruchome: krańce napisu, punkt nad okręgiem, trzy punkty odcinka w okręgu
    const FX = W / 2, FY = 0.72 * H;
    const srcFree = [[0.2 * W, 0.3 * H], [0.8 * W, 0.3 * H], [0.5 * W, 0.47 * H], [FX - 32, FY + 22], [FX, FY + 22], [FX + 32, FY + 22]];
    const preset = [[-18, 34], [18, -34], [0, 0], [-10, 18], [0, -8], [10, -14]];
    const presetDst = () => srcFree.map((p, i) => [p[0] + preset[i][0], p[1] + preset[i][1]]);
    let dst = presetDst();
    let src = null, srcKey = '', srcData = null, out = null, outImg = null;
    let pending = false;

    const ui = SPL.ui.panel(el);
    SPL.ui.button(ui, 'reset', () => { dst = presetDst(); render(); });
    SPL.ui.button(ui, 'wyprostuj', () => { dst = srcFree.map(p => p.slice()); render(); });
    SPL.ui.button(ui, 'losowo', () => {
      dst = srcFree.map(p => [Sp.clamp(p[0] + (Math.random() - 0.5) * 140, 20, W - 20), Sp.clamp(p[1] + (Math.random() - 0.5) * 120, 20, H - 20)]);
      render();
    });
    const eOut = SPL.ui.readout(ui, 'energia zginania');
    SPL.ui.hint(ui, 'przeciągnij punkty ●');

    /** Obraz źródłowy rysowany proceduralnie (zależny od motywu i rozdzielczości). */
    function makeSource(r) {
      const cw = Math.round(W * r), ch = Math.round(H * r);
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const c = cv.getContext('2d');
      c.scale(r, r);
      c.fillStyle = C.card; c.fillRect(0, 0, W, H);
      c.lineWidth = 1;
      for (let x = 0; x <= W; x += 23) { c.strokeStyle = (x / 23) % 4 === 0 ? SPL.alpha(C.blue, 0.35) : C.grid; c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); c.stroke(); }
      for (let y = 0; y <= H; y += 23) { c.strokeStyle = (y / 23) % 4 === 0 ? SPL.alpha(C.blue, 0.35) : C.grid; c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke(); }
      c.fillStyle = C.blue; c.font = SPL.font(118, 800); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('SPLAJN', W / 2, 0.3 * H);
      // okrąg z odcinkiem
      const fx = FX, fy = FY, R = 74;
      c.lineWidth = 6; c.strokeStyle = C.orange; c.fillStyle = SPL.alpha(C.yellow, C.dark ? 0.25 : 0.3);
      c.beginPath(); c.arc(fx, fy, R, 0, 2 * Math.PI); c.fill(); c.stroke();
      c.lineWidth = 6; c.strokeStyle = C.ink; c.lineCap = 'round';
      c.beginPath(); c.moveTo(fx - 32, fy + 22); c.lineTo(fx + 32, fy + 22); c.stroke();
      // okręgi współśrodkowe po bokach
      [[0.14 * W, 0.72 * H], [0.86 * W, 0.72 * H]].forEach(([x, y]) => {
        for (let k = 1; k <= 4; k++) { c.strokeStyle = C.palette[k + 1]; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 12 * k, 0, 2 * Math.PI); c.stroke(); }
      });
      return { cv, cw, ch, data: new Uint32Array(c.getImageData(0, 0, cw, ch).data.buffer) };
    }

    function bgPixel() {
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(C.card) || [0, 'ff', 'ff', 'ff'];
      return ((255 << 24) | (parseInt(m[3], 16) << 16) | (parseInt(m[2], 16) << 8) | parseInt(m[1], 16)) >>> 0;
    }

    function render() {
      const r = Math.min(2, st.dpr || 1);
      const key = r + '|' + C.dark + '|' + C.card;
      if (key !== srcKey) {
        srcKey = key; src = makeSource(r); srcData = src.data;
        out = document.createElement('canvas'); out.width = src.cw; out.height = src.ch;
        outImg = out.getContext('2d').createImageData(src.cw, src.ch);
      }
      const all = pinned.concat(dst), allSrc = pinned.concat(srcFree);
      let inv;
      try { inv = Sp.tpsFit(all, allSrc); }         // cel → źródło (próbkowanie wsteczne)
      catch (e) { return; }                         // układ osobliwy: zostaw poprzednią klatkę
      // odwzorowanie liczymy na rzadkiej siatce, między węzłami — interpolacja dwuliniowa
      const g = 12, nx = Math.ceil(W / g) + 1, ny = Math.ceil(H / g) + 1;
      const MX = new Float64Array(nx * ny), MY = new Float64Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const m = inv.map([i * g, j * g]); MX[j * nx + i] = m[0]; MY[j * nx + i] = m[1];
      }
      const cw = src.cw, ch = src.ch, outU = new Uint32Array(outImg.data.buffer), bg = bgPixel();
      for (let py = 0; py < ch; py++) {
        const ly = (py + 0.5) / r, gy = ly / g, j0 = Math.min(ny - 2, Math.floor(gy)), fy = gy - j0;
        const row = py * cw;
        for (let px = 0; px < cw; px++) {
          const lx = (px + 0.5) / r, gx = lx / g, i0 = Math.min(nx - 2, Math.floor(gx)), fx = gx - i0;
          const k = j0 * nx + i0;
          const sx = (MX[k] * (1 - fx) + MX[k + 1] * fx) * (1 - fy) + (MX[k + nx] * (1 - fx) + MX[k + nx + 1] * fx) * fy;
          const sy = (MY[k] * (1 - fx) + MY[k + 1] * fx) * (1 - fy) + (MY[k + nx] * (1 - fx) + MY[k + nx + 1] * fx) * fy;
          const ix = (sx * r) | 0, iy = (sy * r) | 0;
          outU[row + px] = (ix >= 0 && iy >= 0 && ix < cw && iy < ch && sx >= 0 && sy >= 0) ? srcData[iy * cw + ix] : bg;
        }
      }
      out.getContext('2d').putImageData(outImg, 0, 0);
      st.clear();
      const c = st.ctx;
      c.imageSmoothingEnabled = true;
      c.drawImage(out, 0, 0, W, H);
      // punkty: źródło (puste) → cel (pełne)
      srcFree.forEach((p, i) => {
        const q = dst[i];
        if (Sp.dist(p, q) > 3) SPL.line(c, [p, q], { color: C.ink, width: 1.6, dash: [4, 4], alpha: 0.7 });
        SPL.dot(c, p[0], p[1], { r: 5, hollow: true, fill: C.faint });
        SPL.dot(c, q[0], q[1], { r: 7.5, fill: C.purple, active: drag && drag.hover === i });
      });
      pinned.forEach(p => {
        c.save(); c.fillStyle = C.faint; c.fillRect(Sp.clamp(p[0], 4, W - 4) - 4, Sp.clamp(p[1], 4, H - 4) - 4, 8, 8); c.restore();
      });
      const E = Sp.tpsFit(allSrc, all).energy();
      eOut.set(SPL.fmt(Math.abs(E) < 1e-9 ? 0 : E, 3) + ' <span class="faint">(j. umowne)</span>');
    }
    function schedule() {
      if (SPL.print) { render(); return; }
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; render(); });
    }
    const drag = SPL.drag(st, {
      radius: 16,
      points: () => dst,
      move(i, q) {
        const p = [Sp.clamp(q[0], 6, W - 6), Sp.clamp(q[1], 6, H - 6)];
        // dwa pokrywające się punkty dają układ osobliwy — nie pozwalamy ich skleić
        if (dst.some((d, j) => j !== i && Sp.dist(d, p) < 4) || pinned.some(d => Sp.dist(d, p) < 4)) return;
        dst[i] = p; schedule();
      },
      hover: () => schedule()
    });
    return { render };
  });
})();
