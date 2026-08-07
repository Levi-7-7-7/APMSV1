import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const STORAGE_KEY = 'appTheme'; // 'light' | 'dark' | 'teal' | 'system'
const VALID_THEMES = ['light', 'dark', 'teal', 'system'];

// Mirrors each theme's --blue-800 brand-accent value from theme.css. Used to
// keep the OS/browser PWA window chrome (title bar) — which reads the
// <meta name="theme-color"> tag, not any CSS variable — in sync with
// whichever in-app theme is active. Light and Dark intentionally share the
// same blue brand accent (dark mode never retints --blue-800), only Teal
// diverges, matching how the accent colors themselves are defined in CSS.
const THEME_COLORS = {
  light: '#1d4ed8',
  dark: '#1d4ed8',
  teal: '#0f766e',
};

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

const getSystemPrefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return VALID_THEMES.includes(stored) ? stored : 'system';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);

  // Track OS-level preference changes (only matters while theme === 'system')
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemPrefersDark(e.matches);
    mql.addEventListener ? mql.addEventListener('change', onChange) : mql.addListener(onChange);
    return () => {
      mql.removeEventListener ? mql.removeEventListener('change', onChange) : mql.removeListener(onChange);
    };
  }, []);

  // Apply the chosen theme to the document so CSS can react to it.
  // - 'light' / 'dark' -> explicit override via data-theme attribute
  // - 'system'          -> attribute removed, native prefers-color-scheme takes over
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (VALID_THEMES.includes(next)) setThemeState(next);
  }, []);

  const resolvedTheme = theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  // Keep the PWA/browser window-chrome color (theme-color meta tag) in sync
  // with the resolved theme. The manifest.json theme_color is only read
  // once (install time / before first paint), so this is what actually
  // updates the title bar live as the user switches themes.
  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', THEME_COLORS[resolvedTheme] || THEME_COLORS.light);
  }, [resolvedTheme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
