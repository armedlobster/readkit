const DB_NAME = 'readkit';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'bookId' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('bookmarks')) {
        const store = db.createObjectStore('bookmarks', { keyPath: 'id' });
        store.createIndex('bookId', 'bookId', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readonly').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readonly').get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function put(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readwrite').put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}

async function del(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readwrite').delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Books ---

export async function listBooks() {
  const books = await getAll('books');
  return books.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getBook(id) {
  return get('books', id);
}

export async function saveBook(book) {
  // book: { id, title, author, type ('epub'|'pdf'), words: string[], totalWords, addedAt }
  return put('books', book);
}

export async function deleteBook(id) {
  await del('books', id);
  await del('progress', id);
  const marks = await listBookmarks(id);
  await Promise.all(marks.map((m) => del('bookmarks', m.id)));
}

// --- Progress ---

export async function getProgress(bookId) {
  return get('progress', bookId);
}

export async function saveProgress(bookId, { wordIndex, wpm, chunkSize }) {
  return put('progress', { bookId, wordIndex, wpm, chunkSize, updatedAt: Date.now() });
}

// --- Bookmarks ---

export async function listBookmarks(bookId) {
  const all = await getAll('bookmarks');
  return all.filter((b) => b.bookId === bookId).sort((a, b) => a.wordIndex - b.wordIndex);
}

export async function addBookmark(bookId, wordIndex, label) {
  const bookmark = { id: crypto.randomUUID(), bookId, wordIndex, label: label || '', createdAt: Date.now() };
  await put('bookmarks', bookmark);
  return bookmark;
}

export async function deleteBookmark(id) {
  return del('bookmarks', id);
}

// --- Settings ---

const DEFAULT_SETTINGS = {
  key: 'global',
  theme: 'dark',
  wordSize: 52,
  defaultChunkSize: 1,
  defaultWpm: 420,
  pausePunctuation: true,
  highlightFocus: true,
};

export async function getSettings() {
  const s = await get('settings', 'global');
  return s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS;
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial, key: 'global' };
  await put('settings', next);
  return next;
}
