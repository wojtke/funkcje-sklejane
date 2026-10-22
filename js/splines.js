/* splines.js — mała biblioteka numeryczna do prezentacji „Funkcje sklejane”.
 * Bez zależności. Działa w przeglądarce (window.Splines) i w Node (module.exports).
 * Konwencje: punkty to tablice [x, y]; węzły to tablice liczb rosnących (niemalejących dla B-splajnów).
 */
(function (root) {
  'use strict';
  const S = {};

  // ------------------------------------------------------------------ narzędzia
  S.linspace = (a, b, n) => Array.from({ length: n }, (_, i) => (n === 1 ? a : a + (b - a) * i / (n - 1)));
  S.binom = function (n, k) {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  };
  S.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  S.lerp = (a, b, t) => a + (b - a) * t;
  S.lerpP = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  S.dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);

  /** Indeks i taki, że xs[i] <= x < xs[i+1] (obcięty do [0, xs.length-2]). Wyszukiwanie binarne. */
  S.findInterval = function (xs, x) {
    const n = xs.length - 1;
    if (x <= xs[0]) return 0;
    if (x >= xs[n]) return n - 1;
    let lo = 0, hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid; else hi = mid;
    }
    return lo;
  };

  // ------------------------------------------------------------ algebra liniowa
  /** Rozkład LU z częściowym wyborem elementu głównego. A: tablica wierszy. Zwraca { solve(b) }. */
  S.lu = function (A) {
    const n = A.length;
    const M = A.map(r => Float64Array.from(r));
    const perm = new Int32Array(n);
    for (let i = 0; i < n; i++) perm[i] = i;
    for (let k = 0; k < n; k++) {
      let p = k, mx = Math.abs(M[k][k]);
      for (let i = k + 1; i < n; i++) { const v = Math.abs(M[i][k]); if (v > mx) { mx = v; p = i; } }
      if (mx < 1e-300) throw new Error('macierz osobliwa');
      if (p !== k) { const t = M[k]; M[k] = M[p]; M[p] = t; const q = perm[k]; perm[k] = perm[p]; perm[p] = q; }
      const Rk = M[k], piv = Rk[k];
      for (let i = k + 1; i < n; i++) {
        const Ri = M[i], f = Ri[k] / piv;
        Ri[k] = f;
        if (f === 0) continue;
        for (let j = k + 1; j < n; j++) Ri[j] -= f * Rk[j];
      }
    }
    return {
      solve(b) {
        const x = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          let s = b[perm[i]];
          const Ri = M[i];
          for (let j = 0; j < i; j++) s -= Ri[j] * x[j];
          x[i] = s;
        }
        for (let i = n - 1; i >= 0; i--) {
          let s = x[i];
          const Ri = M[i];
          for (let j = i + 1; j < n; j++) s -= Ri[j] * x[j];
          x[i] = s / Ri[i];
        }
        return x;
      }
    };
  };
  S.solve = (A, b) => S.lu(A).solve(b);

  /** Algorytm Thomasa dla układu trójdiagonalnego.
   * a[i] — pod przekątną (a[0] pomijane), b — przekątna, c[i] — nad przekątną (c[n-1] pomijane), d — prawa strona. */
  S.thomas = function (a, b, c, d) {
    const n = b.length, cp = new Float64Array(n), dp = new Float64Array(n);
    cp[0] = n > 1 ? c[0] / b[0] : 0;
    dp[0] = d[0] / b[0];
    for (let i = 1; i < n; i++) {
      const m = b[i] - a[i] * cp[i - 1];
      cp[i] = i < n - 1 ? c[i] / m : 0;
      dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
    }
    const x = new Float64Array(n);
    x[n - 1] = dp[n - 1];
    for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
    return x;
  };

  // ------------------------------------------------- sześcienna funkcja sklejana
  /** Funkcja sklejana z zadanych wartości y i momentów M = s''(x_i). Zwraca obiekt-ewaluator. */
  S.splineFromMoments = function (xs, ys, M) {
    const n = xs.length - 1;
    function piece(x) {
      const i = S.findInterval(xs, x);
      const h = xs[i + 1] - xs[i], A = xs[i + 1] - x, B = x - xs[i];
      return { i, h, A, B };
    }
    const sp = {
      x: xs, y: ys, M, n,
      eval(x) {
        const { i, h, A, B } = piece(x);
        return (M[i] * A * A * A + M[i + 1] * B * B * B) / (6 * h)
          + (ys[i] - M[i] * h * h / 6) * A / h + (ys[i + 1] - M[i + 1] * h * h / 6) * B / h;
      },
      d1(x) {
        const { i, h, A, B } = piece(x);
        return (-M[i] * A * A + M[i + 1] * B * B) / (2 * h) + (ys[i + 1] - ys[i]) / h - (M[i + 1] - M[i]) * h / 6;
      },
      d2(x) {
        const { i, h, A, B } = piece(x);
        return (M[i] * A + M[i + 1] * B) / h;
      },
      d3(x) {
        const { i, h } = piece(x);
        return (M[i + 1] - M[i]) / h;
      },
      /** Współczynniki wielomianu na przedziale i w bazie (x - x_i)^j: [a0, a1, a2, a3]. */
      coeffs(i) {
        const h = xs[i + 1] - xs[i];
        return [ys[i], (ys[i + 1] - ys[i]) / h - h * (2 * M[i] + M[i + 1]) / 6, M[i] / 2, (M[i + 1] - M[i]) / (6 * h)];
      },
      /** Wielomian i-tego kawałka, przedłużony na całą prostą (do ilustracji „sklejania”). */
      pieceEval(i, x) {
        const c = sp.coeffs(i), t = x - xs[i];
        return c[0] + t * (c[1] + t * (c[2] + t * c[3]));
      },
      /** ∫ s''(x)^2 dx — energia zginania (s'' jest łamaną, więc wzór dokładny). */
      energy() {
        let e = 0;
        for (let i = 0; i < n; i++) {
          const h = xs[i + 1] - xs[i];
          e += h * (M[i] * M[i] + M[i] * M[i + 1] + M[i + 1] * M[i + 1]) / 3;
        }
        return e;
      }
    };
    return sp;
  };

  /** Interpolacyjna sześcienna funkcja sklejana.
   * bc: 'natural' | 'clamped' | 'notaknot' | 'periodic'
   * opts.d0, opts.dn — pochodne na końcach dla 'clamped'. */
  S.cubicSpline = function (xs, ys, bc = 'natural', opts = {}) {
    const n = xs.length - 1;
    if (n < 1) throw new Error('za mało punktów');
    const h = new Float64Array(n), del = new Float64Array(n);
    for (let i = 0; i < n; i++) { h[i] = xs[i + 1] - xs[i]; del[i] = (ys[i + 1] - ys[i]) / h[i]; }
    let M;
    if (n === 1) {
      if (bc === 'clamped') {
        const d0 = opts.d0 || 0, dn = opts.dn || 0;
        M = S.solve([[2 * h[0], h[0]], [h[0], 2 * h[0]]], [6 * (del[0] - d0), 6 * (dn - del[0])]);
      } else M = new Float64Array(2);
      return S.splineFromMoments(xs, ys, Array.from(M));
    }
    if (bc === 'natural' || bc === 'clamped') {
      const N = n + 1, a = new Float64Array(N), b = new Float64Array(N), c = new Float64Array(N), d = new Float64Array(N);
      for (let i = 1; i < n; i++) {
        a[i] = h[i - 1]; b[i] = 2 * (h[i - 1] + h[i]); c[i] = h[i]; d[i] = 6 * (del[i] - del[i - 1]);
      }
      if (bc === 'natural') {
        b[0] = 1; c[0] = 0; d[0] = opts.m0 || 0;
        a[n] = 0; b[n] = 1; d[n] = opts.mn || 0;
      } else {
        const d0 = opts.d0 || 0, dn = opts.dn || 0;
        b[0] = 2 * h[0]; c[0] = h[0]; d[0] = 6 * (del[0] - d0);
        a[n] = h[n - 1]; b[n] = 2 * h[n - 1]; d[n] = 6 * (dn - del[n - 1]);
      }
      M = S.thomas(a, b, c, d);
    } else if (bc === 'notaknot') {
      const N = n + 1;
      const A = Array.from({ length: N }, () => new Float64Array(N)), r = new Float64Array(N);
      for (let i = 1; i < n; i++) {
        A[i][i - 1] = h[i - 1]; A[i][i] = 2 * (h[i - 1] + h[i]); A[i][i + 1] = h[i]; r[i] = 6 * (del[i] - del[i - 1]);
      }
      if (n === 2) { // jedna parabola: M0 = M1 = M2
        A[0][0] = 1; A[0][1] = -1; A[2][1] = 1; A[2][2] = -1;
      } else {
        A[0][0] = h[1]; A[0][1] = -(h[0] + h[1]); A[0][2] = h[0];
        A[n][n - 2] = h[n - 1]; A[n][n - 1] = -(h[n - 2] + h[n - 1]); A[n][n] = h[n - 2];
      }
      M = S.solve(A, r);
    } else if (bc === 'periodic') {
      // niewiadome M_0..M_{n-1}, M_n = M_0; zakładamy y_0 = y_n
      const N = n;
      const A = Array.from({ length: N }, () => new Float64Array(N)), r = new Float64Array(N);
      for (let i = 0; i < n; i++) {
        const hm = i === 0 ? h[n - 1] : h[i - 1], dm = i === 0 ? del[n - 1] : del[i - 1];
        const im = (i - 1 + n) % n, ip = (i + 1) % n;
        A[i][im] += hm; A[i][i] += 2 * (hm + h[i]); A[i][ip] += h[i];
        r[i] = 6 * (del[i] - dm);
      }
      const m = S.solve(A, r);
      M = Array.from(m); M.push(m[0]);
    } else throw new Error('nieznany warunek brzegowy: ' + bc);
    return S.splineFromMoments(xs, ys, Array.from(M));
  };

  /** Parametryzacja punktów: alpha = 0 (równomierna), 0.5 (dośrodkowa), 1 (cięciwowa). */
  S.parametrize = function (pts, alpha = 1) {
    const u = [0];
    for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + Math.max(1e-9, Math.pow(S.dist(pts[i - 1], pts[i]), alpha)));
    return u;
  };

  /** Parametryczna sześcienna funkcja sklejana przez punkty (krzywa). */
  S.paramSpline = function (pts, bc = 'natural', alpha = 1, opts = {}) {
    const u = S.parametrize(pts, alpha);
    const sx = S.cubicSpline(u, pts.map(p => p[0]), bc, opts.x || {});
    const sy = S.cubicSpline(u, pts.map(p => p[1]), bc, opts.y || {});
    return {
      u, sx, sy, umin: u[0], umax: u[u.length - 1],
      at: t => [sx.eval(t), sy.eval(t)],
      d1: t => [sx.d1(t), sy.d1(t)],
      d2: t => [sx.d2(t), sy.d2(t)],
      curvature(t) {
        const x1 = sx.d1(t), y1 = sy.d1(t), x2 = sx.d2(t), y2 = sy.d2(t);
        return (x1 * y2 - y1 * x2) / Math.pow(x1 * x1 + y1 * y1, 1.5);
      }
    };
  };

  // ----------------------------------------------------- interpolacja wielomianowa
  S.baryWeights = function (xs) {
    const n = xs.length, w = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      let p = 1;
      for (let k = 0; k < n; k++) if (k !== j) p *= (xs[j] - xs[k]);
      w[j] = 1 / p;
    }
    return w;
  };
  /** Węzły Czebyszewa drugiego rodzaju na [a,b] (rosnąco) i ich wagi barycentryczne (zamknięta postać). */
  S.chebNodes = function (n, a = -1, b = 1) {
    const xs = [], w = [];
    for (let j = 0; j <= n; j++) {
      xs.push((a + b) / 2 - (b - a) / 2 * Math.cos(j * Math.PI / n));
      w.push((j % 2 ? -1 : 1) * (j === 0 || j === n ? 0.5 : 1));
    }
    return { xs, w };
  };
  /** Wielomian interpolacyjny — wzór barycentryczny (drugiej postaci). */
  S.polyInterp = function (xs, ys, w) {
    w = w || S.baryWeights(xs);
    return function (x) {
      let num = 0, den = 0;
      for (let j = 0; j < xs.length; j++) {
        const dx = x - xs[j];
        if (dx === 0) return ys[j];
        const t = w[j] / dx;
        num += t * ys[j]; den += t;
      }
      return num / den;
    };
  };

  // ------------------------------------------------------------------- B-splajny
  /** Wartości wszystkich B-splajnów N_{i,k}(x), i = 0..m-k-1, gdzie m+1 = t.length. Rekurencja Coxa–de Boora. */
  S.basisAll = function (t, k, x) {
    const m = t.length - 1;
    let N = new Float64Array(m);
    for (let i = 0; i < m; i++) N[i] = (t[i] <= x && x < t[i + 1]) ? 1 : 0;
    if (x === t[m]) { // domknięcie prawego końca
      for (let i = m - 1; i >= 0; i--) if (t[i] < t[i + 1]) { N[i] = 1; break; }
    }
    for (let d = 1; d <= k; d++) {
      const R = new Float64Array(m - d);
      for (let i = 0; i < m - d; i++) {
        let v = 0;
        const d1 = t[i + d] - t[i], d2 = t[i + d + 1] - t[i + 1];
        if (d1 > 0 && N[i] !== 0) v += (x - t[i]) / d1 * N[i];
        if (d2 > 0 && N[i + 1] !== 0) v += (t[i + d + 1] - x) / d2 * N[i + 1];
        R[i] = v;
      }
      N = R;
    }
    return N;
  };

  /** Węzły „otwarte” (clamped): k+1 razy a, równomiernie wewnątrz, k+1 razy b. nCtrl + k + 1 węzłów. */
  S.clampedKnots = function (nCtrl, k, a = 0, b = 1) {
    const t = [], inner = nCtrl - k - 1;
    for (let i = 0; i <= k; i++) t.push(a);
    for (let i = 1; i <= inner; i++) t.push(a + (b - a) * i / (inner + 1));
    for (let i = 0; i <= k; i++) t.push(b);
    return t;
  };
  /** Węzły równomierne t_i = a + i*h, i = 0..nCtrl+k. Dziedzina krzywej: [t_k, t_nCtrl]. */
  S.uniformKnots = function (nCtrl, k, a = 0, h = 1) {
    return Array.from({ length: nCtrl + k + 1 }, (_, i) => a + i * h);
  };
  S.greville = function (t, k) {
    const n = t.length - k - 1, xi = [];
    for (let i = 0; i < n; i++) {
      if (k === 0) { xi.push((t[i] + t[i + 1]) / 2); continue; }
      let s = 0;
      for (let j = 1; j <= k; j++) s += t[i + j];
      xi.push(s / k);
    }
    return xi;
  };

  /** Algorytm de Boora: punkt krzywej B-splajnowej stopnia k w parametrze x. P: punkty kontrolne (tablice dowolnego wymiaru). */
  S.deBoor = function (P, t, k, x) {
    const n = P.length - 1;
    let s = k;
    const lo = t[k], hi = t[n + 1];
    if (x >= hi) { s = n; x = hi; }
    else { while (s < n && !(t[s] <= x && x < t[s + 1])) s++; }
    const dim = P[0].length;
    const d = [];
    for (let j = 0; j <= k; j++) d.push(P[j + s - k].slice());
    for (let r = 1; r <= k; r++) {
      for (let j = k; j >= r; j--) {
        const den = t[j + 1 + s - r] - t[j + s - k];
        const a = den > 0 ? (x - t[j + s - k]) / den : 0;
        for (let q = 0; q < dim; q++) d[j][q] = (1 - a) * d[j - 1][q] + a * d[j][q];
      }
    }
    void lo;
    return d[k];
  };

  /** Pochodna krzywej/funkcji B-splajnowej: zwraca {P, t, k} stopnia k-1. P: tablica punktów lub liczb. */
  S.bsplineDeriv = function (P, t, k) {
    const Q = [];
    const scalar = typeof P[0] === 'number';
    for (let i = 0; i < P.length - 1; i++) {
      const den = t[i + k + 1] - t[i + 1];
      const f = den > 0 ? k / den : 0;
      if (scalar) Q.push(f * (P[i + 1] - P[i]));
      else Q.push(P[i].map((v, q) => f * (P[i + 1][q] - v)));
    }
    return { P: Q, t: t.slice(1, -1), k: k - 1 };
  };

  /** Wartość funkcji sklejanej w postaci B: sum c_i N_{i,k}(x). */
  S.bsplineEval = function (c, t, k, x) {
    const N = S.basisAll(t, k, x);
    let s = 0;
    for (let i = 0; i < c.length && i < N.length; i++) s += c[i] * N[i];
    return s;
  };

  /** Wstawienie węzła u (algorytm Boehma). c: współczynniki (liczby lub punkty). Zwraca {c, t}. */
  S.insertKnot = function (c, t, k, u) {
    let s = S.findInterval(t, u);
    while (s + 1 < t.length - 1 && t[s + 1] <= u) s++;
    const scalar = typeof c[0] === 'number';
    const mix = (p, q, a) => scalar ? (1 - a) * p + a * q : p.map((v, j) => (1 - a) * v + a * q[j]);
    const nc = [];
    for (let i = 0; i <= c.length; i++) {
      if (i <= s - k) nc.push(c[i]);
      else if (i <= s) {
        const den = t[i + k] - t[i];
        const a = den > 0 ? (u - t[i]) / den : 0;
        nc.push(mix(c[i - 1], c[i], a));
      } else nc.push(c[i - 1]);
    }
    const nt = t.slice(0, s + 1).concat([u], t.slice(s + 1));
    return { c: nc, t: nt };
  };

  // --------------------------------------------------------- Bézier, Bernstein
  S.bernstein = (n, i, t) => S.binom(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i);
  /** Wszystkie poziomy algorytmu de Casteljau; ostatni poziom to [punkt krzywej]. */
  S.deCasteljauLevels = function (P, t) {
    const levels = [P.map(p => p.slice())];
    while (levels[levels.length - 1].length > 1) {
      const prev = levels[levels.length - 1], next = [];
      for (let i = 0; i < prev.length - 1; i++) next.push(S.lerpP(prev[i], prev[i + 1], t));
      levels.push(next);
    }
    return levels;
  };
  S.bezier = function (P, t) {
    const L = S.deCasteljauLevels(P, t);
    return L[L.length - 1][0];
  };
  /** Wymierna krzywa Béziera z wagami w. */
  S.rationalBezier = function (P, w, t) {
    const n = P.length - 1;
    let x = 0, y = 0, d = 0;
    for (let i = 0; i <= n; i++) {
      const b = S.bernstein(n, i, t) * w[i];
      x += b * P[i][0]; y += b * P[i][1]; d += b;
    }
    return [x / d, y / d];
  };

  // ----------------------------------------------------------------- Catmull–Rom
  /** Punkt segmentu Catmulla–Roma (sformułowanie Barry'ego–Goldmana) między P1 a P2, s ∈ [0,1]. */
  S.catmullRomPoint = function (P0, P1, P2, P3, s, alpha = 0.5) {
    const t0 = 0;
    const t1 = t0 + Math.max(1e-6, Math.pow(S.dist(P0, P1), alpha));
    const t2 = t1 + Math.max(1e-6, Math.pow(S.dist(P1, P2), alpha));
    const t3 = t2 + Math.max(1e-6, Math.pow(S.dist(P2, P3), alpha));
    const t = t1 + (t2 - t1) * s;
    const L = (A, B, ta, tb) => S.lerpP(A, B, (t - ta) / (tb - ta));
    const A1 = L(P0, P1, t0, t1), A2 = L(P1, P2, t1, t2), A3 = L(P2, P3, t2, t3);
    const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
    return L(B1, B2, t1, t2);
  };
  /** Krzywa Catmulla–Roma przez wszystkie punkty (końce przedłużone odbiciem). Zwraca łamaną. */
  S.catmullRom = function (pts, alpha = 0.5, perSeg = 24, closed = false) {
    const n = pts.length;
    if (n < 2) return pts.slice();
    const get = i => {
      if (closed) return pts[(i % n + n) % n];
      if (i < 0) return [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]];
      if (i >= n) return [2 * pts[n - 1][0] - pts[n - 2][0], 2 * pts[n - 1][1] - pts[n - 2][1]];
      return pts[i];
    };
    const out = [], segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < perSeg; j++) out.push(S.catmullRomPoint(get(i - 1), get(i), get(i + 1), get(i + 2), j / perSeg, alpha));
    }
    out.push(closed ? pts[0].slice() : pts[n - 1].slice());
    return out;
  };

  // --------------------------------------------- funkcja sklejana wygładzająca
  /** Spline wygładzający (Reinsch 1967): min Σ(y_i − f(x_i))² + λ∫f''². x rosnące, różne.
   * Zwraca ewaluator naturalnej funkcji sklejanej + pole df (ślad macierzy wygładzania). */
  S.smoothingSpline = function (xs, ys, lambda, wantDf = false) {
    const n = xs.length;
    if (n < 3) return S.cubicSpline(xs, ys, 'natural');
    const h = [];
    for (let i = 0; i < n - 1; i++) h.push(xs[i + 1] - xs[i]);
    const m = n - 2;
    // Q: n × m, kolumna j (0..m-1) odpowiada węzłowi wewnętrznemu j+1
    const Q = Array.from({ length: n }, () => new Float64Array(m));
    const R = Array.from({ length: m }, () => new Float64Array(m));
    for (let j = 0; j < m; j++) {
      const hl = h[j], hr = h[j + 1];
      Q[j][j] = 1 / hl; Q[j + 1][j] = -1 / hl - 1 / hr; Q[j + 2][j] = 1 / hr;
      R[j][j] = (hl + hr) / 3;
      if (j + 1 < m) { R[j][j + 1] = hr / 6; R[j + 1][j] = hr / 6; }
    }
    const QtQ = Array.from({ length: m }, () => new Float64Array(m));
    for (let a = 0; a < m; a++) for (let b = Math.max(0, a - 2); b < Math.min(m, a + 3); b++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += Q[i][a] * Q[i][b];
      QtQ[a][b] = s;
    }
    const A = Array.from({ length: m }, (_, a) => Float64Array.from(R[a], (v, b) => v + lambda * QtQ[a][b]));
    const Qty = new Float64Array(m);
    for (let a = 0; a < m; a++) { let s = 0; for (let i = 0; i < n; i++) s += Q[i][a] * ys[i]; Qty[a] = s; }
    const F = S.lu(A);
    const gamma = F.solve(Qty);
    const g = ys.map((y, i) => { let s = 0; for (let a = 0; a < m; a++) s += Q[i][a] * gamma[a]; return y - lambda * s; });
    const M = [0].concat(Array.from(gamma), [0]);
    const sp = S.splineFromMoments(xs, g, M);
    sp.fitted = g;
    if (wantDf) {
      // tr(S) = n − λ·tr((R + λQᵀQ)⁻¹ QᵀQ)
      let tr = 0;
      for (let b = 0; b < m; b++) { const col = F.solve(Array.from(QtQ, r => r[b])); tr += col[b]; }
      sp.df = n - lambda * tr;
    }
    return sp;
  };

  // ------------------------------------------------------- thin-plate spline (2D)
  const tpsU = r2 => (r2 > 1e-20 ? r2 * Math.log(r2) : 0); // U(r) = r² log r² (stała pochłonięta przez wagi)
  /** TPS odwzorowujący src[i] → dst[i]. Zwraca {map([x,y]) → [x', y'], energy}. */
  S.tpsFit = function (src, dst, reg = 0) {
    const n = src.length, N = n + 3;
    const A = Array.from({ length: N }, () => new Float64Array(N));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dx = src[i][0] - src[j][0], dy = src[i][1] - src[j][1];
        A[i][j] = tpsU(dx * dx + dy * dy) + (i === j ? reg : 0);
      }
      A[i][n] = 1; A[i][n + 1] = src[i][0]; A[i][n + 2] = src[i][1];
      A[n][i] = 1; A[n + 1][i] = src[i][0]; A[n + 2][i] = src[i][1];
    }
    const F = S.lu(A);
    const bx = new Float64Array(N), by = new Float64Array(N);
    for (let i = 0; i < n; i++) { bx[i] = dst[i][0]; by[i] = dst[i][1]; }
    const cx = F.solve(bx), cy = F.solve(by);
    return {
      map(p) {
        let x = cx[n] + cx[n + 1] * p[0] + cx[n + 2] * p[1];
        let y = cy[n] + cy[n + 1] * p[0] + cy[n + 2] * p[1];
        for (let i = 0; i < n; i++) {
          const dx = p[0] - src[i][0], dy = p[1] - src[i][1];
          const u = tpsU(dx * dx + dy * dy);
          x += cx[i] * u; y += cy[i] * u;
        }
        return [x, y];
      },
      /** Energia zginania ∝ wᵀKw (suma dla obu współrzędnych). */
      energy() {
        let e = 0;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) e += (cx[i] * cx[j] + cy[i] * cy[j]) * (A[i][j] - (i === j ? reg : 0));
        return e;
      }
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  else root.Splines = S;
})(typeof window !== 'undefined' ? window : this);
