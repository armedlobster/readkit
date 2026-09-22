import { useEffect, useMemo, useRef, useState } from 'react';
import { BackIcon, SettingsIcon, PlayIcon, PauseIcon, PrevIcon, NextIcon, ListIcon, BookmarkIcon } from './Icons.jsx';
import { getBook, getProgress, saveProgress, getSettings, addBookmark } from '../db.js';
import { orpIndex, pauseMultiplier } from '../lib/textExtract.js';

function seekSentence(words, fromIndex, direction) {
  if (direction < 0) {
    let i = fromIndex - 1;
    while (i > 0 && !/[.!?]["')\]]?$/.test(words[i - 1])) i--;
    return Math.max(0, i);
  }
  let i = fromIndex;
  while (i < words.length - 1 && !/[.!?]["')\]]?$/.test(words[i])) i++;
  return Math.min(words.length - 1, i + 1);
}

// PDF text extraction doesn't reliably preserve sentence punctuation (running
// headers, footers, column breaks), so page boundaries are a steadier unit
// to step through than "sentences" for PDFs.
function pageAt(pageStarts, wordIndex) {
  let page = 0;
  for (let i = 0; i < pageStarts.length; i++) {
    if (pageStarts[i] <= wordIndex) page = i;
    else break;
  }
  return page;
}

function seekPage(pageStarts, fromIndex, direction) {
  const cur = pageAt(pageStarts, fromIndex);
  const target = direction < 0 ? Math.max(0, cur - 1) : Math.min(pageStarts.length - 1, cur + 1);
  return pageStarts[target];
}

export default function Reader({ bookId, jumpTo, onBack, onOpenSettings, onOpenContents }) {
  const [book, setBook] = useState(null);
  const [wordIndex, setWordIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wpm, setWpm] = useState(420);
  const [chunkSize, setChunkSize] = useState(1);
  const [pausePunctuation, setPausePunctuation] = useState(true);
  const [highlightFocus, setHighlightFocus] = useState(true);
  const [wordSize, setWordSize] = useState(52);
  const [savedFlash, setSavedFlash] = useState(false);
  const lastSavedRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [b, progress, settings] = await Promise.all([getBook(bookId), getProgress(bookId), getSettings()]);
      if (cancelled || !b) return;
      setBook(b);
      // A jump from Contents/Bookmarks always wins over the last saved spot —
      // otherwise this load (which reads the *old* saved progress) can finish
      // after the jump and silently snap back to where you were.
      setWordIndex(jumpTo != null ? jumpTo : progress?.wordIndex ?? 0);
      setWpm(progress?.wpm ?? settings.defaultWpm);
      setChunkSize(progress?.chunkSize ?? settings.defaultChunkSize);
      setPausePunctuation(settings.pausePunctuation);
      setHighlightFocus(settings.highlightFocus);
      setWordSize(settings.wordSize);
      setPlaying(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, jumpTo]);

  const words = book?.words ?? [];
  const totalWords = book?.totalWords ?? 0;
  const pageStarts = book?.pageStarts;
  const hasPages = book?.type === 'pdf' && Array.isArray(pageStarts) && pageStarts.length > 0;
  const currentChunk = useMemo(() => words.slice(wordIndex, wordIndex + chunkSize), [words, wordIndex, chunkSize]);
  const finished = totalWords > 0 && wordIndex >= totalWords;
  const currentPage = hasPages ? pageAt(pageStarts, wordIndex) + 1 : null;

  // Playback loop.
  useEffect(() => {
    if (!playing || !words.length || finished) {
      if (finished) setPlaying(false);
      return;
    }
    const msPerWord = 60000 / wpm;
    const multiplier = pausePunctuation ? pauseMultiplier(currentChunk) : 1;
    const duration = msPerWord * Math.max(1, currentChunk.length) * multiplier;
    const timer = setTimeout(() => {
      setWordIndex((i) => i + Math.max(1, currentChunk.length));
    }, duration);
    return () => clearTimeout(timer);
  }, [playing, wordIndex, wpm, chunkSize, words, pausePunctuation, currentChunk, finished]);

  // Persist progress, throttled.
  useEffect(() => {
    if (!book) return;
    const now = Date.now();
    if (now - lastSavedRef.current < 800 && wordIndex !== totalWords) return;
    lastSavedRef.current = now;
    saveProgress(bookId, { wordIndex, wpm, chunkSize });
  }, [book, bookId, wordIndex, wpm, chunkSize, totalWords]);

  if (!book) {
    return (
      <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Loading…
        </div>
      </div>
    );
  }

  const progressPct = totalWords ? Math.min(100, (wordIndex / totalWords) * 100) : 0;

  async function handleAddBookmark() {
    const label = words.slice(wordIndex, wordIndex + 6).join(' ').trim() || 'Bookmark';
    await addBookmark(bookId, wordIndex, label);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  }

  function openContents() {
    saveProgress(bookId, { wordIndex, wpm, chunkSize });
    onOpenContents();
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 12px 16px' }}>
        <button className="icon-btn" aria-label="Back to library" onClick={onBack}>
          <BackIcon color="var(--text)" />
        </button>
        <div className="mono" style={{ fontSize: 13, color: 'var(--text-muted)', flexGrow: 1, minWidth: 0, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px' }}>
          {savedFlash ? 'Bookmark saved' : book.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <button className="icon-btn" aria-label="Save bookmark here" onClick={handleAddBookmark} style={{ width: 40, height: 40 }}>
            <BookmarkIcon color={savedFlash ? 'var(--accent)' : 'var(--text-muted)'} filled={savedFlash} />
          </button>
          <button className="icon-btn" aria-label="Contents and bookmarks" onClick={openContents} style={{ width: 40, height: 40 }}>
            <ListIcon color="var(--text-muted)" />
          </button>
          <button className="icon-btn" aria-label="Settings" onClick={onOpenSettings} style={{ width: 40, height: 40 }}>
            <SettingsIcon color="var(--text-muted)" />
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <div style={{ height: 2, width: '100%', background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--accent)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '20px 0 0 0' }}>
        {[1, 2, 3].map((n) => (
          <button key={n} className={`chip mono ${chunkSize === n ? 'active' : ''}`} onClick={() => setChunkSize(n)}>
            {n} word{n > 1 ? 's' : ''}
          </button>
        ))}
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 24px' }}>
        <div style={{ width: 2, height: 14, background: 'var(--border)' }} />
        {finished ? (
          <div className="mono" style={{ fontSize: 22, color: 'var(--text-muted)' }}>
            Finished
          </div>
        ) : chunkSize === 1 && highlightFocus ? (
          <div
            className="mono"
            style={{
              // Fixed-width columns (monospace 'ch' units) pin the highlighted
              // letter to one exact spot on screen — the word grows unevenly
              // left/right around it, rather than the whole word being centered
              // (which would make the highlighted letter itself drift).
              display: 'grid',
              gridTemplateColumns: '6.5ch auto 10ch',
              alignItems: 'baseline',
              width: '100%',
              fontSize: `clamp(${wordSize}px, ${wordSize}px + 2vw, ${Math.round(wordSize * 1.6)}px)`,
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
          >
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: 0, overflow: 'visible' }}>
              {currentChunk[0]?.slice(0, orpIndex(currentChunk[0] || ''))}
            </span>
            <span style={{ textAlign: 'center', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
              {currentChunk[0]?.charAt(orpIndex(currentChunk[0] || ''))}
            </span>
            <span style={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: 0, overflow: 'visible' }}>
              {currentChunk[0]?.slice(orpIndex(currentChunk[0] || '') + 1)}
            </span>
          </div>
        ) : (
          <div
            className="mono"
            style={{
              fontSize: `clamp(${wordSize}px, ${wordSize}px + 2vw, ${Math.round(wordSize * 1.6)}px)`,
              fontWeight: 500,
              letterSpacing: '0.01em',
              textAlign: 'center',
              wordBreak: 'break-word',
            }}
          >
            {currentChunk.join(' ')}
          </div>
        )}
        <div style={{ width: 2, height: 14, background: 'var(--border)' }} />
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          {hasPages && `page ${currentPage} of ${pageStarts.length} · `}
          word {Math.min(wordIndex + 1, totalWords).toLocaleString()} of {totalWords.toLocaleString()}
        </div>
      </div>

      <div style={{ padding: '0 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            200
          </div>
          <div className="mono" style={{ fontSize: 15 }}>
            {wpm} wpm
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            700
          </div>
        </div>
        <input
          type="range"
          min={200}
          max={700}
          step={10}
          value={wpm}
          onChange={(e) => setWpm(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '18px 0 calc(30px + env(safe-area-inset-bottom, 0px)) 0' }}>
        <button
          className="icon-btn"
          aria-label={hasPages ? 'Previous page' : 'Back one sentence'}
          onClick={() => setWordIndex((i) => (hasPages ? seekPage(pageStarts, i, -1) : seekSentence(words, i, -1)))}
          style={{ width: 48, height: 48 }}
        >
          <PrevIcon color="var(--text)" />
        </button>
        <button
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => setPlaying((p) => (finished ? (setWordIndex(0), true) : !p))}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            background: 'var(--accent)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(224,138,79,0.35)',
          }}
        >
          {playing ? <PauseIcon color="var(--bg)" /> : <PlayIcon color="var(--bg)" />}
        </button>
        <button
          className="icon-btn"
          aria-label={hasPages ? 'Next page' : 'Forward one sentence'}
          onClick={() => setWordIndex((i) => (hasPages ? seekPage(pageStarts, i, 1) : seekSentence(words, i, 1)))}
          style={{ width: 48, height: 48 }}
        >
          <NextIcon color="var(--text)" />
        </button>
      </div>
    </div>
  );
}
