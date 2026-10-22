/* curves.js — dema: nurbs (wagi i okrąg), catmull (parametryzacje), chaikin (ścinanie narożników),
 * glyph (kontur TrueType), easing (cubic-bezier w CSS). */
(function () {
  'use strict';
  const Sp = window.Splines;
  const C = SPL.c;

  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const clone = P => P.map(p => p.slice());

  // ===================================================================== nurbs
  SPL.register('nurbs', function (el, o) {
    const W = +o.w || 600, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    const side = H - 36; // kwadrat: równe skale osi
    const pl = SPL.plot(st, { x: 34, y: 14, w: side, h: side }, { xmin: -0.18, xmax: 1.42, ymin: -0.18, ymax: 1.42 });
    const P = [[1, 0], [1, 1], [0, 1]];
    const W_CIRCLE = Math.SQRT1_2;
    let w = 1;

    // przyciąganie do wartości szczególnych
    const snap = v => (Math.abs(v - W_CIRCLE) < 0.006 ? W_CIRCLE : Math.abs(v - 1) < 0.012 ? 1 : v);
    const fmtW = v => (v === W_CIRCLE ? '0.7071' : v.toFixed(3));
    const curve = (ww, t) => Sp.rationalBezier(P, [1, ww, 1], t);

    const ui = SPL.ui.panel(el);
    const sl = SPL.ui.slider(ui, {
      label: 'waga w', min: Math.log10(0.05), max: Math.log10(3), step: 0.001, value: 0,
      fmt: v => fmtW(snap(Math.pow(10, v))),
      onInput: v => { w = snap(Math.pow(10, v)); render(); }
    });
    SPL.ui.button(ui, 'okrąg (w = √2/2)', () => { w = W_CIRCLE; sl.set(Math.log10(w)); render(); });
    SPL.ui.button(ui, 'parabola (w = 1)', () => { w = 1; sl.set(0); render(); });

    function classify(v) {
      if (v === 1) return { name: 'parabola', color: C.green };
      if (v < 1) return { name: 'elipsa', color: C.orange };
      return { name: 'hiperbola', color: C.purple };
    }

    function render() {
      st.clear();
      const c = st.ctx;
      pl.grid({ dx: 0.25, dy: 0.25, labels: true, labelsOutside: true, xfmt: v => String(v), yfmt: v => String(v) });

      // rodzina krzywych dla innych wag (tło)
      for (const ww of [0.15, 0.4, 1.8, 5]) {
        const pts = [];
        for (let j = 0; j <= 120; j++) pts.push(curve(ww, j / 120));
        pl.path(pts, { color: C.faint, width: 1.2, alpha: 0.45 });
      }
      // okrąg wzorcowy
      const circ = [];
      for (let j = 0; j <= 160; j++) { const a = -0.15 + (Math.PI / 2 + 0.3) * j / 160; circ.push([Math.cos(a), Math.sin(a)]); }
      pl.path(circ, { color: C.blue, width: 1.6, dash: [6, 6], alpha: 0.9 });

      // łamana kontrolna i przekątna do punktu „barkowego” C(½)
      pl.path(P, { color: C.faint, width: 1.5, dash: [4, 5] });
      pl.path([[0.5, 0.5], P[1]], { color: C.grid, width: 1.2 });

      const cl = classify(w);
      const pts = [];
      for (let j = 0; j <= 300; j++) pts.push(curve(w, j / 300));
      pl.path(pts, { color: cl.color, width: 4 });

      const sh = curve(w, 0.5);
      pl.dot(sh, { r: 4.5, fill: cl.color });
      SPL.text(c, 'C(½)', pl.X(sh[0]) - 10, pl.Y(sh[1]) + 18, { size: 13, color: C.muted, align: 'right' });

      // punkty kontrolne; promień P₁ rośnie z wagą
      const r1 = Sp.clamp(5 + 4 * Math.log2(w + 1), 4, 13);
      pl.dot(P[0], { r: 6, fill: C.ink });
      pl.dot(P[2], { r: 6, fill: C.ink });
      pl.dot(P[1], { r: r1, fill: cl.color });
      SPL.text(c, 'P₀  (w = 1)', pl.X(1) + 10, pl.Y(0) + 18, { size: 14, color: C.muted, weight: 600 });
      SPL.text(c, 'P₂  (w = 1)', pl.X(0) - 8, pl.Y(1) - 14, { size: 14, color: C.muted, weight: 600 });
      SPL.text(c, 'P₁', pl.X(1) + r1 + 5, pl.Y(1) - 8, { size: 15, color: C.ink, weight: 700 });

      // odchylenie od okręgu
      let mx = 0;
      for (let j = 0; j <= 600; j++) { const q = curve(w, j / 600); mx = Math.max(mx, Math.abs(Math.hypot(q[0], q[1]) - 1)); }

      // panel informacyjny po prawej
      const x0 = pl.r.x + pl.r.w + 16;
      SPL.text(c, 'w = ' + fmtW(w), x0, 46, { size: 21, weight: 700, mono: true });
      SPL.text(c, cl.name, x0, 84, { size: 26, weight: 800, color: cl.color });
      if (w === W_CIRCLE) SPL.text(c, 'tu: okrąg!', x0, 110, { size: 18, weight: 700, color: C.blue });
      SPL.text(c, 'odchylenie', x0, 170, { size: 13, weight: 700, color: C.muted });
      SPL.text(c, 'od okręgu:', x0, 187, { size: 13, weight: 700, color: C.muted });
      SPL.text(c, 'max |‖C‖ − 1|', x0, 204, { size: 13, color: C.muted });
      SPL.text(c, mx < 1e-12 ? '0' : supFmt(mx), x0, 232, { size: 19, weight: 700, mono: true, color: mx < 1e-12 ? C.blue : C.ink });
      if (mx < 1e-12) SPL.text(c, '(co do bitu)', x0, 252, { size: 12, color: C.muted });
      const notes = [['w → 0:', 'odcinek P₀P₂'], ['w → ∞:', 'łamana P₀P₁P₂'], ['ćwiartka:', 'w = cos 45° = √2/2']];
      notes.forEach(([a, b], i) => {
        SPL.text(c, a, x0, 300 + i * 40, { size: 14, weight: 700, color: C.muted });
        SPL.text(c, b, x0, 318 + i * 40, { size: 14, color: C.muted });
      });
    }
    return { render };
  });

  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  /** Liczba do napisu na płótnie: 0.0607 lub 3.2·10⁻⁵. */
  function supFmt(v) {
    if (v >= 1e-3) return v.toPrecision(3);
    const [m, e] = v.toExponential(1).split('e');
    return m + '·10' + String(+e).split('').map(ch => SUP[ch] || ch).join('');
  }

  // =================================================================== catmull
  SPL.register('catmull', function (el, o) {
    const W = +o.w || 680, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    const init = [[40, 200], [130, 410], [326, 172], [350, 172], [546, 410], [636, 200]];
    let P = clone(init);
    const curves = [
      { alpha: 0, label: 'równomierna  α = 0', short: 'α = 0', key: 'faint', width: 3.5, on: true },
      { alpha: 0.5, label: 'dośrodkowa  α = ½', short: 'α = ½', key: 'blue', width: 3.5, on: true },
      { alpha: 1, label: 'cięciwowa  α = 1', short: 'α = 1', key: 'green', width: 2.5, on: true }
    ];
    const ui = SPL.ui.panel(el);
    curves.forEach(cv => SPL.ui.toggle(ui, cv.short, cv.on, v => { cv.on = v; render(); }));
    SPL.ui.button(ui, 'reset', () => { P = clone(init); render(); });
    SPL.ui.hint(ui, 'przeciągnij punkty');

    const colorOf = cv => (cv.key === 'faint' ? (C.dark ? '#9aa0ab' : '#7d828c') : C[cv.key]);
    function drawCurves(c, T, widthScale) {
      SPL.line(c, P.map(T), { color: C.grid, width: 1.5, dash: [4, 5] });
      for (const cv of curves) {
        if (!cv.on) continue;
        SPL.line(c, Sp.catmullRom(P, cv.alpha, 80).map(T), { color: colorOf(cv), width: cv.width * widthScale, alpha: 0.92 });
      }
    }
    function render() {
      st.clear();
      const c = st.ctx;
      drawCurves(c, p => p, 1);
      P.forEach((p, i) => {
        SPL.dot(c, p[0], p[1], { r: 6.5, fill: C.ink, active: drag.hover === i });
        SPL.text(c, 'P' + subs(i), p[0], p[1] + 26, { size: 14, weight: 700, color: C.muted, align: 'center' });
      });
      // lupa: powiększenie okolicy najbliższej pary sąsiednich punktów
      let bi = 0, bd = Infinity;
      for (let i = 0; i < P.length - 1; i++) { const d = Sp.dist(P[i], P[i + 1]); if (d < bd) { bd = d; bi = i; } }
      // kadr obejmuje ten segment dla wszystkich parametryzacji
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const cv of curves) {
        if (!cv.on) continue;
        Sp.catmullRom(P, cv.alpha, 80).slice(bi * 80, bi * 80 + 81).forEach(q => {
          x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
        });
      }
      if (!isFinite(x0)) { x0 = Math.min(P[bi][0], P[bi + 1][0]); x1 = Math.max(P[bi][0], P[bi + 1][0]); y0 = Math.min(P[bi][1], P[bi + 1][1]); y1 = Math.max(P[bi][1], P[bi + 1][1]); }
      const LW = 210, LH = 150, LX = W - LW - 12, LY = 12;
      const cen = [(x0 + x1) / 2, (y0 + y1) / 2];
      const Z = Math.max(1, Math.min(4, 0.8 * LW / Math.max(1, x1 - x0), 0.8 * LH / Math.max(1, y1 - y0)));
      c.save();
      c.fillStyle = C.card; c.strokeStyle = C.faint; c.lineWidth = 1.2;
      c.beginPath(); c.rect(LX, LY, LW, LH); c.fill(); c.stroke();
      c.beginPath(); c.rect(LX, LY, LW, LH); c.clip();
      const T = p => [LX + LW / 2 + (p[0] - cen[0]) * Z, LY + LH / 2 + (p[1] - cen[1]) * Z];
      drawCurves(c, T, 0.8);
      [P[bi], P[bi + 1]].forEach(p => { const q = T(p); SPL.dot(c, q[0], q[1], { r: 5, fill: C.ink }); });
      c.restore();
      SPL.text(c, `lupa ×${Z.toFixed(1)}`, LX + 8, LY + 18, { size: 12, weight: 600, color: C.muted });
      c.save(); c.strokeStyle = C.faint; c.setLineDash([3, 4]);
      c.strokeRect(cen[0] - LW / (2 * Z), cen[1] - LH / (2 * Z), LW / Z, LH / Z); c.restore();

      // legenda
      const lx = 18, ly = 26;
      c.save();
      c.fillStyle = SPL.alpha(C.dark ? '#1a1d24' : '#ffffff', 0.9); c.strokeStyle = C.grid;
      c.beginPath(); c.rect(lx - 8, ly - 18, 210, 80); c.fill(); c.stroke();
      c.restore();
      curves.forEach((cv, i) => {
        const color = colorOf(cv);
        SPL.line(c, [[lx, ly + i * 24 - 5], [lx + 26, ly + i * 24 - 5]], { color, width: 3.5, alpha: cv.on ? 1 : 0.25 });
        SPL.text(c, cv.label, lx + 36, ly + i * 24, { size: 14, color: cv.on ? C.ink : C.faint, weight: 500 });
      });
    }
    const drag = SPL.drag(st, {
      points: () => P,
      move(i, q) { P[i] = [Sp.clamp(q[0], 8, W - 8), Sp.clamp(q[1], 8, H - 8)]; render(); },
      hover: () => render()
    });
    return { render };
  });

  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const subs = i => String(i).split('').map(d => SUB[+d]).join('');

  // =================================================================== chaikin
  SPL.register('chaikin', function (el, o) {
    const W = +o.w || 680, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    const init = [[150, 385], [150, 205], [340, 62], [530, 205], [530, 385], [340, 300]];
    const MAX = 7;
    let P = clone(init), iter = SPL.print ? 3 : 0, anim = 1, showLimit = true;

    const ui = SPL.ui.panel(el);
    SPL.ui.button(ui, 'krok ▶', () => {
      if (iter >= MAX) return;
      iter++; anim = 0; loop.start();
      if (!loop.running) anim = 1;
      render();
    }, 'primary');
    SPL.ui.button(ui, 'cofnij', () => { if (iter > 0) { iter--; anim = 1; render(); } });
    SPL.ui.button(ui, 'reset', () => { P = clone(init); iter = 0; anim = 1; render(); });
    SPL.ui.toggle(ui, 'granica: B-splajn st. 2', showLimit, v => { showLimit = v; render(); });
    const out = SPL.ui.readout(ui, '');

    const step = poly => {
      const res = [], n = poly.length;
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        res.push(Sp.lerpP(a, b, 0.25), Sp.lerpP(a, b, 0.75));
      }
      return res;
    };
    // ten sam krok, ale „w trakcie”: dla t = 0 wierzchołki siedzą w starych narożnikach
    const stepAnim = (poly, t) => {
      const res = [], n = poly.length;
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        res.push(Sp.lerpP(a, Sp.lerpP(a, b, 0.25), t), Sp.lerpP(b, Sp.lerpP(a, b, 0.75), t));
      }
      return res;
    };
    // granica: zamknięta jednorodna kwadratowa krzywa B-splajnowa (łuki Béziera między środkami boków)
    function limitCurve() {
      const pts = [], n = P.length;
      for (let i = 0; i < n; i++) {
        const a = mid(P[i], P[(i + 1) % n]), b = P[(i + 1) % n], e = mid(P[(i + 1) % n], P[(i + 2) % n]);
        for (let j = 0; j < 30; j++) pts.push(Sp.bezier([a, b, e], j / 30));
      }
      pts.push(pts[0]);
      return pts;
    }

    function render() {
      st.clear();
      const c = st.ctx;
      let prev = P;
      for (let k = 0; k < iter - 1; k++) prev = step(prev);
      const e = anim * anim * (3 - 2 * anim);
      const cur = iter === 0 ? P : (anim < 1 ? stepAnim(prev, e) : step(prev));

      SPL.line(c, P, { color: C.faint, width: 1.5, dash: [5, 6], close: true });
      if (iter > 0) SPL.line(c, prev, { color: C.faint, width: 1.2, close: true, alpha: 0.6 });
      SPL.line(c, cur, { color: C.blue, width: 3, close: true, fill: SPL.alpha(C.blue, 0.06) });
      if (showLimit) SPL.line(c, limitCurve(), { color: C.green, width: 2.2, dash: [8, 6] });
      if (iter > 0 && cur.length <= 96) cur.forEach(p => SPL.dot(c, p[0], p[1], { r: 3.2, fill: C.blue }));
      P.forEach((p, i) => SPL.dot(c, p[0], p[1], { r: 7, fill: C.ink, active: drag.hover === i }));

      SPL.text(c, iter === 0 ? 'łamana wyjściowa' : `po ${iter} ${iter === 1 ? 'kroku' : 'krokach'}: ${cur.length} wierzchołków`, 18, 30, { size: 16, weight: 700, color: C.ink });
      SPL.text(c, 'Q = ¾·Pᵢ + ¼·Pᵢ₊₁,  R = ¼·Pᵢ + ¾·Pᵢ₊₁', 18, 52, { size: 14, color: C.muted, mono: true });
      out.set(`krok <b>${iter}</b> / ${MAX}`);
    }
    const loop = SPL.loop(dt => { anim = Math.min(1, anim + dt / 0.55); render(); return anim < 1; });
    const drag = SPL.drag(st, {
      points: () => P,
      move(i, q) { P[i] = [Sp.clamp(q[0], 10, W - 10), Sp.clamp(q[1], 10, H - 10)]; anim = 1; render(); },
      hover: () => render()
    });
    return { render, deactivate() { loop.stop(); anim = 1; render(); } };
  });

  // ===================================================================== glyph
  SPL.register('glyph', function (el, o) {
    const W = +o.w || 736, H = +o.h || 460;
    const st = SPL.stage(el, W, H);
    const G = window.SPL_GLYPHS;
    if (!G) throw new Error('brak danych glifów (data/glyphs.js)');
    const MAIN_W = 540;                        // obszar głównego glifu; po prawej wstawka
    const em = G.ascender - G.descender;
    const scale = (H - 40) / em;
    const baseY = 20 + G.ascender * scale;     // linia bazowa w px
    const keys = ['S', 'ą', 'g', '&', 'ę'].filter(k => G.glyphs[k]);
    let key = keys[0], pts = null, ox = 0, showImplied = true, showFill = true;

    function load(k) {
      key = k;
      pts = G.glyphs[k].contours.map(cn => cn.map(p => p.slice()));
      let lo = Infinity, hi = -Infinity;
      pts.forEach(cn => cn.forEach(p => { lo = Math.min(lo, p[0]); hi = Math.max(hi, p[0]); }));
      ox = MAIN_W / 2 - (lo + hi) / 2 * scale;
    }
    const toPx = p => [ox + p[0] * scale, baseY - p[1] * scale];

    /** Kontur TrueType → segmenty: wstawiamy niejawne punkty między kolejnymi punktami „poza krzywą”. */
    function contour(cn) {
      const n = cn.length, ex = [];
      for (let i = 0; i < n; i++) {
        const a = cn[i], b = cn[(i + 1) % n];
        ex.push({ p: [a[0], a[1]], on: !!a[2], implied: false });
        if (!a[2] && !b[2]) ex.push({ p: mid(a, b), on: true, implied: true });
      }
      const m = ex.length, s = ex.findIndex(q => q.on);
      const segs = [];
      for (let k = 1; k <= m;) {
        const nx = ex[(s + k) % m];
        if (nx.on) { segs.push({ type: 'L', p: nx.p }); k += 1; } else { segs.push({ type: 'Q', c: nx.p, p: ex[(s + k + 1) % m].p }); k += 2; }
      }
      return { start: ex[s].p, segs, implied: ex.filter(q => q.implied).map(q => q.p) };
    }
    function tracePath(c, T, parsed) {
      c.beginPath();
      for (const cn of parsed) {
        const s = T(cn.start); c.moveTo(s[0], s[1]);
        for (const g of cn.segs) {
          const p = T(g.p);
          if (g.type === 'L') c.lineTo(p[0], p[1]);
          else { const q = T(g.c); c.quadraticCurveTo(q[0], q[1], p[0], p[1]); }
        }
        c.closePath();
      }
    }

    const ui = SPL.ui.panel(el);
    SPL.ui.segmented(ui, keys.map(k => ({ value: k, label: k === '&' ? '&amp;' : k })), key, v => { load(v); render(); }, 'litera');
    SPL.ui.toggle(ui, 'punkty niejawne', showImplied, v => { showImplied = v; render(); });
    SPL.ui.toggle(ui, 'wypełnienie', showFill, v => { showFill = v; render(); });
    SPL.ui.button(ui, 'reset', () => { load(key); render(); });

    function render() {
      st.clear();
      const c = st.ctx;
      const parsed = pts.map(contour);

      // linie metryczne
      c.save();
      c.strokeStyle = C.grid; c.lineWidth = 1.2;
      [[baseY, 'linia bazowa']].forEach(([y, lab]) => {
        c.beginPath(); c.moveTo(12, Math.round(y) + 0.5); c.lineTo(MAIN_W - 12, Math.round(y) + 0.5); c.stroke();
        if (lab) SPL.text(c, lab, 16, y - 6, { size: 12, color: C.faint });
      });
      c.restore();

      // wypełnienie i kontur
      tracePath(c, toPx, parsed);
      if (showFill) { c.fillStyle = SPL.alpha(C.blue, C.dark ? 0.2 : 0.12); c.fill('nonzero'); }
      c.strokeStyle = C.ink; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();

      // łamana kontrolna
      pts.forEach(cn => SPL.line(c, cn.map(toPx), { color: C.faint, width: 1, dash: [3, 4], close: true }));
      if (showImplied) parsed.forEach(cn => cn.implied.forEach(p => { const q = toPx(p); SPL.dot(c, q[0], q[1], { r: 2.6, fill: C.faint, width: 0.8 }); }));
      let idx = 0;
      pts.forEach(cn => cn.forEach(p => {
        const q = toPx(p), active = drag.hover === idx++;
        if (p[2]) SPL.dot(c, q[0], q[1], { r: 4.5, fill: C.blue, active });
        else SPL.dot(c, q[0], q[1], { r: 4.5, hollow: true, fill: C.orange, width: 2, active });
      }));

      // statystyka
      let nPts = 0, nQ = 0, nL = 0;
      pts.forEach(cn => { nPts += cn.length; });
      parsed.forEach(cn => cn.segs.forEach(g => { if (g.type === 'Q') nQ++; else nL++; }));
      SPL.text(c, `punkty: ${nPts}  ·  łuki 2. stopnia: ${nQ}  ·  odcinki: ${nL}`, 16, H - 14, { size: 14, color: C.muted, weight: 600 });

      // legenda
      SPL.dot(c, 22, 24, { r: 4.5, fill: C.blue });
      SPL.text(c, 'na krzywej', 32, 29, { size: 13, color: C.muted });
      SPL.dot(c, 118, 24, { r: 4.5, hollow: true, fill: C.orange, width: 2 });
      SPL.text(c, 'kontrolny', 128, 29, { size: 13, color: C.muted });
      if (showImplied) { SPL.dot(c, 208, 24, { r: 2.6, fill: C.faint, width: 0.8 }); SPL.text(c, 'niejawny', 216, 29, { size: 13, color: C.muted }); }
      SPL.text(c, 'przeciągnij punkty', MAIN_W - 14, 29, { size: 13, color: C.faint, align: 'right' });

      // wstawka: ten sam kontur w kilku rozmiarach
      const x0 = MAIN_W + 8;
      c.save(); c.strokeStyle = C.grid; c.beginPath(); c.moveTo(x0 + 0.5, 16); c.lineTo(x0 + 0.5, H - 16); c.stroke(); c.restore();
      SPL.text(c, 'ten sam kontur,', x0 + 18, 30, { size: 13, color: C.muted, weight: 600 });
      SPL.text(c, 'dowolny rozmiar', x0 + 18, 47, { size: 13, color: C.muted, weight: 600 });
      let y = 70;
      [120, 64, 32, 16, 9].forEach(sizePx => {
        const s = sizePx / em, by = y + G.ascender * s;
        let lo = Infinity, hi = -Infinity;
        pts.forEach(cn => cn.forEach(p => { lo = Math.min(lo, p[0]); hi = Math.max(hi, p[0]); }));
        const gx = x0 + (W - x0) / 2 - (lo + hi) / 2 * s;
        tracePath(c, p => [gx + p[0] * s, by - p[1] * s], parsed);
        c.fillStyle = C.ink; c.fill('nonzero');
        SPL.text(c, sizePx + ' px', W - 12, by, { size: 11, color: C.faint, align: 'right' });
        y += sizePx * em / G.unitsPerEm * 0.98 + 10;
      });
    }

    const flat = () => { const out = []; pts.forEach(cn => cn.forEach(p => out.push(toPx(p)))); return out; };
    const drag = SPL.drag(st, {
      radius: 10,
      points: flat,
      move(i, q) {
        let k = i;
        for (const cn of pts) {
          if (k < cn.length) {
            cn[k][0] = (Sp.clamp(q[0], 6, MAIN_W - 6) - ox) / scale;
            cn[k][1] = (baseY - Sp.clamp(q[1], 6, H - 6)) / scale;
            break;
          }
          k -= cn.length;
        }
        render();
      },
      hover: () => render()
    });
    load(key);
    return { render };
  });

  // ==================================================================== easing
  SPL.register('easing', function (el, o) {
    const W = +o.w || 680, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    const pl = SPL.plot(st, { x: 54, y: 24, w: 250, h: H - 62 }, { xmin: -0.08, xmax: 1.08, ymin: -0.6, ymax: 1.7 });
    const PRESETS = {
      ease: [0.25, 0.1, 0.25, 1],
      'ease-in-out': [0.42, 0, 0.58, 1],
      linear: [0, 0, 1, 1],
      'sprężyna': [0.34, 1.56, 0.64, 1]
    };
    let B = PRESETS.ease.slice();
    const DUR = 1.6, PAUSE = 0.9;
    let tau = DUR / 2; // statyczna klatka (druk, slajd nieaktywny)

    // współczynniki wielomianu dla jednej współrzędnej: P0 = 0, P3 = 1
    const coef = (p1, p2) => { const c = 3 * p1, b = 3 * (p2 - p1) - c; return [1 - c - b, b, c]; };
    const ev = (k, t) => ((k[0] * t + k[1]) * t + k[2]) * t;
    const dev = (k, t) => (3 * k[0] * t + 2 * k[1]) * t + k[2];
    /** y dla czasu x: odwracamy x(t) metodą Newtona, w razie kłopotów — bisekcja (jak w przeglądarkach). */
    function easeY(x) {
      const kx = coef(B[0], B[2]), ky = coef(B[1], B[3]);
      let t = x;
      for (let i = 0; i < 8; i++) {
        const f = ev(kx, t) - x;
        if (Math.abs(f) < 1e-7) return ev(ky, t);
        const d = dev(kx, t);
        if (Math.abs(d) < 1e-6) break;
        t -= f / d;
      }
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 60; i++) {
        const f = ev(kx, t);
        if (Math.abs(f - x) < 1e-7) break;
        if (f < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return ev(ky, t);
    }
    const cssString = () => `cubic-bezier(${B.map(v => String(+v.toFixed(2))).join(', ')})`;

    const ui = SPL.ui.panel(el);
    const seg = SPL.ui.segmented(ui, Object.keys(PRESETS).map(k => ({ value: k, label: k })), 'ease', v => { B = PRESETS[v].slice(); restart(); render(); }, 'preset');
    SPL.ui.hint(ui, 'przeciągnij P₁ i P₂');

    // tory kulek (prawa część płótna)
    const TX0 = 380, TX1 = 628, R = 11;
    const ROWS = [
      { y: 118, label: 'nasza implementacja (Newton)', key: 'blue' },
      { y: 210, label: 'przeglądarka: CSS transition', key: 'purple', css: true },
      { y: 302, label: 'liniowo (dla porównania)', key: 'faint', linear: true }
    ];
    const cssRow = ROWS[1];

    // prawdziwa kulka animowana przez przeglądarkę — dowód, że liczymy to samo
    const ball = document.createElement('div');
    ball.className = 'easing-cssball';
    Object.assign(ball.style, {
      position: 'absolute', width: 2 * R + 'px', height: 2 * R + 'px', borderRadius: '50%',
      background: 'var(--purple)', pointerEvents: 'none', visibility: 'hidden', left: '0px', top: '0px'
    });
    el.appendChild(ball);
    function placeBall() {
      ball.style.left = (st.el.offsetLeft + TX0 - R) + 'px';
      ball.style.top = (st.el.offsetTop + cssRow.y - R) + 'px';
    }
    function restartCss() {
      if (SPL.print) return;
      placeBall();
      ball.style.visibility = 'visible';
      ball.style.transition = 'none';
      ball.style.transform = 'translateX(0px)';
      void ball.offsetWidth; // wymuszenie przeliczenia stylu
      ball.style.transition = `transform ${DUR}s ${cssString()}`;
      ball.style.transform = `translateX(${TX1 - TX0}px)`;
    }
    function restart() { if (loop.running) { tau = 0; restartCss(); } }

    function render() {
      st.clear();
      const c = st.ctx;
      const time = Sp.clamp(tau / DUR, 0, 1), prog = easeY(time);

      // edytor krzywej
      pl.grid({ dx: 0.25, dy: 0.25, labels: true, labelsOutside: true, axes: false, xfmt: v => (Math.abs(v - Math.round(v * 2) / 2) < 1e-9 ? String(v) : ''), yfmt: v => (Math.abs(v - Math.round(v * 2) / 2) < 1e-9 ? String(v) : '') });
      const X0 = pl.X(0), X1 = pl.X(1), Y0 = pl.Y(0), Y1 = pl.Y(1);
      c.save(); c.strokeStyle = C.faint; c.lineWidth = 1.4; c.strokeRect(X0, Y1, X1 - X0, Y0 - Y1); c.restore();
      pl.path([[0, 0], [1, 1]], { color: C.faint, width: 1.2, dash: [4, 5] });
      const P1 = [B[0], B[1]], P2 = [B[2], B[3]];
      pl.path([[0, 0], P1], { color: C.orange, width: 1.8 });
      pl.path([[1, 1], P2], { color: C.orange, width: 1.8 });
      const curve = [];
      for (let j = 0; j <= 160; j++) curve.push(Sp.bezier([[0, 0], P1, P2, [1, 1]], j / 160));
      pl.path(curve, { color: C.blue, width: 3.5 });
      // bieżący czas
      pl.path([[time, -0.6], [time, 1.7]], { color: SPL.alpha(C.blue, 0.35), width: 1.2 });
      pl.dot([time, prog], { r: 5, fill: C.blue });
      pl.dot([0, 0], { r: 4.5, fill: C.ink });
      pl.dot([1, 1], { r: 4.5, fill: C.ink });
      pl.dot(P1, { r: 7, fill: C.orange, active: drag.hover === 0 });
      pl.dot(P2, { r: 7, fill: C.orange, active: drag.hover === 1 });
      SPL.text(c, 'P₁', pl.X(P1[0]) + 10, pl.Y(P1[1]) - 8, { size: 14, weight: 700, color: C.orange });
      SPL.text(c, 'P₂', pl.X(P2[0]) + 10, pl.Y(P2[1]) - 8, { size: 14, weight: 700, color: C.orange });
      SPL.text(c, 'czas →', X1, pl.r.y + pl.r.h + 32, { size: 13, color: C.muted, align: 'right', weight: 600 });
      SPL.text(c, 'postęp ↑', X0 - 46, pl.r.y - 8, { size: 13, color: C.muted, weight: 600 });

      // tory z kulkami
      ROWS.forEach(row => {
        const color = row.key === 'faint' ? C.faint : C[row.key];
        const f = x => (row.linear ? x : easeY(x));
        SPL.text(c, row.label, TX0 - R, row.y - 26, { size: 14, weight: 600, color: C.muted });
        SPL.line(c, [[TX0, row.y], [TX1, row.y]], { color: C.grid, width: 4 });
        // „duchy”: położenia w równych odstępach czasu
        for (let j = 0; j <= 10; j++) {
          const x = TX0 + f(j / 10) * (TX1 - TX0);
          c.save(); c.globalAlpha = 0.22 + 0.04 * j; c.fillStyle = color;
          c.beginPath(); c.arc(x, row.y + 26, 4.5, 0, 2 * Math.PI); c.fill(); c.restore();
        }
        if (row.css && !SPL.print && loop.running) return; // tę kulkę rysuje przeglądarka
        const x = TX0 + f(time) * (TX1 - TX0);
        SPL.dot(c, x, row.y, { r: R, fill: color, width: 2 });
      });
      SPL.text(c, 'kropki: położenie co 0,1 czasu trwania', TX0 - R, 360, { size: 12, color: C.faint });
      SPL.text(c, cssString(), TX0 - R, 404, { size: 15, weight: 600, mono: true, color: C.ink });
    }

    const loop = SPL.loop(dt => {
      tau += dt;
      if (tau > DUR + PAUSE) { tau = 0; restartCss(); }
      render();
    });

    const drag = SPL.drag(st, {
      points: () => [pl.P([B[0], B[1]]), pl.P([B[2], B[3]])],
      move(i, q) {
        const x = Sp.clamp(pl.ix(q[0]), 0, 1), y = Sp.clamp(pl.iy(q[1]), -0.6, 1.7);
        B[2 * i] = Math.round(x * 100) / 100; B[2 * i + 1] = Math.round(y * 100) / 100;
        seg.set('');
        render();
      },
      up() { restart(); },
      hover: () => render()
    });

    return {
      render,
      activate() { tau = 0; loop.start(); restartCss(); },
      deactivate() { loop.stop(); ball.style.visibility = 'hidden'; ball.style.transition = 'none'; tau = DUR / 2; render(); }
    };
  });
})();
