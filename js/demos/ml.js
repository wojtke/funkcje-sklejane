/* ml.js — dema: smoothing (splajn wygładzający), relu (sieć ReLU = splajn liniowy),
 * kan (jedna krawędź sieci KAN: B-splajn z uczonymi współczynnikami). */
(function () {
  'use strict';
  const Sp = window.Splines;
  const C = SPL.c;

  // ------------------------------------------------------------------ pomocnicze
  /** Deterministyczny generator liczb losowych (mulberry32). */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); }

  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  /** Liczba do tekstu na płótnie: 0.0123 → „0.0123”, 1.2e-5 → „1.2·10⁻⁵”. */
  function sci(v, d = 2) {
    if (!isFinite(v)) return '∞';
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 1e-2 && a < 1e4) return v.toPrecision(d + 1).replace(/\.?0+$/, m => (m.startsWith('.') ? '' : m)).replace('-', '−');
    const [m, e] = v.toExponential(d - 1).split('e');
    const ex = String(+e).split('').map(ch => SUP[ch] || '').join('');
    return (m === '1' ? '' : m.replace('-', '−') + '·') + '10' + ex;
  }

  /** Legenda w ramce. items: [{color, label, dash, width, dot}] ; align 'right' liczy x od prawej krawędzi. */
  function legend(c, x, y, items, align = 'right') {
    c.save();
    c.font = SPL.font(14, 500);
    const w = Math.max(...items.map(it => c.measureText(it.label).width)) + 50, h = items.length * 22 + 12;
    const x0 = align === 'right' ? x - w : x;
    c.fillStyle = SPL.alpha(C.card, 0.9); c.strokeStyle = C.grid; c.lineWidth = 1;
    c.beginPath();
    if (c.roundRect) c.roundRect(x0, y, w, h, 8); else c.rect(x0, y, w, h);
    c.fill(); c.stroke();
    items.forEach((it, i) => {
      const yy = y + 17 + i * 22;
      if (it.dot) SPL.dot(c, x0 + 22, yy, { r: 4, fill: it.color });
      else SPL.line(c, [[x0 + 10, yy], [x0 + 34, yy]], { color: it.color, width: it.width || 3, dash: it.dash });
      SPL.text(c, it.label, x0 + 42, yy + 5, { size: 14, color: C.ink });
    });
    c.restore();
  }
  /** Wiersz informacji (lewy górny róg wykresu) na półprzezroczystym tle. */
  function info(c, x, y, str) {
    c.save();
    c.font = SPL.font(15, 600);
    const w = c.measureText(str).width + 16;
    c.fillStyle = SPL.alpha(C.card, 0.88);
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, 26, 7); else c.rect(x, y, w, 26);
    c.fill();
    c.fillStyle = C.ink; c.textBaseline = 'middle';
    c.fillText(str, x + 8, y + 13.5);
    c.restore();
  }

  // węższe suwaki w tych demach, aby kontrolki mieściły się w jednym wierszu
  const css = document.createElement('style');
  css.textContent = '.ml-ctrls input[type=range]{width:130px}.ml-ctrls .btn{padding:5px 10px}';
  document.head.appendChild(css);

  // ================================================================= smoothing
  SPL.register('smoothing', function (el, o) {
    const W = +o.w || 736, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    const pl = SPL.plot(st, { x: 40, y: 12, w: W - 52, h: H - 36 }, { xmin: -0.03, xmax: 1.03, ymin: -2.1, ymax: 2.4 });
    const f = x => 0.9 * Math.sin(2 * Math.PI * x) + 0.35 * Math.cos(5 * Math.PI * x);
    const n = 40, sigma = 0.22, LMIN = -9, LMAX = 0;
    let seed = 3, xs, ys, moved, logLam = -4, fit, rss, ols;

    function genData() {
      const rnd = mulberry32(seed * 7919 + 17);
      xs = []; ys = [];
      for (let i = 0; i < n; i++) xs.push((i + 0.1 + 0.8 * rnd()) / n); // losowo, ale bez zbijania się punktów
      for (let i = 0; i < n; i++) ys.push(f(xs[i]) + sigma * gauss(rnd));
      moved = new Array(n).fill(false);
    }
    function refit() {
      fit = Sp.smoothingSpline(xs, ys, Math.pow(10, logLam), true);
      rss = 0;
      for (let i = 0; i < n; i++) rss += (ys[i] - fit.fitted[i]) ** 2;
      // prosta MNK (granica λ → ∞)
      const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
      let sxy = 0, sxx = 0;
      for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
      const b1 = sxy / sxx; ols = x => my + b1 * (x - mx);
    }
    /** Uogólniona walidacja krzyżowa: GCV(λ) = n·RSS / (n − df)². Siatka + złoty podział. */
    function gcvLogLam() {
      const g = ll => {
        const s = Sp.smoothingSpline(xs, ys, Math.pow(10, ll), true);
        let r = 0;
        for (let i = 0; i < n; i++) r += (ys[i] - s.fitted[i]) ** 2;
        return n * r / Math.pow(n - s.df, 2);
      };
      let best = LMIN + 1, bv = Infinity;
      for (let ll = LMIN + 1; ll <= LMAX; ll += 0.25) { const v = g(ll); if (v < bv) { bv = v; best = ll; } }
      let a = Math.max(LMIN, best - 0.25), b = Math.min(LMAX, best + 0.25);
      const phi = (Math.sqrt(5) - 1) / 2;
      let x1 = b - phi * (b - a), x2 = a + phi * (b - a), f1 = g(x1), f2 = g(x2);
      for (let it = 0; it < 30; it++) {
        if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - phi * (b - a); f1 = g(x1); }
        else { a = x1; x1 = x2; f1 = f2; x2 = a + phi * (b - a); f2 = g(x2); }
      }
      return (a + b) / 2;
    }

    const ui = SPL.ui.panel(el, 'ml-ctrls');
    const sl = SPL.ui.slider(ui, {
      label: 'λ', min: LMIN, max: LMAX, step: 0.05, value: logLam,
      fmt: v => SPL.fmt(Math.pow(10, v), 2),
      onInput: v => { logLam = v; refit(); render(); }
    });
    const snap = v => Math.round(v * 20) / 20; // krok suwaka 0.05
    const setLam = v => { logLam = snap(v); sl.set(logLam); refit(); render(); };
    SPL.ui.button(ui, 'interpolacja', () => setLam(LMIN));
    SPL.ui.button(ui, 'λ z GCV', () => setLam(gcvLogLam()), 'primary');
    SPL.ui.button(ui, 'prosta', () => setLam(LMAX));
    SPL.ui.button(ui, 'nowe dane', () => { seed++; genData(); refit(); render(); });

    let hover = -1;
    function render() {
      st.clear();
      const c = st.ctx;
      pl.grid({ dx: 0.1, dy: 0.5, labels: true });
      pl.fn(f, { color: C.faint, width: 2.5, dash: [7, 6] });
      pl.fn(ols, { color: C.green, width: 1.8, dash: [2, 5], alpha: 0.9 });
      // reszty
      pl.clip(cc => {
        cc.save(); cc.strokeStyle = SPL.alpha(C.red, 0.45); cc.lineWidth = 1.2;
        cc.beginPath();
        for (let i = 0; i < n; i++) { cc.moveTo(pl.X(xs[i]), pl.Y(ys[i])); cc.lineTo(pl.X(xs[i]), pl.Y(fit.fitted[i])); }
        cc.stroke(); cc.restore();
      });
      pl.fn(x => fit.eval(x), { color: C.blue, width: 3.5 }, xs[0], xs[n - 1], 700);
      for (let i = 0; i < n; i++) pl.dot([xs[i], ys[i]], { r: 4.5, fill: moved[i] ? C.orange : C.ink, active: hover === i });

      let mode = '';
      if (logLam <= LMIN + 0.3) mode = '  ≈ interpolacja';
      else if (logLam >= LMAX - 0.3) mode = '  ≈ regresja liniowa';
      info(c, pl.r.x + 8, pl.r.y + 6, `λ = ${sci(Math.pow(10, logLam))}   ·   df = tr Sλ = ${fit.df.toFixed(1)}   ·   RSS = ${rss.toFixed(2)}${mode}`);
      legend(c, pl.r.x + 8, pl.r.y + pl.r.h - 112, [
        { color: C.faint, label: 'prawdziwa f', dash: [7, 6], width: 2.5 },
        { color: C.ink, label: 'dane (przeciągnij)', dot: true },
        { color: C.blue, label: 'splajn wygładzający', width: 3.5 },
        { color: C.green, label: 'prosta MNK (λ → ∞)', dash: [2, 5], width: 2 }
      ], 'left');
    }

    SPL.drag(st, {
      radius: 12,
      points: () => xs.map((x, i) => pl.P([x, ys[i]])),
      move(i, q) { ys[i] = Sp.clamp(pl.iy(q[1]), pl.ymin + 0.05, pl.ymax - 0.05); moved[i] = true; refit(); render(); },
      hover(i) { hover = i; render(); }
    });

    genData();
    logLam = snap(gcvLogLam());
    sl.set(logLam);
    refit();
    return { render };
  });

  // ====================================================================== relu
  SPL.register('relu', function (el, o) {
    const W = +o.w || 736, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    const pl = SPL.plot(st, { x: 40, y: 12, w: W - 52, h: H - 36 }, { xmin: -1.08, xmax: 1.08, ymin: -1.3, ymax: 1.45 });
    const targets = {
      sin: x => 0.85 * Math.sin(1.5 * Math.PI * x),
      step: x => 0.65 * Math.tanh(14 * x),
      zig: x => { const u = 1.5 * x; return 0.75 * (4 * Math.abs(u - Math.round(u)) - 1); } // załamania w k/3
    };
    const N = 60, LR = 0.01, B1 = 0.9, B2 = 0.999, MAXSTEP = 20000;
    let tname = 'zig', Hn = 12, seed = 1;
    let X, Y, w, b, v, c, mom, sec, mc, vc, step, mse, playing = false;
    let gw, gb, gv, act;

    function makeData() {
      const r = mulberry32(12345);
      X = new Float64Array(N); Y = new Float64Array(N);
      for (let i = 0; i < N; i++) { X[i] = -1 + 2 * (i + 0.2 + 0.6 * r()) / N; Y[i] = targets[tname](X[i]); }
    }
    function initNet() {
      const r = mulberry32(seed * 101 + Hn);
      w = new Float64Array(Hn); b = new Float64Array(Hn); v = new Float64Array(Hn); c = 0;
      for (let j = 0; j < Hn; j++) {
        const t = -1 + 2 * (j + r()) / Hn;               // węzeł startowy t_j ~ U(−1, 1) (warstwowo)
        w[j] = (r() < 0.5 ? -1 : 1) * (0.8 + 0.4 * r());
        b[j] = -w[j] * t;
        v[j] = 0.1 * gauss(r);
      }
      mom = [w, b, v].map(() => new Float64Array(Hn));
      sec = [w, b, v].map(() => new Float64Array(Hn));
      gw = new Float64Array(Hn); gb = new Float64Array(Hn); gv = new Float64Array(Hn); act = new Float64Array(Hn);
      mc = 0; vc = 0; step = 0; mse = lossNow();
    }
    function net(x) {
      let out = c;
      for (let j = 0; j < Hn; j++) { const z = w[j] * x + b[j]; if (z > 0) out += v[j] * z; }
      return out;
    }
    function lossNow() { let s = 0; for (let i = 0; i < N; i++) s += (net(X[i]) - Y[i]) ** 2; return s / N; }

    /** Jeden krok Adama na pełnym zbiorze (MSE). */
    function trainStep() {
      gw.fill(0); gb.fill(0); gv.fill(0);
      let gc = 0, loss = 0;
      for (let s = 0; s < N; s++) {
        const x = X[s];
        let out = c;
        for (let j = 0; j < Hn; j++) { const z = w[j] * x + b[j]; act[j] = z > 0 ? z : 0; out += v[j] * act[j]; }
        const e = out - Y[s], g = 2 * e / N;
        loss += e * e; gc += g;
        for (let j = 0; j < Hn; j++) if (act[j] > 0) { gv[j] += g * act[j]; gw[j] += g * v[j] * x; gb[j] += g * v[j]; }
      }
      step++;
      const bc1 = 1 - Math.pow(B1, step), bc2 = 1 - Math.pow(B2, step);
      const P = [w, b, v], G = [gw, gb, gv];
      for (let p = 0; p < 3; p++) {
        const th = P[p], gr = G[p], m1 = mom[p], m2 = sec[p];
        for (let j = 0; j < Hn; j++) {
          m1[j] = B1 * m1[j] + (1 - B1) * gr[j];
          m2[j] = B2 * m2[j] + (1 - B2) * gr[j] * gr[j];
          th[j] -= LR * (m1[j] / bc1) / (Math.sqrt(m2[j] / bc2) + 1e-8);
        }
      }
      mc = B1 * mc + (1 - B1) * gc; vc = B2 * vc + (1 - B2) * gc * gc;
      c -= LR * (mc / bc1) / (Math.sqrt(vc / bc2) + 1e-8);
      mse = loss / N;
    }

    /** Węzły t_j = −b_j/w_j w przedziale (−1, 1) i skoki nachylenia δ_j = v_j·|w_j|. */
    function knots() {
      const out = [];
      for (let j = 0; j < Hn; j++) {
        if (Math.abs(w[j]) < 1e-9) continue;
        const t = -b[j] / w[j];
        if (t > pl.xmin && t < pl.xmax) out.push({ t, d: v[j] * Math.abs(w[j]) });
      }
      return out;
    }
    function pieces(ks) {
      const dmax = Math.max(1e-9, ...ks.map(k => Math.abs(k.d)));
      const ts = ks.filter(k => k.t > -1 && k.t < 1 && Math.abs(k.d) > Math.max(1e-3, 0.01 * dmax)).map(k => k.t).sort((p, q) => p - q);
      let cnt = 0, last = -Infinity;
      for (const t of ts) { if (t - last > 2e-3) cnt++; last = t; }
      return cnt + 1;
    }

    const ui = SPL.ui.panel(el, 'ml-ctrls');
    SPL.ui.segmented(ui, [{ value: 'sin', label: 'sinus' }, { value: 'step', label: 'schodek' }, { value: 'zig', label: 'zygzak' }], tname,
      val => { tname = val; makeData(); initNet(); render(); }, 'cel');
    SPL.ui.slider(ui, { label: 'H', min: 2, max: 32, step: 1, value: Hn, fmt: v2 => String(v2), onInput: v2 => { Hn = v2; initNet(); render(); } });
    const playBtn = SPL.ui.button(ui, '▶ Trenuj', () => setPlaying(!playing), 'primary');
    SPL.ui.button(ui, 'reset', () => { seed++; initNet(); render(); });

    const loop = SPL.loop(() => {
      if (!playing) return false;
      // wolniej na początku, żeby było widać wędrówkę węzłów
      const k = step < 400 ? 2 : step < 1500 ? 5 : 20;
      for (let i = 0; i < k; i++) trainStep();
      if (step >= MAXSTEP) setPlaying(false);
      render();
    });
    function setPlaying(p) {
      playing = p;
      playBtn.innerHTML = p ? '❚❚ Pauza' : '▶ Trenuj';
      if (p) loop.start(); else loop.stop();
    }

    function render() {
      st.clear();
      const cx = st.ctx;
      pl.grid({ dx: 0.25, dy: 0.5, labels: true });
      const ks = knots();
      const dmax = Math.max(1e-9, ...ks.map(k => Math.abs(k.d)));
      // węzły: pionowe linie
      pl.clip(cc => {
        cc.save(); cc.setLineDash([4, 5]); cc.lineWidth = 1.5;
        for (const k of ks) {
          cc.strokeStyle = SPL.alpha(C.orange, 0.12 + 0.68 * Math.abs(k.d) / dmax);
          cc.beginPath(); cc.moveTo(pl.X(k.t), pl.r.y); cc.lineTo(pl.X(k.t), pl.r.y + pl.r.h); cc.stroke();
        }
        cc.restore();
      });
      pl.fn(targets[tname], { color: C.faint, width: 2.5, dash: [7, 6] }, -1, 1, 600);
      for (let i = 0; i < N; i++) pl.dot([X[i], Y[i]], { r: 2.8, fill: C.muted, stroke: C.card, width: 1 });
      // wyjście sieci: dokładna łamana (wartości w węzłach + gęsta siatka)
      const xsP = [];
      for (let i = 0; i <= 400; i++) xsP.push(pl.xmin + (pl.xmax - pl.xmin) * i / 400);
      ks.forEach(k => xsP.push(k.t));
      xsP.sort((p, q) => p - q);
      pl.path(xsP.map(x => [x, net(x)]), { color: C.blue, width: 3.5 });
      // znaczniki węzłów na krzywej
      for (const k of ks) {
        const a = 0.25 + 0.75 * Math.abs(k.d) / dmax;
        const X0 = pl.X(k.t), Y0 = pl.Y(net(k.t));
        if (Y0 < pl.r.y || Y0 > pl.r.y + pl.r.h) continue;
        cx.save(); cx.globalAlpha = a;
        SPL.dot(cx, X0, Y0, { r: 5, fill: C.orange });
        cx.restore();
        // trójkąt na dolnej krawędzi — „węzeł” na osi
        cx.save(); cx.globalAlpha = a; cx.fillStyle = C.orange;
        const yb = pl.r.y + pl.r.h;
        cx.beginPath(); cx.moveTo(X0, yb - 9); cx.lineTo(X0 - 6, yb); cx.lineTo(X0 + 6, yb); cx.closePath(); cx.fill();
        cx.restore();
      }
      info(cx, pl.r.x + 8, pl.r.y + 6, `krok ${step}   ·   MSE = ${sci(mse)}   ·   kawałków liniowych: ${pieces(ks)}`);
      legend(cx, pl.r.x + pl.r.w - 8, pl.r.y + 6, [
        { color: C.faint, label: 'funkcja docelowa', dash: [7, 6], width: 2.5 },
        { color: C.blue, label: `sieć ReLU (H = ${Hn})`, width: 3.5 },
        { color: C.orange, label: 'węzły  t = −b / w', dash: [4, 5], width: 2 }
      ]);
    }

    makeData();
    initNet();
    if (SPL.print) { for (let i = 0; i < 3000; i++) trainStep(); }
    return {
      render,
      activate() { if (playing) loop.start(); },
      deactivate() { setPlaying(false); }
    };
  });

  // ======================================================================= kan
  SPL.register('kan', function (el, o) {
    const W = +o.w || 680, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    const k = 3, G0 = 5, GMAX = 40;
    const stripH = 82;
    const pl = SPL.plot(st, { x: 40, y: 12, w: W - 52, h: H - 36 - stripH - 14 }, { xmin: -1.55, xmax: 1.55, ymin: -1.6, ymax: 1.6 });
    const pb = SPL.plot(st, { x: 40, y: H - 24 - stripH, w: W - 52, h: stripH }, { xmin: -1.55, xmax: 1.55, ymin: 0, ymax: 1.08 });
    const silu = x => x / (1 + Math.exp(-x));
    const shape = x => 0.85 * Math.sin(2.3 * x) + 0.4 * Math.cos(4.2 * x) - 0.15;
    let t, cf, G, seed = 1, withSilu = false, lastDelta = null;
    let anim = 1, old = null, t0 = 0; // przejście po zagęszczeniu siatki (0 → 1 w 0.9 s)

    /** Siatka jak w KAN: G przedziałów na [−1,1] + k węzłów dodatkowych z każdej strony. */
    function grid(Gn) { const h = 2 / Gn; return Array.from({ length: Gn + 2 * k + 1 }, (_, i) => -1 + (i - k) * h); }
    function reset() { G = G0; t = grid(G); cf = Sp.greville(t, k).map(shape); lastDelta = null; old = null; anim = 1; }
    function randomize() {
      const r = mulberry32(seed++ * 31 + 7);
      cf = cf.map(() => -1.1 + 2.2 * r());
      lastDelta = null; old = null; anim = 1;
    }
    const spl = x => Sp.bsplineEval(cf, t, k, x);
    const phi = x => spl(x) + (withSilu ? silu(x) : 0);

    function refine() {
      if (G >= GMAX) return;
      const before = Sp.linspace(-1, 1, 801).map(spl);
      old = { xi: Sp.greville(t, k), c: cf.slice() };
      const h = 2 / G;
      for (let j = 0; j < G; j++) { const r = Sp.insertKnot(cf, t, k, -1 + (j + 0.5) * h); cf = r.c; t = r.t; }
      G *= 2;
      const after = Sp.linspace(-1, 1, 801).map(spl);
      lastDelta = Math.max(...before.map((y, i) => Math.abs(y - after[i])));
      t0 = performance.now();
      anim = SPL.print ? 1 : 0;
      if (!SPL.print) loop.start();
    }

    const ui = SPL.ui.panel(el, 'ml-ctrls');
    const refBtn = SPL.ui.button(ui, 'zagęść siatkę (G → 2G)', () => { refine(); render(); }, 'primary');
    SPL.ui.button(ui, 'losuj', () => { randomize(); render(); });
    SPL.ui.button(ui, 'reset', () => { reset(); render(); });
    SPL.ui.toggle(ui, '+ silu(x)', false, val => { withSilu = val; render(); });
    const delta = SPL.ui.readout(ui, 'zmiana φ');

    const loop = SPL.loop(() => { render(); return anim < 1; });

    let hover = -1;
    function render() {
      if (anim < 1) anim = Math.min(1, (performance.now() - t0) / 900);
      st.clear();
      const c = st.ctx;
      const xi = Sp.greville(t, k);
      // dziedzina [−1, 1]
      c.save(); c.fillStyle = SPL.alpha(C.blue, C.dark ? 0.07 : 0.045);
      c.fillRect(pl.X(-1), pl.r.y, pl.X(1) - pl.X(-1), pl.r.h);
      c.fillRect(pb.X(-1), pb.r.y, pb.X(1) - pb.X(-1), pb.r.h);
      c.restore();
      pl.grid({ dx: 0.5, dy: 0.5, labels: true });

      // znaczniki węzłów siatki
      c.save();
      for (const tk of t) {
        if (tk < pl.xmin || tk > pl.xmax) continue;
        const inside = tk >= -1 - 1e-9 && tk <= 1 + 1e-9;
        c.strokeStyle = inside ? C.ink : C.faint; c.lineWidth = inside ? 1.6 : 1.2;
        const X0 = pl.X(tk);
        c.beginPath(); c.moveTo(X0, pl.r.y + pl.r.h - 8); c.lineTo(X0, pl.r.y + pl.r.h); c.stroke();
        c.beginPath(); c.moveTo(X0, pb.r.y + pb.r.h); c.lineTo(X0, pb.r.y + pb.r.h + 6); c.stroke();
      }
      c.restore();

      // pas z funkcjami bazowymi B_i
      const nb = cf.length;
      for (let i = 0; i < nb; i++) {
        const col = C.palette[i % C.palette.length];
        const a = t[i], bnd = t[i + k + 1];
        pb.fn(x => Sp.basisAll(t, k, x)[i], { color: col, width: 1.6, alpha: 0.75 }, Math.max(a, pb.xmin), Math.min(bnd, pb.xmax), 90);
      }
      pb.path([[-1, 1], [1, 1]], { color: C.faint, width: 1, dash: [3, 4] });
      SPL.text(c, 'Bᵢ(x)', pb.r.x + 6, pb.r.y + 14, { size: 13, color: C.muted, weight: 600 });
      SPL.text(c, 'Σ Bᵢ = 1', pb.X(1) - 6, pb.Y(1) - 4, { size: 12, color: C.faint, align: 'right' });

      // stary wielobok kontrolny (zanika po zagęszczeniu)
      if (old && anim < 1) {
        const pts = old.xi.map((x, i) => [x, old.c[i]]);
        pl.path(pts, { color: C.faint, width: 1.4, alpha: 1 - anim });
        c.save(); c.globalAlpha = 1 - anim;
        pts.forEach(p => pl.dot(p, { r: 5, hollow: true, fill: C.faint }));
        c.restore();
      }
      // funkcja: poza [−1,1] blado (tam Σ B_i ≠ 1)
      pl.fn(phi, { color: C.purple, width: 2, alpha: 0.35, dash: [5, 5] }, pl.xmin, -1, 120);
      pl.fn(phi, { color: C.purple, width: 2, alpha: 0.35, dash: [5, 5] }, 1, pl.xmax, 120);
      if (withSilu) {
        pl.fn(silu, { color: C.green, width: 1.6, dash: [2, 4] }, -1, 1);
        pl.fn(spl, { color: C.purple, width: 1.6, dash: [6, 4], alpha: 0.7 }, -1, 1);
      }
      // nowy wielobok kontrolny (pod krzywą), krzywa, współczynniki
      const a2 = old ? anim : 1;
      const pts = xi.map((x, i) => [x, cf[i]]);
      pl.path(pts, { color: C.blue, width: 1.3, alpha: 0.6 * a2 });
      pl.fn(phi, { color: C.purple, width: 4 }, -1, 1, 500);
      c.save(); c.globalAlpha = a2;
      pts.forEach((p, i) => pl.dot(p, { r: 6 * (0.6 + 0.4 * a2), fill: C.blue, active: hover === i }));
      c.restore();

      const formula = withSilu ? 'φ(x) = silu(x) + Σ cᵢ Bᵢ(x)' : 'φ(x) = Σ cᵢ Bᵢ(x)';
      info(c, pl.r.x + 8, pl.r.y + 6, `${formula}   ·   G = ${G}   ·   współczynników: ${nb}`);
      delta.set(lastDelta == null ? '—' : SPL.fmt(lastDelta, 2));
      refBtn.disabled = G >= GMAX;
      refBtn.style.opacity = G >= GMAX ? 0.5 : 1;
    }

    SPL.drag(st, {
      radius: 13,
      points: () => Sp.greville(t, k).map((x, i) => pl.P([x, cf[i]])),
      move(i, q) { cf[i] = Sp.clamp(pl.iy(q[1]), pl.ymin + 0.05, pl.ymax - 0.05); lastDelta = null; render(); },
      hover(i) { hover = i; render(); }
    });

    reset();
    return { render, deactivate() { if (anim < 1) { anim = 1; loop.stop(); } } };
  });
})();
