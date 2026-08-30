import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Page, EASE, staggerContainer, staggerItem } from '../../lib/motion.jsx';
import { CountUp, Toast, Modal, SuccessBurst } from '../../components/ui.jsx';

function MarkInput({ value, onChange, onKeyDown, inputRef, subjectColor, max }) {
  return (
    <input ref={inputRef} type="number" min="0" max={max} step="0.5"
      value={value === '' || value === null || value === undefined ? '' : value}
      onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
      onKeyDown={onKeyDown} className="mark-input" style={{ '--subject-color': subjectColor || 'var(--accent)' }} />
  );
}

export default function MarksBoard() {
  const { user } = useAuth();
  const classId = user?.assigned_class_id;

  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [examData, setExamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marksLoading, setMarksLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [burst, setBurst] = useState(false);
  const [draft, setDraft] = useState({});

  const inputRefs = useRef({});
  const showToast = (m, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 2600); };

  useEffect(() => { if (classId) init(); }, [classId]);

  const init = async () => {
    setLoading(true);
    try {
      // Only load exams first (the marks response carries students + subjects).
      // NOTE: we deliberately do NOT call /attendance/class/{id} here because it
      // requires a `date` param; students come from the marks response instead.
      const exRes = await api.get(`/academics/class/${classId}/exams`);
      setExams(exRes.data);
      if (exRes.data.length) setSelectedExam(String(exRes.data[0].id));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (classId && selectedExam) fetchMarks(); }, [selectedExam, classId]);

  const fetchMarks = async () => {
    setMarksLoading(true);
    try {
      const res = await api.get(`/academics/class/${classId}/marks?exam_id=${selectedExam}`);
      setExamData(res.data);
      setSubjects(res.data.subjects);
      setStudents(res.data.students.map(s => ({ id: s.id, name: s.name })));
    } catch (e) { console.error(e); }
    setMarksLoading(false);
  };

  const openModal = () => {
    const d = {};
    students.forEach(s => subjects.forEach(sub => {
      const v = examData?.students.find(st => st.id === s.id)?.marks?.[String(sub.id)];
      d[`${s.id}-${sub.id}`] = v !== null && v !== undefined ? v : '';
    }));
    setDraft(d); setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); inputRefs.current = {}; };

  const handleMarkChange = (sid, subId, v) => setDraft(p => ({ ...p, [`${sid}-${subId}`]: v }));

  const cellKey = (e, si, ssi) => {
    const nS = subjects[ssi + 1]; const nStu = students[si + 1];
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nS) inputRefs.current[`${students[si].id}-${nS.id}`]?.focus();
      else if (nStu) inputRefs.current[`${nStu.id}-${subjects[0].id}`]?.focus();
    } else if (e.key === 'ArrowRight' && subjects[ssi + 1]) { e.preventDefault(); inputRefs.current[`${students[si].id}-${subjects[ssi + 1].id}`]?.focus(); }
    else if (e.key === 'ArrowLeft' && subjects[ssi - 1]) { e.preventDefault(); inputRefs.current[`${students[si].id}-${subjects[ssi - 1].id}`]?.focus(); }
    else if (e.key === 'ArrowDown' && nStu) { e.preventDefault(); inputRefs.current[`${nStu.id}-${subjects[ssi].id}`]?.focus(); }
    else if (e.key === 'ArrowUp' && students[si - 1]) { e.preventDefault(); inputRefs.current[`${students[si - 1].id}-${subjects[ssi].id}`]?.focus(); }
  };

  const saveMarks = async () => {
    setSaving(true);
    const marks = [];
    students.forEach(s => subjects.forEach(sub => {
      const v = draft[`${s.id}-${sub.id}`];
      if (v !== '' && v !== null && v !== undefined) marks.push({ student_id: s.id, subject_id: sub.id, score: parseFloat(v) });
    }));
    try {
      await api.post('/academics/marks/bulk', { class_id: classId, exam_id: parseInt(selectedExam), marks });
      showToast('Marks saved successfully!', 'success');
      setBurst(true); setTimeout(() => setBurst(false), 900);
      closeModal(); fetchMarks();
    } catch (e) { showToast(e.response?.data?.detail || 'Failed to save marks', 'error'); }
    setSaving(false);
  };

  const studentAvg = (s) => {
    if (!examData) return null;
    const vals = Object.values(examData.students.find(st => st.id === s.id)?.marks || {}).filter(v => v !== null && v !== undefined);
    if (!vals.length) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };
  const classAvg = () => {
    if (!examData || !examData.students.length) return 0;
    let t = 0, c = 0;
    examData.students.forEach(s => Object.values(s.marks).forEach(v => { if (v !== null && v !== undefined) { t += v; c++; } }));
    return c ? (t / c).toFixed(1) : 0;
  };

  if (!classId) return <NoClass />;
  if (loading) return <Page><SkeletonMarks /></Page>;

  const maxScore = examData?.max_score || 100;

  return (
    <Page>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SuccessBurst show={burst} />

      <div className="page-header">
        <h2>Marks</h2>
        <p>Enter and view exam marks for your class</p>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="stat-grid">
        {[{ v: students.length, l: 'Total Students', c: '#4f7df3', i: '🏫', bg: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)' },
          { v: exams.length, l: 'Exams Configured', c: '#d97706', i: '📝', bg: 'linear-gradient(135deg,#fef3c7,#fde68a)' },
          { v: classAvg(), l: 'Class Average', c: '#059669', i: '📊', bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' }].map((s, i) => (
          <motion.div key={i} variants={staggerItem} className="stat-card" whileHover={{ y: -5 }}>
            <div className="stat-icon" style={{ background: s.bg, fontSize: 22 }}>{s.i}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: s.c, letterSpacing: '-1px' }}>
              <CountUp value={s.v} decimals={s.v % 1 ? 1 : 0} />
            </div>
            <div className="stat-label">{s.l}</div>
          </motion.div>
        ))}
      </motion.div>

      <div className="glass controls-bar" style={{ padding: 20, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>Exam</label>
          <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="input" style={{ width: 'auto', minWidth: 200 }}>
            <option value="">Select an exam…</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name} (/{ex.max_score})</option>)}
          </select>
          {examData && <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Max: {maxScore}</span>}
        </div>
        {exams.length === 0 ? (
          <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>No exams configured for this grade. Ask admin to create one.</span>
        ) : selectedExam && (
          <button onClick={openModal} className="btn btn-primary" style={{ fontSize: 13 }}>
            ✏️ Enter / Edit Marks
          </button>
        )}
      </div>

      {!exams.length ? (
        <div className="glass" style={{ padding: 50, textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📝</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 8 }}>No exams configured for this class's grade.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>An admin must create an exam (Admin → Exams tab) and configure subjects for the grade (Admin → Subjects tab) first.</p>
        </div>
      ) : !selectedExam ? (
        <div className="glass" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Select an exam from the dropdown above.</p>
        </div>
      ) : examData && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>#</th>
                <th>Student Name</th>
                {subjects.map(sub => (
                  <th key={sub.id} style={{ textAlign: 'center', minWidth: 90 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sub.color || 'var(--accent)', display: 'inline-block' }} />
                      {sub.name}
                    </span>
                  </th>
                ))}
                <th style={{ textAlign: 'center', width: 80 }}>Avg</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const stData = examData.students.find(st => st.id === s.id);
                const avg = studentAvg(s);
                return (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</td>
                    {subjects.map(sub => {
                      const mark = stData?.marks?.[String(sub.id)];
                      return (
                        <td key={sub.id} style={{ textAlign: 'center' }}>
                          {mark !== null && mark !== undefined
                            ? <span className="mark-display" style={{ color: sub.color || 'var(--accent)' }}>{mark}</span>
                            : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                      {avg !== null
                        ? <span className={`mark-avg-badge ${parseFloat(avg) >= (maxScore * 0.6) ? 'mark-pass' : 'mark-fail'}`}>{avg}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={closeModal} title={`Enter Marks — ${examData?.exam_name || ''} (max ${maxScore})`} wide>
        <div className="marks-grid-wrap">
          <table className="marks-grid-table">
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--card-bg)', minWidth: 160 }}>Student</th>
                {subjects.map(sub => (
                  <th key={sub.id} style={{ textAlign: 'center', minWidth: 85 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sub.color || 'var(--accent)' }} />
                      {sub.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, si) => (
                <tr key={s.id}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--card-bg)', fontWeight: 600, fontSize: 14, padding: '10px 14px' }}>{s.name}</td>
                  {subjects.map((sub, ssi) => {
                    const key = `${s.id}-${sub.id}`;
                    return (
                      <td key={sub.id} style={{ padding: 6 }}>
                        <MarkInput value={draft[key]} onChange={v => handleMarkChange(s.id, sub.id, v)}
                          onKeyDown={e => cellKey(e, si, ssi)}
                          inputRef={el => { if (el) inputRefs.current[key] = el; }} subjectColor={sub.color} max={maxScore} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          Tip: <strong>Enter</strong> or <strong>→</strong> moves next, <strong>↑↓</strong> move rows
        </div>
        <div className="modal-footer">
          <button onClick={closeModal} className="btn btn-secondary">Cancel</button>
          <button onClick={saveMarks} disabled={saving} className="btn btn-primary">
            {saving ? (<><span className="spin-icon" style={{ marginRight: 8 }}>⟳</span>Saving...</>) : '💾 Save Marks'}
          </button>
        </div>
      </Modal>
    </Page>
  );
}

function NoClass() {
  return (
    <Page>
      <div className="glass" style={{ textAlign: 'center', padding: 60, marginTop: 40 }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>⚠️</p>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Class Assigned</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Please contact the administrator to assign you a class.</p>
      </div>
    </Page>
  );
}

function SkeletonMarks() {
  return (
    <div>
      <div className="page-header"><h2>Marks</h2><p>Loading…</p></div>
      <div className="stat-grid">{[0, 1, 2].map(i => (
        <div key={i} className="stat-card" style={{ opacity: 0.5 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: '#e8e6e2', marginBottom: 16 }} />
          <div style={{ width: 50, height: 36, borderRadius: 6, background: '#e8e6e2', marginBottom: 8 }} />
          <div style={{ width: 80, height: 12, borderRadius: 4, background: '#e8e6e2' }} />
        </div>))}
      </div>
    </div>
  );
}
