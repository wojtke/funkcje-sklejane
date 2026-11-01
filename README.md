# Funkcje sklejane i ich własności

Interaktywna prezentacja na **Seminarium dyplomowe 1** (MiNI PW, prowadzący prof. Bohdan Macukow),
referat **02.11.2026**, ok. 15 min (±3) + dyskusja. Autor: Wojciech Jasiński.

Od prostej intuicji („kawałki wielomianów sklejone bez szwów”), przez listwę szkutnika, twierdzenie
Holladaya, B-splajny i krzywe Béziera, po czcionki, wygładzanie danych i sieci neuronowe. Wszystkie wykresy
liczą się na żywo w przeglądarce.

## Jak prezentować

- Otwórz `index.html` (działa też offline, bez serwera — wszystkie biblioteki są w `vendor/`)
  albo wersję na GitHub Pages.
- Klawisze: `→`, spacja, PageDown (pilot) — dalej po ścieżce głównej; `↓` — dodatki (pionowe slajdy);
  `S` — widok prelegenta z notatkami i licznikiem tempa; `D` — tryb ciemny; `O` — przegląd;
  `F` — pełny ekran; `B` — wygaszenie ekranu.
- Kontrolki w demach oddają fokus po kliknięciu, więc pilot do prezentacji działa dalej.
- Notatki prelegenta do druku: `tools/build-notes.sh` → `../notatki-prelegenta.pdf`.

## Ścieżka główna i dodatki

Ścieżka główna (strzałka w prawo) to plan **ok. 12:50** — reszta do 15 min to zapas na dema i reakcje sali.
Czas każdego slajdu jest w `data-timing` i w notatkach (`S`). Slajdy oznaczone „dodatek” leżą pod spodem
(strzałka w dół) — na pytania i do PDF.

| # | Slajd | Demo | Dodatki ↓ |
|---|---|---|---|
| 1 | Tytuł | animowana krzywa B-splajnowa | |
| 2 | Funkcja sklejana — idea | łamana → gładkie kawałki | definicja formalna, wymiar $n+k$, potęgi ucięte |
| 3 | Zastosowania (czcionki, CAD, animacja, robotyka, ML, medycyna) | | |
| 4 | Pochodzenie nazwy: listwa kreślarska | przeciąganie kaczek, energia zginania | rys historyczny 1691–2024 |
| 5 | Interpolacja wielomianowa i efekt Rungego | efekt Rungego vs splajn | |
| 6 | Splajn sześcienny i warunki brzegowe | $s, s', s'', s'''$ na żywo | układ trójdiagonalny + Thomas na $10^6$ |
| 7 | Twierdzenie Holladaya i fizyka listwy | | dowód; rząd zbieżności $O(h^4)$ |
| 8 | B-splajny | baza, krotność węzłów | splot → rozkład normalny |
| 9 | Bézier, de Casteljau | konstrukcja na żywo | |
| 10 | Krzywe B-splajnowe | sterowanie lokalne, grzebień krzywizny | NURBS i okrąg, Catmull–Rom, Chaikin |
| 11 | Czcionki: kontury TrueType | kontury TrueType (DejaVu Sans) | `cubic-bezier()` w CSS; tabela algorytmów |
| 12 | Splajn wygładzający | λ, GCV | |
| 13 | Sieć neuronowa z ReLU to funkcja sklejana | trening na żywo, węzły | KAN |
| 14 | Ciągłość krzywizny a przeciążenia | przeciążenie $C^1$ vs $C^2$ | thin-plate spline |
| 15–17 | Podsumowanie, pytania (QR), literatura | | |

## Eksport do PDF

- Skrypt: `tools/build-pdf.sh` (Chrome headless) → `funkcje-sklejane.pdf`.
- Ręcznie: otwórz `index.html?print-pdf` w Chrome → Drukuj → Zapisz jako PDF, marginesy: brak,
  grafika tła: włączona. Dema są wtedy statycznymi rysunkami, fragmenty są rozwinięte.

## Struktura

```
index.html            slajdy (treść, notatki prelegenta)
css/theme.css         motyw (jasny/ciemny)
js/splines.js         biblioteka numeryczna: splajny sześcienne, B-splajny, de Boor, Bézier,
                      Catmull–Rom, wygładzanie (Reinsch), thin-plate spline, wstawianie węzłów
js/core.js            infrastruktura dem: płótno, wykresy, przeciąganie, kontrolki
js/demos/*.js         dema (intro, numerics, bsplines, curves, ml, fun)
js/main.js            start: KaTeX, reveal.js, kod QR
data/glyphs.js        kontury glifów DejaVu Sans
vendor/               reveal.js 5.2.1, KaTeX 0.16.11, Inter, JetBrains Mono, qrcode-generator
tools/build-pdf.sh    eksport PDF
tools/build-notes.sh  notatki prelegenta do druku (../notatki-prelegenta.pdf)
tools/deploy.sh       publikacja na GitHub Pages
```

Biblioteka `js/splines.js` jest sprawdzona względem SciPy (`CubicSpline`, `BSpline`,
`make_smoothing_spline`, `insert`) — zgodność do błędu maszynowego.

## Licencje

Biblioteki w `vendor/` zachowują swoje licencje (reveal.js — MIT,
KaTeX — MIT, Inter i JetBrains Mono — SIL OFL 1.1, qrcode-generator — MIT, DejaVu Sans — licencja
Bitstream Vera/DejaVu).
