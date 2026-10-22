# Funkcje sklejane i ich własności

Interaktywna prezentacja na **Seminarium dyplomowe 1** (MiNI PW, prowadzący prof. Bohdan Macukow),
referat **02.11.2026**, ok. 15 min (±3) + dyskusja. Autor: Wojciech Jasiński.

Od listwy szkutnika i „kaczek”, przez twierdzenie Holladaya, B-splajny i krzywe Béziera,
po czcionki, wygładzanie, sieci ReLU i KAN. Wszystkie wykresy liczą się na żywo w przeglądarce.

## Jak prezentować

- Otwórz `index.html` (działa też offline, bez serwera — wszystkie biblioteki są w `vendor/`)
  albo wersję na GitHub Pages.
- Klawisze: `→`/spacja — dalej, `↓` — dodatki (pionowe slajdy), `S` — widok prelegenta z notatkami
  i czasem, `D` — tryb ciemny, `O` — przegląd, `F` — pełny ekran, `B` — wygaszenie ekranu.
- Kontrolki w demach oddają fokus po kliknięciu, więc pilot do prezentacji działa dalej.

## Ścieżka główna i dodatki

Ścieżka główna (strzałka w prawo) to ok. 16–17 min; w notatkach prelegenta (`S`) jest szacowany
czas każdego slajdu. Slajdy oznaczone „dodatek” leżą pod spodem (strzałka w dół) — na pytania
i do PDF.

| # | Slajd | Demo | Dodatki ↓ |
|---|---|---|---|
| 1 | Tytuł | animowana krzywa B-splajnowa | |
| 2 | Gdzie są funkcje sklejane? | | |
| 3 | Listwa i kaczki | przeciąganie kaczek, energia zginania | |
| 4 | Oś czasu 1691–2024 | | |
| 5 | Dlaczego nie jeden wielomian? | efekt Rungego vs splajn | |
| 6 | Definicja, wymiar $n+k$ | kawałki wielomianów | |
| 7 | Splajn sześcienny i warunki brzegowe | $s, s', s'', s'''$ na żywo | układ trójdiagonalny + Thomas na $10^6$ |
| 8 | Twierdzenie Holladaya + fizyka belki | | rząd zbieżności $O(h^4)$ |
| 9 | B-splajny (Cox–de Boor) | baza, krotność węzłów | splot → rozkład normalny |
| 10 | Bézier, de Casteljau | konstrukcja na żywo | |
| 11 | Krzywe B-splajnowe | sterowanie lokalne, grzebień krzywizny | NURBS i okrąg, Catmull–Rom, Chaikin |
| 12 | Okiem informatyka | tabela algorytmów | |
| 13 | Litera to funkcja sklejana | kontury TrueType (DejaVu Sans) | `cubic-bezier()` w CSS |
| 14 | Splajn wygładzający | λ, df, GCV | |
| 15 | Sieć ReLU to splajn | trening na żywo, węzły | |
| 16 | KAN | współczynniki B-splajnu, zagęszczanie siatki | |
| 17 | Kolejka górska $C^1$ vs $C^2$ | przeciążenie | thin-plate spline |
| 18–20 | Podsumowanie, pytania (QR), literatura | | |

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
```

Biblioteka `js/splines.js` jest sprawdzona względem SciPy (`CubicSpline`, `BSpline`,
`make_smoothing_spline`, `insert`) — zgodność do błędu maszynowego.

## Licencje

Biblioteki w `vendor/` zachowują swoje licencje (reveal.js — MIT,
KaTeX — MIT, Inter i JetBrains Mono — SIL OFL 1.1, qrcode-generator — MIT, DejaVu Sans — licencja
Bitstream Vera/DejaVu).
