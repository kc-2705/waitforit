'use client';

import { useEffect } from 'react';
import { waitForServer } from '@/lib/api';

const SEEN_KEY = 'waitforit.introSeen';

function seenThisVisit() {
  try {
    const seen = sessionStorage.getItem(SEEN_KEY) === '1';
    sessionStorage.setItem(SEEN_KEY, '1');
    return seen;
  } catch {
    return false;
  }
}

/**
 * Keeps the opening animation (rendered in layout.tsx) up until it has played once and the API is awake.
 * Reloads in the same visit skip the animation.
 */
export default function ServerGate() {
  useEffect(() => {
    const splash = document.getElementById('splash');
    if (!splash) return;
    const quick = seenThisVisit();
    if (quick) splash.classList.add('quick');
    const minimum = new Promise((r) => setTimeout(r, quick ? 250 : 2100));
    const ready = waitForServer({
      onSlow: () => setTimeout(() => splash.classList.add('waiting'), quick ? 0 : 1200),
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
