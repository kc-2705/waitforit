'use client';

import { useEffect } from 'react';
import { waitForServer } from '@/lib/api';

/** Keeps the opening screen (rendered in layout.tsx) up until the API is awake. */
export default function ServerGate() {
  useEffect(() => {
    const splash = document.getElementById('splash');
    if (!splash) return;
    const minimum = new Promise((r) => setTimeout(r, 700));
    const ready = waitForServer({
      onSlow: () => splash.classList.add('waiting'),
      onRetry: () => {
        const note = document.getElementById('splash-note');
        if (note) note.textContent = 'Still starting up. Thanks for waiting, almost there.';
      },
    });
    Promise.all([minimum, ready]).then(() => {
      splash.classList.add('done');
      setTimeout(() => splash.remove(), 400);
    });
  }, []);
  return null;
}
