import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Page, staggerContainer, staggerItem } from '../../lib/motion.jsx';
import { CountUp } from '../../components/ui.jsx';

export default function ClassReport() {
  const { user } = useAuth();
  const classId = user?.assigned_class_id;
  const [report, setReport] = useState([]);
  const [classLabel, setClassLabel] = useState('your class');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    Promise.all([
      api.get(`/academics/class/${classId}/report`),
      api.get('/attendance/teacher/classes'),
    ]).then(([r, c]) => {
      setReport(r.data);
      const found = c.data.find(c => c.id === classId);
      if (found) setClassLabel(found.label);
    }).catch(console.error).finally(() => setLoading(false));
  }, [classId]);

  if (loading) return <Page><div className="glass" style={{ padding: 60, textAlign: 'center' }}>Loading report…</div></Page>;

  const avg = report.length ? (report.reduce((a, b) => a + b.average_score, 0) / report.length).toFixed(1) : 0;

  return (
    <Page>
      <div className="page-header">
        <h2>Class Report</h2>
        <p>Academic overview for {classLabel}</p>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate"
        className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        <motion.div variants={staggerItem} className="stat-card" whileHover={{ y: -5 }}>
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)', color: '#6366f1', fontSize: 22 }}>👨‍🎓</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}><CountUp value={report.length} /></div>
          <div className="stat-label">Total Students</div>
        </motion.div>
        <motion.div variants={staggerItem} className="stat-card" whileHover={{ y: -5 }}>
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', fontSize: 22 }}>📊</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#10b981' }}><CountUp value={avg} decimals={1} /></div>
          <div className="stat-label">Class Average %</div>
        </motion.div>
      </motion.div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th><th>Student</th>
              <th style={{ textAlign: 'center' }}>Exams</th>
              <th style={{ textAlign: 'center' }}>Average %</th>
              <th style={{ textAlign: 'center' }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {report.map((s, i) => {
              const score = s.average_score;
              const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D';
              const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
              return (
                <motion.tr key={s.student_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{s.exams}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color }}>{score}%</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="pill" style={{ background: `${color}20`, color, minWidth: 50 }}>{grade}</span>
                  </td>
                </motion.tr>
              );
            })}
            {!report.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No report data yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
