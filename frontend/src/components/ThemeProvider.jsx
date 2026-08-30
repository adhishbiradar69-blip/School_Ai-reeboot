import { createContext, useContext, useEffect, useState } from 'react';

/* SchoolAI theme system. Each theme overrides the CSS custom properties
   defined in index.css. Switching is instant + persists to localStorage. */

export const THEMES = [
  { id: 'aurora',  name: 'Aurora',  swatch: 'linear-gradient(135deg,#4f7df3,#8b7cf6)', desc: 'Soft & calm' },
  { id: 'midnight', name: 'Midnight', swatch: 'linear-gradient(135deg,#1e293b,#475569)', desc: 'Dark focus' },
  { id: 'emerald', name: 'Emerald', swatch: 'linear-gradient(135deg,#059669,#34d399)', desc: 'Growth' },
  { id: 'sunset',  name: 'Sunset',  swatch: 'linear-gradient(135deg,#e85d75,#f0a04b)', desc: 'Warm' },
  { id: 'slate',   name: 'Slate',   swatch: 'linear-gradient(135deg,#334155,#64748b)', desc: 'Pro neutral' },
  { id: 'royal',   name: 'Royal',   swatch: 'linear-gradient(135deg,#7c3aed,#a855f7)', desc: 'Premium' },
];

const VARS = {
  aurora: {
    '--bg': '#faf8f5',
    '--bg-gradient': 'linear-gradient(135deg,#f5f0ff 0%,#eef4ff 25%,#f0f9f6 50%,#fff8f0 75%,#faf5ff 100%)',
    '--bg-card': 'rgba(255,255,255,0.72)',
    '--bg-solid': '#ffffff',
    '--border': 'rgba(200,210,230,0.5)',
    '--border-strong': '#d8dde8',
    '--text-primary': '#1a1f36',
    '--text-secondary': '#5a6278',
    '--text-muted': '#8a92a8',
    '--accent': '#4f7df3',
    '--accent-light': '#7aa2f7',
    '--accent-glow': 'rgba(79,125,243,0.12)',
    '--accent-gradient': 'linear-gradient(135deg,#4f7df3 0%,#6b8ef8 40%,#8b7cf6 100%)',
  },
  midnight: {
    '--bg': '#0f172a',
    '--bg-gradient': 'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)',
    '--bg-card': 'rgba(30,41,59,0.85)',   // more opaque — glass cards were muddy on dark bg
    '--bg-solid': '#1e293b',
    '--bg-hover': '#334155',
    '--border': 'rgba(148,163,184,0.18)',
    '--border-strong': '#334155',
    '--text-primary': '#f1f5f9',
    '--text-secondary': '#cbd5e1',
    '--text-muted': '#94a3b8',
    '--accent': '#60a5fa',
    '--accent-light': '#93c5fd',
    '--accent-glow': 'rgba(96,165,250,0.18)',
    '--accent-gradient': 'linear-gradient(135deg,#3b82f6 0%,#60a5fa 50%,#818cf8 100%)',
    '--shadow-sm': '0 2px 8px rgba(0,0,0,0.3)',
    '--shadow': '0 8px 32px rgba(0,0,0,0.4)',
    '--shadow-lg': '0 16px 48px rgba(0,0,0,0.5)',
  },
  emerald: {
    '--bg': '#f0fdf4',
    '--bg-gradient': 'linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 50%,#f0fdfa 100%)',
    '--bg-card': 'rgba(255,255,255,0.72)',
    '--bg-solid': '#ffffff',
    '--border': 'rgba(167,243,208,0.4)',
    '--border-strong': '#bbf7d0',
    '--text-primary': '#052e16',
    '--text-secondary': '#166534',
    '--text-muted': '#4b7c6a',
    '--accent': '#059669',
    '--accent-light': '#34d399',
    '--accent-glow': 'rgba(5,150,105,0.12)',
    '--accent-gradient': 'linear-gradient(135deg,#059669 0%,#10b981 50%,#34d399 100%)',
  },
  sunset: {
    '--bg': '#fff7ed',
    '--bg-gradient': 'linear-gradient(135deg,#fff7ed 0%,#fef2f2 50%,#fdf4ff 100%)',
    '--bg-card': 'rgba(255,255,255,0.72)',
    '--bg-solid': '#ffffff',
    '--border': 'rgba(251,213,170,0.4)',
    '--border-strong': '#fed7aa',
    '--text-primary': '#431407',
    '--text-secondary': '#9a3412',
    '--text-muted': '#c2725a',
    '--accent': '#e85d75',
    '--accent-light': '#f4a3b0',
    '--accent-glow': 'rgba(232,93,117,0.12)',
    '--accent-gradient': 'linear-gradient(135deg,#e85d75 0%,#f0a04b 100%)',
  },
  slate: {
    '--bg': '#f8fafc',
    '--bg-gradient': 'linear-gradient(135deg,#f8fafc 0%,#f1f5f9 50%,#e2e8f0 100%)',
    '--bg-card': 'rgba(255,255,255,0.78)',
    '--bg-solid': '#ffffff',
    '--border': 'rgba(203,213,225,0.5)',
    '--border-strong': '#cbd5e1',
    '--text-primary': '#0f172a',
    '--text-secondary': '#475569',
    '--text-muted': '#94a3b8',
    '--accent': '#334155',
    '--accent-light': '#64748b',
    '--accent-glow': 'rgba(51,65,85,0.1)',
    '--accent-gradient': 'linear-gradient(135deg,#334155 0%,#475569 50%,#64748b 100%)',
  },
  royal: {
    '--bg': '#faf5ff',
    '--bg-gradient': 'linear-gradient(135deg,#faf5ff 0%,#f5f3ff 50%,#eef2ff 100%)',
    '--bg-card': 'rgba(255,255,255,0.72)',
    '--bg-solid': '#ffffff',
    '--border': 'rgba(216,180,254,0.4)',
    '--border-strong': '#d8b4fe',
    '--text-primary': '#2e1065',
    '--text-secondary': '#6b21a8',
    '--text-muted': '#9379c4',
    '--accent': '#7c3aed',
    '--accent-light': '#a855f7',
    '--accent-glow': 'rgba(124,58,237,0.12)',
    '--accent-gradient': 'linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#c084fc 100%)',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('schoolai-theme') || 'aurora');

  useEffect(() => {
    const vars = VARS[theme] || VARS.aurora;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    // Set data-theme on <html> so CSS can theme components that need a
    // solid background in dark themes (e.g. midnight) — see motion.css.
    root.setAttribute('data-theme', theme);
    localStorage.setItem('schoolai-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
