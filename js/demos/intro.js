/* intro.js — dema: hero (tło tytułu), ducks (listwa i kaczki), runge, pieces, reticulate. */
(function () {
  'use strict';
  const Sp = window.Splines;
  const C = SPL.c;

  // ====================================================================== hero
  SPL.register('hero', function (el, o) {
    const W = +o.w || 1280, H = +o.h || 720;
    const st = SPL.stage(el, W, H);
    const N = 11, k = 3;
    const base = [], phase = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), x = -80 + u * (W + 160);
      const v = Sp.clamp((u - 0.5) / 0.5, 0, 1), s = v * v * (3 - 2 * v);
      base.push([x, 640 - s * 440 + (i % 2 ? -22 : 18) * (1 - 0.5 * s)]);
      phase.push(i * 1.7);
    }
    const P = base.map(p => p.slice());
    const pinned = new Array(N).fill(false);
    const knots = Sp.uniformKnots(N, k, 0, 1);
    let time = 0;

    function curve(Q, steps = 260) {
      const pts = [], a = knots[k], b = knots[N];
      for (let j = 0; j <= steps; j++) pts.push(Sp.deBoor(Q, knots, k, a + (b - a) * j / steps - (j === steps ? 1e-9 : 0)));
      return pts;
    }
    function update(t) {
      for (let i = 0; i < N; i++) {
        if (pinned[i]) continue;
        P[i][0] = base[i][0] + 10 * Math.sin(0.5 * t + phase[i]);
        P[i][1] = base[i][1] + 18 * Math.sin(0.7 * t + phase[i] * 1.3);
      }
    }
    function render() {
      st.clear();
      const c = st.ctx;
      // echa krzywej
      for (let e = 3; e >= 1; e--) {
        const Q = P.map((p, i) => [p[0], p[1] + e * 16 * Math.sin(0.4 * time + i * 0.6 + e)]);
        SPL.line(c, curve(Q), { color: C.palette[e], width: 2, alpha: 0.18 + 0.06 * (3 - e) });
      }
      SPL.line(c, P, { color: C.faint, width: 1.2, dash: [5, 6], alpha: 0.8 });
      SPL.line(c, curve(P), { color: C.blue, width: 4 });
      P.forEach((p, i) => SPL.dot(c, p[0], p[1], { r: 6, hollow: true, fill: pinned[i] ? C.orange : C.blue, active: drag.hover === i }));
    }
    const drag = SPL.drag(st, {
      points: () => P,
      move(i, q) { pinned[i] = true; P[i][0] = q[0]; P[i][1] = Sp.clamp(q[1], 10, H - 10); render(); },
      dbl(i) { if (i >= 0) { pinned[i] = false; render(); } },
      hover: () => render()
    });
    const loop = SPL.loop(dt => { time += dt; update(time); render(); });
    update(0);
    return { render, activate: () => loop.start(), deactivate: () => loop.stop() };
  });

  // ===================================================================== ducks
  SPL.register('ducks', function (el, o) {
    const W = +o.w || 736, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    const init = [[90, 300], [225, 196], [372, 262], [520, 168], [650, 236]];
    let D = init.map(p => p.slice());
    let comb = false;
    const ui = SPL.ui.panel(el);
    SPL.ui.toggle(ui, 'grzebień krzywizny', false, v => { comb = v; render(); });
    SPL.ui.button(ui, 'reset', () => { D = init.map(p => p.slice()); render(); });
    const energyOut = SPL.ui.readout(ui, 'energia zginania ∫κ² ds');
    SPL.ui.hint(ui, 'przeciągnij kaczkę · dwuklik: dodaj / usuń');

    function sample() {
      const sp = Sp.paramSpline(D, 'natural', 1);
      const pts = [], kap = [], nrm = [];
      const steps = 400;
      for (let j = 0; j <= steps; j++) {
        const u = sp.umin + (sp.umax - sp.umin) * j / steps;
        const p = sp.at(u), d = sp.d1(u), L = Math.hypot(d[0], d[1]) || 1;
        pts.push(p); kap.push(sp.curvature(u)); nrm.push([-d[1] / L, d[0] / L]);
      }
      return { sp, pts, kap, nrm };
    }

    function drawDuck(c, p, n, tan) {
      // ciało po stronie normalnej skierowanej „do góry” ekranu
      let nx = n[0], ny = n[1];
      if (ny > 0) { nx = -nx; ny = -ny; }
      const bx = p[0] + nx * 30, by = p[1] + ny * 30;
      const ang = Math.atan2(tan[1], tan[0]);
      c.save();
      c.translate(bx, by);
      c.rotate(ang);
      const lead = C.dark ? '#7d8594' : '#4f5664';
      c.fillStyle = lead; c.strokeStyle = C.dark ? '#aab1bd' : '#2c313a'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(0, 0, 22, 11, 0, 0, 2 * Math.PI); c.fill(); c.stroke();
      c.beginPath(); c.arc(17, -8, 7, 0, 2 * Math.PI); c.fill(); c.stroke();
      c.fillStyle = C.dark ? '#c9ced8' : '#e9ecf1';
      c.beginPath(); c.arc(19, -10, 1.8, 0, 2 * Math.PI); c.fill();
      c.restore();
      // „dziób” dociskający listwę
      c.save();
      c.strokeStyle = C.dark ? '#aab1bd' : '#2c313a'; c.lineWidth = 2.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(bx - nx * 8, by - ny * 8); c.lineTo(p[0] + nx * 6, p[1] + ny * 6); c.stroke();
      c.restore();
      SPL.dot(c, p[0], p[1], { r: 4, fill: C.orange });
    }

    function render() {
      st.clear();
      const c = st.ctx;
      // papier milimetrowy
      c.save();
      c.strokeStyle = C.grid; c.lineWidth = 1;
      c.beginPath();
      for (let x = 0.5; x < W; x += 20) { c.moveTo(x, 0); c.lineTo(x, H); }
      for (let y = 0.5; y < H; y += 20) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke();
      c.restore();

      const S = sample();
      // przedłużenia proste za skrajnymi kaczkami (s'' = 0 ⇒ listwa prosta)
      const t0 = S.sp.d1(S.sp.umin), t1 = S.sp.d1(S.sp.umax);
      const L0 = Math.hypot(t0[0], t0[1]) || 1, L1 = Math.hypot(t1[0], t1[1]) || 1;
      const ext = 70;
      const pre = [S.pts[0][0] - t0[0] / L0 * ext, S.pts[0][1] - t0[1] / L0 * ext];
      const post = [S.pts[S.pts.length - 1][0] + t1[0] / L1 * ext, S.pts[S.pts.length - 1][1] + t1[1] / L1 * ext];
      const strip = [pre].concat(S.pts, [post]);

      if (comb) {
        c.save();
        c.strokeStyle = SPL.alpha(C.purple, 0.55); c.lineWidth = 1;
        const scale = 1800, tips = [];
        c.beginPath();
        for (let j = 0; j < S.pts.length; j += 4) {
          const p = S.pts[j], n = S.nrm[j], kk = S.kap[j];
          const q = [p[0] - n[0] * kk * scale, p[1] - n[1] * kk * scale];
          c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); tips.push(q);
        }
        c.stroke();
        c.restore();
        SPL.line(c, tips, { color: C.purple, width: 1.5 });
      }

      const wood = C.dark ? '#c8964f' : '#e3b46a', edge = C.dark ? '#7a5426' : '#8a5a22';
      SPL.line(c, strip, { color: edge, width: 13 });
      SPL.line(c, strip, { color: wood, width: 9 });
      SPL.line(c, strip, { color: SPL.alpha('#ffffff', C.dark ? 0.15 : 0.35), width: 2 });

      // kaczki: normalna i styczna w punktach węzłowych
      D.forEach((p, i) => {
        const u = S.sp.u[i], d = S.sp.d1(u), L = Math.hypot(d[0], d[1]) || 1;
        drawDuck(c, p, [-d[1] / L, d[0] / L], [d[0] / L, d[1] / L]);
      });

      // energia ∫κ² ds (numerycznie)
      let E = 0;
      for (let j = 1; j < S.pts.length; j++) {
        const ds = Math.hypot(S.pts[j][0] - S.pts[j - 1][0], S.pts[j][1] - S.pts[j - 1][1]);
        E += 0.5 * (S.kap[j] ** 2 + S.kap[j - 1] ** 2) * ds;
      }
      energyOut.set((E * 1000).toFixed(2) + ' <span class="faint">(×10⁻³ px⁻¹)</span>');
      SPL.text(c, 'model: naturalna sześcienna funkcja sklejana (parametryczna)', 12, H - 12, { size: 12, color: C.faint });
    }

    SPL.drag(st, {
      radius: 22,
      points: () => D,
      move(i, q) { D[i] = [Sp.clamp(q[0], 10, W - 10), Sp.clamp(q[1], 40, H - 20)]; render(); },
      dbl(i, q) {
        if (i >= 0) { if (D.length > 3) { D.splice(i, 1); render(); } return; }
        // wstaw w najbliższym miejscu wzdłuż łamanej kaczek
        let best = 0, bd = Infinity;
        for (let j = 0; j < D.length - 1; j++) {
          const a = D[j], b = D[j + 1], ab = [b[0] - a[0], b[1] - a[1]];
          const t = Sp.clamp(((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2), 0, 1);
          const d = Sp.dist(q, [a[0] + t * ab[0], a[1] + t * ab[1]]);
          if (d < bd) { bd = d; best = j; }
        }
        if (Sp.dist(q, D[0]) < bd && q[0] < D[0][0]) { D.unshift(q); render(); return; }
        if (Sp.dist(q, D[D.length - 1]) < bd && q[0] > D[D.length - 1][0]) { D.push(q); render(); return; }
        D.splice(best + 1, 0, q); render();
      }
    });
    return { render };
  });

  // ===================================================================== runge
  SPL.register('runge', function (el, o) {
    const W = +o.w || 736, H = +o.h || 440;
    const st = SPL.stage(el, W, H);
    const pl = SPL.plot(st, { x: 44, y: 16, w: W - 60, h: H - 46 }, { xmin: -1.08, xmax: 1.08, ymin: -0.7, ymax: 1.7 });
    const f = x => 1 / (1 + 25 * x * x);
    let n = 10, cheb = false;
    const ui = SPL.ui.panel(el);
    SPL.ui.slider(ui, { label: 'n', min: 2, max: 30, step: 1, value: n, fmt: v => String(v), onInput: v => { n = v; render(); } });
    SPL.ui.toggle(ui, 'węzły Czebyszewa', false, v => { cheb = v; render(); });
    const eP = SPL.ui.readout(ui, '<span style="color:var(--orange)">max|f − pₙ|</span>');
    const eS = SPL.ui.readout(ui, '<span style="color:var(--blue)">max|f − s|</span>');

    function render() {
      st.clear();
      pl.grid({ dx: 0.25, dy: 0.5, labels: true });
      let xs, w;
      if (cheb) { const cn = Sp.chebNodes(n, -1, 1); xs = cn.xs; w = cn.w; }
      else { xs = Sp.linspace(-1, 1, n + 1); w = null; }
      const ys = xs.map(f);
      const p = Sp.polyInterp(xs, ys, w);
      const s = Sp.cubicSpline(xs, ys, n >= 3 ? 'notaknot' : 'natural');
      pl.fn(f, { color: C.faint, width: 5, alpha: 0.6 });
      pl.fn(p, { color: C.orange, width: 2.5 }, -1, 1, 1200);
      pl.fn(x => s.eval(x), { color: C.blue, width: 2.5 }, -1, 1);
      xs.forEach((x, i) => pl.dot([x, ys[i]], { r: 4.5, fill: C.ink }));
      let mp = 0, ms = 0;
      for (let i = 0; i <= 2000; i++) {
        const x = -1 + 2 * i / 2000, fx = f(x);
        mp = Math.max(mp, Math.abs(fx - p(x))); ms = Math.max(ms, Math.abs(fx - s.eval(x)));
      }
      eP.set(SPL.fmt(mp)); eS.set(SPL.fmt(ms));
      // legenda
      const c = st.ctx, lx = W - 214, ly = 30;
      c.save(); c.fillStyle = SPL.alpha(C.dark ? '#1a1d24' : '#ffffff', 0.88); c.strokeStyle = C.grid;
      c.beginPath(); c.roundRect ? c.roundRect(lx - 12, ly - 16, 206, 74, 8) : c.rect(lx - 12, ly - 16, 206, 74); c.fill(); c.stroke(); c.restore();
      [[C.faint, 'f(x) = 1/(1+25x²)'], [C.orange, `wielomian st. ${n}`], [C.blue, 'splajn sześcienny']].forEach(([col, txt], i) => {
        SPL.line(c, [[lx, ly + i * 22], [lx + 24, ly + i * 22]], { color: col, width: i === 0 ? 5 : 3 });
        SPL.text(c, txt, lx + 32, ly + i * 22 + 5, { size: 14, color: C.ink });
      });
    }
    return { render };
  });

  // ==================================================================== pieces
  SPL.register('pieces', function (el, o) {
    const W = +o.w || 540, H = +o.h || 430;
    const st = SPL.stage(el, W, H);
    const pl = SPL.plot(st, { x: 30, y: 14, w: W - 44, h: H - 40 }, { xmin: -0.3, xmax: 10.3, ymin: -0.5, ymax: 6.5 });
    let P = [[0.5, 2.2], [2.3, 4.6], [4.2, 2.0], [6.1, 3.4], [7.9, 5.2], [9.6, 2.6]];
    // data-deg / data-ext: stan początkowy (slajd „Idea” zaczyna od łamanej); w PDF zawsze stopień 3
    let ext = o.ext !== '0', deg = SPL.print ? 3 : Math.min(4, Math.max(1, +o.deg || 3));
    const SMOOTH = ['', 's', 's, s′', 's, s′, s″', 's, s′, s″, s‴'];
    const ui = SPL.ui.panel(el);
    const kSl = SPL.ui.slider(ui, { label: 'stopień k', min: 1, max: 4, step: 1, value: deg, fmt: v => String(v), onInput: v => { deg = v; render(); } });
    kSl.input.style.width = '96px';
    const smOut = SPL.ui.readout(ui, 'ciągłe:');
    smOut.el.querySelector('.val').style.cssText = 'display:inline-block; min-width:8.2em; text-align:left';  // stała szerokość: panel nie skacze
    SPL.ui.toggle(ui, 'przedłuż kawałki', ext, v => { ext = v; render(); });

    /**
     * Splajn interpolacyjny stopnia k z węzłami w punktach danych, kawałki p_i(t) = Σ a_ij t^j, t = x − x_i.
     * Warunki: interpolacja (2n) i ciągłość pochodnych 1..k−1 w węzłach wewnętrznych; brakujące k−1 stopni
     * swobody wybieramy tak, by ∫ s″² była najmniejsza (dla k = 3 to dokładnie splajn naturalny, tw. Holladaya).
     */
    function splineK(xs, ys, k) {
      const n = xs.length - 1, m = k + 1, N = n * m;
      const h = xs.slice(1).map((x, i) => x - xs[i]);
      const dcoef = (j, d) => { let c = 1; for (let r = 0; r < d; r++) c *= (j - r); return c; };
      const rows = [], rhs = [];
      const row = () => new Array(N).fill(0);
      for (let i = 0; i < n; i++) {
        let r = row(); r[i * m] = 1; rows.push(r); rhs.push(ys[i]);
        r = row(); for (let j = 0; j < m; j++) r[i * m + j] = Math.pow(h[i], j); rows.push(r); rhs.push(ys[i + 1]);
      }
      for (let i = 1; i < n; i++) for (let d = 1; d <= k - 1; d++) {
        const r = row();
        for (let j = d; j < m; j++) r[(i - 1) * m + j] = dcoef(j, d) * Math.pow(h[i - 1], j - d);
        r[i * m + d] -= dcoef(d, d);
        rows.push(r); rhs.push(0);
      }
      // KKT: min aᵀQa przy Aa = b, Q = ∫ s″² (blokowo-diagonalna)
      const L = rows.length, T = N + L;
      const M = Array.from({ length: T }, () => new Array(T + 1).fill(0));
      for (let i = 0; i < n; i++) for (let j = 2; j < m; j++) for (let l = 2; l < m; l++) {
        M[i * m + j][i * m + l] = 2 * j * (j - 1) * l * (l - 1) * Math.pow(h[i], j + l - 3) / (j + l - 3);
      }
      for (let q = 0; q < L; q++) for (let c = 0; c < N; c++) { M[N + q][c] = rows[q][c]; M[c][N + q] = rows[q][c]; }
      for (let q = 0; q < L; q++) M[N + q][T] = rhs[q];
      for (let c = 0; c < T; c++) {               // eliminacja Gaussa z częściowym wyborem
        let p = c; for (let r = c + 1; r < T; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
        if (p !== c) { const t = M[p]; M[p] = M[c]; M[c] = t; }
        const piv = M[c][c] || 1e-14;
        for (let r = c + 1; r < T; r++) { const f = M[r][c] / piv; if (f) for (let q = c; q <= T; q++) M[r][q] -= f * M[c][q]; }
      }
      const z = new Array(T).fill(0);
      for (let r = T - 1; r >= 0; r--) { let sum = M[r][T]; for (let q = r + 1; q < T; q++) sum -= M[r][q] * z[q]; z[r] = sum / (M[r][r] || 1e-14); }
      const a = z.slice(0, N);
      return i => x => { const t = x - xs[i]; let v = 0; for (let j = m - 1; j >= 0; j--) v = v * t + a[i * m + j]; return v; };
    }

    function render() {
      st.clear();
      pl.grid({ dx: 1, dy: 1, labels: false });
      const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
      const pieceFn = splineK(xs, ys, deg);
      smOut.set(SMOOTH[deg]);
      const c = st.ctx;
      // węzły
      c.save(); c.strokeStyle = C.grid; c.setLineDash([3, 4]); c.lineWidth = 1.2;
      xs.forEach(x => { c.beginPath(); c.moveTo(pl.X(x), pl.r.y); c.lineTo(pl.X(x), pl.r.y + pl.r.h); c.stroke(); });
      c.restore();
      for (let i = 0; i < xs.length - 1; i++) {
        const col = C.palette[i % C.palette.length];
        if (ext) pl.fn(pieceFn(i), { color: col, width: 1.6, dash: [6, 5], alpha: 0.55 });
      }
      for (let i = 0; i < xs.length - 1; i++) {
        const col = C.palette[i % C.palette.length];
        pl.fn(pieceFn(i), { color: col, width: 4 }, xs[i], xs[i + 1], 120);
      }
      P.forEach(p => pl.dot(p, { r: 6, fill: C.ink }));
      SPL.text(c, 'każdy kolor = inny wielomian', pl.r.x + 8, pl.r.y + 20, { size: 14, color: C.muted, weight: 600 });
    }
    SPL.drag(st, {
      points: () => P.map(p => pl.P(p)),
      move(i, q) {
        const lo = i > 0 ? P[i - 1][0] + 0.3 : 0, hi = i < P.length - 1 ? P[i + 1][0] - 0.3 : 10;
        P[i] = [Sp.clamp(pl.ix(q[0]), lo, hi), Sp.clamp(pl.iy(q[1]), -0.3, 6.3)];
        render();
      }
    });
    return { render };
  });

  // =============================================================== reticulate
  SPL.register('reticulate', function (el) {
    el.innerHTML = '<div class="msg">Reticulating splines…</div><div class="bar"><i></i></div><div class="tiny faint" style="margin-top:6px">ekran ładowania SimCity 2000 (Maxis, 1993)</div>';
    const msg = el.querySelector('.msg'), bar = el.querySelector('.bar i');
    const steps = ['Reticulating splines…', 'Wstawianie węzłów…', 'Rozwiązywanie układu trójdiagonalnego…', 'Minimalizowanie ∫ f″² …', 'Gotowe ✓'];
    let t = 0;
    const loop = SPL.loop(dt => {
      t += dt;
      const p = Math.min(1, t / 7);
      bar.style.width = (p * 100).toFixed(1) + '%';
      msg.textContent = steps[Math.min(steps.length - 1, Math.floor(p * (steps.length - 1) + 1e-9))];
      return p < 1;
    });
    function render() { if (SPL.print) { bar.style.width = '100%'; msg.textContent = 'Reticulating splines… gotowe ✓'; } }
    return { render, activate() { t = 0; loop.start(); }, deactivate() { loop.stop(); } };
  });
})();
