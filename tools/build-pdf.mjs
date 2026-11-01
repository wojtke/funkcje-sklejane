// Eksport PDF przez Chrome headless i DevTools Protocol.
// Drukuje dopiero, gdy reveal.js rozłoży slajdy (?print-pdf) — nie polega na --virtual-time-budget,
// które potrafi wydrukować pustą stronę, zanim układ PDF jest gotowy.
// Użycie: node tools/build-pdf.mjs [plik-wyjściowy.pdf]   (uruchamiać z katalogu prezentacji)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = path.resolve(process.argv[2] || 'funkcje-sklejane.pdf');
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = pathToFileURL(path.resolve('index.html')).href + '?print-pdf';
const profile = mkdtempSync(path.join(tmpdir(), 'spl-pdf-'));
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => { if (process.env.DEBUG) console.error('[pdf]', ...a); };
setTimeout(() => { console.error('Przekroczono limit czasu (120 s)'); proc.kill(); process.exit(1); }, 120000).unref();

try {
  // port DevTools z komunikatu „DevTools listening on ws://127.0.0.1:PORT/...”
  const port = await new Promise((resolve, reject) => {
    let buf = '';
    proc.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//); if (m) resolve(m[1]); });
    setTimeout(() => reject(new Error('Chrome nie wystartował')), 20000);
  });
  log('port', port);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, m => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

  log('połączono');
  await send('Page.enable');
  await send('Page.navigate', { url });
  // czekamy na układ PDF: strony .pdf-page, czcionki, a potem chwilę na narysowanie dem
  const t0 = Date.now();
  let pages = 0;
  while (Date.now() - t0 < 60000) {
    await sleep(300);
    try { pages = await evaluate("document.querySelectorAll('.reveal .pdf-page').length"); } catch { pages = 0; }
    log('strony', pages);
    if (pages > 0) break;
  }
  if (!pages) throw new Error('reveal.js nie przygotował stron PDF w 60 s');
  await evaluate('document.fonts.ready.then(() => true)');
  log('czcionki gotowe');
  await sleep(2500);
  log('drukuję');
  // duży PDF: odbieramy strumieniem w kawałkach (jedna wielka wiadomość WebSocket potrafi utknąć)
  const { stream } = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: false, transferMode: 'ReturnAsStream' });
  const chunks = [];
  for (;;) {
    const r = await send('IO.read', { handle: stream, size: 1 << 20 });
    chunks.push(Buffer.from(r.data, r.base64Encoded ? 'base64' : 'utf8'));
    if (r.eof) break;
  }
  await send('IO.close', { handle: stream });
  writeFileSync(out, Buffer.concat(chunks));
  console.log(`Zapisano: ${process.argv[2] || "funkcje-sklejane.pdf"} (${pages} slajdów)`);
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
