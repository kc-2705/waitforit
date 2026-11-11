'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { App as AntApp, ConfigProvider, theme as antTheme } from 'antd';

// Navy + one blue accent. Everything else is neutral slate.
export const COLORS = {
  light: { accent: '#1d4ed8', text: '#0f172a', muted: '#64748b', border: '#e2e8f0', bg: '#f8fafc', surface: '#ffffff' },
  dark: { accent: '#3b82f6', text: '#e2e8f0', muted: '#94a3b8', border: '#1e293b', bg: '#0b1220', surface: '#0f172a' },
};

type Mode = 'light' | 'dark';
const KEY = 'waitforit.theme';
const ThemeContext = createContext<{ mode: Mode; toggle: () => void }>({ mode: 'light', toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('light');

  // Read the saved choice after mount (the static HTML is always built in light mode).
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      // Storage blocked: follow the system setting.
    }
    const initial = saved === 'dark' || saved === 'light' ? saved : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setMode(initial);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggle: () =>
        setMode((m) => {
          const next = m === 'dark' ? 'light' : 'dark';
          try {
            localStorage.setItem(KEY, next);
          } catch {
            // Not critical.
          }
          return next;
        }),
    }),
    [mode],
  );
  const c = COLORS[mode];

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        theme={{
          algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: {
            colorPrimary: c.accent,
            colorLink: c.accent,
            colorText: c.text,
            colorTextSecondary: c.muted,
            // Ant Design's default description gray fails WCAG AA contrast on white; use ours.
            colorTextDescription: c.muted,
            colorTextTertiary: c.muted,
            colorBorder: c.border,
            colorBorderSecondary: c.border,
            colorBgLayout: c.bg,
            colorBgContainer: c.surface,
            colorSuccess: mode === 'dark' ? '#22c55e' : '#15803d',
            colorWarning: mode === 'dark' ? '#f59e0b' : '#b45309',
            colorError: mode === 'dark' ? '#ef4444' : '#b91c1c',
            colorInfo: c.accent,
            fontFamily: 'var(--font-inter), system-ui, -apple-system, "Segoe UI", sans-serif',
            borderRadius: 6,
            boxShadow: 'none',
            boxShadowSecondary: '0 4px 16px rgba(15, 23, 42, 0.08)',
          },
          components: {
            Card: { paddingLG: 20, headerFontSize: 15 },
            Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
            Tag: { defaultBg: 'transparent' },
          },
        }}
      >
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeContext);
