# ReadKit

A word-at-a-time (RSVP) speed reader for EPUB and PDF files. Import a book,
pick a words-per-minute pace and a chunk size (1–3 words at once), and read
without your eyes scanning left to right.

Working name — rename freely (package.json, index.html `<title>`, manifest.json)
before you settle on one.

## Stack

- React + Vite
- `epubjs` for EPUB parsing, `pdfjs-dist` for PDF text extraction
- IndexedDB (no backend) for book text, reading progress, and settings
- PWA: direct `public/manifest.json` + SVG icon, no build-time icon generation

## Local dev

```
npm install
npm run dev
```

## Deploy

Push to GitHub, connect the repo in Vercel. `vite` and `@vitejs/plugin-react`
are in `dependencies` (not `devDependencies`) so the Vercel build doesn't
break. `vercel.json` has an SPA rewrite that excludes `assets/`,
`manifest.json`, and `icon.svg` so the PWA files still resolve directly.

## Structure

```
src/
  App.jsx              screen router (library / reader / settings)
  db.js                IndexedDB wrapper: books, progress, settings
  lib/
    textExtract.js      EPUB/PDF -> word array, ORP pivot, chunking, pause timing
  components/
    Library.jsx          book grid + import
    Reader.jsx            the RSVP playback engine
    Settings.jsx          display + reading preferences, stats
    Icons.jsx              shared inline SVG icons
```

## Known limitations to revisit

- EPUB/PDF parsing runs on the main thread during import — large files will
  briefly block the UI. Worth moving to a Web Worker if it's noticeable.
- No DRM handling — DRM-protected EPUBs won't parse.
- The "back/forward one sentence" jump is a regex heuristic
  (`seekSentence` in `Reader.jsx`), not a real sentence parser — it can
  misfire on abbreviations, decimals, etc.
- "Time saved" stat in Settings is a rough estimate (current pace vs. a
  250 wpm baseline), not a tracked history of actual reading sessions.
- No cover art extraction yet — covers are solid-color placeholders by
  file type.
