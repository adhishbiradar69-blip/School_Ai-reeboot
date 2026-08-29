import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

/* ─── Toast ─── */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`toast toast-${type}`}>
      {type === 'success' ? '✓ ' : '✕ '}{message}
    </div>
  );
}

/* ─── Animated Number ─── */
function AnimatedNumber({ value, color }) {
  const [display, setDisplay] = useState(value);
  const [bump, setBump] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 300);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);

  useEffect(() => {
    setDisplay(value);
  }, [value]);

  return (
    <span className={bump ? 'stat-number stat-number-bump' : 'stat-number'} style={{ color }}>
      {display}
    </span>
  );
}

/* ─── Skeleton Loader Row ─── */
function SkeletonRow({ index }) {
  return (
    <tr className="skeleton-row" style={{ animationDelay: `${index * 0.06}s` }}>
      <td style={{ textAlign: 'center', padding: '16px 20px' }}>
        <div className="skeleton-block" style={{ width: 20, height: 14, margin: '0 auto' }} />
      </td>
      <td style={{ padding: '16px 20px' }}>
        <div className="skeleton-block" style={{ width: '60%', height: 14 }} />
      </td>
      <td style={{ textAlign: 'center', padding: '16px 20px' }}>
        <div className="skeleton-block" style={{ width: 70, height: 28, borderRadius: 14, margin: '0 auto' }} />
      </td>
    </tr>
  );
}

/* ─── Main Component ─── */
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
  const [shrinkingId, setShrinkingId] = useState(null);
  const [dateChanging, setDateChanging] = useState(false);

  const timeoutsRef = useRef([]);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const queueTimeout = (fn, delay) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  useEffect(() => {
    if (classId) fetchAttendance();
    return () => clearAllTimeouts();
  }, [date, classId]);

  const showToast = (message, type) => {
    setToast({ message, type });
    queueTimeout(() => setToast(null), 2600);
  };

  const fetchAttendance = async () => {
    setLoading(true);
    setDateChanging(true);
    try {
      const res = await api.get(`/attendance/class/${classId}?date=${date}`);
      const mapped = res.data.students.map(s => ({
        ...s,
        status: s.status === 'Not Marked' ? 'P' : s.status
      }));
      setStudents(mapped);
    } catch (err) {
      console.error(err);
    }
    queueTimeout(() => setDateChanging(false), 350);
    setLoading(false);
  };

  const toggleStatus = useCallback((id) => {
    setShrinkingId(id);
    setStudents(prev => prev.map(s => {
      if (s.id === id) {
        const cycle = { 'P': 'A', 'A': 'L', 'L': 'P' };
        return { ...s, status: cycle[s.status] || 'P' };
      }
      return s;
    }));
    queueTimeout(() => setShrinkingId(null), 260);
  }, []);

  const markAll = (status) => {
    setStudents(prev => prev.map(s => ({ ...s, status })));
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'P': return 'pill-present';
      case 'A': return 'pill-absent';
      case 'L': return 'pill-late';
      default: return 'pill-present';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'P': return 'Present';
      case 'A': return 'Absent';
      case 'L': return 'Late';
      default: return 'Present';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'P': return '✓';
      case 'A': return '✕';
      case 'L': return '⏱';
      default: return '?';
    }
  };

  const presentStudents = students.filter(s => s.status === 'P');
  const absentStudents = students.filter(s => s.status === 'A');
  const lateStudents = students.filter(s => s.status === 'L');

  const saveAttendance = async () => {
    setSaving(true);
    const marks = students.map(s => ({
      student_id: s.id,
      status: s.status
    }));
    try {
      await api.post('/attendance/mark', { class_id: classId, date, marks });
      showToast('Attendance saved successfully!', 'success');
    } catch (err) {
      showToast('Failed to save attendance', 'error');
    }
    setSaving(false);
  };

  if (!classId) {
    return (
      <div style={{ padding: 40 }}>
        <div className="glass" style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>⚠️</p>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Class Assigned</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Please contact the administrator to assign you a class.</p>
        </div>
      </div>
    );
  }

  if (loading && students.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h2>Attendance</h2>
          <p>Mark daily attendance</p>
        </div>
        <div className="stat-grid">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="stat-card" style={{ opacity: 0.5 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: '#e8e6e2', marginBottom: 16 }} />
              <div style={{ width: 50, height: 36, borderRadius: 6, background: '#e8e6e2', marginBottom: 8 }} />
              <div style={{ width: 80, height: 12, borderRadius: 4, background: '#e8e6e2' }} />
            </div>
          ))}
        </div>
        <div className="glass" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ width: 200, height: 14, borderRadius: 4, background: '#e8e6e2' }} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Student Name</th>
                <th style={{ width: 140 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} index={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header animate-slide-up">
        <h2>Attendance</h2>
        <p>Mark daily attendance for your class</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card animate-slide-up" style={{ animationDelay: '0.06s' }}>
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', fontSize: 22 }}>
            🏫
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', marginTop: 8 }}>
            <AnimatedNumber value={students.length} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Total Students
          </div>
        </div>

        <div className="stat-card animate-slide-up" style={{ animationDelay: '0.13s' }}>
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', fontSize: 22 }}>
            ✓
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#059669', letterSpacing: '-1px' }}>
            <AnimatedNumber value={presentStudents.length} color="#059669" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Present Today
          </div>
          <div className="attendance-bar-track" style={{ marginTop: 12 }}>
            <div className="attendance-bar-fill" style={{ width: `${students.length ? (presentStudents.length / students.length) * 100 : 0}%`, background: 'linear-gradient(90deg, #34d399 0%, #059669 100%)' }} />
          </div>
        </div>

        <div className="stat-card animate-slide-up" style={{ animationDelay: '0.20s' }}>
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', fontSize: 22 }}>
            ✕
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#dc2626', letterSpacing: '-1px' }}>
            <AnimatedNumber value={absentStudents.length} color="#dc2626" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Absent Today
          </div>
          <div className="attendance-bar-track" style={{ marginTop: 12 }}>
            <div className="attendance-bar-fill" style={{ width: `${students.length ? (absentStudents.length / students.length) * 100 : 0}%`, background: 'linear-gradient(90deg, #f87171 0%, #dc2626 100%)' }} />
          </div>
        </div>

        <div className="stat-card animate-slide-up" style={{ animationDelay: '0.27s' }}>
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', fontSize: 22 }}>
            ⏱
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#d97706', letterSpacing: '-1px' }}>
            <AnimatedNumber value={lateStudents.length} color="#d97706" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Late Today
          </div>
          <div className="attendance-bar-track" style={{ marginTop: 12 }}>
            <div className="attendance-bar-fill" style={{ width: `${students.length ? (lateStudents.length / students.length) * 100 : 0}%`, background: 'linear-gradient(90deg, #fbbf24 0%, #d97706 100%)' }} />
          </div>
        </div>
      </div>

      {(absentStudents.length > 0 || lateStudents.length > 0) && (
        <div className="glass summary-section-enter" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {absentStudents.length > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#dc2626', marginBottom: 10 }}>
                  Absent ({absentStudents.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {absentStudents.map((s, i) => (
                    <span key={s.id} className="summary-chip" style={{ animationDelay: `${i * 0.04}s`, padding: '5px 12px', borderRadius: 20, background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', color: '#991b1b', fontSize: 12, fontWeight: 600 }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {lateStudents.length > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#d97706', marginBottom: 10 }}>
                  Late ({lateStudents.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {lateStudents.map((s, i) => (
                    <span key={s.id} className="summary-chip" style={{ animationDelay: `${i * 0.04}s`, padding: '5px 12px', borderRadius: 20, background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', color: '#92400e', fontSize: 12, fontWeight: 600 }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass controls-bar animate-slide-up" style={{ animationDelay: '0.34s', padding: 20, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div className="date-picker-wrap">
          <label style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onKeyDown={(e) => e.preventDefault()}
            className="input"
            style={{ width: 'auto', minWidth: 150 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => markAll('P')} className="btn btn-secondary mark-all-btn" style={{ fontSize: 13 }}>
            ✓ All Present
          </button>
          <button onClick={() => markAll('A')} className="btn btn-secondary mark-all-btn" style={{ fontSize: 13 }}>
            ✕ All Absent
          </button>
        </div>
      </div>

      <div
        className="table-wrap animate-slide-up"
        style={{
          animationDelay: '0.41s',
          opacity: dateChanging ? 0.5 : 1,
          transform: dateChanging ? 'translateY(6px)' : 'translateY(0)',
          transition: 'opacity 0.3s ease, transform 0.3s var(--ease-butter)'
        }}
      >
        <table>
          <thead>
            <tr>
              <th style={{ width: 50, textAlign: 'center' }}>#</th>
              <th>Student Name</th>
              <th style={{ width: 140, textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody key={`tbody-${date}`}>
            {students.map((s) => (
              <tr
                key={s.id}
                className="attendance-row"
              >
                <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>
                  <span className="attendance-row-number">{s.id}</span>
                </td>
                <td style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => toggleStatus(s.id)}
                    className={`pill pill-attendance ${getStatusClass(s.status)} ${shrinkingId === s.id ? 'status-changing' : ''}`}
                  >
                    <span style={{ marginRight: 4 }}>{getStatusIcon(s.status)}</span>
                    {getStatusLabel(s.status)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '0.50s', marginTop: 24, display: 'flex', justifyContent: 'flex-start' }}>
        <button
          onClick={saveAttendance}
          disabled={saving}
          className="btn btn-primary"
          style={{ padding: '12px 36px', fontSize: 15 }}
        >
          {saving ? (
            <>
              <span className="spin-icon" style={{ marginRight: 8 }}>⟳</span>
              Saving...
            </>
          ) : (
            '💾 Save Attendance'
          )}
        </button>
      </div>
    </div>
  );
}