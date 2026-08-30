import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../api/client';
import { Page, staggerContainer, staggerItem } from '../../lib/motion.jsx';
import { CountUp } from '../../components/ui.jsx';

export default function ParentChildView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/parent/child').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Page><div className="glass" style={{ padding: 60, textAlign: 'center' }}>Loading…</div></Page>;
  if (!data) return (
    <Page>
      <div className="glass" style={{ padding: 60, textAlign: 'center' }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Child Linked</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Contact the administrator to link your child to this account.</p>
      </div>
    </Page>
  );

  const child = data.student;
  const cls = data.class;
  const avg = data.average_percentage || 0;

  return (
    <Page>
      <div className="page-header">
        <h2>My Child</h2>
        <p>Performance overview for {child.name}{cls ? ` · ${cls.label}` : ''}</p>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="stat-grid">
        {[
          { v: data.marks.length, l: 'Subject Scores', c: '#6366f1', i: '📚', bg: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)' },
          { v: avg, l: 'Average %', c: '#10b981', i: '📊', bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' },
          { v: data.attendance.rate, l: 'Attendance %', c: '#f59e0b', i: '✓', bg: 'linear-gradient(135deg,#fef3c7,#fde68a)' },
          { v: data.attendance.present, l: 'Days Present', c: '#8b5cf6', i: '🗓', bg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' },
        ].map((s, i) => (
          <motion.div key={i} variants={staggerItem} className="stat-card" whileHover={{ y: -5 }}>
            <div className="stat-icon" style={{ background: s.bg, fontSize: 22 }}>{s.i}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: s.c, letterSpacing: '-1px' }}>
              <CountUp value={s.v} decimals={s.v % 1 ? 1 : 0} />
            </div>
            <div className="stat-label">{s.l}</div>
          </motion.div>
        ))}
      </motion.div>

      <div className="glass" style={{ padding: 28, marginTop: 8 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Marks Breakdown</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Exam</th>
                <th>Subject</th>
                <th style={{ textAlign: 'center' }}>Score</th>
                <th style={{ textAlign: 'center' }}>Max</th>
                <th style={{ textAlign: 'center' }}>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {data.marks.map((m, i) => {
                const pct = m.percentage;
                const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
                return (
                  <motion.tr key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <td style={{ fontWeight: 600 }}>{m.exam}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.subject_color }} />
                        {m.subject}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{m.score}</td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{m.max}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="pill" style={{ background: `${color}20`, color }}>{pct}%</span>
                    </td>
                  </motion.tr>
                );
              })}
              {!data.marks.length && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No marks recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}
