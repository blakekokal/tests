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
  photo/              photo entry (new): parsers, reader, screen
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
Pick *Scorecard* or *Shot-by-Shot Notes*, take or choose the photo, and the result opens
in the normal Simple or Hole-by-Hole form to check before submitting. The saved round is
identical to one typed by hand, so nothing in Supabase changes shape.

Two readers:

- **On device** (default, free, no setup): Tesseract.js in the browser. Reliable on clear
  printed text; weak on handwriting.
- **AI vision** (optional, reads handwriting): the `read-round-photo` Supabase Edge
  Function in `supabase/functions/`. The app uses it automatically once deployed, for
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
