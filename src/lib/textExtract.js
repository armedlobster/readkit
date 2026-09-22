function tokenize(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export async function extractEpubWords(arrayBuffer) {
  const ePub = (await import('epubjs')).default;
  const book = ePub(arrayBuffer);
  await book.ready;

  const spineItems = book.spine.spineItems;
  let fullText = '';

  for (const item of spineItems) {
    const doc = await item.load(book.load.bind(book));
    fullText += ' ' + (doc?.body?.textContent || '');
    item.unload();
  }

  const metadata = book.packaging?.metadata || book.package?.metadata || {};

  return {
    words: tokenize(fullText),
    title: metadata.title || null,
    author: metadata.creator || null,
  };
}

export async function extractPdfWords(arrayBuffer) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += ' ' + content.items.map((it) => it.str).join(' ');
  }

  return { words: tokenize(fullText), title: null, author: null, pageCount: pdf.numPages };
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
