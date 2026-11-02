/* bsplines.js — dema: basis (baza B-splajnów), convolution (B-splajn jako splot → Gauss),
 * casteljau (algorytm de Casteljau), bcurve (krzywe B-splajnowe: sterowanie lokalne). */
(function () {
  'use strict';
  const Sp = window.Splines;
  const C = SPL.c;

  const SUB = '₀₁₂₃₄₅₆₇₈₉', SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sub = n => String(n).split('').map(d => (d >= '0' && d <= '9') ? SUB[+d] : d).join('');
  const sup = n => String(n).split('').map(d => (d >= '0' && d <= '9') ? SUP[+d] : d === '-' ? '⁻' : d).join('');

  function css(id, text) {
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id; s.textContent = text;
    document.head.appendChild(s);
  }

  /** Tekst z indeksem dolnym, np. B_{3,2}. Zwraca szerokość. */
  function subText(c, base, idx, x, y, s = {}) {
    const size = s.size || 15;
    c.save();
    c.fillStyle = s.color || SPL.c.ink;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.font = SPL.font(size, s.weight || 650);
    let w = c.measureText(base).width;
    if (s.align === 'center') {
      c.font = SPL.font(size * 0.68, s.weight || 650);
      w += c.measureText(idx).width;
      x -= w / 2;
    }
    c.font = SPL.font(size, s.weight || 650);
    c.fillText(base, x, y);
    const bw = c.measureText(base).width;
    c.font = SPL.font(size * 0.68, s.weight || 650);
    c.fillText(idx, x + bw + 1, y + size * 0.28);
    const total = bw + 1 + c.measureText(idx).width;
    c.restore();
    return total;
  }

  function roundBox(c, x, y, w, h, r, fill, stroke) {
    c.save();
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
    c.restore();
  }

  // ===================================================================== basis
  SPL.register('basis', function (el, o) {
    const W = +o.w || 736, H = +o.h || 440;
    css('basis-css', '.basis-ctrls input[type=range]{width:120px}');
    const st = SPL.stage(el, W, H);
    const KN = 12, A = 0, B = 10;
    const pl = SPL.plot(st, { x: 40, y: 40, w: W - 58, h: H - 116 }, { xmin: -0.35, xmax: 10.35, ymin: -0.04, ymax: 1.12 });
    const triTop = () => pl.Y(0) + 7;          // wierzchołek trójkąta węzła
    let k = 2, preset = 'uniform';
    let t = Sp.linspace(A, B, KN);
    let hoverFn = -1, pinnedFn = -1, hoverKnot = -1;

    function makePreset(name) {
      if (name === 'uniform') return Sp.linspace(A, B, KN);
      if (name === 'clamped') return Sp.clampedKnots(KN - k - 1, k, A, B);
      // losowe: posortowane, minimalny odstęp 0.3, zaokrąglone do 0.05
      for (let tries = 0; tries < 200; tries++) {
        const r = Array.from({ length: KN - 2 }, () => Math.round((A + 0.3 + Math.random() * (B - A - 0.6)) * 20) / 20).sort((a, b) => a - b);
        const cand = [A].concat(r, [B]);
        let ok = true;
        for (let i = 1; i < cand.length; i++) if (cand[i] - cand[i - 1] < 0.3) { ok = false; break; }
        if (ok) return cand;
      }
      return Sp.linspace(A, B, KN);
    }

    const ui = SPL.ui.panel(el, 'basis-ctrls');
    SPL.ui.slider(ui, {
      label: 'stopień k', min: 0, max: 5, step: 1, value: k,
      onInput: v => { k = v; if (preset === 'clamped') t = makePreset('clamped'); pinnedFn = -1; render(); }
    });
    const seg = SPL.ui.segmented(ui, [
      { value: 'uniform', label: 'równomierne' },
      { value: 'clamped', label: 'otwarte (clamped)' },
      { value: 'random', label: 'losowe' }
    ], preset, v => { preset = v; t = makePreset(v); pinnedFn = -1; render(); }, 'węzły');

    // grupy węzłów o tej samej wartości: [{v, from, to, mult}]
    function groups() {
      const g = [];
      for (let i = 0; i < t.length; i++) {
        const last = g[g.length - 1];
        if (last && Math.abs(t[i] - last.v) < 1e-9) { last.to = i; last.mult++; } else g.push({ v: t[i], from: i, to: i, mult: 1 });
      }
      return g;
    }

    function sample() {
      const m = t.length - 1, nb = Math.max(0, m - k);
      const xs = [];
      const N = 640;
      for (let j = 0; j <= N; j++) xs.push(pl.xmin + (pl.xmax - pl.xmin) * j / N);
      for (const v of t) xs.push(v - 1e-7, v + 1e-7);   // ostre skoki w węzłach
      xs.sort((a, b) => a - b);
      const vals = Array.from({ length: nb }, () => new Float64Array(xs.length));
      const sum = new Float64Array(xs.length);
      xs.forEach((x, j) => {
        const b = Sp.basisAll(t, k, x);
        let s = 0;
        for (let i = 0; i < nb; i++) { vals[i][j] = b[i]; s += b[i]; }
        sum[j] = s;
      });
      return { xs, vals, sum, nb, m };
    }

    function render() {
      st.clear();
      const c = st.ctx, S = sample(), m = S.m;
      const focus = hoverFn >= 0 ? hoverFn : pinnedFn;
      if (focus >= S.nb) { hoverFn = pinnedFn = -1; }
      const f = (hoverFn >= 0 ? hoverFn : pinnedFn);

      // obszar, gdzie Σ B_i ≠ 1 (poza [t_k, t_{m-k}])
      const lo = t[k], hi = t[m - k];
      pl.clip(cc => {
        cc.fillStyle = SPL.alpha(C.dark ? '#000000' : '#8a8a8a', C.dark ? 0.28 : 0.10);
        const yTop = pl.r.y, h = pl.Y(0) - pl.r.y;
        if (!(lo < hi)) cc.fillRect(pl.r.x, yTop, pl.r.w, h);
        else {
          cc.fillRect(pl.r.x, yTop, pl.X(lo) - pl.r.x, h);
          cc.fillRect(pl.X(hi), yTop, pl.r.x + pl.r.w - pl.X(hi), h);
        }
      });

      // nośnik wyróżnionej funkcji
      if (f >= 0) {
        const a = t[f], b = t[f + k + 1], col = C.palette[f % C.palette.length];
        pl.clip(cc => {
          cc.fillStyle = SPL.alpha(col, 0.13);
          cc.fillRect(pl.X(a), pl.r.y, pl.X(b) - pl.X(a), pl.Y(0) - pl.r.y);
          cc.strokeStyle = SPL.alpha(col, 0.7); cc.setLineDash([4, 4]); cc.lineWidth = 1.2;
          cc.beginPath(); cc.moveTo(pl.X(a), pl.r.y); cc.lineTo(pl.X(a), pl.Y(0)); cc.moveTo(pl.X(b), pl.r.y); cc.lineTo(pl.X(b), pl.Y(0)); cc.stroke();
        });
      }

      // siatka: linie y = 0, 0.5, 1 i pionowe linie węzłów
      c.save();
      c.strokeStyle = C.grid; c.lineWidth = 1;
      c.beginPath();
      for (const y of [0.25, 0.5, 0.75, 1]) { const Y = Math.round(pl.Y(y)) + 0.5; c.moveTo(pl.r.x, Y); c.lineTo(pl.r.x + pl.r.w, Y); }
      c.stroke();
      c.setLineDash([2, 4]); c.strokeStyle = C.faint; c.globalAlpha = 0.6;
      c.beginPath();
      groups().forEach(g => { const X = Math.round(pl.X(g.v)) + 0.5; c.moveTo(X, pl.r.y + 8); c.lineTo(X, pl.Y(0)); });
      c.stroke();
      c.restore();
      c.save();
      c.strokeStyle = C.faint; c.lineWidth = 1.25;
      c.beginPath(); c.moveTo(pl.r.x, Math.round(pl.Y(0)) + 0.5); c.lineTo(pl.r.x + pl.r.w, Math.round(pl.Y(0)) + 0.5); c.stroke();
      c.fillStyle = C.muted; c.font = SPL.font(12, 500); c.textAlign = 'right'; c.textBaseline = 'middle';
      for (const y of [0, 0.5, 1]) c.fillText(String(y).replace('.', ','), pl.r.x - 6, pl.Y(y));
      c.restore();

      // funkcje bazowe
      for (let i = 0; i < S.nb; i++) {
        const col = C.palette[i % C.palette.length];
        const pts = S.xs.map((x, j) => [x, S.vals[i][j]]);
        const isF = i === f, dim = f >= 0 && !isF;
        const area = pts.concat([[S.xs[S.xs.length - 1], 0], [S.xs[0], 0]]);
        pl.path(area, { color: col, width: 0, fill: SPL.alpha(col, isF ? 0.28 : dim ? 0.03 : 0.08) });
        pl.path(pts, { color: col, width: isF ? 4 : 2.4, alpha: dim ? 0.35 : 1 });
      }
      // suma
      pl.path(S.xs.map((x, j) => [x, S.sum[j]]), { color: C.ink, width: 2, dash: [7, 6] });

      // etykieta wyróżnionej funkcji
      if (f >= 0) {
        let jm = 0;
        for (let j = 1; j < S.xs.length; j++) if (S.vals[f][j] > S.vals[f][jm]) jm = j;
        const col = C.palette[f % C.palette.length];
        const X = Sp.clamp(pl.X(S.xs[jm]), pl.r.x + 30, pl.r.x + pl.r.w - 30), Y = Math.max(pl.r.y + 16, pl.Y(S.vals[f][jm]) - 10);
        subText(c, 'B', `${f},${k}`, X, Y, { size: 17, color: col, align: 'center' });
        SPL.text(c, `supp = [t${sub(f)}, t${sub(f + k + 1)}]`, (pl.X(t[f]) + pl.X(t[f + k + 1])) / 2, pl.r.y + 2 + 12, { size: 13, color: col, align: 'center', weight: 600 });
      }

      // węzły: trójkąty, krotność i ciągłość
      const G = groups();
      G.forEach(g => {
        const X = pl.X(g.v), y0 = triTop();
        const act = hoverKnot >= g.from && hoverKnot <= g.to;
        const bad = g.mult > k + 1;
        const fill = bad ? C.red : act ? C.blue : C.ink;
        for (let s = Math.min(g.mult, 4) - 1; s >= 0; s--) {
          const yy = y0 + s * 5;
          c.save();
          c.beginPath(); c.moveTo(X, yy); c.lineTo(X - 7, yy + 13); c.lineTo(X + 7, yy + 13); c.closePath();
          c.fillStyle = fill; c.fill(); c.strokeStyle = C.card; c.lineWidth = 1.2; c.stroke();
          c.restore();
        }
        if (g.mult > 1) {
          const interior = g.from > 0 && g.to < t.length - 1;
          let label = `×${g.mult}`;
          let col = C.muted;
          if (bad) { label += ' > k+1'; col = C.red; }
          else if (interior) {
            const cont = k - g.mult;
            label += cont >= 0 ? ` · C${sup(cont)}` : ' · skok';
            if (cont < 0) col = C.red; else col = C.purple;
          }
          SPL.text(c, label, X, y0 + 13 + 5 * Math.min(g.mult - 1, 3) + 16, { size: 13, color: col, align: 'center', weight: 700 });
        }
      });

      // nagłówek i legenda
      SPL.text(c, `funkcji bazowych: m − k = ${m} − ${k} = ${S.nb}`, pl.r.x, 22, { size: 14, weight: 650, color: C.ink });
      SPL.text(c, k > 0 ? `węzły pojedyncze: C${sup(k - 1)}` : 'k = 0: funkcje schodkowe', pl.r.x + 262, 22, { size: 14, weight: 600, color: C.purple });
      const lx = W - 196;
      SPL.line(c, [[lx, 17], [lx + 26, 17]], { color: C.ink, width: 2, dash: [7, 6] });
      SPL.text(c, 'Σ Bᵢ', lx + 32, 22, { size: 14, weight: 600 });
      c.save(); c.fillStyle = SPL.alpha(C.dark ? '#000000' : '#8a8a8a', C.dark ? 0.4 : 0.16); c.fillRect(lx + 82, 10, 16, 14); c.restore();
      SPL.text(c, 'Σ Bᵢ ≠ 1', lx + 104, 22, { size: 14, weight: 600, color: C.muted });
      SPL.text(c, 'przeciągnij ▲ · zsuń węzły, by zwiększyć krotność · najedź na funkcję', W - 12, H - 8, { size: 12, color: C.faint, align: 'right' });
    }

    // --- przeciąganie węzłów (z rozdzielaniem węzłów wielokrotnych wg kierunku ruchu)
    let dragK = -1, group = null, startX = 0;
    const multAt = (val, skip) => t.filter((w, j) => j !== skip && Math.abs(w - val) < 1e-9).length + 1;
    SPL.drag(st, {
      radius: 16,
      points: () => t.map(v => [pl.X(v), triTop() + 8]),
      down(i, q) {
        if (i < 0) {
          // kliknięcie w funkcję przypina ją (ponowne — odpina)
          if (pl.inside(q[0], q[1])) { pinnedFn = (hoverFn >= 0 && hoverFn !== pinnedFn) ? hoverFn : -1; render(); }
          return;
        }
        group = [];
        for (let j = 0; j < t.length; j++) if (Math.abs(t[j] - t[i]) < 1e-9) group.push(j);
        dragK = group.length === 1 ? group[0] : -1;
        startX = q[0];
      },
      move(i, q) {
        if (dragK < 0) {
          const dx = q[0] - startX;
          if (Math.abs(dx) < 3) return;
          dragK = dx < 0 ? group[0] : group[group.length - 1];
        }
        const j = dragK, last = t.length - 1;
        const lo = j > 0 ? t[j - 1] : A, hi = j < last ? t[j + 1] : B;
        let v = Sp.clamp(pl.ix(q[0]), lo, hi);
        const snap = 0.18;
        if (j > 0 && v - t[j - 1] < snap) v = t[j - 1];
        else if (j < last && t[j + 1] - v < snap) v = t[j + 1];
        // krotność nie większa niż k+1
        if (j > 0 && v === t[j - 1] && multAt(v, j) > k + 1) v = Math.min(hi, t[j - 1] + 0.05);
        if (j < last && v === t[j + 1] && multAt(v, j) > k + 1) v = Math.max(lo, t[j + 1] - 0.05);
        t[j] = v;
        preset = null; seg.set('');
        hoverKnot = j;
        render();
      },
      up() { dragK = -1; group = null; hoverKnot = -1; render(); },
      hover(i) { hoverKnot = i; render(); }
    });

    // najechanie na funkcję bazową
    st.el.addEventListener('pointermove', ev => {
      if (dragK >= 0 || group) return;
      const q = st.pointer(ev);
      let h = -1;
      if (pl.inside(q[0], q[1]) && hoverKnot < 0) {
        const x = pl.ix(q[0]), y = pl.iy(q[1]);
        const b = Sp.basisAll(t, k, x);
        let bi = -1, bv = 0;
        for (let i = 0; i < b.length; i++) if (b[i] > bv) { bv = b[i]; bi = i; }
        if (bi >= 0 && bv > 0.02 && y <= bv + 0.07 && y >= -0.04) h = bi;
      }
      if (h !== hoverFn) { hoverFn = h; render(); }
    });
    st.el.addEventListener('pointerleave', () => { if (hoverFn !== -1) { hoverFn = -1; render(); } });

    if (SPL.print) pinnedFn = 4;
    return { render };
  });

  // =============================================================== convolution
  SPL.register('convolution', function (el, o) {
    const W = +o.w || 680, H = +o.h || 420;
    const st = SPL.stage(el, W, H);
    const pl = SPL.plot(st, { x: 44, y: 16, w: W - 60, h: H - 44 }, { xmin: -6.3, xmax: 6.3, ymin: -0.06, ymax: 1.5 });
    let k = 3, lower = false;
    const knots = kk => Array.from({ length: kk + 2 }, (_, i) => i);
    const Bc = (kk, x) => Sp.basisAll(knots(kk), kk, x + (kk + 1) / 2)[0];   // B_k przesunięty do środka
    const phi = (kk, x) => { const s2 = (kk + 1) / 12; return Math.exp(-x * x / (2 * s2)) / Math.sqrt(2 * Math.PI * s2); };

    const ui = SPL.ui.panel(el);
    SPL.ui.slider(ui, { label: 'stopień k', min: 0, max: 10, step: 1, value: k, onInput: v => { k = v; render(); } });
    SPL.ui.toggle(ui, 'pokaż niższe stopnie', false, v => { lower = v; render(); });
    const out = SPL.ui.readout(ui, 'max |B<sub>k</sub> − φ|');

    function curve(kk) {
      const pts = [], a = -(kk + 1) / 2, b = (kk + 1) / 2;
      const xs = [];
      for (let j = 0; j <= 900; j++) xs.push(pl.xmin + (pl.xmax - pl.xmin) * j / 900);
      for (let i = 0; i <= kk + 1; i++) xs.push(a + i - 1e-7, a + i + 1e-7);
      xs.sort((p, q) => p - q);
      for (const x of xs) pts.push([x, x < a || x > b ? 0 : Bc(kk, x)]);
      return pts;
    }

    function render() {
      st.clear();
      const c = st.ctx;
      pl.grid({ dx: 1, dy: 0.25, labels: true, labelsOutside: false });
      if (lower) for (let j = 0; j < k; j++) pl.path(curve(j), { color: C.faint, width: 1.6, alpha: 0.45 + 0.4 * j / Math.max(1, k) });
      const pts = curve(k);
      pl.path(pts.concat([[pl.xmax, 0], [pl.xmin, 0]]), { color: C.blue, width: 0, fill: SPL.alpha(C.blue, 0.13) });
      pl.path(pts, { color: C.blue, width: 3.2 });
      pl.fn(x => phi(k, x), { color: C.orange, width: 2.6, dash: [8, 6] });
      let mx = 0;
      for (let j = 0; j <= 3000; j++) {
        const x = -6 + 12 * j / 3000, a = (k + 1) / 2;
        mx = Math.max(mx, Math.abs((x < -a || x > a ? 0 : Bc(k, x)) - phi(k, x)));
      }
      out.set(SPL.fmt(mx));
      // wzór: B_k = χ ∗ … ∗ χ
      roundBox(c, pl.r.x + 4, pl.r.y + 4, 372, 56, 8, SPL.alpha(C.dark ? '#1a1d24' : '#ffffff', 0.9), null);
      let w = subText(c, 'B', String(k), pl.r.x + 12, pl.r.y + 26, { size: 20, color: C.blue });
      const conv = k === 0 ? ' = χ' : k <= 4 ? ' = ' + Array(k + 1).fill('χ').join(' ∗ ') : ` = χ ∗ χ ∗ … ∗ χ  (${k + 1} razy)`;
      SPL.text(c, conv, pl.r.x + 12 + w, pl.r.y + 26, { size: 20, weight: 600, color: C.blue });
      SPL.text(c, 'χ: funkcja prostokątna na [−½, ½), gęstość U(−½, ½)', pl.r.x + 12, pl.r.y + 50, { size: 14, color: C.muted });
      // legenda
      const lx = pl.r.x + pl.r.w - 228, ly = pl.r.y + 18;
      roundBox(c, lx - 12, ly - 14, 232, 56, 8, SPL.alpha(C.dark ? '#1a1d24' : '#ffffff', 0.9), C.grid);
      SPL.line(c, [[lx, ly], [lx + 26, ly]], { color: C.blue, width: 3.2 });
      SPL.text(c, `B${sub(k)} (węzły całkowite)`, lx + 34, ly + 5, { size: 14 });
      SPL.line(c, [[lx, ly + 24], [lx + 26, ly + 24]], { color: C.orange, width: 2.6, dash: [8, 6] });
      SPL.text(c, `φ: N(0, σ² = ${k + 1}/12)`, lx + 34, ly + 29, { size: 14 });
    }
    return { render };
  });

  // ================================================================= casteljau
  SPL.register('casteljau', function (el, o) {
    const W = +o.w || 736, H = +o.h || 460;
    const st = SPL.stage(el, W, H);
    const TOP = { x: 14, y: 14, w: W - 28, h: H - 160 };      // obszar punktów kontrolnych (px)
    const bp = SPL.plot(st, { x: 48, y: H - 112, w: W - 72, h: 92 }, { xmin: 0, xmax: 1, ymin: 0, ymax: 1.05 });
    const init = [[90, 262], [175, 52], [540, 44], [650, 250]];
    let P = init.map(p => p.slice());
    let t = 0.4, playing = !SPL.print, userPaused = false, dir = 1, hover = -1, scrubbing = false;

    const ui = SPL.ui.panel(el);
    const playBtn = SPL.ui.button(ui, '❚❚ pauza', () => { playing = !playing; userPaused = !playing; syncPlay(); if (playing) loop.start(); });
    const tSl = SPL.ui.slider(ui, { label: 't', min: 0, max: 1, step: 0.001, value: t, fmt: v => v.toFixed(2), onInput: v => { t = v; pause(); render(); } });
    SPL.ui.button(ui, '− punkt', () => { if (P.length > 2) { P.splice(P.length - 2, 1); render(); } });
    SPL.ui.button(ui, '+ punkt', () => { if (P.length < 8) { elevate(); render(); } });

    function syncPlay() { playBtn.innerHTML = playing ? '❚❚ pauza' : '▶ odtwórz'; }
    function pause() { playing = false; userPaused = true; syncPlay(); }
    function setT(v) { t = Sp.clamp(v, 0, 1); tSl.set(t); render(); }

    /** Podniesienie stopnia: n+2 punkty opisujące tę samą krzywą. */
    function elevate() {
      const n = P.length - 1, Q = [P[0].slice()];
      for (let i = 1; i <= n; i++) {
        const a = i / (n + 1);
        Q.push([a * P[i - 1][0] + (1 - a) * P[i][0], a * P[i - 1][1] + (1 - a) * P[i][1]]);
      }
      Q.push(P[n].slice());
      P = Q;
    }

    function render() {
      st.clear();
      const c = st.ctx, n = P.length - 1;
      const LEVEL = [C.green, C.purple, C.orange, C.teal, C.pink, C.yellow, C.red];
      const PC = i => C.palette[i % C.palette.length];

      // separator
      c.save(); c.strokeStyle = C.grid; c.lineWidth = 1; c.beginPath();
      c.moveTo(12, H - 136.5); c.lineTo(W - 12, H - 136.5); c.stroke(); c.restore();

      // aureole ∝ b_{i,n}(t)
      P.forEach((p, i) => {
        const b = Sp.bernstein(n, i, t);
        c.save(); c.beginPath(); c.arc(p[0], p[1], 8 + 34 * b, 0, 2 * Math.PI);
        c.fillStyle = SPL.alpha(PC(i), 0.16); c.fill();
        c.strokeStyle = SPL.alpha(PC(i), 0.55); c.lineWidth = 1.2; c.stroke(); c.restore();
      });

      // krzywa: całość blado, [0, t] wyraźnie
      const full = [], traced = [];
      for (let j = 0; j <= 300; j++) { const u = j / 300, q = Sp.bezier(P, u); full.push(q); if (u <= t) traced.push(q); }
      const Ct = Sp.bezier(P, t);
      traced.push(Ct);
      SPL.line(c, full, { color: C.blue, width: 2.2, alpha: 0.28 });
      SPL.line(c, P, { color: C.faint, width: 1.6 });
      SPL.line(c, traced, { color: C.blue, width: 4.5 });

      // poziomy algorytmu de Casteljau
      const L = Sp.deCasteljauLevels(P, t);
      for (let r = 1; r < L.length - 1; r++) {
        const col = LEVEL[(r - 1) % LEVEL.length];
        SPL.line(c, L[r], { color: col, width: 2 });
        L[r].forEach(q => SPL.dot(c, q[0], q[1], { r: 4, fill: col }));
      }
      SPL.dot(c, Ct[0], Ct[1], { r: 8, fill: C.red });
      SPL.text(c, `C(${t.toFixed(2)})`, Ct[0] + 12, Ct[1] + 20, { size: 14, weight: 700, color: C.red });

      // punkty kontrolne
      P.forEach((p, i) => {
        SPL.dot(c, p[0], p[1], { r: 7, fill: PC(i), active: hover === i });
        const lx = p[0] + (p[0] < W / 2 ? -26 : 12), ly = p[1] + (p[1] < 60 ? 24 : -10);
        subText(c, 'P', String(i), lx, ly, { size: 16, color: PC(i), weight: 700 });
      });
      SPL.text(c, `stopień n = ${n}`, TOP.x + 4, TOP.y + 12, { size: 14, weight: 650, color: C.muted });
      SPL.text(c, '„+ punkt” podnosi stopień, krzywa się nie zmienia', W - 16, TOP.y + 12, { size: 12, color: C.faint, align: 'right' });

      // pasek: wielomiany Bernsteina
      c.save(); c.strokeStyle = C.grid; c.lineWidth = 1; c.beginPath();
      c.moveTo(bp.r.x, Math.round(bp.Y(1)) + 0.5); c.lineTo(bp.r.x + bp.r.w, Math.round(bp.Y(1)) + 0.5); c.stroke();
      c.strokeStyle = C.faint; c.beginPath(); c.moveTo(bp.r.x, Math.round(bp.Y(0)) + 0.5); c.lineTo(bp.r.x + bp.r.w, Math.round(bp.Y(0)) + 0.5); c.stroke();
      c.fillStyle = C.muted; c.font = SPL.font(12, 500); c.textAlign = 'right'; c.textBaseline = 'middle';
      c.fillText('1', bp.r.x - 6, bp.Y(1)); c.fillText('0', bp.r.x - 6, bp.Y(0));
      c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText('t = 0', bp.X(0), bp.Y(0) + 4); c.fillText('t = 1', bp.X(1), bp.Y(0) + 4);
      c.restore();
      for (let i = 0; i <= n; i++) bp.fn(u => Sp.bernstein(n, i, u), { color: PC(i), width: 2.2 }, 0, 1, 240);
      c.save(); c.strokeStyle = C.red; c.lineWidth = 1.5; c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(bp.X(t), bp.r.y - 4); c.lineTo(bp.X(t), bp.Y(0)); c.stroke(); c.restore();
      for (let i = 0; i <= n; i++) bp.dot([t, Sp.bernstein(n, i, t)], { r: 4.5, fill: PC(i) });
      const bw = subText(c, 'b', `i,${n}`, bp.r.x + 6, bp.r.y + 4, { size: 15, color: C.muted, weight: 650 });
      SPL.text(c, '(t)', bp.r.x + 8 + bw, bp.r.y + 4, { size: 15, color: C.muted, weight: 650 });
      SPL.text(c, 'wagi punktów kontrolnych (przeciągnij, by zmienić t)', bp.r.x + bp.r.w, bp.r.y + 2, { size: 12, color: C.faint, align: 'right' });
    }

    SPL.drag(st, {
      captureAll: true,
      points: () => P,
      down(i, q) {
        scrubbing = i < 0 && q[1] > H - 136;
        if (scrubbing) { pause(); setT(bp.ix(q[0])); }
      },
      move(i, q) {
        P[i] = [Sp.clamp(q[0], TOP.x + 8, TOP.x + TOP.w - 8), Sp.clamp(q[1], TOP.y + 8, TOP.y + TOP.h + 10)];
        render();
      },
      hover(i) { hover = i; render(); }
    });
    // przewijanie t po pasku Bernsteina (niezależne od przechwytywania wskaźnika)
    st.el.addEventListener('pointermove', ev => { if (scrubbing && ev.buttons) setT(bp.ix(st.pointer(ev)[0])); });
    const stopScrub = () => { scrubbing = false; };
    st.el.addEventListener('pointerup', stopScrub);
    st.el.addEventListener('pointercancel', stopScrub);

    const loop = SPL.loop(dt => {
      if (!playing) return false;
      t += dir * dt * 0.22;
      if (t >= 1) { t = 1; dir = -1; } else if (t <= 0) { t = 0; dir = 1; }
      tSl.set(t);
      render();
    });
    syncPlay();
    return {
      render,
      activate() { if (!userPaused) { playing = true; syncPlay(); loop.start(); } },
      deactivate() { loop.stop(); }
    };
  });

  // ==================================================================== bcurve
  SPL.register('bcurve', function (el, o) {
    const W = +o.w || 736, H = +o.h || 460;
    css('bcurve-css', '.bcurve-ctrls input[type=range]{width:100px}');
    const st = SPL.stage(el, W, H);
    const KB = { x: 70, y: H - 22, w: W - 110 };      // pasek węzłów
    const init = [[56, 330], [100, 120], [236, 76], [318, 250], [396, 380], [520, 362], [586, 168], [676, 92], [690, 316]];
    let P = init.map(p => p.slice());
    let k = 3, mode = 'bspline', comb = false, hoverPt = -1, dragPt = -1, ghost = null;

    const ui = SPL.ui.panel(el, 'bcurve-ctrls');
    const sl = SPL.ui.slider(ui, { label: 'k', min: 1, max: 5, step: 1, value: k, onInput: v => { k = v; render(); } });
    SPL.ui.segmented(ui, [{ value: 'bspline', label: 'B-splajn (lokalnie)' }, { value: 'bezier', label: 'Bézier (globalnie)' }], mode,
      v => { mode = v; sl.input.disabled = v === 'bezier'; sl.el.style.opacity = v === 'bezier' ? 0.4 : 1; render(); });
    SPL.ui.toggle(ui, 'grzebień krzywizny', false, v => { comb = v; render(); });

    function spec() {
      const n = P.length - 1, kk = mode === 'bezier' ? n : Math.min(k, n);
      return { n, kk, t: Sp.clampedKnots(P.length, kk, 0, 1) };
    }
    function sampleCurve(S, N = 480) {
      const us = [], pts = [];
      for (let j = 0; j <= N; j++) { const u = j / N; us.push(u); pts.push(Sp.deBoor(P, S.t, S.kk, u)); }
      return { us, pts };
    }

    function render() {
      st.clear();
      const c = st.ctx, S = spec(), Cv = sampleCurve(S);
      const act = dragPt >= 0 ? dragPt : hoverPt;

      // grzebień krzywizny (pochodne analityczne)
      if (comb && S.kk >= 2) {
        const d1 = Sp.bsplineDeriv(P, S.t, S.kk), d2 = Sp.bsplineDeriv(d1.P, d1.t, d1.k);
        const tips = [];
        c.save(); c.strokeStyle = SPL.alpha(C.purple, 0.5); c.lineWidth = 1; c.beginPath();
        for (let j = 0; j < Cv.us.length; j += 2) {
          const u = Cv.us[j], p = Cv.pts[j];
          const r1 = Sp.deBoor(d1.P, d1.t, d1.k, u), r2 = Sp.deBoor(d2.P, d2.t, d2.k, u);
          const sp = Math.hypot(r1[0], r1[1]) || 1e-9;
          const kap = (r1[0] * r2[1] - r1[1] * r2[0]) / (sp * sp * sp);
          const len = Sp.clamp(kap * 2000, -100, 100);
          const nx = -r1[1] / sp, ny = r1[0] / sp;
          const q = [p[0] - nx * len, p[1] - ny * len];
          c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); tips.push(q);
        }
        c.stroke(); c.restore();
        SPL.line(c, tips, { color: C.purple, width: 1.6 });
      }

      // łamana kontrolna
      SPL.line(c, P, { color: C.faint, width: 1.4, dash: [5, 5] });
      if (ghost) SPL.line(c, ghost, { color: C.faint, width: 2, dash: [3, 5] });

      // krzywa i fragment zależny od aktywnego punktu
      SPL.line(c, Cv.pts, { color: C.blue, width: 3.4 });
      let pct = null, a = 0, b = 1;
      if (act >= 0) {
        a = S.t[act]; b = S.t[act + S.kk + 1];
        const part = [];
        let Ltot = 0, Lpart = 0;
        for (let j = 0; j < Cv.pts.length; j++) {
          const inside = Cv.us[j] >= a - 1e-12 && Cv.us[j] <= b + 1e-12;
          if (inside) part.push(Cv.pts[j]);
          if (j > 0) {
            const d = Sp.dist(Cv.pts[j - 1], Cv.pts[j]);
            Ltot += d;
            if (inside && Cv.us[j - 1] >= a - 1e-12) Lpart += d;
          }
        }
        SPL.line(c, part, { color: C.orange, width: 6, alpha: 0.85 });
        pct = Math.round(100 * Lpart / Math.max(Ltot, 1e-9));
      }

      // połączenia segmentów (węzły wewnętrzne)
      const joins = [];
      for (let i = S.kk + 1; i <= S.n; i++) if (S.t[i] > 0 && S.t[i] < 1 && S.t[i] !== S.t[i - 1]) joins.push(S.t[i]);
      joins.forEach(u => { const p = Sp.deBoor(P, S.t, S.kk, u); SPL.dot(c, p[0], p[1], { r: 4, fill: C.ink }); });

      // punkty kontrolne
      P.forEach((p, i) => {
        const on = i === act;
        SPL.dot(c, p[0], p[1], { r: 7, hollow: !on, fill: on ? C.orange : C.blue, active: on });
        subText(c, 'P', String(i), p[0] + 10, p[1] - 9, { size: 13, color: on ? C.orange : C.muted, weight: 650 });
      });

      // pasek węzłów t ∈ [0,1]
      const X = u => KB.x + u * KB.w;
      c.save();
      if (act >= 0) { c.fillStyle = SPL.alpha(C.orange, 0.25); c.fillRect(X(a), KB.y - 9, X(b) - X(a), 18); }
      c.strokeStyle = C.faint; c.lineWidth = 2; c.beginPath(); c.moveTo(X(0), KB.y); c.lineTo(X(1), KB.y); c.stroke();
      c.restore();
      const uniq = [];
      S.t.forEach(v => { const g = uniq.find(q => Math.abs(q.v - v) < 1e-12); if (g) g.m++; else uniq.push({ v, m: 1 }); });
      uniq.forEach(g => {
        c.save(); c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(X(g.v), KB.y - 7); c.lineTo(X(g.v), KB.y + 7); c.stroke(); c.restore();
        if (g.m > 1) SPL.text(c, `×${g.m}`, X(g.v), KB.y - 11, { size: 12, color: C.muted, align: 'center', weight: 650 });
      });
      SPL.text(c, 'węzły t', 12, KB.y + 5, { size: 13, color: C.muted, weight: 650 });

      // opis
      const head = mode === 'bezier'
        ? `Bézier: jeden wielomian stopnia ${S.n}`
        : `B-splajn stopnia ${S.kk}, węzły otwarte, klasa C${sup(S.kk - 1)}`;
      SPL.text(c, head, 14, 22, { size: 14, weight: 650, color: C.ink });
      if (pct !== null) {
        const msg = `P${sub(act)} zmienia ${pct}% krzywej  ·  t ∈ [${a.toFixed(2)}, ${b.toFixed(2)}]`;
        SPL.text(c, msg, 14, 44, { size: 15, weight: 700, color: C.orange });
      } else {
        SPL.text(c, 'najedź na punkt kontrolny lub go przeciągnij', 14, 44, { size: 13, color: C.faint });
      }
      if (comb && S.kk < 2) SPL.text(c, 'k = 1: krzywizna 0 na odcinkach, ∞ w węzłach', W - 14, 22, { size: 13, color: C.purple, align: 'right' });
    }

    SPL.drag(st, {
      points: () => P,
      down(i) { if (i >= 0) { dragPt = i; ghost = sampleCurve(spec(), 240).pts; render(); } },
      move(i, q) { P[i] = [Sp.clamp(q[0], 12, W - 12), Sp.clamp(q[1], 62, H - 52)]; render(); },
      up() { dragPt = -1; ghost = null; render(); },
      hover(i) { hoverPt = i; render(); }
    });

    if (SPL.print) hoverPt = 4;
    return { render };
  });
})();
