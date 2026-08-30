import { motion } from 'framer-motion';

/* SchoolAI brand logo — a graduation cap formed from an upward arc + tassel,
   sitting inside a rounded gradient tile. Crisp, professional, no AI-slop. */
export function Logo({ size = 40, withWordmark = false, animated = false }) {
  const tile = (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sai-logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f7df3" />
          <stop offset="0.5" stopColor="#6b8ef8" />
          <stop offset="1" stopColor="#8b7cf6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#sai-logo-grad)" />
      {/* graduation cap */}
      <path d="M24 13L37 19.5L24 26L11 19.5L24 13Z" fill="white" fillOpacity="0.96" />
      <path d="M16.5 22.5V28.5C16.5 28.5 19 31 24 31C29 31 31.5 28.5 31.5 28.5V22.5L24 26L16.5 22.5Z" fill="white" fillOpacity="0.86" />
      {/* tassel */}
      <path d="M37 19.5V26" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="37" cy="27.5" r="1.6" fill="white" />
    </svg>
  );

  if (animated) {
    return (
      <motion.div style={{ display: 'inline-flex', alignItems: 'center' }}
        initial={{ rotate: -8, opacity: 0, scale: 0.8 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
        {tile}
        {withWordmark && (
          <span style={{ marginLeft: 12, fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg,#4f7df3,#8b7cf6)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent' }}>SchoolAI</span>
        )}
      </motion.div>
    );
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {tile}
      {withWordmark && (
        <span style={{ marginLeft: 12, fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px',
          background: 'linear-gradient(135deg,#4f7df3,#8b7cf6)', WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent' }}>SchoolAI</span>
      )}
    </div>
  );
}

/* Full brand loading animation — logo draws in + 3-dot pulse + wordmark fade.
   Used on initial app load and as a route-transition fallback. */
export function BrandLoader({ fullscreen = true }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      ...(fullscreen ? { minHeight: '100vh' } : { padding: 60 }),
      gap: 24,
    }}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 12 }}>
        <Logo size={56} />
      </motion.div>
      <motion.span
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.5px',
          background: 'linear-gradient(135deg,#4f7df3,#8b7cf6)', WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent' }}>
        SchoolAI
      </motion.span>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <motion.span key={i}
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: '#4f7df3' }} />
        ))}
      </div>
    </div>
  );
}
