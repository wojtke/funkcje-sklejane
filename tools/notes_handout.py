"""Notatki prelegenta do druku: zbiera <aside class="notes"> ze slajdów (ścieżka główna + dodatki ↓).
Użycie: python3 notes_handout.py index.html wyjście.html katalog-czcionek"""
import re, sys, html
from html.parser import HTMLParser
src, out_html = sys.argv[1], sys.argv[2]
FONTS = sys.argv[3] if len(sys.argv) > 3 else 'fonts'
doc = open(src, encoding='utf-8').read()

class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=False); s.depth = 0; s.slides = []; s.cur = None
        s.in_title = False; s.in_notes = 0; s.h = 0; s.v = 0
    def handle_starttag(s, t, a):
        a = dict(a)
        if s.in_notes:
            if t == 'aside': s.in_notes += 1
            s.cur['notes'] += s.get_starttag_text(); return
        if t == 'section':
            s.depth += 1
            if s.depth == 1: s.h += 1; s.v = 0
            else: s.v += 1
            s.cur = {'h': s.h, 'v': s.v, 'timing': a.get('data-timing'), 'title': '', 'notes': ''}
            s.slides.append(s.cur)
        elif t in ('h1', 'h2') and s.cur is not None and not s.cur['title']: s.in_title = True
        elif t == 'aside' and 'notes' in (a.get('class') or ''): s.in_notes = 1
    def handle_endtag(s, t):
        if s.in_notes:
            if t == 'aside':
                s.in_notes -= 1
                if s.in_notes == 0: return
            s.cur['notes'] += f'</{t}>'; return
        if t == 'section': s.depth -= 1
        if t in ('h1', 'h2'): s.in_title = False
    def handle_data(s, d):
        if s.in_notes: s.cur['notes'] += d
        elif s.in_title: s.cur['title'] += d
    def handle_entityref(s, n):
        if s.in_notes: s.cur['notes'] += f'&{n};'
        elif s.in_title: s.cur['title'] += html.unescape(f'&{n};')
    def handle_charref(s, n): s.handle_entityref('#' + n)

p = P(); p.feed(doc)
slides = [x for x in p.slides if x['notes'].strip()]
main = [x for x in slides if x['timing']]
extra = [x for x in slides if not x['timing']]
def clean_title(t): return re.sub(r'\s+', ' ', t.replace('Funkcje sklejanei', 'Funkcje sklejane i')).strip()
def split_head(n):
    m = re.match(r'\s*<p><b>(⏱[^<]*)</b>([^<]*)</p>', n)
    return (m.group(1) + m.group(2), n[m.end():]) if m else ('', n)

parts = []
for i, x in enumerate(main, 1):
    head, body = split_head(x['notes'])
    parts.append(f'<section class="sl"><h2><span class="n">{i}</span>{html.escape(clean_title(x["title"]))}'
                 f'<span class="t">{html.escape(head)}</span></h2>{body}</section>')
ex = []
for x in extra:
    body = re.sub(r'\s*<p><b>Dodatek</b>[^<]*</p>', '', x['notes'])
    parent = next(m for m in main if m['h'] == x['h'])
    ex.append(f'<section class="sl ex"><h3>↓ {html.escape(clean_title(x["title"]))} '
              f'<span class="under">(pod: {html.escape(clean_title(parent["title"]))})</span></h3>{body}</section>')
total = sum(int(x['timing']) for x in main)
page = f'''<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Notatki prelegenta — Funkcje sklejane</title>
<style>
@font-face {{ font-family: Inter; font-weight: 400; src: url({FONTS}/inter-latin-400-normal.woff2) format("woff2"); unicode-range: U+0000-00FF, U+2000-206F, U+2191, U+2193, U+2212; }}
@font-face {{ font-family: Inter; font-weight: 400; src: url({FONTS}/inter-latin-ext-400-normal.woff2) format("woff2"); unicode-range: U+0100-02BA, U+1E00-1E9F; }}
@font-face {{ font-family: Inter; font-weight: 700; src: url({FONTS}/inter-latin-700-normal.woff2) format("woff2"); unicode-range: U+0000-00FF, U+2000-206F, U+2191, U+2193, U+2212; }}
@font-face {{ font-family: Inter; font-weight: 700; src: url({FONTS}/inter-latin-ext-700-normal.woff2) format("woff2"); unicode-range: U+0100-02BA, U+1E00-1E9F; }}
@page {{ size: A4; margin: 13mm 14mm; }}
body {{ font-family: Inter, -apple-system, Helvetica, sans-serif; font-size: 10.6pt; line-height: 1.38; color: #1a1a1a; margin: 0; }}
h1 {{ font-size: 17pt; margin: 0 0 2pt; }} .sub {{ color: #555; margin: 0 0 10pt; }}
h2 {{ font-size: 12pt; margin: 0 0 3pt; display: flex; align-items: baseline; gap: 7pt; }}
h2 .n {{ background: #1d4ed8; color: #fff; border-radius: 4pt; padding: 0 5pt; font-size: 10pt; }}
h2 .t {{ margin-left: auto; font-weight: 400; color: #1d4ed8; font-size: 10pt; white-space: nowrap; }}
h3 {{ font-size: 10.6pt; margin: 0 0 2pt; }} h3 .under {{ font-weight: 400; color: #777; }}
.sl {{ border-top: 1px solid #ddd; padding: 6pt 0 5pt; break-inside: avoid; }}
.sl p {{ margin: 2pt 0; }} .sl ul {{ margin: 2pt 0 2pt; padding-left: 15pt; }} .sl li {{ margin: 1pt 0; }}
.ex {{ font-size: 9.6pt; }} h2.part {{ font-size: 13pt; margin: 14pt 0 4pt; display: block; break-before: page; }}
code {{ font-family: Menlo, monospace; font-size: .92em; }}
</style></head><body>
<h1>Funkcje sklejane i ich własności — notatki prelegenta</h1>
<p class="sub">SD1, 02.11.2026 · limit 15 min ±3 · plan ścieżki głównej {total//60}:{total%60:02d} (zapas na dema i pytania) ·
klawisze: → / pilot — dalej, ↓ — dodatki, S — widok prelegenta, O — przegląd, B — wygaszenie</p>
{''.join(parts)}
<h2 class="part">Dodatki pod strzałką ↓ — na pytania</h2>
{''.join(ex)}
</body></html>'''
open(out_html, 'w', encoding='utf-8').write(page)
print(len(main), 'main,', len(extra), 'extras, total', total, 's')
