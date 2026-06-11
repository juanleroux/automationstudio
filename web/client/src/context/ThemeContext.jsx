import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const DEFAULT_ACCENT = '#888888';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function darken(hex, amount = 0.15) {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 - amount;
  return `#${[r, g, b].map(c => Math.round(c * f).toString(16).padStart(2, '0')).join('')}`;
}

function toRgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function applyTheme(scheme) {
  const effective = scheme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : scheme;
  document.documentElement.setAttribute('data-theme', effective);
}

function applyAccent(color) {
  const root = document.documentElement;
  root.style.setProperty('--accent',      color);
  root.style.setProperty('--accent-dim',  darken(color, 0.15));
  root.style.setProperty('--accent-bg',   toRgba(color, 0.1));
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState]   = useState(() => localStorage.getItem('theme')       || 'system');
  const [accent, setAccentState] = useState(() => localStorage.getItem('accentColor') || DEFAULT_ACCENT);

  // Apply theme + listen for OS changes when 'system'
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  // Apply accent color CSS variables
  useEffect(() => {
    applyAccent(accent);
    localStorage.setItem('accentColor', accent);
  }, [accent]);

  const setTheme = (t) => setThemeState(t);
  const toggleTheme = () => setThemeState(t => t === 'dark' ? 'light' : 'dark');
  const setAccentColor  = (color) => setAccentState(color);
  const resetAccentColor = () => setAccentState(DEFAULT_ACCENT);

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, toggleTheme,
      accentColor: accent, setAccentColor, resetAccentColor,
      defaultAccent: DEFAULT_ACCENT,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
