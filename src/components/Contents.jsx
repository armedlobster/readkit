import { useEffect, useState } from 'react';
import { BackIcon, TrashIcon } from './Icons.jsx';
import { getBook, listBookmarks, deleteBookmark } from '../db.js';

export default function Contents({ bookId, onBack, onJump }) {
  const [book, setBook] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [pageInput, setPageInput] = useState('');

  async function refreshBookmarks() {
    setBookmarks(await listBookmarks(bookId));
  }

  useEffect(() => {
    (async () => {
      const b = await getBook(bookId);
      setBook(b);
      await refreshBookmarks();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  async function handleDeleteBookmark(id) {
    await deleteBookmark(id);
    await refreshBookmarks();
  }

  function handleGoToPage() {
    const n = parseInt(pageInput, 10);
    if (!book?.pageStarts || Number.isNaN(n)) return;
    const clamped = Math.min(Math.max(n, 1), book.pageStarts.length);
    onJump(book.pageStarts[clamped - 1]);
  }

  if (!book) return null;

  const chapters = book.chapters || [];
  const hasPageStarts = Array.isArray(book.pageStarts) && book.pageStarts.length > 0;

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 20px 16px 16px' }}>
        <button className="icon-btn" aria-label="Back to reader" onClick={onBack}>
          <BackIcon color="var(--text)" />
        </button>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Contents</div>
      </div>

      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '0 24px 40px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {chapters.length > 0 && (
          <div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Chapters
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {chapters.map((ch, i) => (
                <button
                  key={i}
                  onClick={() => onJump(ch.wordIndex)}
                  style={{
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--surface-2)',
                    padding: '12px 0',
                    paddingLeft: ch.depth * 16,
                    fontSize: 15,
                    cursor: 'pointer',
                  }}
                >
                  {ch.label}
                  {ch.page ? (
                    <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}> · p.{ch.page}</span>
                  ) : (
                    <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {' '}
                      · {Math.round((ch.wordIndex / (book.totalWords || 1)) * 100)}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {book.type === 'epub' && chapters.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            No chapter markers found in this book. Re-import it if a newer version of ReadKit improves detection.
          </div>
        )}

        {book.type === 'pdf' && (
          <div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Go to page
            </div>
            {hasPageStarts ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="number"
                  min={1}
                  max={book.pageStarts.length}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  placeholder={`1–${book.pageStarts.length}`}
                  className="mono"
                  style={{
                    flexGrow: 1,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text)',
                    padding: '10px 12px',
                    fontSize: 15,
                  }}
                />
                <button
                  onClick={handleGoToPage}
                  className="mono"
                  style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '0 20px', fontSize: 14, cursor: 'pointer' }}
                >
                  Go
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Re-import this PDF to enable page jumping.
              </div>
            )}
          </div>
        )}

        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Bookmarks
          </div>
          {bookmarks.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              None yet — tap the bookmark icon while reading to save a spot.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {bookmarks.map((bm) => (
                <div key={bm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--surface-2)' }}>
                  <button
                    onClick={() => onJump(bm.wordIndex)}
                    style={{ flexGrow: 1, textAlign: 'left', background: 'transparent', border: 'none', padding: '12px 0', fontSize: 15, cursor: 'pointer' }}
                  >
                    {bm.label || 'Bookmark'}
                  </button>
                  <button
                    aria-label="Delete bookmark"
                    onClick={() => handleDeleteBookmark(bm.id)}
                    style={{ width: 32, height: 32, borderRadius: 16, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
