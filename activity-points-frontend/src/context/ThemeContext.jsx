import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { buildAccentShades, hexToRgba, lighten, darken } from '../utils/colorTheme';

const STORAGE_KEY = 'appTheme'; // 'light' | 'dark' | 'teal' | 'custom' | 'system'
const CUSTOM_STORAGE_KEY = 'appCustomTheme'; // { accent: '#rrggbb', base: 'light' | 'dark' }
const VALID_THEMES = ['light', 'dark', 'teal', 'custom', 'system'];

const DEFAULT_CUSTOM_THEME = { accent: '#7c3aed', base: 'light' };

// Mirrors each theme's --surface value from theme.css (the same background
// color the app's own topbar sits on). Used to keep the OS/browser PWA
// window chrome (title bar) — which reads the <meta name="theme-color">
// tag, not any CSS variable — blended with whichever in-app theme is
// active: white for Light, dark slate for Dark, deep teal for Teal.
const THEME_COLORS = {
  light: '#ffffff',
  dark: '#1e293b',
  teal: '#0f3d3e',
};

// Neutral (background/border/text) scale for the two possible custom-theme
// bases, mirroring the :root[data-theme="light"] / :root[data-theme="dark"]
// blocks in theme.css. The user's accent color is layered on top of
// whichever of these they pick — see applyCustomVars() below.
const NEUTRAL_LIGHT = {
  colorScheme: 'light',
  '--surface': '#ffffff',
  '--on-color': '#ffffff',
  '--slate-50': '#f8fafc',
  '--slate-100': '#f1f5f9',
  '--slate-200': '#e2e8f0',
  '--slate-300': '#cbd5e1',
  '--slate-400': '#94a3b8',
  '--slate-500': '#64748b',
  '--slate-600': '#475569',
  '--slate-700': '#334155',
  '--slate-800': '#1e293b',
  '--slate-900': '#0f172a',
  '--glass-surface-strong': 'rgba(255, 255, 255, 0.94)',
  '--glass-surface': 'rgba(255, 255, 255, 0.85)',
  '--glass-overlay': 'rgba(255, 255, 255, 0.7)',
  '--shadow-color': 'rgba(0, 0, 0, 0.1)',
  '--shadow-color-strong': 'rgba(0, 0, 0, 0.15)',
};

const NEUTRAL_DARK = {
  colorScheme: 'dark',
  '--surface': '#1e293b',
  '--on-color': '#ffffff',
  '--slate-50': '#0f172a',
  '--slate-100': '#16213a',
  '--slate-200': '#334155',
  '--slate-300': '#475569',
  '--slate-400': '#94a3b8',
  '--slate-500': '#a8b6c9',
  '--slate-600': '#cbd5e1',
  '--slate-700': '#e2e8f0',
  '--slate-800': '#f1f5f9',
  '--slate-900': '#f8fafc',
  '--glass-surface-strong': 'rgba(30, 41, 59, 0.94)',
  '--glass-surface': 'rgba(30, 41, 59, 0.85)',
  '--glass-overlay': 'rgba(255, 255, 255, 0.08)',
  '--shadow-color': 'rgba(0, 0, 0, 0.4)',
  '--shadow-color-strong': 'rgba(0, 0, 0, 0.55)',
};

// Every CSS variable a custom theme might set inline, so we can cleanly
// remove them all when the user switches to a non-custom theme (otherwise
// the inline style would keep overriding the built-in theme's own rules).
const CUSTOM_VAR_NAMES = [
  '--surface', '--on-color',
  '--slate-50', '--slate-100', '--slate-200', '--slate-300', '--slate-400',
  '--slate-500', '--slate-600', '--slate-700', '--slate-800', '--slate-900',
  '--glass-surface-strong', '--glass-surface', '--glass-overlay',
  '--shadow-color', '--shadow-color-strong',
  '--blue-500', '--blue-600', '--blue-700', '--blue-800', '--blue-800-text',
  '--blue-tint-25', '--blue-tint-50', '--blue-tint-75', '--blue-tint-100',
];

function applyCustomVars(root, { accent, base }) {
  const neutrals = base === 'dark' ? NEUTRAL_DARK : NEUTRAL_LIGHT;
  Object.entries(neutrals).forEach(([key, value]) => {
    if (key !== 'colorScheme') root.style.setProperty(key, value);
  });
  root.style.setProperty('color-scheme', neutrals.colorScheme);

  const shades = buildAccentShades(accent);
  root.style.setProperty('--blue-500', shades[500]);
  root.style.setProperty('--blue-600', shades[600]);
  root.style.setProperty('--blue-700', shades[700]);
  root.style.setProperty('--blue-800', shades[800]);
  // Text drawn directly on a page/tinted surface (not a solid button) needs
  // to stay legible against that surface, same reasoning as the built-in
  // themes' --blue-800-text token.
  root.style.setProperty('--blue-800-text', base === 'dark' ? lighten(accent, 0.35) : darken(accent, 0.1));

  const tintAlpha = base === 'dark'
    ? { 25: 0.05, 50: 0.08, 75: 0.06, 100: 0.14 }
    : { 25: 0.04, 50: 0.07, 75: 0.05, 100: 0.12 };
  root.style.setProperty('--blue-tint-25', hexToRgba(accent, tintAlpha[25]));
  root.style.setProperty('--blue-tint-50', hexToRgba(accent, tintAlpha[50]));
  root.style.setProperty('--blue-tint-75', hexToRgba(accent, tintAlpha[75]));
  root.style.setProperty('--blue-tint-100', hexToRgba(accent, tintAlpha[100]));
}

function clearCustomVars(root) {
  CUSTOM_VAR_NAMES.forEach((name) => root.style.removeProperty(name));
  root.style.removeProperty('color-scheme');
}

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  customTheme: DEFAULT_CUSTOM_THEME,
  setCustomTheme: () => {},
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

  const [customTheme, setCustomThemeState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_CUSTOM_THEME;
    try {
      const stored = JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY) || 'null');
      if (stored && typeof stored.accent === 'string' && (stored.base === 'light' || stored.base === 'dark')) {
        return stored;
      }
    } catch {
      // ignore malformed storage, fall back to default
    }
    return DEFAULT_CUSTOM_THEME;
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
  // - 'light' / 'dark' / 'teal' -> explicit override via data-theme attribute
  // - 'custom'                   -> data-theme="custom" PLUS inline CSS
  //                                 variables generated from the user's
  //                                 own accent color + base pick
  // - 'system'                   -> attribute removed, native
  //                                 prefers-color-scheme takes over
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
      clearCustomVars(root);
    } else if (theme === 'custom') {
      root.setAttribute('data-theme', 'custom');
      applyCustomVars(root, customTheme);
    } else {
      root.setAttribute('data-theme', theme);
      clearCustomVars(root);
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, customTheme]);

  const setTheme = useCallback((next) => {
    if (VALID_THEMES.includes(next)) setThemeState(next);
  }, []);

  // Merges partial updates (e.g. just a new accent, or just a new base) into
  // the saved custom theme config, persists it, and — if custom is already
  // the active theme — the effect above re-applies it immediately so any
  // open Appearance page shows a live preview as the user picks a color.
  const setCustomTheme = useCallback((partial) => {
    setCustomThemeState((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resolvedTheme = theme === 'system'
    ? (systemPrefersDark ? 'dark' : 'light')
    : theme === 'custom'
      ? customTheme.base
      : theme;

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
    if (theme === 'custom') {
      meta.setAttribute('content', customTheme.base === 'dark' ? NEUTRAL_DARK['--surface'] : NEUTRAL_LIGHT['--surface']);
    } else {
      meta.setAttribute('content', THEME_COLORS[resolvedTheme] || THEME_COLORS.light);
    }
  }, [resolvedTheme, theme, customTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, customTheme, setCustomTheme }),
    [theme, resolvedTheme, setTheme, customTheme, setCustomTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
