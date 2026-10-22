/* core.js — wspólna infrastruktura dem: płótno (HiDPI + skala reveal.js), układ współrzędnych,
 * przeciąganie punktów, kontrolki, kolory motywu i cykl życia (start/stop przy zmianie slajdu).
 *
 * Rejestracja dema:
 *   SPL.register('nazwa', function (el, opts) {
 *     const st = SPL.stage(el, 720, 420);          // płótno w jednostkach slajdu
 *     ...
 *     return { render, activate, deactivate };     // activate/deactivate opcjonalne
 *   });
 * Kontener w HTML: <div class="demo" data-demo="nazwa" data-prevent-swipe></div>
 */
(function () {
  'use strict';
  const SPL = window.SPL = window.SPL || {};
  const Sp = window.Splines;

  SPL.factories = {};
  SPL.instances = [];
  SPL.stages = [];
  SPL.print = /print-pdf/gi.test(window.location.search);
  SPL.register = (name, factory) => { SPL.factories[name] = factory; };

  // ------------------------------------------------------------------ kolory
  const VARS = ['bg', 'ink', 'muted', 'faint', 'grid', 'card', 'blue', 'orange', 'green', 'purple', 'red', 'teal', 'yellow', 'pink'];
  SPL.c = {};
  SPL.readTheme = function () {
    const cs = getComputedStyle(document.documentElement);
    for (const v of VARS) SPL.c[v] = cs.getPropertyValue('--' + v).trim() || '#888';
    SPL.c.palette = [SPL.c.blue, SPL.c.orange, SPL.c.green, SPL.c.purple, SPL.c.red, SPL.c.teal, SPL.c.yellow, SPL.c.pink];
    SPL.c.dark = document.documentElement.classList.contains('dark');
  };
  SPL.alpha = function (color, a) { // '#rrggbb' → rgba
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
    if (!m) return color;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
  };
  SPL.font = (px, weight = 500, mono = false) =>
    `${weight} ${px}px ${mono ? '"JetBrains Mono", ui-monospace, monospace' : 'Inter, system-ui, sans-serif'}`;

  SPL.toggleTheme = function () {
    document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('spl-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); } catch (e) { /* brak dostępu */ }
    SPL.readTheme();
    SPL.renderAll();
  };

  // ------------------------------------------------------------------ płótno
  class Stage {
    constructor(parent, w, h, cls) {
      this.w = w; this.h = h;
      this.el = document.createElement('canvas');
      this.el.className = 'spl-canvas' + (cls ? ' ' + cls : '');
      this.el.style.width = w + 'px';
      this.el.style.height = h + 'px';
      parent.appendChild(this.el);
      this.ctx = this.el.getContext('2d');
      this.fit();
      SPL.stages.push(this);
    }
    fit() {
      let scale = 1;
      try { scale = (window.Reveal && Reveal.isReady && Reveal.isReady()) ? Reveal.getScale() : 1; } catch (e) { scale = 1; }
      // w trybie druku (PDF) rysujemy w 2× rozdzielczości, żeby wykresy były ostre po powiększeniu
      const dpr = SPL.print ? 2 : Math.min(4, (window.devicePixelRatio || 1) * Math.max(1, scale || 1));
      const W = Math.round(this.w * dpr), H = Math.round(this.h * dpr);
      if (this.el.width !== W || this.el.height !== H) { this.el.width = W; this.el.height = H; }
      this.dpr = dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    clear() {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
    /** Pozycja wskaźnika w jednostkach płótna (odporne na transformacje CSS). */
    pointer(ev) {
      const r = this.el.getBoundingClientRect();
      return [(ev.clientX - r.left) * this.w / r.width, (ev.clientY - r.top) * this.h / r.height];
    }
  }
  SPL.Stage = Stage;
  SPL.stage = (parent, w, h, cls) => new Stage(parent, w, h, cls);

  // ------------------------------------------------- układ współrzędnych (świat → px)
  class Plot {
    /** rect = {x, y, w, h} w px płótna; dom = {xmin, xmax, ymin, ymax} w jednostkach świata. */
    constructor(stage, rect, dom) {
      this.st = stage; this.ctx = stage.ctx;
      this.r = rect;
      Object.assign(this, { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, dom);
    }
    X(x) { return this.r.x + (x - this.xmin) / (this.xmax - this.xmin) * this.r.w; }
    Y(y) { return this.r.y + (1 - (y - this.ymin) / (this.ymax - this.ymin)) * this.r.h; }
    P(p) { return [this.X(p[0]), this.Y(p[1])]; }
    ix(px) { return this.xmin + (px - this.r.x) / this.r.w * (this.xmax - this.xmin); }
    iy(py) { return this.ymin + (1 - (py - this.r.y) / this.r.h) * (this.ymax - this.ymin); }
    iP(q) { return [this.ix(q[0]), this.iy(q[1])]; }
    inside(px, py) { return px >= this.r.x && px <= this.r.x + this.r.w && py >= this.r.y && py <= this.r.y + this.r.h; }
    /** Wykonuje rysowanie przycięte do prostokąta wykresu. */
    clip(draw) {
      const c = this.ctx;
      c.save(); c.beginPath(); c.rect(this.r.x, this.r.y, this.r.w, this.r.h); c.clip();
      draw(c); c.restore();
    }
    /** Siatka i osie. o: {dx, dy, labels: true, xfmt, yfmt, axes: true, frame: false} */
    grid(o = {}) {
      const c = this.ctx, C = SPL.c;
      const dx = o.dx || niceStep(this.xmax - this.xmin), dy = o.dy || niceStep(this.ymax - this.ymin);
      c.save();
      c.lineWidth = 1; c.strokeStyle = C.grid;
      c.beginPath();
      for (let x = Math.ceil(this.xmin / dx) * dx; x <= this.xmax + 1e-9; x += dx) { const X = Math.round(this.X(x)) + 0.5; c.moveTo(X, this.r.y); c.lineTo(X, this.r.y + this.r.h); }
      for (let y = Math.ceil(this.ymin / dy) * dy; y <= this.ymax + 1e-9; y += dy) { const Y = Math.round(this.Y(y)) + 0.5; c.moveTo(this.r.x, Y); c.lineTo(this.r.x + this.r.w, Y); }
      c.stroke();
      if (o.axes !== false) {
        c.strokeStyle = C.faint; c.lineWidth = 1.25; c.beginPath();
        if (this.ymin <= 0 && this.ymax >= 0) { const Y = Math.round(this.Y(0)) + 0.5; c.moveTo(this.r.x, Y); c.lineTo(this.r.x + this.r.w, Y); }
        if (this.xmin <= 0 && this.xmax >= 0) { const X = Math.round(this.X(0)) + 0.5; c.moveTo(X, this.r.y); c.lineTo(X, this.r.y + this.r.h); }
        c.stroke();
      }
      if (o.frame) { c.strokeStyle = C.faint; c.strokeRect(this.r.x + 0.5, this.r.y + 0.5, this.r.w, this.r.h); }
      if (o.labels) {
        const xf = o.xfmt || fmtTick, yf = o.yfmt || fmtTick;
        c.fillStyle = C.muted; c.font = SPL.font(12, 500);
        c.textAlign = 'center'; c.textBaseline = 'top';
        const yl = this.ymin <= 0 && this.ymax >= 0 && !o.labelsOutside ? this.Y(0) + 4 : this.r.y + this.r.h + 4;
        for (let x = Math.ceil(this.xmin / dx) * dx; x <= this.xmax + 1e-9; x += dx) if (Math.abs(x) > 1e-12 || o.zero) c.fillText(xf(x), this.X(x), yl);
        c.textAlign = 'right'; c.textBaseline = 'middle';
        const xl = this.xmin <= 0 && this.xmax >= 0 && !o.labelsOutside ? this.X(0) - 5 : this.r.x - 5;
        for (let y = Math.ceil(this.ymin / dy) * dy; y <= this.ymax + 1e-9; y += dy) if (Math.abs(y) > 1e-12 || o.zero) c.fillText(yf(y), xl, this.Y(y));
      }
      c.restore();
    }
    /** Wykres funkcji f na [a,b] (domyślnie cała dziedzina). Przerywa linię przy NaN/nieskończoności. */
    fn(f, style = {}, a = this.xmin, b = this.xmax, N) {
      N = N || Math.max(200, Math.round(this.r.w * 1.5));
      const pts = [];
      for (let i = 0; i <= N; i++) { const x = a + (b - a) * i / N; pts.push([x, f(x)]); }
      this.path(pts, style);
    }
    /** Łamana w jednostkach świata. style: {color, width, dash, alpha, fill, clip=true} */
    path(pts, style = {}) {
      const draw = c => {
        c.save();
        c.strokeStyle = style.color || SPL.c.ink; c.lineWidth = style.width || 2;
        c.lineJoin = 'round'; c.lineCap = 'round';
        if (style.alpha != null) c.globalAlpha = style.alpha;
        if (style.dash) c.setLineDash(style.dash);
        c.beginPath();
        let pen = false;
        const lim = 1e5;
        for (const p of pts) {
          const X = this.X(p[0]), Y = this.Y(p[1]);
          if (!isFinite(X) || !isFinite(Y) || Math.abs(Y) > lim || Math.abs(X) > lim) { pen = false; continue; }
          if (!pen) { c.moveTo(X, Y); pen = true; } else c.lineTo(X, Y);
        }
        if (style.fill) { c.fillStyle = style.fill; c.fill(); }
        if (style.width !== 0) c.stroke();
        c.restore();
      };
      if (style.clip === false) draw(this.ctx); else this.clip(draw);
    }
    dot(p, style = {}) { SPL.dot(this.ctx, this.X(p[0]), this.Y(p[1]), style); }
  }
  SPL.Plot = Plot;
  SPL.plot = (stage, rect, dom) => new Plot(stage, rect, dom);

  function niceStep(span) {
    const raw = span / 8, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  function fmtTick(v) {
    if (Math.abs(v) < 1e-12) return '0';
    const a = Math.abs(v);
    if (a >= 1e4 || a < 1e-3) return v.toExponential(0);
    return String(Math.round(v * 1000) / 1000).replace('-', '−');
  }
  SPL.fmt = function (v, digits = 3) {
    if (!isFinite(v)) return '∞';
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e4 || a < 1e-3)) {
      const [m, e] = v.toExponential(digits - 1).split('e');
      return `${m.replace('-', '−')}·10<sup>${e.replace('+', '').replace('-', '−')}</sup>`;
    }
    return v.toPrecision(digits).replace('-', '−');
  };

  // ------------------------------------------------------------------ prymitywy
  /** Punkt (uchwyt). style: {r, fill, stroke, width, hollow, label, active} */
  SPL.dot = function (c, x, y, s = {}) {
    const r = s.r || 6;
    c.save();
    c.beginPath(); c.arc(x, y, s.active ? r + 2 : r, 0, 2 * Math.PI);
    c.fillStyle = s.hollow ? SPL.c.card : (s.fill || SPL.c.ink);
    c.fill();
    c.lineWidth = s.width || 2; c.strokeStyle = s.stroke || (s.hollow ? (s.fill || SPL.c.ink) : SPL.c.card);
    c.stroke();
    if (s.label) {
      c.fillStyle = s.labelColor || SPL.c.muted; c.font = SPL.font(13, 600);
      c.textAlign = 'left'; c.textBaseline = 'bottom';
      c.fillText(s.label, x + r + 3, y - r - 1);
    }
    c.restore();
  };
  SPL.line = function (c, pts, s = {}) {
    if (!pts.length) return;
    c.save();
    c.strokeStyle = s.color || SPL.c.ink; c.lineWidth = s.width || 2;
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (s.alpha != null) c.globalAlpha = s.alpha;
    if (s.dash) c.setLineDash(s.dash);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (s.close) c.closePath();
    if (s.fill) { c.fillStyle = s.fill; c.fill(); }
    c.stroke();
    c.restore();
  };
  SPL.text = function (c, str, x, y, s = {}) {
    c.save();
    c.fillStyle = s.color || SPL.c.ink;
    c.font = SPL.font(s.size || 14, s.weight || 500, s.mono);
    c.textAlign = s.align || 'left'; c.textBaseline = s.baseline || 'alphabetic';
    if (s.bg) {
      const m = c.measureText(str), pad = 4, w = m.width + 2 * pad, h = (s.size || 14) + 2 * pad;
      const ox = s.align === 'center' ? -w / 2 : s.align === 'right' ? -w : 0;
      c.fillStyle = s.bg; c.fillRect(x + ox - (s.align === 'center' || s.align === 'right' ? 0 : pad), y - h + pad + 2, w, h);
      c.fillStyle = s.color || SPL.c.ink;
    }
    c.fillText(str, x, y);
    c.restore();
  };

  // ------------------------------------------------------------- przeciąganie
  /** Obsługa przeciągania na płótnie.
   * o.points(): tablica punktów w px płótna (lub null dla punktów nieaktywnych)
   * o.move(i, [px,py], ev), o.down?(i, [px,py], ev) — i = -1 gdy klik w pustym miejscu,
   * o.dbl?(i, [px,py]), o.up?(i), o.hover?(i), o.radius (domyślnie 14) */
  SPL.drag = function (stage, o) {
    const el = stage.el, R = o.radius || 14;
    let active = -1, hover = -1;
    el.style.touchAction = 'none';
    const hit = q => {
      const pts = o.points();
      let best = -1, bd = R * R;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]; if (!p) continue;
        const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
        if (d <= bd) { bd = d; best = i; }
      }
      return best;
    };
    el.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      const q = stage.pointer(ev);
      active = hit(q);
      if (o.down) o.down(active, q, ev);
      if (active >= 0 || o.captureAll) {
        el.setPointerCapture(ev.pointerId);
        el.classList.add('grabbing');
        ev.preventDefault(); ev.stopPropagation();
      }
    });
    el.addEventListener('pointermove', ev => {
      const q = stage.pointer(ev);
      if (active >= 0) { o.move(active, q, ev); ev.preventDefault(); return; }
      if (o.dragEmpty && el.hasPointerCapture && el.hasPointerCapture(ev.pointerId)) { o.dragEmpty(q, ev); return; }
      const h = hit(q);
      if (h !== hover) { hover = h; el.classList.toggle('can-grab', h >= 0); if (o.hover) o.hover(h); }
    });
    const end = ev => {
      if (active >= 0 && o.up) o.up(active);
      active = -1;
      el.classList.remove('grabbing');
      try { el.releasePointerCapture(ev.pointerId); } catch (e) { /* już zwolnione */ }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', () => { if (active < 0 && hover !== -1) { hover = -1; el.classList.remove('can-grab'); if (o.hover) o.hover(-1); } });
    if (o.dbl) el.addEventListener('dblclick', ev => { const q = stage.pointer(ev); o.dbl(hit(q), q, ev); ev.preventDefault(); ev.stopPropagation(); });
    return { get active() { return active; }, get hover() { return hover; } };
  };

  // ------------------------------------------------------------------ kontrolki
  // Wszystkie kontrolki oddają fokus po użyciu, aby pilot/strzałki dalej przełączały slajdy.
  const blur = el => setTimeout(() => el.blur(), 0);
  SPL.ui = {
    panel(parent, cls) {
      const d = document.createElement('div');
      d.className = 'ctrls' + (cls ? ' ' + cls : '');
      parent.appendChild(d);
      return d;
    },
    slider(panel, o) {
      const wrap = document.createElement('label');
      wrap.className = 'ctl slider';
      const lab = document.createElement('span'); lab.className = 'lab'; lab.innerHTML = o.label;
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = o.min; inp.max = o.max; inp.step = o.step || 'any'; inp.value = o.value;
      const val = document.createElement('span'); val.className = 'val';
      const fmt = o.fmt || (v => String(v));
      const upd = () => { val.innerHTML = fmt(+inp.value); };
      inp.addEventListener('input', () => { upd(); o.onInput && o.onInput(+inp.value); });
      inp.addEventListener('change', () => { o.onChange && o.onChange(+inp.value); blur(inp); });
      inp.addEventListener('pointerup', () => blur(inp));
      wrap.append(lab, inp, val); panel.appendChild(wrap); upd();
      return { el: wrap, input: inp, get: () => +inp.value, set(v) { inp.value = v; upd(); } };
    },
    button(panel, label, onClick, cls) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ctl btn' + (cls ? ' ' + cls : ''); b.innerHTML = label;
      b.addEventListener('click', ev => { onClick(ev); blur(b); });
      panel.appendChild(b);
      return b;
    },
    toggle(panel, label, value, onChange) {
      const wrap = document.createElement('label'); wrap.className = 'ctl toggle';
      const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!value;
      const sw = document.createElement('span'); sw.className = 'sw';
      const lab = document.createElement('span'); lab.innerHTML = label;
      inp.addEventListener('change', () => { onChange(inp.checked); blur(inp); });
      wrap.append(inp, sw, lab); panel.appendChild(wrap);
      return { el: wrap, get: () => inp.checked, set(v) { inp.checked = !!v; } };
    },
    /** Przełącznik segmentowy. options: [{value, label}] */
    segmented(panel, options, value, onChange, label) {
      const wrap = document.createElement('div'); wrap.className = 'ctl seg';
      if (label) { const l = document.createElement('span'); l.className = 'lab'; l.innerHTML = label; wrap.appendChild(l); }
      const btns = options.map(op => {
        const b = document.createElement('button'); b.type = 'button'; b.innerHTML = op.label; b.dataset.value = op.value;
        b.addEventListener('click', () => { set(op.value); onChange(op.value); blur(b); });
        wrap.appendChild(b); return b;
      });
      function set(v) { btns.forEach(b => b.classList.toggle('on', b.dataset.value === String(v))); }
      set(value); panel.appendChild(wrap);
      return { el: wrap, set };
    },
    readout(panel, label) {
      const d = document.createElement('div'); d.className = 'ctl readout';
      d.innerHTML = label ? `<span class="lab">${label}</span><span class="val"></span>` : '<span class="val"></span>';
      panel.appendChild(d);
      const v = d.querySelector('.val');
      return { el: d, set(html) { v.innerHTML = html; } };
    },
    hint(panel, html) {
      const d = document.createElement('div'); d.className = 'ctl hint'; d.innerHTML = html;
      panel.appendChild(d); return d;
    }
  };

  // -------------------------------------------------------- pętla animacji
  /** Pętla requestAnimationFrame; step(dt w sekundach, t). Zwraca {start, stop, running}. */
  SPL.loop = function (step) {
    let id = 0, last = 0, t = 0;
    const frame = now => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now; t += dt;
      if (step(dt, t) === false) { id = 0; return; }
      id = requestAnimationFrame(frame);
    };
    return {
      start() { if (!id && !SPL.print) { last = 0; id = requestAnimationFrame(frame); } },
      stop() { if (id) cancelAnimationFrame(id); id = 0; },
      get running() { return !!id; }
    };
  };

  // ------------------------------------------------------------ cykl życia
  SPL.renderAll = function () {
    for (const s of SPL.stages) s.fit();
    for (const inst of SPL.instances) { try { inst.api.render && inst.api.render(); } catch (e) { console.error('[SPL] render', inst.name, e); } }
  };

  function slideOf(el) { return el.closest('section'); }

  SPL.updateActive = function () {
    const cur = window.Reveal ? Reveal.getCurrentSlide() : null;
    for (const inst of SPL.instances) {
      const on = !!cur && (inst.slide === cur || cur.contains(inst.el));
      if (on && !inst.on) { inst.on = true; inst.api.activate && inst.api.activate(); }
      else if (!on && inst.on) { inst.on = false; inst.api.deactivate && inst.api.deactivate(); }
    }
  };

  SPL.initAll = function (root) {
    SPL.readTheme();
    (root || document).querySelectorAll('[data-demo]').forEach(el => {
      if (el.dataset.ready) return;
      const name = el.dataset.demo, f = SPL.factories[name];
      if (!f) { console.warn('[SPL] brak dema', name); return; }
      el.dataset.ready = '1';
      el.setAttribute('data-prevent-swipe', '');
      try {
        const api = f(el, Object.assign({}, el.dataset)) || {};
        SPL.instances.push({ name, el, slide: slideOf(el), api, on: false });
        api.render && api.render();
      } catch (e) {
        console.error('[SPL] init', name, e);
        el.innerHTML = `<div class="demo-error">Błąd dema „${name}”: ${e.message}</div>`;
      }
    });
  };

  // Theme z localStorage przed pierwszym renderem
  try { if (localStorage.getItem('spl-theme') === 'dark' && !SPL.print) document.documentElement.classList.add('dark'); } catch (e) { /* brak dostępu */ }

  SPL.Sp = Sp;
})();
