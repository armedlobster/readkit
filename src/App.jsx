import { useEffect, useState } from 'react';
import Library from './components/Library.jsx';
import Reader from './components/Reader.jsx';
import Settings from './components/Settings.jsx';
import Contents from './components/Contents.jsx';
import { getSettings } from './db.js';

export default function App() {
  const [screen, setScreen] = useState({ name: 'library' });

  useEffect(() => {
    getSettings().then((s) => {
      document.documentElement.dataset.theme = s.theme;
    });
  }, []);

  if (screen.name === 'reader') {
    return (
      <Reader
        bookId={screen.bookId}
        jumpTo={screen.jumpTo}
        onBack={() => setScreen({ name: 'library' })}
        onOpenSettings={() => setScreen({ name: 'settings', returnTo: { name: 'reader', bookId: screen.bookId } })}
        onOpenContents={() => setScreen({ name: 'contents', bookId: screen.bookId })}
      />
    );
  }

  if (screen.name === 'contents') {
    return (
      <Contents
        bookId={screen.bookId}
        onBack={() => setScreen({ name: 'reader', bookId: screen.bookId })}
        onJump={(wordIndex) => setScreen({ name: 'reader', bookId: screen.bookId, jumpTo: wordIndex })}
      />
    );
  }

  if (screen.name === 'settings') {
    return <Settings onBack={() => setScreen(screen.returnTo || { name: 'library' })} />;
  }

  return (
    <Library
      onOpenBook={(bookId) => setScreen({ name: 'reader', bookId })}
      onOpenSettings={() => setScreen({ name: 'settings', returnTo: { name: 'library' } })}
    />
  );
}
