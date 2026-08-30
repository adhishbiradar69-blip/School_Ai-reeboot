import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../api/client';
import { Page, EASE, staggerContainer, staggerItem } from '../../lib/motion.jsx';
import { CountUp } from '../../components/ui.jsx';

export default function ChairpersonMultiSchool() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/chairperson/compare').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Page><div className="glass" style={{ padding: 60, textAlign: 'center' }}>Loading comparison…</div></Page>;
  if (!data) return <Page><div className="glass" style={{ padding: 60, textAlign: 'center' }}>No schools assigned.</div></Page>;

  const schools = data.schools || [];
  const maxAvg = Math.max(...schools.map(s => s.average), 1);

  return (
    <Page>
      <div className="page-header">
        <h2>Multi-School Overview</h2>
        <p>Compare performance across the schools you oversee</p>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="stat-grid">
        {[
          { v: schools.length, l: 'Schools', c: '#6366f1', i: '🏫', bg: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)' },
          { v: data.total_students, l: 'Total Students', c: '#10b981', i: '👨‍🎓', bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' },
          { v: data.overall_average, l: 'Overall Average', c: '#f59e0b', i: '📈', bg: 'linear-gradient(135deg,#fef3c7,#fde68a)' },
          { v: data.best_school ? 1 : 0, l: data.best_school ? `Top: ${data.best_school.name}` : 'No data yet', c: '#8b5cf6', i: '🏆', bg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' },
        ].map((s, i) => (
          <motion.div key={i} variants={staggerItem} className="stat-card" whileHover={{ y: -5 }}>
            <div className="stat-icon" style={{ background: s.bg, fontSize: 22 }}>{s.i}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.c, letterSpacing: '-1px' }}>
              {s.l.includes('Top') ? <span style={{ fontSize: 16 }}>{s.l}</span> : <CountUp value={s.v} decimals={s.v % 1 ? 1 : 0} />}
            </div>
            {!s.l.includes('Top') && <div className="stat-label">{s.l}</div>}
          </motion.div>
        ))}
      </motion.div>

      <div className="glass" style={{ padding: 28, marginTop: 8 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>School Comparison</h3>
        <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {schools.map(s => (
            <motion.div key={s.id} variants={staggerItem} className="school-compare-row">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>🏫</span>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</span>
                  <span className="pill" style={{ background: '#f0eeea', color: '#64748b', fontSize: 11 }}>{s.students} students</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 20, color: s.average >= 60 ? '#10b981' : s.average >= 40 ? '#f59e0b' : '#ef4444' }}>
                  {s.average}%
                </span>
              </div>
              <div className="progress-track" style={{ height: 10 }}>
                <motion.div className="progress-fill"
                  initial={{ width: 0 }} animate={{ width: `${(s.average / 100) * 100}%` }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
                  style={{ background: s.average >= 60 ? 'linear-gradient(90deg,#34d399,#059669)' : s.average >= 40 ? 'linear-gradient(90deg,#fbbf24,#d97706)' : 'linear-gradient(90deg,#f87171,#dc2626)' }} />
              </div>
            </motion.div>
          ))}
          {!schools.length && <div className="empty-mini">No schools assigned to your account yet.</div>}
        </motion.div>
      </div>
    </Page>
  );
}
