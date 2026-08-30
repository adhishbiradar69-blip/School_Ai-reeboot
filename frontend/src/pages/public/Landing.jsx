import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, Bot, Building2, ArrowRight, Play, CheckCircle2,
  Sparkles, TrendingUp, Users, GraduationCap, ShieldCheck,
} from 'lucide-react';
import { Logo } from '../../components/Logo.jsx';
import { EASE } from '../../lib/motion.jsx';

/* SchoolAI landing page — hero, 3 feature cards, stats band, footer-CTA.
   Uses framer-motion entrance animations, the Logo component, and Lucide
   icons throughout. Designed to look like a polished SaaS product page. */

const FEATURES = [
  {
    Icon: BarChart3,
    title: 'Analytics that matter',
    body: 'Real-time dashboards for grades, attendance, exam performance, and at-risk detection — built for principals and chairpersons.',
    color: '#4f7df3',
    bg: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)',
  },
  {
    Icon: Bot,
    title: 'AI Assistant',
    body: 'Ask plain-English questions about your school. Get markdown answers with named students, specific numbers, and action recommendations.',
    color: '#8b7cf6',
    bg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)',
  },
  {
    Icon: Building2,
    title: 'Multi-School ready',
    body: 'Chairpersons compare performance across every school they oversee with side-by-side benchmarks, top performers, and trends.',
    color: '#10b981',
    bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)',
  },
];

const STATS = [
  { Icon: GraduationCap, value: '1,125', label: 'Demo students seeded' },
  { Icon: Building2, value: '3', label: 'Demo schools' },
  { Icon: TrendingUp, value: '65%', label: 'Avg school performance' },
  { Icon: ShieldCheck, value: '6', label: 'Role-based access tiers' },
];

const field = (delay) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE, delay },
});

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <motion.div className="hero-orbs" aria-hidden="true">
          <motion.span className="orb orb-1"
            animate={{ x: [0, 40, -10, 0], y: [0, -30, 20, 0], scale: [1, 1.1, 0.95, 1] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.span className="orb orb-2"
            animate={{ x: [0, -30, 18, 0], y: [0, 24, -16, 0], scale: [1, 0.92, 1.08, 1] }}
            transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }} />
        </motion.div>

        <motion.div className="hero-content" {...field(0)}>
          <span className="hero-badge">
            <Sparkles size={14} /> AI-powered school intelligence platform
          </span>
          <h1 className="hero-headline">
            School management, <br />
            <span className="hero-gradient-text">finally intelligent.</span>
          </h1>
          <p className="hero-sub">
            One platform for attendance, marks, tasks, and school-wide analytics.
            Built for class teachers, principals, chairpersons, and parents —
            with an AI assistant that actually reads your data.
          </p>

          <motion.div className="hero-cta-row">
            <motion.button
              type="button"
              className="btn btn-primary hero-cta-primary"
              onClick={() => navigate('/login')}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Get Started <ArrowRight size={16} />
            </motion.button>
            <motion.button
              type="button"
              className="btn btn-secondary hero-cta-secondary"
              onClick={() => navigate('/login')}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play size={14} /> Live Demo
            </motion.button>
          </motion.div>

          <div className="hero-trust-row">
            {['RBAC for 6 roles', 'AI insights in seconds', 'Multi-school rollups'].map(t => (
              <span key={t} className="hero-trust-pill">
                <CheckCircle2 size={13} /> {t}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div className="hero-logo-mark" {...field(0.2)}>
          <Logo size={120} animated />
        </motion.div>
      </section>

      {/* Features */}
      <section className="features-section">
        <motion.div className="section-headline" {...field(0.05)}>
          <h2>Everything a school needs, in one place</h2>
          <p>From the classroom to the boardroom — purpose-built for every role.</p>
        </motion.div>

        <div className="feature-grid">
          {FEATURES.map((f, i) => {
            const FIcon = f.Icon;
            return (
              <motion.div
                key={f.title}
                className="glass feature-card"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.55, ease: EASE, delay: i * 0.1 }}
                whileHover={{ y: -6 }}
              >
                <div className="feature-icon" style={{ background: f.bg, color: f.color }}>
                  <FIcon size={26} strokeWidth={2.2} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Stats band */}
      <section className="stats-band">
        <motion.div
          className="stats-band-inner glass"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          {STATS.map((s, i) => {
            const SIcon = s.Icon;
            return (
              <motion.div
                key={s.label}
                className="stats-band-item"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}
              >
                <div className="stats-band-icon"><SIcon size={20} /></div>
                <div className="stats-band-value">{s.value}</div>
                <div className="stats-band-label">{s.label}</div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <motion.div
          className="cta-card glass"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Users size={40} color="var(--accent)" style={{ marginBottom: 12 }} />
          <h2>Ready to modernize your school?</h2>
          <p>Sign in with a demo account to explore the full experience — class teacher, principal, chairperson, parent, and admin roles all available.</p>
          <div className="cta-card-actions">
            <motion.button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/login')}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Sign In <ArrowRight size={16} />
            </motion.button>
            <Link to="/about" className="btn btn-secondary">Learn More</Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
