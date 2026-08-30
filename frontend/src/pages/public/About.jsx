import { motion } from 'framer-motion';
import { Target, Heart, Shield, Compass, Users, Building2 } from 'lucide-react';
import { EASE } from '../../lib/motion.jsx';

/* SchoolAI about page — company story, mission, values, team placeholder. */
const VALUES = [
  { Icon: Compass, title: 'Mission-driven', body: 'We exist to give every educator the tools to spot struggling students early — and to celebrate the ones who shine.' },
  { Icon: Heart, title: 'Human-first', body: 'Software should respect teachers\' time. Every interaction is tuned to reduce clicks, not add them.' },
  { Icon: Shield, title: 'Privacy by default', body: 'Student data is sacred. We use role-based access at every layer and never expose more than each role needs.' },
  { Icon: Target, title: 'Outcomes over output', body: 'We measure success in improved averages and lower at-risk counts — not pageviews or vanity metrics.' },
];

const TEAM = [
  { name: 'Aarav Sharma', role: 'Founder & CEO', Icon: Users },
  { name: 'Priya Nair', role: 'Head of Engineering', Icon: Building2 },
  { name: 'Rohit Gupta', role: 'Head of Design', Icon: Compass },
  { name: 'Ananya Reddy', role: 'Customer Success', Icon: Heart },
];

const field = (delay) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE, delay },
});

export default function About() {
  return (
    <div className="public-page about-page">
      <motion.section className="public-hero" {...field(0)}>
        <span className="public-hero-badge">Our story</span>
        <h1>We're building the operating system for schools.</h1>
        <p className="public-hero-sub">
          SchoolAI started in 2024 with a simple observation: schools have more data than
          ever, but teachers and principals have less time than ever to make sense of it.
          Spreadsheets don't surface at-risk students. Paper attendance doesn't predict
          dropouts. And none of it talks to the parent on a Wednesday evening.
        </p>
      </motion.section>

      <motion.section className="about-mission glass" {...field(0.1)}>
        <div className="about-mission-icon">
          <Target size={28} color="var(--accent)" />
        </div>
        <div>
          <h2>Our mission</h2>
          <p>
            To give every school — regardless of size or budget — the same data
            superpowers that Fortune 500 companies take for granted. Attendance,
            marks, tasks, analytics, and an AI assistant that reads your school's
            data and answers questions in plain English. One platform. Every role.
          </p>
        </div>
      </motion.section>

      <section className="about-values">
        <motion.div className="section-headline" {...field(0.1)}>
          <h2>What we value</h2>
          <p>The principles that guide every product decision we make.</p>
        </motion.div>
        <div className="values-grid">
          {VALUES.map((v, i) => {
            const VIcon = v.Icon;
            return (
              <motion.div
                key={v.title}
                className="glass value-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
                whileHover={{ y: -4 }}
              >
                <div className="value-icon"><VIcon size={22} /></div>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="about-team">
        <motion.div className="section-headline" {...field(0.1)}>
          <h2>The team</h2>
          <p>A small group of educators, engineers, and designers.</p>
        </motion.div>
        <div className="team-grid">
          {TEAM.map((t, i) => {
            const TIcon = t.Icon;
            return (
              <motion.div
                key={t.name}
                className="glass team-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
                whileHover={{ y: -4 }}
              >
                <div className="team-avatar"><TIcon size={28} /></div>
                <div className="team-name">{t.name}</div>
                <div className="team-role">{t.role}</div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
