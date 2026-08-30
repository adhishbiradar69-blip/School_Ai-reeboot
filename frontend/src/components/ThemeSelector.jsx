import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check } from 'lucide-react';
import { useTheme } from './ThemeProvider.jsx';
import { EASE } from '../lib/motion.jsx';

/* A compact theme switcher. Renders the current theme's gradient swatch +
   a Palette icon. Click opens a dropdown of all themes with name + desc.
   On select, the new theme is applied instantly via `setTheme` (ThemeProvider
   pushes the CSS variables to <html> immediately + persists to localStorage). */
export default function ThemeSelector({ compact = false }) {
  const { theme, setTheme, themes } = useTheme() || {};
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!theme || !themes) return null;
  const current = themes.find(t => t.id === theme) || themes[0];

  return (
    <div className="theme-selector" ref={ref} style={{ position: 'relative' }}>
      <motion.button
        type="button"
        className={`theme-trigger ${compact ? 'theme-trigger-compact' : ''}`}
        onClick={() => setOpen(o => !o)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        aria-label="Change theme"
        title={current ? `${current.name} theme` : 'Change theme'}
      >
        <Palette size={compact ? 16 : 18} />
        {!compact && <span className="theme-trigger-label">{current?.name || 'Theme'}</span>}
        <span className="theme-swatch" style={{ background: current?.swatch }} aria-hidden="true" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="theme-dropdown glass"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <div className="theme-dropdown-header">
              <Palette size={14} />
              <span>Choose a theme</span>
            </div>
            <div className="theme-grid">
              {themes.map(t => (
                <motion.button
                  key={t.id}
                  type="button"
                  className={`theme-option ${t.id === theme ? 'active' : ''}`}
                  onClick={() => { setTheme(t.id); setOpen(false); }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="theme-option-swatch" style={{ background: t.swatch }} aria-hidden="true">
                    {t.id === theme && <Check size={14} color="#fff" strokeWidth={3} />}
                  </span>
                  <span className="theme-option-meta">
                    <span className="theme-option-name">{t.name}</span>
                    <span className="theme-option-desc">{t.desc}</span>
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
