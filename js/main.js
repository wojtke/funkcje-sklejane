/* main.js — start prezentacji: KaTeX, reveal.js, dema, kod QR. */
(function () {
  'use strict';

  renderMathInElement(document.querySelector('.reveal .slides'), {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false }
    ],
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'aside'],
    throwOnError: false
  });

  // Pełny ekran: F (włącz/wyłącz), F5 z pilota zamiast przeładowania strony, przycisk w lewym dolnym rogu
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const fsEnabled = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  function toggleFullscreen() {
    if (!fsEnabled) return;
    const root = document.documentElement;
    const p = fsElement()
      ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    if (p && p.catch) p.catch(() => {});
  }

  Reveal.initialize({
    width: 1280,
    height: 720,
    margin: 0.035,
    minScale: 0.2,
    maxScale: 3,
    center: false,
    hash: true,
    controls: true,
    controlsTutorial: false,
    progress: true,
    // numer slajdu tylko na ścieżce głównej (np. 4 / 17); dodatki pod spodem jako 4.1, 4.2
    slideNumber: slide => {
      const i = Reveal.getIndices(slide);
      return [i.v ? `${i.h + 1}.${i.v}` : `${i.h + 1}`, '/', Reveal.getHorizontalSlides().length]; // liczba, inaczej reveal pokaże tylko pierwszą część
    },
    transition: 'fade',
    transitionSpeed: 'fast',
    backgroundTransition: 'none',
    pdfSeparateFragments: false,
    pdfMaxPagesPerSlide: 1,
    preloadIframes: false,
    defaultTiming: 0, // czasy slajdów z data-timing → licznik tempa w widoku prelegenta (S)
    plugins: [RevealNotes, RevealHighlight],
    keyboard: {
      68: () => SPL.toggleTheme(), // D — tryb ciemny
      70: toggleFullscreen, // F — pełny ekran (włącz/wyłącz)
      116: toggleFullscreen, // F5 — przycisk „pokaz slajdów” w pilotach
      // pilot (PageDown/PageUp) i spacja idą ścieżką główną, nie w dodatki ↓
      34: () => Reveal.right(),
      33: () => Reveal.left(),
      32: () => Reveal.right()
    }
  }).then(() => {
    SPL.initAll();
    SPL.renderAll();
    SPL.updateActive();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => SPL.renderAll());
  });

  Reveal.on('slidechanged', () => SPL.updateActive());
  Reveal.on('resize', () => SPL.renderAll());
  Reveal.on('pdf-ready', () => SPL.renderAll());

  // Przycisk pełnego ekranu: nie w PDF i nie w podglądach widoku prelegenta (iframe)
  let inFrame = true;
  try { inFrame = window.self !== window.top; } catch (e) {}
  if (fsEnabled && !inFrame && !/print-pdf/.test(location.search)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fs-btn';
    btn.innerHTML =
      '<svg class="fs-enter" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' +
      '<svg class="fs-exit" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
    // blur: fokus wraca do prezentacji, więc Enter/spacja nie przełączają pełnego ekranu ponownie
    btn.addEventListener('click', () => { toggleFullscreen(); btn.blur(); });
    document.body.appendChild(btn);
    const sync = () => {
      const on = !!fsElement();
      document.documentElement.classList.toggle('is-fullscreen', on);
      btn.title = on ? 'Zakończ pełny ekran (F)' : 'Pełny ekran (F)';
      btn.setAttribute('aria-label', btn.title);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
  }

  // Zegar: przytrzymaj C. Prawy górny róg, słabo widoczny: czas wystąpienia i godzina.
  // Czas liczy się od wyjścia ze slajdu tytułowego; powrót na tytuł go zeruje (wygodne przy próbach).
  // Start zapisany w sessionStorage, więc przypadkowe przeładowanie strony go nie gubi.
  if (!inFrame && !/print-pdf/.test(location.search)) {
    const clock = document.createElement('div');
    clock.className = 'talk-clock';
    clock.setAttribute('aria-hidden', 'true');
    document.body.appendChild(clock);
    const KEY = 'spl-talk-start';
    let start = null;
    try { const v = +sessionStorage.getItem(KEY); if (v && Date.now() - v < 3 * 3600e3) start = v; } catch (e) {}
    const setStart = v => {
      start = v;
      try { if (v) sessionStorage.setItem(KEY, String(v)); else sessionStorage.removeItem(KEY); } catch (e) {}
    };
    const onSlide = () => {
      if (Reveal.getIndices().h === 0) setStart(null);
      else if (start === null) setStart(Date.now());
    };
    Reveal.on('slidechanged', onSlide);
    if (Reveal.isReady()) onSlide(); else Reveal.on('ready', onSlide);

    const pad = n => String(n).padStart(2, '0');
    const render = () => {
      const s = start ? Math.max(0, Math.floor((Date.now() - start) / 1000)) : 0;
      const now = new Date();
      clock.innerHTML = `<b>${Math.floor(s / 60)}:${pad(s % 60)}</b><span>${pad(now.getHours())}:${pad(now.getMinutes())}</span>`;
    };
    let tick = null;
    const show = on => {
      if (on === clock.classList.contains('on')) return;
      clock.classList.toggle('on', on);
      clearInterval(tick); tick = null;
      if (on) { render(); tick = setInterval(render, 250); }
    };
    const isC = e => e.code === 'KeyC' || e.key === 'c' || e.key === 'C';
    document.addEventListener('keydown', e => {
      if (!isC(e) || e.metaKey || e.ctrlKey || e.altKey) return; // Cmd+C itp. bez zmian
      const a = document.activeElement;
      if (a && (a.isContentEditable || /^(input|textarea|select)$/i.test(a.tagName))) return;
      show(true);
    });
    document.addEventListener('keyup', e => { if (isC(e)) show(false); });
    window.addEventListener('blur', () => show(false)); // puszczenie C w innym oknie
  }

  // Kod QR do adresu prezentacji (tylko gdy serwowana przez http/https)
  const qrEl = document.getElementById('qr');
  if (qrEl) {
    // na GitHub Pages: bieżący adres; lokalnie (file://, PDF): adres publiczny z data-url
    const live = /^https?:/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname);
    const url = live ? location.origin + location.pathname : qrEl.dataset.url;
    if (url && typeof qrcode === 'function') {
      const qr = qrcode(0, 'M');
      qr.addData(url); qr.make();
      qrEl.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      const u = document.getElementById('qr-url');
      if (u) u.textContent = url.replace(/^https?:\/\//, '');
    } else {
      qrEl.closest('.qr-wrap').style.visibility = 'hidden';
    }
  }
})();
