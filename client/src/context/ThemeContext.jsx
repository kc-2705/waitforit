import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { App as AntApp, ConfigProvider, theme as antTheme } from 'antd';

const ThemeContext = createContext(null);
const KEY = 'waitforit.theme';

function initialMode() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage blocked: fall back to the system setting.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const BRAND = { primary: '#0f766e', good: '#15803d', warn: '#b45309', bad: '#b91c1c' };

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // Not critical.
    }
  }, [mode]);

  const value = useMemo(() => ({ mode, toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')) }), [mode]);
  const dark = mode === 'dark';

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        theme={{
          algorithm: dark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: {
            colorPrimary: dark ? '#14b8a6' : BRAND.primary,
            colorLink: dark ? '#5eead4' : BRAND.primary,
            colorSuccess: BRAND.good,
            colorWarning: BRAND.warn,
            colorError: BRAND.bad,
            fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
            borderRadius: 10,
            colorBgLayout: dark ? '#0b1514' : '#f4f7f6',
          },
          components: { Card: { paddingLG: 20 } },
        }}
      >
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
