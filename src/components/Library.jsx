import { useEffect, useRef, useState } from 'react';
import { PlusIcon, SettingsIcon } from './Icons.jsx';
import { listBooks, saveBook, getProgress } from '../db.js';
import { extractEpubWords, extractPdfWords } from '../lib/textExtract.js';

const COVER_STYLES = {
  epub: { bg: '#2b2440', border: '#3a3350', label: '#a99be0' },
  pdf: { bg: '#241f1f', border: '#372f2f', label: '#c99c8f' },
};

function formatPercent(progress, totalWords) {
  if (!progress || !totalWords) return 0;
  return Math.min(100, Math.round((progress.wordIndex / totalWords) * 100));
}

export default function Library({ onOpenBook, onOpenSettings }) {
  const [books, setBooks] = useState([]);
  const [progressByBook, setProgressByBook] = useState({});
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  async function refresh() {
    const list = await listBooks();
    setBooks(list);
    const entries = await Promise.all(list.map((b) => getProgress(b.id)));
    const map = {};
    list.forEach((b, i) => (map[b.id] = entries[i]));
    setProgressByBook(map);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const extracted = isPdf ? await extractPdfWords(buffer) : await extractEpubWords(buffer);

      const book = {
        id: crypto.randomUUID(),
        title: extracted.title || file.name.replace(/\.(epub|pdf)$/i, ''),
        author: extracted.author || null,
        type: isPdf ? 'pdf' : 'epub',
        words: extracted.words,
        totalWords: extracted.words.length,
        addedAt: Date.now(),
      };

      await saveBook(book);
      await refresh();
      onOpenBook(book.id);
    } catch (err) {
      console.error('Import failed', err);
      alert('Could not read that file. Try a DRM-free EPUB or a text-based PDF.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="screen screen-wide" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 8px 24px' }}>
        <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.01em' }}>Library</div>
        <button className="icon-btn" aria-label="Settings" onClick={onOpenSettings}>
          <SettingsIcon color="var(--text-muted)" />
        </button>
      </div>

      <div style={{ padding: '0 24px 20px 24px', fontSize: 14, color: 'var(--text-muted)' }}>
        {books.length} {books.length === 1 ? 'book' : 'books'}
        {importing ? ' · importing…' : ''}
      </div>

      {books.length === 0 && !importing ? (
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Import an EPUB or PDF to start speed-reading.
        </div>
      ) : (
        <div
          style={{
            flexGrow: 1,
            overflowY: 'auto',
            padding: '0 24px 100px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '20px 16px',
          }}
        >
          {books.map((book) => {
            const style = COVER_STYLES[book.type] || COVER_STYLES.epub;
            const progress = progressByBook[book.id];
            const pct = formatPercent(progress, book.totalWords);
            const status = pct === 0 ? 'Not started' : pct >= 100 ? 'Finished' : `${pct}%`;

            return (
              <button
                key={book.id}
                onClick={() => onOpenBook(book.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  border: 'none',
                  background: 'transparent',
                  padding: 4,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '2 / 3',
                    borderRadius: 6,
                    background: style.bg,
                    border: `1px solid ${style.border}`,
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 14,
                  }}
                >
                  <div className="mono" style={{ fontSize: 11, color: style.label }}>
                    {book.type.toUpperCase()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.25 }}>{book.title}</div>
                  {book.author && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{book.author}</div>}
                </div>
                <div style={{ height: 3, width: '100%', background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)' }} />
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {status}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" style={{ display: 'none' }} onChange={handleFile} />
      <button
        aria-label="Import a book"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        style={{
          position: 'absolute',
          right: 24,
          bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          width: 56,
          height: 56,
          borderRadius: 28,
          background: 'var(--accent)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          opacity: importing ? 0.6 : 1,
        }}
      >
        <PlusIcon color="var(--bg)" />
      </button>
    </div>
  );
}
