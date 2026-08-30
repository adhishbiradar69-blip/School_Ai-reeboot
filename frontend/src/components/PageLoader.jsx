import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from './Logo.jsx';

/* Shows a thin branded progress bar at the top of the viewport whenever
   `loading` is true. Used during route transitions + data fetches. */
export function PageProgress({ loading }) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 9999,
            background: 'linear-gradient(90deg,#4f7df3,#8b7cf6,#4f7df3)',
            backgroundSize: '200% 100%',
          }}
          initial={{ scaleX: 0, opacity: 0, transformOrigin: 'left' }}
          animate={{ scaleX: 1, opacity: 1, backgroundPosition: ['0% 0%', '200% 0%'] }}
          exit={{ opacity: 0, scaleX: 1, transition: { duration: 0.3 } }}
          transition={{ scaleX: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                       backgroundPosition: { duration: 1.2, repeat: Infinity, ease: 'linear' } }}
        />
      )}
    </AnimatePresence>
  );
}

/* Full-route branded loader — logo + shimmer wordmark + dots.
   Renders for `ms` milliseconds on mount, then calls onDone. */
export function RouteLoader({ ms = 650, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [ms, onDone]);
  return (
    <motion.div
      style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #faf8f5)' }}
      initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
          <Logo size={52} />
        </motion.div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <motion.span key={i}
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent, #4f7df3)' }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* Hook: returns true for `ms` after `key` changes — drives the RouteLoader. */
export function useRouteTransition(key, ms = 650) {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return loading;
}
