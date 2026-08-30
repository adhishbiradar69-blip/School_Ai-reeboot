import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, GraduationCap } from 'lucide-react';
import { useAuth, homePathFor } from '../auth/AuthContext';
import { EASE, SPRING } from '../lib/motion.jsx';

const field = (delay) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE, delay },
});

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!agreed) { setError('You must agree to the Terms and Conditions to continue.'); return; }
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(homePathFor(user.role), { replace: true });
    } catch (err) {
      setError('Invalid email or password');
    }
    setLoading(false);
  };

  return (
    <div className="login-shell">
      {/* Drifting orbs */}
      <motion.span className="orb orb-1 orb-login-1" aria-hidden="true"
        animate={{ x: [0, 30, -10, 0], y: [0, -20, 15, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.span className="orb orb-2 orb-login-2" aria-hidden="true"
        animate={{ x: [0, -25, 12, 0], y: [0, 18, -12, 0], scale: [1, 0.94, 1.06, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.span className="orb orb-3 orb-login-3" aria-hidden="true"
        animate={{ x: [0, 18, -18, 0], y: [0, -14, 10, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }} />

      <motion.div className="login-card-wrap"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}>
        <div className="glass login-card">
          {/* Logo mark with glow pulse */}
          <motion.div className="login-logo"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING, delay: 0.1 }}>
            <motion.span className="login-logo-glow"
              animate={{ opacity: [0.4, 0.9, 0.4], scale: [1, 1.15, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
            <GraduationCap size={28} strokeWidth={2.4} color="#fff" />
          </motion.div>

          <motion.h1 className="login-title" {...field(0.18)}>SchoolAI Portal</motion.h1>
          <motion.p className="login-sub" {...field(0.24)}>Authorized personnel only</motion.p>

          {error && (
            <motion.div className="login-error"
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              transition={{ duration: 0.3, ease: EASE }}>
              <AlertCircle size={16} strokeWidth={2.4} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <motion.div className="login-field" {...field(0.32)}>
              <input type="email" placeholder="Email address" value={email}
                onChange={(e) => setEmail(e.target.value)} className="input" required />
            </motion.div>
            <motion.div className="login-field" {...field(0.40)}>
              <input type="password" placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)} className="input" required />
            </motion.div>

            <motion.div className="login-terms" {...field(0.48)}>
              <input type="checkbox" id="terms" checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)} />
              <label htmlFor="terms">
                I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
                I understand this system contains confidential student data.
              </label>
            </motion.div>

            <motion.button type="submit" className="btn btn-primary login-submit"
              disabled={loading} {...field(0.56)}
              whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              {loading ? (
                <>
                  <motion.span className="spin-icon" animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    style={{ display: 'inline-flex' }}>
                    <Loader2 size={16} />
                  </motion.span>
                  Authenticating...
                </>
              ) : 'Sign In'}
            </motion.button>
          </form>
        </div>

        <motion.p className="login-footer" {...field(0.7)}>
          <Link to="/" className="login-footer-back">← Back to site</Link>
          <span>SchoolAI Data Intelligence Platform · v1.1</span>
        </motion.p>
      </motion.div>
    </div>
  );
}
