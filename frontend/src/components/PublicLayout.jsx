import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogIn } from 'lucide-react';
import { Logo } from './Logo.jsx';
import ThemeSelector from './ThemeSelector.jsx';
import { EASE } from '../lib/motion.jsx';

/* Public site layout: sticky nav (logo + links + Sign In + theme picker)
   + page outlet + footer. Active nav link gets a gradient underline.
   Nav has a subtle framer-motion entrance on mount. */
const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
];

export default function PublicLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="public-shell">
      {/* Ambient backdrop */}
      <div className="ambient-orbs public-orbs" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
      </div>

      <motion.header
        className="public-nav"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="public-nav-inner glass">
          <Link to="/" className="public-nav-brand" onClick={() => setMenuOpen(false)}>
            <Logo size={32} />
            <span className="public-nav-wordmark">SchoolAI</span>
          </Link>

          <nav className={`public-nav-links ${menuOpen ? 'open' : ''}`}>
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="public-nav-actions">
            <ThemeSelector compact />
            <motion.button
              type="button"
              className="btn btn-primary public-sign-in"
              onClick={() => navigate('/login')}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              <LogIn size={16} /> <span>Sign In</span>
            </motion.button>
            <button
              type="button"
              className="public-nav-toggle"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.header>

      <main className="public-main">{children}</main>

      <footer className="public-footer">
        <div className="public-footer-inner">
          <div className="public-footer-brand">
            <Logo size={28} />
            <div>
              <div className="public-footer-name">SchoolAI</div>
              <div className="public-footer-tagline">Intelligent school management.</div>
            </div>
          </div>
          <nav className="public-footer-links">
            <Link to="/about">About</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/login">Sign In</Link>
          </nav>
          <div className="public-footer-meta">
            © {new Date().getFullYear()} SchoolAI Data Intelligence Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
