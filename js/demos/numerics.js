/* numerics.js — dema: cubic (warunki brzegowe + pochodne), thomas (milion niewiadomych), convergence (rząd zbieżności). */
(function () {
  'use strict';
  const Sp = window.Splines;
  const C = SPL.c;

  /** Najmniejsza „ładna” liczba ≥ m (1, 2, 2.5, 5 × 10^k). */
  function niceCeil(m) {
    if (!(m > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(m)));
    for (const f of [1, 2, 2.5, 5, 10]) if (f * p >= m * (1 - 1e-12)) return f * p;
    return 10 * p;
  }
  /** Zakres symetryczny [−R, R] z histerezą — oś nie skacze przy każdym ruchu myszy. */
  function stableRange(state, values) {
    let m = 0;
    for (const v of values) if (isFinite(v)) m = Math.max(m, Math.abs(v));
    m = Math.max(m * 1.12, 1e-6);
    if (!state.R || m > state.R || m < state.R * 0.3) state.R = niceCeil(m);
    return state.R;
  }
  const fmtR = v => {
    const a = Math.abs(v);
    const s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(0) : a >= 1 ? String(+v.toFixed(1)) : String(+v.toPrecision(2));
    return s.replace('-', '−');
  };

  // ===================================================================== cubic
  SPL.register('cubic', function (el, o) {
    const W = +o.w || 736, H = +o.h || 470;
    const st = SPL.stage(el, W, H);
    const L = 48, R = 14, PW = W - L - R;
    const dom = { xmin: -0.3, xmax: 10.3 };
    const pS = SPL.plot(st, { x: L, y: 10, w: PW, h: 196 }, Object.assign({ ymin: -0.6, ymax: 6.6 }, dom));
    const pD = [216, 294, 372].map(y => SPL.plot(st, { x: L, y, w: PW, h: 68 }, Object.assign({ ymin: -1, ymax: 1 }, dom)));
    const ranges = [{}, {}, {}];
    const init = [[0.4, 2.0], [1.9, 4.3], [3.4, 1.6], [5.0, 3.1], [6.5, 4.7], [8.1, 2.3], [9.6, 3.6]];
    let P = init.map(p => p.slice());
    let bc = 'natural', d0 = 2.0, dn = -1.0;
    const HX = 0.9; // poziome odsunięcie uchwytów stycznych

    const ui = SPL.ui.panel(el);
    SPL.ui.segmented(ui, [
      { value: 'natural', label: 'naturalne' },
      { value: 'clamped', label: 'zupełne' },
      { value: 'notaknot', label: 'not-a-knot' },
      { value: 'periodic', label: 'okresowe' }
    ], bc, v => { bc = v; if (bc === 'periodic') P[P.length - 1][1] = P[0][1]; render(); });
    const eOut = SPL.ui.readout(ui, '∫ s″² dx');
    SPL.ui.button(ui, 'reset', () => { P = init.map(p => p.slice()); d0 = 2.0; dn = -1.0; if (bc === 'periodic') P[P.length - 1][1] = P[0][1]; render(); });

    const NOTE = {
      natural: 's″(a) = s″(b) = 0',
      clamped: 'przeciągnij ◆ — zadaje s′(a) i s′(b)',
      notaknot: 's‴ ciągła w x₁ i xₙ₋₁ (ten sam stopień)',
      periodic: 'y₀ = yₙ — końce poruszają się razem'
    };

    function spline(kind) {
      const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
      return Sp.cubicSpline(xs, ys, kind || bc, { d0, dn });
    }
    const handles = () => {
      const n = P.length - 1;
      return [[P[0][0] + HX, P[0][1] + d0 * HX], [P[n][0] - HX, P[n][1] - dn * HX]];
    };

    function panelLabel(pl, txt) {
      SPL.text(st.ctx, txt, 12, pl.r.y + pl.r.h / 2 + 7, { size: 21, weight: 700, color: C.ink });
    }
    function frame(pl) {
      const c = st.ctx;
      c.save(); c.strokeStyle = C.grid; c.lineWidth = 1;
      c.strokeRect(pl.r.x + 0.5, pl.r.y + 0.5, pl.r.w - 1, pl.r.h - 1);
      c.restore();
    }

    function render() {
      st.clear();
      const c = st.ctx;
      const s = spline();
      const xs = s.x, n = xs.length - 1, a = xs[0], b = xs[n];
      const N = 500, X = Sp.linspace(a, b, N + 1);

      // --- panel s
      pS.grid({ dx: 1, dy: 1, labels: false, axes: false });
      frame(pS);
      // węzły przez wszystkie panele
      c.save(); c.strokeStyle = SPL.alpha(C.faint, 0.45); c.setLineDash([3, 4]); c.lineWidth = 1;
      xs.forEach(x => { const Xp = Math.round(pS.X(x)) + 0.5; c.beginPath(); c.moveTo(Xp, pS.r.y); c.lineTo(Xp, pD[2].r.y + pD[2].r.h); c.stroke(); });
      c.restore();
      // podpis pod krzywymi i punktami (punkty zawsze widoczne)
      const nbg = SPL.alpha(C.dark ? '#1a1d24' : '#ffffff', 0.75);
      SPL.text(c, NOTE[bc], pS.r.x + 10, pS.r.y + 20, { size: 13.5, color: C.muted, weight: 600, bg: nbg });
      if (bc !== 'natural') SPL.text(c, '- - - naturalne (dla porównania)', pS.r.x + 10, pS.r.y + 40, { size: 12.5, color: C.faint, bg: nbg });
      if (bc !== 'natural') {
        const sn = spline('natural');
        pS.path(X.map(x => [x, sn.eval(x)]), { color: C.faint, width: 1.6, dash: [5, 5] });
      }
      pS.path(X.map(x => [x, s.eval(x)]), { color: C.blue, width: 3.2 });
      if (bc === 'clamped') {
        const [h0, h1] = handles();
        const p0 = P[0], p1 = P[n];
        pS.path([[2 * p0[0] - h0[0], 2 * p0[1] - h0[1]], h0], { color: C.orange, width: 1.6 });
        pS.path([[2 * p1[0] - h1[0], 2 * p1[1] - h1[1]], h1], { color: C.orange, width: 1.6 });
        [h0, h1].forEach(h => {
          const q = pS.P(h);
          c.save(); c.translate(q[0], q[1]); c.rotate(Math.PI / 4);
          c.fillStyle = C.orange; c.strokeStyle = C.card; c.lineWidth = 2;
          c.fillRect(-6, -6, 12, 12); c.strokeRect(-6, -6, 12, 12);
          c.restore();
        });
      }
      P.forEach((p, i) => {
        const tied = bc === 'periodic' && (i === 0 || i === n);
        pS.dot(p, { r: 6.5, fill: tied ? C.purple : C.ink });
      });
      panelLabel(pS, 's');

      // --- pochodne: s′ (próbkowana), s″ (łamana przez momenty), s‴ (schodki)
      const d1 = X.map(x => s.d1(x));
      const d3 = [];
      for (let i = 0; i < n; i++) d3.push((s.M[i + 1] - s.M[i]) / (xs[i + 1] - xs[i]));
      const vals = [d1, s.M, d3];
      const cols = [C.green, C.purple, C.red];
      const labs = ['s′', 's″', 's‴'];
      pD.forEach((pl, k) => {
        const Rk = stableRange(ranges[k], vals[k]);
        pl.ymin = -Rk; pl.ymax = Rk;
        frame(pl);
        c.save(); c.strokeStyle = C.faint; c.lineWidth = 1;
        const y0 = Math.round(pl.Y(0)) + 0.5;
        c.beginPath(); c.moveTo(pl.r.x, y0); c.lineTo(pl.r.x + pl.r.w, y0); c.stroke();
        c.restore();
        SPL.text(c, fmtR(Rk), L - 4, pl.r.y + 11, { size: 11, color: C.faint, align: 'right' });
        SPL.text(c, fmtR(-Rk), L - 4, pl.r.y + pl.r.h - 2, { size: 11, color: C.faint, align: 'right' });
        panelLabel(pl, labs[k]);
      });
      pD[0].path(X.map((x, i) => [x, d1[i]]), { color: cols[0], width: 2.4 });
      pD[1].path(xs.map((x, i) => [x, s.M[i]]), { color: cols[1], width: 2.4 });
      xs.forEach((x, i) => pD[1].dot([x, s.M[i]], { r: 3, fill: cols[1] }));
      // schodki s‴ z zaznaczonymi skokami
      pD[2].clip(cc => {
        for (let i = 0; i < n; i++) {
          if (i > 0) {
            cc.save(); cc.strokeStyle = SPL.alpha(cols[2], 0.5); cc.setLineDash([2, 3]); cc.lineWidth = 1.2;
            cc.beginPath(); cc.moveTo(pD[2].X(xs[i]), pD[2].Y(d3[i - 1])); cc.lineTo(pD[2].X(xs[i]), pD[2].Y(d3[i])); cc.stroke();
            cc.restore();
          }
          cc.save(); cc.strokeStyle = cols[2]; cc.lineWidth = 3; cc.lineCap = 'butt';
          cc.beginPath(); cc.moveTo(pD[2].X(xs[i]), pD[2].Y(d3[i])); cc.lineTo(pD[2].X(xs[i + 1]), pD[2].Y(d3[i])); cc.stroke();
          cc.restore();
        }
      });
      // etykiety osi x
      c.save(); c.fillStyle = C.muted; c.font = SPL.font(12, 500); c.textAlign = 'center'; c.textBaseline = 'top';
      for (let x = 0; x <= 10; x += 2) c.fillText(String(x), pD[2].X(x), pD[2].r.y + pD[2].r.h + 5);
      c.restore();

      const E = s.energy(), En = spline('natural').energy();
      eOut.set(E.toFixed(1) + (bc === 'natural'
        ? ' <span class="faint">(minimum)</span>'
        : ` <span class="faint">≥ ${En.toFixed(1)} (nat.)</span>`));
    }

    SPL.drag(st, {
      points() {
        const pts = P.map(p => pS.P(p));
        if (bc === 'clamped') handles().forEach(h => pts.push(pS.P(h)));
        return pts;
      },
      move(i, q) {
        const n = P.length - 1;
        if (i > n) { // uchwyt stycznej
          const y = pS.iy(q[1]);
          if (i === n + 1) d0 = Sp.clamp((y - P[0][1]) / HX, -12, 12);
          else dn = Sp.clamp((P[n][1] - y) / HX, -12, 12);
          render(); return;
        }
        const lo = i > 0 ? P[i - 1][0] + 0.35 : 0, hi = i < n ? P[i + 1][0] - 0.35 : 10;
        const y = Sp.clamp(pS.iy(q[1]), -0.3, 6.3);
        P[i] = [Sp.clamp(pS.ix(q[0]), lo, hi), y];
        if (bc === 'periodic') { if (i === 0) P[n][1] = y; if (i === n) P[0][1] = y; }
        render();
      }
    });
    return { render };
  });

  // ==================================================================== thomas
  SPL.register('thomas', function (el, o) {
    const W = +o.w || 540, H = +o.h || 120;
    if (!document.getElementById('thomas-style')) {
      const css = document.createElement('style');
      css.id = 'thomas-style';
      css.textContent = `
        .thomas-card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow);
          padding: 12px 16px; display: flex; flex-direction: column; justify-content: center; gap: 10px; box-sizing: border-box; }
        .thomas-card .ctrls { flex-wrap: nowrap; }
        .thomas-res { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 14.5px; color: var(--ink); line-height: 1.45; min-height: 2.9em; }
        .thomas-res .big { font-size: 22px; font-weight: 600; color: var(--blue); }
        .thomas-res .faint { color: var(--faint); }`;
      document.head.appendChild(css);
    }
    const card = document.createElement('div');
    card.className = 'thomas-card';
    card.style.maxWidth = W + 'px'; card.style.minHeight = H + 'px';
    el.appendChild(card);
    const sizes = [1e3, 1e4, 1e5, 1e6];
    let n = 1e6;
    const fmtN = v => v.toLocaleString('pl-PL').replace(/ /g, ' ');
    const ui = SPL.ui.panel(card);
    SPL.ui.segmented(ui, sizes.map(v => ({ value: v, label: '10' + '⁰¹²³⁴⁵⁶⁷⁸⁹'[Math.round(Math.log10(v))] })), n, v => { n = +v; btn.innerHTML = label(); }, 'n');
    const label = () => `Rozwiąż dla n = ${fmtN(n)}`;
    const btn = SPL.ui.button(ui, label(), run, 'primary');
    const res = document.createElement('div');
    res.className = 'thomas-res';
    res.innerHTML = SPL.print
      ? 'W wersji online: milion niewiadomych w kilkadziesiąt milisekund <span class="faint">— na żywo, w przeglądarce.</span>'
      : '<span class="faint">Układ momentów naturalnego splajnu dla losowych danych — algorytm Thomasa w JavaScripcie.</span>';
    card.appendChild(res);

    function run() {
      const N = n + 1;
      const t0 = performance.now();
      // losowe dane: węzły o losowych odstępach, losowe wartości
      const x = new Float64Array(N), y = new Float64Array(N);
      for (let i = 1; i < N; i++) x[i] = x[i - 1] + 0.5 + Math.random();
      for (let i = 0; i < N; i++) y[i] = 2 * Math.random() - 1;
      const a = new Float64Array(N), b = new Float64Array(N), c = new Float64Array(N), d = new Float64Array(N);
      b[0] = 1; b[N - 1] = 1; // M_0 = M_n = 0 (warunki naturalne)
      for (let i = 1; i < N - 1; i++) {
        const hl = x[i] - x[i - 1], hr = x[i + 1] - x[i];
        a[i] = hl; b[i] = 2 * (hl + hr); c[i] = hr;
        d[i] = 6 * ((y[i + 1] - y[i]) / hr - (y[i] - y[i - 1]) / hl);
      }
      // małe układy rozwiązujemy wielokrotnie, żeby pomiar czasu miał sens
      const reps = Math.min(2000, Math.ceil(2e5 / n));
      const t1 = performance.now();
      let M;
      for (let k = 0; k < reps; k++) M = Sp.thomas(a, b, c, d);
      const t2 = performance.now();
      let r = 0;
      for (let i = 0; i < N; i++) {
        let s = b[i] * M[i] - d[i];
        if (i > 0) s += a[i] * M[i - 1];
        if (i < N - 1) s += c[i] * M[i + 1];
        r = Math.max(r, Math.abs(s));
      }
      const ms = (t2 - t1) / reps;
      const msTxt = ms >= 10 ? ms.toFixed(1) : ms >= 0.1 ? ms.toFixed(2) : (ms * 1000).toFixed(1) + ' µs';
      res.innerHTML = `Thomas: <span class="big">${ms >= 0.1 ? msTxt + ' ms' : msTxt}</span>`
        + ` <span class="faint">· ${(ms * 1e6 / N).toFixed(1)} ns na niewiadomą</span><br>`
        + `max |A·M − d| = ${SPL.fmt(r, 2)}<span class="faint">${reps > 1 ? ` · średnia z ${reps} prób` : ` · budowa układu ${(t1 - t0).toFixed(0)} ms`}</span>`;
    }
    return { render() {} };
  });

  // =============================================================== convergence
  SPL.register('convergence', function (el, o) {
    const W = +o.w || 680, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    const pl = SPL.plot(st, { x: 66, y: 14, w: W - 66 - 18, h: H - 14 - 50 },
      { xmin: Math.log10(2), xmax: Math.log10(1300), ymin: -16.6, ymax: 1.6 });
    const f = x => 1 / (1 + 25 * x * x), fp = x => -50 * x / Math.pow(1 + 25 * x * x, 2);
    const show = { equi: true, cheb: true, cl: true, nat: true };
    let data = null;

    const SERIES = [
      { key: 'equi', label: 'wielomian, węzły równoodległe', color: () => C.orange },
      { key: 'cheb', label: 'wielomian, węzły Czebyszewa', color: () => C.purple },
      { key: 'cl', label: 'splajn zupełny (dokładne f′)', color: () => C.blue },
      { key: 'nat', label: 'splajn naturalny', color: () => C.teal, dash: [7, 4] }
    ];
    const ui = SPL.ui.panel(el);
    const short = { equi: 'równoodległe', cheb: 'Czebyszew', cl: 'zupełny', nat: 'naturalny' };
    const cssCol = { equi: 'orange', cheb: 'purple', cl: 'blue', nat: 'teal' };
    SERIES.forEach(s => SPL.ui.toggle(ui, `<span style="color:var(--${cssCol[s.key]})">${short[s.key]}</span>`, true, v => { show[s.key] = v; render(); }));

    function maxErr(fn, n) {
      const M = Math.max(2001, 24 * n + 1);
      let e = 0;
      for (let i = 0; i < M; i++) { const x = -1 + 2 * i / (M - 1); e = Math.max(e, Math.abs(f(x) - fn(x))); }
      return Math.max(e, 1e-16);
    }
    function compute() {
      const out = { equi: [], cheb: [], cl: [], nat: [] };
      for (let n = 2; n <= 52; n += 2) {
        const xs = Sp.linspace(-1, 1, n + 1);
        const w = xs.map((_, j) => (j % 2 ? -1 : 1) * Sp.binom(n, j));
        out.equi.push([n, maxErr(Sp.polyInterp(xs, xs.map(f), w), n)]);
      }
      const chebN = [];
      for (let n = 2; n <= 40; n += 2) chebN.push(n);
      chebN.push(48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256);
      for (const n of chebN) {
        const cn = Sp.chebNodes(n, -1, 1);
        out.cheb.push([n, maxErr(Sp.polyInterp(cn.xs, cn.xs.map(f), cn.w), n)]);
      }
      const ns = [4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128,
        160, 192, 224, 256, 320, 384, 448, 512, 640, 768, 896, 1024];
      for (const n of ns) { // oba warianty: układ trójdiagonalny, O(n)
        const xs = Sp.linspace(-1, 1, n + 1), ys = xs.map(f);
        const s1 = Sp.cubicSpline(xs, ys, 'clamped', { d0: fp(-1), dn: fp(1) }), s2 = Sp.cubicSpline(xs, ys, 'natural');
        out.cl.push([n, maxErr(x => s1.eval(x), n)]);
        out.nat.push([n, maxErr(x => s2.eval(x), n)]);
      }
      return out;
    }
    const sup = s => String(s).replace(/[-0-9]/g, ch => ({ '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' })[ch]);
    const LX = n => Math.log10(n), LY = e => Math.log10(e);

    function axes() {
      const c = st.ctx;
      c.save();
      c.strokeStyle = C.grid; c.lineWidth = 1;
      c.beginPath();
      for (let n = 2; n <= 1024; n *= 2) { const X = Math.round(pl.X(LX(n))) + 0.5; c.moveTo(X, pl.r.y); c.lineTo(X, pl.r.y + pl.r.h); }
      for (let k = -16; k <= 0; k += 2) { const Y = Math.round(pl.Y(k)) + 0.5; c.moveTo(pl.r.x, Y); c.lineTo(pl.r.x + pl.r.w, Y); }
      c.stroke();
      c.strokeStyle = C.faint; c.strokeRect(pl.r.x + 0.5, pl.r.y + 0.5, pl.r.w, pl.r.h);
      c.fillStyle = C.muted; c.font = SPL.font(12.5, 500);
      c.textAlign = 'center'; c.textBaseline = 'top';
      for (let n = 2; n <= 1024; n *= 2) c.fillText(String(n), pl.X(LX(n)), pl.r.y + pl.r.h + 5);
      c.textAlign = 'right'; c.textBaseline = 'middle';
      for (let k = -16; k <= 0; k += 2) c.fillText('10' + sup(k), pl.r.x - 6, pl.Y(k));
      c.font = SPL.font(13.5, 600); c.fillStyle = C.ink;
      c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.fillText('n — liczba przedziałów (skala log.)', pl.r.x + pl.r.w / 2, H - 4);
      c.translate(15, pl.r.y + pl.r.h / 2); c.rotate(-Math.PI / 2);
      c.textBaseline = 'middle';
      c.fillText('max |f − interpolant|', 0, 0);
      c.restore();
    }

    function render() {
      st.clear();
      axes();
      const c = st.ctx;
      if (!data) {
        SPL.text(c, 'liczenie…', pl.r.x + pl.r.w / 2, pl.r.y + pl.r.h / 2, { size: 16, color: C.muted, align: 'center' });
        return;
      }
      // oszacowanie Halla–Meyera: (5/384)·h⁴·‖f⁗‖, h = 2/n, ‖f⁗‖ = f⁗(0) = 15000; nachylenie −2 dla porównania
      const hm = n => 5 / 384 * Math.pow(2 / n, 4) * 15000;
      const at = (arr, n) => arr.find(p => p[0] === n)[1];
      const c2 = at(data.nat, 512) * 2.5 * 512 * 512;
      pl.path([[LX(8), LY(hm(8))], [LX(1300), LY(hm(1300))]], { color: C.faint, width: 1.6, dash: [2, 4] });
      pl.path([[LX(48), LY(c2 / 48 / 48)], [LX(1300), LY(c2 / 1300 / 1300)]], { color: C.faint, width: 1.5, dash: [8, 5] });
      const lbg = SPL.alpha(C.dark ? '#1a1d24' : '#ffffff', 0.85);
      SPL.text(c, 'oszacowanie Halla–Meyera (nachylenie −4)', pl.X(LX(700)), pl.Y(LY(hm(700))) + 30, { size: 13, color: C.muted, align: 'right', weight: 600, bg: lbg });
      SPL.text(c, 'nachylenie −2', pl.X(LX(1000)), pl.Y(LY(c2 / 1000 / 1000)) - 16, { size: 13, color: C.muted, align: 'right', weight: 600, bg: lbg });

      for (const s of SERIES) {
        if (!show[s.key]) continue;
        const pts = data[s.key].map(([n, e]) => [LX(n), LY(e)]);
        pl.path(pts, { color: s.color(), width: 2.6, dash: s.dash });
        pts.forEach(p => { if (p[1] <= pl.ymax) pl.dot(p, { r: 3, fill: s.color(), stroke: C.card, width: 1 }); });
      }
      // legenda w lewym dolnym rogu (tam wykres jest pusty)
      const lx = pl.r.x + 14, ly = pl.r.y + pl.r.h - 14 - 22 * (SERIES.length - 1);
      c.save();
      c.fillStyle = SPL.alpha(C.dark ? '#1a1d24' : '#ffffff', 0.9); c.strokeStyle = C.grid;
      c.beginPath();
      if (c.roundRect) c.roundRect(lx - 8, ly - 16, 268, 22 * SERIES.length + 8, 8); else c.rect(lx - 8, ly - 16, 268, 22 * SERIES.length + 8);
      c.fill(); c.stroke(); c.restore();
      SERIES.forEach((s, i) => {
        const y = ly + i * 22;
        SPL.line(c, [[lx, y - 4], [lx + 22, y - 4]], { color: s.color(), width: 3, dash: s.dash, alpha: show[s.key] ? 1 : 0.3 });
        SPL.text(c, s.label, lx + 30, y + 1, { size: 13.5, color: show[s.key] ? C.ink : C.faint });
      });
      SPL.text(c, 'f(x) = 1/(1+25x²) na [−1, 1]', pl.r.x + pl.r.w - 10, pl.r.y + 20, { size: 13.5, color: C.muted, align: 'right', weight: 600 });
    }

    function ensure() {
      if (data) return;
      data = compute();
      render();
    }
    if (SPL.print) data = compute();
    else setTimeout(ensure, 400);
    return { render, activate: ensure };
  });
})();
