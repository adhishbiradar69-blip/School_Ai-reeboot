import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, X, Clock, Save, Loader2, Users } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Page, EASE, SPRING, staggerContainer, staggerItem } from '../../lib/motion.jsx';
import { CountUp, Toast } from '../../components/ui.jsx';

function SkeletonRow({ index }) {
  return (
    <tr style={{ animationDelay: `${index * 0.06}s` }}>
      <td style={{ textAlign: 'center', padding: '16px 20px' }}><div className="skeleton-block" style={{ width: 20, height: 14, margin: '0 auto' }} /></td>
      <td style={{ padding: '16px 20px' }}><div className="skeleton-block" style={{ width: '60%', height: 14 }} /></td>
      <td style={{ textAlign: 'center', padding: '16px 20px' }}><div className="skeleton-block" style={{ width: 70, height: 28, borderRadius: 14, margin: '0 auto' }} /></td>
    </tr>
  );
}

const STATUS = {
  P: { next: 'A', cls: 'pill-present', label: 'Present', Icon: Check, color: '#059669' },
  A: { next: 'L', cls: 'pill-absent', label: 'Absent', Icon: X, color: '#dc2626' },
  L: { next: 'P', cls: 'pill-late', label: 'Late', Icon: Clock, color: '#d97706' },
};

function StatusPill({ status, onClick, active }) {
  const s = STATUS[status] || STATUS.P;
  const StatusIcon = s.Icon;
  return (
    <motion.button
      onClick={onClick}
      className={`pill pill-attendance ${s.cls} ${active ? 'status-changing' : ''}`}
      animate={{ scale: active ? [1, 0.88, 1.06, 1] : 1 }}
      transition={{ duration: 0.34, ease: EASE }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      style={{ '--pill-color': s.color }}
    >
      <motion.span animate={{ rotate: active ? [0, -8, 8, 0] : 0 }} transition={{ duration: 0.34 }}
        style={{ display: 'inline-flex', alignItems: 'center' }}><StatusIcon size={14} strokeWidth={3} /></motion.span>
      <span style={{ marginLeft: 4 }}>{s.label}</span>
    </motion.button>
  );
}

export default function AttendanceBoard() {
  const { user } = useAuth();
  const classId = user?.assigned_class_id;
  const [students, setStudents] = useState([]);
  const [date, setDate] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [changingId, setChangingId] = useState(null);
  const [dateChanging, setDateChanging] = useState(false);
  const showToast = (m, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 2600); };

  useEffect(() => { if (classId) fetchAttendance(); }, [date, classId]);

  const fetchAttendance = async () => {
    setLoading(true); setDateChanging(true);
    try {
      const res = await api.get(`/attendance/class/${classId}?date=${date}`);
      setStudents(res.data.students.map(s => ({ ...s, status: s.status === 'Not Marked' ? 'P' : s.status })));
    } catch (e) { console.error(e); }
    setTimeout(() => setDateChanging(false), 280);
    setLoading(false);
  };

  const toggleStatus = useCallback((id) => {
    setChangingId(id);
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status: (STATUS[s.status] || STATUS.P).next } : s));
    setTimeout(() => setChangingId(null), 340);
  }, []);

  const markAll = (status) => setStudents(prev => prev.map(s => ({ ...s, status })));

  const present = students.filter(s => s.status === 'P');
  const absent = students.filter(s => s.status === 'A');
  const late = students.filter(s => s.status === 'L');

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/attendance/mark', { class_id: classId, date, marks: students.map(s => ({ student_id: s.id, status: s.status })) });
      showToast('Attendance saved successfully!', 'success');
    } catch { showToast('Failed to save attendance', 'error'); }
    setSaving(false);
  };

  if (!classId) return (
    <Page><div className="glass" style={{ textAlign: 'center', padding: 60, marginTop: 40 }}>
      <AlertTriangle size={48} color="#d97706" style={{ marginBottom: 16 }} />
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Class Assigned</h3>
      <p style={{ color: 'var(--text-secondary)' }}>Please contact the administrator to assign you a class.</p>
    </div></Page>
  );

  if (loading && students.length === 0) return (
    <Page>
      <div className="page-header"><h2>Attendance</h2><p>Mark daily attendance</p></div>
      <div className="stat-grid">{[0,1,2,3].map(i => <div key={i} className="stat-card" style={{ opacity: 0.5 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: '#e8e6e2', marginBottom: 16 }} />
        <div style={{ width: 50, height: 36, borderRadius: 6, background: '#e8e6e2', marginBottom: 8 }} />
        <div style={{ width: 80, height: 12, borderRadius: 4, background: '#e8e6e2' }} />
      </div>)}</div>
      <div className="table-wrap"><table><tbody>{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} index={i} />)}</tbody></table></div>
    </Page>
  );

  return (
    <Page>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <h2>Attendance</h2>
        <p>Mark daily attendance for your class</p>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="stat-grid">
        {[
          { v: students.length, l: 'Total Students', c: '#1a1f36', Icon: Users, bg: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)' },
          { v: present.length, l: 'Present Today', c: '#059669', Icon: Check, bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', bar: present.length },
          { v: absent.length, l: 'Absent Today', c: '#dc2626', Icon: X, bg: 'linear-gradient(135deg,#fee2e2,#fecaca)', bar: absent.length },
          { v: late.length, l: 'Late Today', c: '#d97706', Icon: Clock, bg: 'linear-gradient(135deg,#fef3c7,#fde68a)', bar: late.length },
        ].map((s, i) => {
          const SIcon = s.Icon;
          return (
            <motion.div key={i} variants={staggerItem} className="stat-card" whileHover={{ y: -5 }}>
              <div className="stat-icon" style={{ background: s.bg, color: s.c }}>
                <SIcon size={22} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: s.c, letterSpacing: '-1px' }}>
                <CountUp value={s.v} />
              </div>
              <div className="stat-label">{s.l}</div>
              {s.bar !== undefined && (
                <div className="attendance-bar-track" style={{ marginTop: 12 }}>
                  <motion.div className="attendance-bar-fill"
                    initial={{ width: 0 }} animate={{ width: `${students.length ? (s.bar / students.length) * 100 : 0}%` }}
                    transition={{ duration: 0.7, ease: EASE }}
                    style={{ background: s.c === '#059669' ? 'linear-gradient(90deg,#34d399,#059669)' : s.c === '#dc2626' ? 'linear-gradient(90deg,#f87171,#dc2626)' : 'linear-gradient(90deg,#fbbf24,#d97706)' }} />
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {(absent.length > 0 || late.length > 0) && (
          <motion.div className="glass" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ padding: 20, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {absent.length > 0 && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#dc2626', marginBottom: 10 }}>Absent ({absent.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {absent.map((s, i) => <motion.span key={s.id} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04, ...SPRING }}
                      style={{ padding: '5px 12px', borderRadius: 20, background: 'linear-gradient(135deg,#fee2e2,#fecaca)', color: '#991b1b', fontSize: 12, fontWeight: 600 }}>{s.name}</motion.span>)}
                  </div>
                </div>
              )}
              {late.length > 0 && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#d97706', marginBottom: 10 }}>Late ({late.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {late.map((s, i) => <motion.span key={s.id} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04, ...SPRING }}
                      style={{ padding: '5px 12px', borderRadius: 20, background: 'linear-gradient(135deg,#fef3c7,#fde68a)', color: '#92400e', fontSize: 12, fontWeight: 600 }}>{s.name}</motion.span>)}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass controls-bar" style={{ padding: 20, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div className="date-picker-wrap">
          <label style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} onKeyDown={e => e.preventDefault()} className="input" style={{ width: 'auto', minWidth: 150 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => markAll('P')} className="btn btn-secondary" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={14} /> All Present</button>
          <button onClick={() => markAll('A')} className="btn btn-secondary" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><X size={14} /> All Absent</button>
        </div>
      </div>

      <motion.div className="table-wrap" animate={{ opacity: dateChanging ? 0.5 : 1, y: dateChanging ? 6 : 0 }} transition={{ duration: 0.28 }}>
        <table>
          <thead>
            <tr><th style={{ width: 50, textAlign: 'center' }}>#</th><th>Student Name</th><th style={{ width: 140, textAlign: 'center' }}>Status</th></tr>
          </thead>
          <tbody key={`tbody-${date}`}>
            {students.map(s => (
              <motion.tr key={s.id} className="attendance-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>{s.id}</td>
                <td style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</td>
                <td style={{ textAlign: 'center' }}>
                  <StatusPill status={s.status} active={changingId === s.id} onClick={() => toggleStatus(s.id)} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <div style={{ marginTop: 24 }}>
        <motion.button onClick={save} disabled={saving} className="btn btn-primary"
          whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} style={{ padding: '12px 36px', fontSize: 15 }}>
          {saving ? (<><motion.span className="spin-icon" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ marginRight: 8, display: 'inline-flex' }}><Loader2 size={16} /></motion.span>Saving...</>) : <><Save size={16} style={{ marginRight: 6, display: 'inline-flex', verticalAlign: '-2px' }} /> Save Attendance</>}
        </motion.button>
      </div>
    </Page>
  );
}
