function tokenize(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function hrefFilename(href) {
  if (!href) return '';
  return href.split('#')[0].split('/').pop();
}

function flattenToc(items, depth, spineIndex, out) {
  for (const item of items || []) {
    const key = hrefFilename(item.href);
    const wordIndex = spineIndex[key];
    if (wordIndex !== undefined) {
      out.push({ label: (item.label || '').trim() || 'Untitled', wordIndex, depth });
    }
    if (item.subitems && item.subitems.length) {
      flattenToc(item.subitems, depth + 1, spineIndex, out);
    }
  }
  return out;
}

export async function extractEpubWords(arrayBuffer) {
  // epubjs ships as a Babel-compiled CJS module with a `default` export.
  // Depending on the runtime's CJS/ESM interop, `import ePub from 'epubjs'`
  // (or `(await import('epubjs')).default`) can resolve to the whole module
  // object instead of the actual function — unwrap defensively either way.
  const epubModule = await import('epubjs');
  const ePub = typeof epubModule.default === 'function' ? epubModule.default : epubModule.default.default;
  if (typeof ePub !== 'function') {
    throw new Error('epubjs did not load correctly (unexpected module shape)');
  }

  const book = ePub(arrayBuffer);
  await book.ready;

  const spineItems = book.spine.spineItems;
  const spineIndex = {}; // filename (no fragment) -> starting word index
  const allWords = [];

  for (const item of spineItems) {
    spineIndex[hrefFilename(item.href)] = allWords.length;
    const doc = await item.load(book.load.bind(book));
    // XHTML sections parse as an XMLDocument, which has no `.body` shortcut
    // (that's an HTMLDocument-only convenience) — query for it explicitly,
    // falling back to the whole document if that somehow comes up empty.
    const bodyEl = doc?.querySelector?.('body') || doc?.body;
    const text = bodyEl?.textContent || doc?.documentElement?.textContent || '';
    allWords.push(...tokenize(text));
    item.unload();
  }

  const metadata = book.packaging?.metadata || book.package?.metadata || {};
  const chapters = flattenToc(book.navigation?.toc, 0, spineIndex, []);

  return {
    words: allWords,
    title: metadata.title || null,
    author: metadata.creator || null,
    chapters,
  };
}

async function flattenPdfOutline(items, depth, pdf, pageStarts, out) {
  for (const item of items || []) {
    let pageIndex = null;
    try {
      if (item.dest) {
        const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
        if (dest && dest[0] != null) {
          pageIndex = await pdf.getPageIndex(dest[0]);
        }
      }
    } catch {
      pageIndex = null;
    }
    if (pageIndex !== null && pageStarts[pageIndex] !== undefined) {
      out.push({ label: item.title?.trim() || 'Untitled', wordIndex: pageStarts[pageIndex], depth, page: pageIndex + 1 });
    }
    if (item.items && item.items.length) {
      await flattenPdfOutline(item.items, depth + 1, pdf, pageStarts, out);
    }
  }
  return out;
}

export async function extractPdfWords(arrayBuffer) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allWords = [];
  const pageStarts = []; // pageStarts[i] = word index where page (i+1) begins

  for (let i = 1; i <= pdf.numPages; i++) {
    pageStarts.push(allWords.length);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    allWords.push(...tokenize(content.items.map((it) => it.str).join(' ')));
  }

  let chapters = [];
  try {
    const outline = await pdf.getOutline();
    if (outline?.length) {
      chapters = await flattenPdfOutline(outline, 0, pdf, pageStarts, []);
    }
  } catch {
    chapters = [];
  }

  return { words: allWords, title: null, author: null, pageCount: pdf.numPages, pageStarts, chapters };
}

// Optimal recognition point: which letter index to highlight, by word length.
export function orpIndex(word) {
  const bare = word.replace(/[^a-zA-Z0-9]/g, '') || word;
  const len = bare.length;
  if (len <= 1) return 0;
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  if (len <= 11) return 3;
  return 4;
}

// Groups words into fixed-size chunks for the "N words at once" display mode.
export function chunkWords(words, size) {
  if (size <= 1) return words.map((w) => [w]);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  return chunks;
}

// How much longer to hold a chunk that ends on punctuation, as a multiplier on base ms/word.
export function pauseMultiplier(chunk) {
  const last = chunk[chunk.length - 1] || '';
  if (/[.!?]["')\]]?$/.test(last)) return 2.2;
  if (/[,;:]["')\]]?$/.test(last)) return 1.5;
  return 1;
}
