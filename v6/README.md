# Golf Stat Tracker — v6 (modular rebuild)

The same app as the single-file `index.html` in the repo root — same screens, colours,
strokes gained tables and Supabase project — split into ES modules, with one new
feature: entering a round from a photo. No framework and no build step; it is served
as static files (GitHub Pages).

While this lives in `v6/` it is a preview at `bkgstats.com/v6`. The root `index.html`
is untouched and is still the live app.

## Run locally

```bash
npx serve -l 3000 .
```

Then open `http://localhost:3000/v6/`.

## Layout

```
index.html            page markup (every screen is a <div class="page">)
manifest.webmanifest  PWA manifest
css/                  base, combines, optimizer, distance-guide
assets/               icons, drill diagrams, SG calculator/explainer images
js/
  app.js              entry point: loads every module, then boots
  core/               router (show / onEnter / onBack), shared state, session,
                      Supabase client, expose() for inline handlers, utilities
  sg/                 strokes gained tables + expected strokes/putts lookups
  data/               course database, drill library, combine presets
  round/              setup, shot-by-shot, hole-by-hole, simple entry, summary,
                      save/resume, history, edit, Excel/CSV import + export
  photo/              photo entry (new): scorecard reader, printable stat card + scanner, screen
  stats/              dashboard, full stats, radar charts, handicap index, goals
  performance/        performance analysis (rounds + combines)
  combines/           table combines, line drill, driver drill, evaluation test
  practice/           hub, drills, plans, generator, log, swing journal
  learn/              SG calculator/explainer, break calculator, optimizer,
                      proximity calculator, distance guide, library
  bag/                clubs, find-your-yardage, gap visualizer, wedge gapping, speed
  coaching/           roles, roster, teams, notes, assignments, messages, student view
  auth/, profile/, home/, help/, courses/
tests/                parser unit test + old-vs-new comparison tools
```

Conventions:

- The markup uses inline handlers (`onclick="fn()"`). Each module ends with an
  `expose({ ... })` call listing the functions its markup calls.
- A feature registers what happens when its page opens with `onEnter(pageId, fn)` and
  custom Back behaviour with `onBack(pageId, fn)` (`core/router.js`).
- State written by more than one module lives in `core/state.js` (`S`). State private
  to one feature stays in that feature's module.

## Photo entry

New Round → Entry Mode → **Photo** (or Round History → *Add Round from Photo*).
Take or choose a photo of a normal scorecard. The player writes one row each for:

| Row | What to write |
|---|---|
| Score | strokes on each hole |
| F | fairway: check = hit, x = missed (blank on par 3s) |
| G | green in regulation: check = hit, x = missed |
| Putts | number of putts |
| Pen | penalty strokes (blank = none) |

The result opens in the Simple form, with a stats row per hole, to check before submitting.
It is saved as a simple round (`entryMode: 'simple'`, no shots, so no strokes gained) with
`basicStats: true`, per-hole `putts` / `fairway` / `gir` / `penalties`, and the usual `stats`
totals. The dashboard counts these rounds toward fairways, greens and putting. Nothing in
Supabase changes shape; the extra fields live inside the existing `round_data` JSON.

### Stat card (printable, one bubble per shot)

Photo Entry → **Stat Card** → *Print Stat Cards* opens `stat-card.html`: yardage-book-sized
cards (4 × 6.5 in, two per Letter sheet, three holes per card). On each hole the player circles
the par, writes yardage and score, and uses one row per shot: color the bubble for where the
ball finished and write the distance left.

One photo per card is scanned on the device (`photo/card-scan.js`): it finds the corner
squares, straightens the card and reads the par ring and the bubbles. The card's code squares
say which holes it holds, so photos can be in any order. The result opens in the Hole-by-Hole
form with every shot's lie filled in; the handwritten yardage and distances are typed in there.
Water and Out of Bounds add a `PENALTY` row. `photo/card-layout.js` is the single source of the
card's geometry for both printing and scanning; `printouts/` holds PDFs made from that page.

### Readers for the scorecard photo

- **On device** (default, free, no setup): Tesseract.js in the browser. Reads clear printed
  numbers; it cannot be relied on for handwriting or for the check / x marks.
- **AI vision** (optional, reads handwriting and the marks): the `read-round-photo` Supabase
  Edge Function in `supabase/functions/`. The app uses it automatically once deployed, for
  signed-in users, and falls back to on-device reading otherwise.

  ```bash
  supabase secrets set ANTHROPIC_API_KEY=<your key>
  ```

  ```bash
  supabase functions deploy read-round-photo
  ```

  It adds no tables, columns or policies.

## Tests

```bash
node v6/tests/parse-text.test.mjs
```

`tests/compare/` holds the tools used to check v6 against the original app while both
exist (they need Playwright and both apps served locally): `shots.js` compares every
screen pixel-for-pixel, `monkey.js` drives both apps with the same random clicks and
compares the page, alerts and everything written to an in-memory Supabase stand-in
(`mock-supabase.js`), and `sgcheck.js` compares strokes gained lookups.

## Going live

When the preview is approved, replace the root `index.html` with the contents of `v6/`
(move `v6/*` to the repo root). Asset and script paths are relative, so nothing else changes.
