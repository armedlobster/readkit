import { useEffect, useState } from 'react';
import { BackIcon } from './Icons.jsx';
import { getSettings, saveSettings, listBooks, getProgress } from '../db.js';

const BASELINE_WPM = 250; // typical left-to-right reading speed, for the time-saved estimate

function Toggle({ on, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: on ? 'var(--accent)' : 'var(--surface-2)',
        border: 'none',
        position: 'relative',
        flexShrink: 0,
        marginLeft: 16,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 22,
          height: 22,
          borderRadius: 11,
          background: on ? 'var(--bg)' : 'var(--text)',
          transition: 'left 0.15s ease',
        }}
      />
    </button>
  );
}

export default function Settings({ onBack }) {
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState({ wordsRead: 0, hoursSaved: 0 });

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setSettings(s);
      document.documentElement.dataset.theme = s.theme;

      const books = await listBooks();
      const progresses = await Promise.all(books.map((b) => getProgress(b.id)));
      const wordsRead = progresses.reduce((sum, p) => sum + (p?.wordIndex || 0), 0);
      const avgWpm = progresses.length
        ? progresses.reduce((sum, p) => sum + (p?.wpm || s.defaultWpm), 0) / progresses.length
        : s.defaultWpm;
      const minutesAtSpeed = wordsRead / avgWpm;
      const minutesAtBaseline = wordsRead / BASELINE_WPM;
      const hoursSaved = Math.max(0, (minutesAtBaseline - minutesAtSpeed) / 60);
      setStats({ wordsRead, hoursSaved });
    })();
  }, []);

  async function update(partial) {
    const next = await saveSettings(partial);
    setSettings(next);
    if (partial.theme) document.documentElement.dataset.theme = partial.theme;
  }

  if (!settings) return null;

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 20px 20px 16px' }}>
        <button className="icon-btn" aria-label="Back" onClick={onBack}>
          <BackIcon color="var(--text)" />
        </button>
        <div style={{ fontSize: 26, fontWeight: 600 }}>Settings</div>
      </div>

      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '0 24px 40px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Display
          </div>

          <Row label="Theme">
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`chip mono ${settings.theme === 'dark' ? 'active' : ''}`} onClick={() => update({ theme: 'dark' })}>
                Dark
              </button>
              <button className={`chip mono ${settings.theme === 'light' ? 'active' : ''}`} onClick={() => update({ theme: 'light' })}>
                Light
              </button>
            </div>
          </Row>

          <Row label="Word size">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                aria-label="Decrease word size"
                onClick={() => update({ wordSize: Math.max(28, settings.wordSize - 4) })}
                style={stepperBtnStyle}
              >
                –
              </button>
              <div className="mono" style={{ fontSize: 14, width: 28, textAlign: 'center' }}>
                {settings.wordSize}
              </div>
              <button
                aria-label="Increase word size"
                onClick={() => update({ wordSize: Math.min(96, settings.wordSize + 4) })}
                style={stepperBtnStyle}
              >
                +
              </button>
            </div>
          </Row>
        </div>

        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Reading
          </div>

          <Row label="Default chunk size">
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3].map((n) => (
                <button key={n} className={`chip mono ${settings.defaultChunkSize === n ? 'active' : ''}`} onClick={() => update({ defaultChunkSize: n })}>
                  {n}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Pause on punctuation" sub="Slows briefly at commas and sentence ends">
            <Toggle on={settings.pausePunctuation} onChange={(v) => update({ pausePunctuation: v })} />
          </Row>

          <Row label="Highlight focus letter" sub="Colors the eye's fixation point in each word">
            <Toggle on={settings.highlightFocus} onChange={(v) => update({ highlightFocus: v })} />
          </Row>
        </div>

        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Stats
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flexGrow: 1, background: 'var(--surface)', borderRadius: 10, padding: 16 }}>
              <div className="mono" style={{ fontSize: 22 }}>
                {stats.wordsRead >= 1000 ? `${(stats.wordsRead / 1000).toFixed(1)}k` : stats.wordsRead}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>words read</div>
            </div>
            <div style={{ flexGrow: 1, background: 'var(--surface)', borderRadius: 10, padding: 16 }}>
              <div className="mono" style={{ fontSize: 22 }}>
                {stats.hoursSaved.toFixed(1)}h
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>time saved</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const stepperBtnStyle = {
  width: 32,
  height: 32,
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'transparent',
  fontSize: 16,
  cursor: 'pointer',
};

function Row({ label, sub, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--surface-2)' }}>
      <div>
        <div style={{ fontSize: 16 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
