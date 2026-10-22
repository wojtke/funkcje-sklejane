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
    slideNumber: 'c/t',
    transition: 'fade',
    transitionSpeed: 'fast',
    backgroundTransition: 'none',
    pdfSeparateFragments: false,
    pdfMaxPagesPerSlide: 1,
    preloadIframes: false,
    plugins: [RevealNotes, RevealHighlight],
    keyboard: { 68: () => SPL.toggleTheme() } // D — tryb ciemny
  }).then(() => {
    SPL.initAll();
    SPL.renderAll();
    SPL.updateActive();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => SPL.renderAll());
  });

  Reveal.on('slidechanged', () => SPL.updateActive());
  Reveal.on('resize', () => SPL.renderAll());
  Reveal.on('pdf-ready', () => SPL.renderAll());

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
