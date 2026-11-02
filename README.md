# Funkcje sklejane i ich własności

Interaktywna prezentacja na **Seminarium dyplomowe 1** (MiNI PW, prowadzący prof. Bohdan Macukow),
referat **02.11.2026**, ok. 15 min (±3) + dyskusja. Autor: Wojciech Jasiński.

Od prostej intuicji („kawałki wielomianów sklejone bez szwów”), przez listwę szkutnika, twierdzenie
Holladaya, B-splajny i krzywe Béziera, po czcionki, wygładzanie danych i sieci neuronowe. Wszystkie wykresy
liczą się na żywo w przeglądarce.

## Wersje

| Wersja | Adres | Plik | Kolejność | Czas |
|---|---|---|---|---|
| 1 | <https://wojtke.github.io/funkcje-sklejane/> | `index.html` | idea → zastosowania → listwa → Runge → splajn sześcienny → Holladay → B-splajny → Bézier → krzywe → czcionki → dane → ReLU → przeciążenia | ok. 12:50 |
| 2 | <https://wojtke.github.io/funkcje-sklejane/v2/> | `v2/index.html` | idea → Runge → splajn sześcienny (4n warunków) → układ trójdiagonalny → listwa i Holladay → B-splajny → krzywe Béziera i B-splajnowe → zastosowania → czcionki → dane → ReLU → przeciążenia | ok. 12:05 |

Obie wersje korzystają z tych samych `css/`, `js/`, `vendor/`, `img/`. Wersja 2 powstała z wersji 1
(02.11.2026): problem na start, liczenie warunków 4n − (4n − 2) = 2, wyznaczanie (układ trójdiagonalny)
na ścieżce głównej, listwa połączona z twierdzeniem Holladaya, de Casteljau, fizyka listwy i dowód w dodatkach.
PDF wersji 2: `tools/build-pdf.sh` uruchomiony w `v2/` (`node ../tools/build-pdf.mjs funkcje-sklejane-v2.pdf`);
notatki: `tools/build-notes-v2.sh` → `../notatki-prelegenta-v2.pdf`.

Odwołania do literatury i źródła na slajdach mają klasę `ref` (krój szeryfowy Charter, przygaszony kolor).

## Jak prezentować

- Otwórz `index.html` (działa też offline, bez serwera; wszystkie biblioteki są w `vendor/`)
  albo wersję na GitHub Pages.
- Klawisze:

  | Klawisz | Działanie |
  |---|---|
  | `→`, spacja, PageDown (pilot) | dalej po ścieżce głównej |
  | `↓` | dodatki (pionowe slajdy) |
  | `S` | widok prelegenta: notatki, licznik tempa, podgląd następnego slajdu ścieżki głównej |
  | `A` (w oknie prelegenta) | przełącza notatki: zwięzłe ↔ proste (tekst z `na-chlopski-rozum.md`); to samo robi przycisk przy „Notes” |
  | `F`, F5 (pilot), przycisk w lewym dolnym rogu | pełny ekran (włącz/wyłącz) |
  | `C` (przytrzymaj) | słabo widoczny zegar w prawym górnym rogu: czas od wyjścia ze slajdu tytułowego (powrót na tytuł zeruje) i godzina |
  | `D` | tryb ciemny |
  | `O` | przegląd wszystkich slajdów |
  | `B` | wygaszenie ekranu |

- Z widokiem prelegenta pełny ekran włącz w oknie prezentacji (na projektorze); `F` w oknie notatek go nie włączy.
- Numer slajdu liczy tylko ścieżkę główną (np. 4 / 17); dodatki mają numery 4.1, 4.2.
- Kontrolki w demach oddają fokus po kliknięciu, więc pilot do prezentacji działa dalej.
- Notatki prelegenta do druku: `tools/build-notes.sh` → `../notatki-prelegenta.pdf`.

## Ścieżka główna i dodatki

Ścieżka główna (strzałka w prawo) to plan **ok. 12:50**; reszta do 15 min to zapas na dema i reakcje sali.
Czas każdego slajdu jest w `data-timing` i w notatkach (`S`). Slajdy oznaczone „dodatek” leżą pod spodem
(strzałka w dół), na pytania i do PDF.

| # | Slajd | Demo | Dodatki ↓ |
|---|---|---|---|
| 1 | Tytuł | animowana krzywa B-splajnowa | |
| 2 | Idea funkcji sklejanej | łamana → gładkie kawałki | definicja formalna, wymiar $n+k$, potęgi ucięte |
| 3 | Zastosowania (czcionki, CAD, animacja, robotyka, ML, medycyna) | | |
| 4 | Pochodzenie nazwy: listwa kreślarska (zdjęcie trasernii, 1956) | przeciąganie kaczek, energia zginania | rys historyczny 1691–2024 |
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
img/                  zdjęcie listwy z kaczkami (1956)
favicon.svg, *.png    ikona strony
vendor/               reveal.js 5.2.1, KaTeX 0.16.11, Inter, JetBrains Mono, qrcode-generator
tools/build-pdf.sh    eksport PDF
tools/build-notes.sh  notatki prelegenta do druku (../notatki-prelegenta.pdf)
tools/deploy.sh       publikacja na GitHub Pages
```

Biblioteka `js/splines.js` jest sprawdzona względem SciPy (`CubicSpline`, `BSpline`,
`make_smoothing_spline`, `insert`): zgodność do błędu maszynowego.

## Licencje

Biblioteki w `vendor/` zachowują swoje licencje: reveal.js (MIT), KaTeX (MIT), Inter i JetBrains Mono
(SIL OFL 1.1), qrcode-generator (MIT), DejaVu Sans (licencja Bitstream Vera/DejaVu).
`vendor/reveal/plugin/notes.js` ma jedną zmianę: podgląd w widoku prelegenta pokazuje następny slajd ścieżki
głównej (`right`), a nie następny w kolejności liniowej (`next`), który byłby dodatkiem.

Zdjęcie `img/listwa-rohr-1956.jpg`: trasernia zakładów lotniczych Rohr, Chula Vista, 4.06.1956,
San Diego Air & Space Museum Archives, domena publiczna
([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:26_0000167_Piction_ID-402291551_--Main_Lofting_Room_at_Rohr_Engineering_Chula_Vista_06-04-1956_(55558904083).jpg)); kadr przycięty.
