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

/* ─── Mark Input Cell ─── */
function MarkInput({ value, onChange, onKeyDown, inputRef, subjectColor }) {
  return (
    <input
      ref={inputRef}
      type="number"
      min="0"
      step="0.5"
      value={value === '' || value === null || value === undefined ? '' : value}
      onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
      onKeyDown={onKeyDown}
      className="mark-input"
      style={{ '--subject-color': subjectColor || 'var(--accent)' }}
    />
  );
}

/* ─── Main Component ─── */
export default function MarksBoard() {
  const { user } = useAuth();
  const classId = user?.assigned_class_id;

  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [examData, setExamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [modalExamName, setModalExamName] = useState('');
  const [modalMaxScore, setModalMaxScore] = useState(100);
  const [modalMarks, setModalMarks] = useState({});

  const inputRefs = useRef({});
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
    if (classId) init();
    return () => clearAllTimeouts();
  }, [classId]);

  useEffect(() => {
    if (classId && selectedExam) fetchExamMarks();
  }, [selectedExam, classId]);

  const showToastMsg = (message, type) => {
    setToast({ message, type });
    queueTimeout(() => setToast(null), 2600);
  };

  const init = async () => {
    setLoading(true);
    try {
      const [studentsRes, subjectsRes, examsRes] = await Promise.all([
        api.get(`/attendance/class/${classId}`),
        api.get('/academics/subjects'),
        api.get(`/academics/class/${classId}/exams`),
      ]);
      setStudents(studentsRes.data.students.map(s => ({ id: s.id, name: s.name })));
      setSubjects(subjectsRes.data);
      setExams(examsRes.data);
      if (examsRes.data.length > 0) {
        setSelectedExam(examsRes.data[0].name);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchExamMarks = async () => {
    if (!selectedExam) return;
    try {
      const res = await api.get(`/academics/class/${classId}/marks?exam=${encodeURIComponent(selectedExam)}`);
      setExamData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddModal = () => {
    setModalExamName('');
    setModalMaxScore(100);
    const initialMarks = {};
    students.forEach(s => {
      subjects.forEach(sub => {
        initialMarks[`${s.id}-${sub.id}`] = '';
      });
    });
    setModalMarks(initialMarks);
    setShowModal(true);
    queueTimeout(() => {
      const firstKey = students.length && subjects.length ? `${students[0].id}-${subjects[0].id}` : null;
      if (firstKey && inputRefs.current[firstKey]) {
        inputRefs.current[firstKey].focus();
      }
    }, 100);
  };

  const openEditModal = () => {
    if (!examData) return;
    setModalExamName(examData.exam_name);
    setModalMaxScore(examData.max_score);
    const initialMarks = {};
    students.forEach(s => {
      subjects.forEach(sub => {
        const val = examData.students.find(st => st.id === s.id)?.marks?.[String(sub.id)];
        initialMarks[`${s.id}-${sub.id}`] = val !== null && val !== undefined ? val : '';
      });
    });
    setModalMarks(initialMarks);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    inputRefs.current = {};
  };

  const handleMarkChange = (studentId, subjectId, value) => {
    setModalMarks(prev => ({ ...prev, [`${studentId}-${subjectId}`]: value }));
  };

  const handleCellKeyDown = (e, studentIdx, subjectIdx) => {
    const totalStudents = students.length;
    const totalSubjects = subjects.length;

    if (e.key === 'Enter') {
      e.preventDefault();
      const nextSubject = subjectIdx + 1;
      if (nextSubject < totalSubjects) {
        const nextKey = `${students[studentIdx].id}-${subjects[nextSubject].id}`;
        inputRefs.current[nextKey]?.focus();
      } else if (studentIdx + 1 < totalStudents) {
        const nextKey = `${students[studentIdx + 1].id}-${subjects[0].id}`;
        inputRefs.current[nextKey]?.focus();
      }
    } else if (e.key === 'ArrowRight') {
      const nextSubject = subjectIdx + 1;
      if (nextSubject < totalSubjects) {
        e.preventDefault();
        const nextKey = `${students[studentIdx].id}-${subjects[nextSubject].id}`;
        inputRefs.current[nextKey]?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      const prevSubject = subjectIdx - 1;
      if (prevSubject >= 0) {
        e.preventDefault();
        const prevKey = `${students[studentIdx].id}-${subjects[prevSubject].id}`;
        inputRefs.current[prevKey]?.focus();
      }
    } else if (e.key === 'ArrowDown') {
      const nextStudent = studentIdx + 1;
      if (nextStudent < totalStudents) {
        e.preventDefault();
        const nextKey = `${students[nextStudent].id}-${subjects[subjectIdx].id}`;
        inputRefs.current[nextKey]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      const prevStudent = studentIdx - 1;
      if (prevStudent >= 0) {
        e.preventDefault();
        const prevKey = `${students[prevStudent].id}-${subjects[subjectIdx].id}`;
        inputRefs.current[prevKey]?.focus();
      }
    }
  };

  const saveMarks = async () => {
    if (!modalExamName.trim()) {
      showToastMsg('Please enter an exam name', 'error');
      return;
    }
    setSaving(true);
    const marks = [];
    students.forEach(s => {
      subjects.forEach(sub => {
        const val = modalMarks[`${s.id}-${sub.id}`];
        if (val !== '' && val !== null && val !== undefined) {
          marks.push({
            student_id: s.id,
            subject_id: sub.id,
            score: parseFloat(val),
          });
        }
      });
    });

    try {
      await api.post('/academics/marks/bulk', {
        class_id: classId,
        exam_name: modalExamName.trim(),
        max_score: parseFloat(modalMaxScore) || 100,
        marks,
      });
      showToastMsg('Marks saved successfully!', 'success');
      closeModal();
      const examsRes = await api.get(`/academics/class/${classId}/exams`);
      setExams(examsRes.data);
      if (!selectedExam || selectedExam !== modalExamName.trim()) {
        setSelectedExam(modalExamName.trim());
      } else {
        fetchExamMarks();
      }
    } catch (err) {
      showToastMsg('Failed to save marks', 'error');
    }
    setSaving(false);
  };

  const getStudentAverage = (student) => {
    if (!examData) return null;
    const st = examData.students.find(s => s.id === student.id);
    if (!st) return null;
    const vals = Object.values(st.marks).filter(v => v !== null && v !== undefined);
    if (!vals.length) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  const classAverage = () => {
    if (!examData || !examData.students.length) return 0;
    let total = 0;
    let count = 0;
    examData.students.forEach(s => {
      Object.values(s.marks).forEach(v => {
        if (v !== null && v !== undefined) {
          total += v;
          count++;
        }
      });
    });
    return count ? (total / count).toFixed(1) : 0;
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

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h2>Marks</h2>
          <p>Enter exam marks for your class</p>
        </div>
        <div className="stat-grid">
          {[0, 1, 2].map(i => (
            <div key={i} className="stat-card" style={{ opacity: 0.5 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: '#e8e6e2', marginBottom: 16 }} />
              <div style={{ width: 50, height: 36, borderRadius: 6, background: '#e8e6e2', marginBottom: 8 }} />
              <div style={{ width: 80, height: 12, borderRadius: 4, background: '#e8e6e2' }} />
            </div>
          ))}
        </div>
        <div className="glass" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ width: 300, height: 14, borderRadius: 4, background: '#e8e6e2' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header animate-slide-up">
        <h2>Marks</h2>
        <p>Enter and view exam marks for your class</p>
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
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', fontSize: 22 }}>
            📝
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#d97706', letterSpacing: '-1px' }}>
            <AnimatedNumber value={exams.length} color="#d97706" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Exams Recorded
          </div>
        </div>

        <div className="stat-card animate-slide-up" style={{ animationDelay: '0.20s' }}>
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', fontSize: 22 }}>
            📊
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#059669', letterSpacing: '-1px' }}>
            <AnimatedNumber value={classAverage()} color="#059669" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Class Average
          </div>
        </div>
      </div>

      <div className="glass controls-bar animate-slide-up" style={{ animationDelay: '0.27s', padding: 20, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>Exam</label>
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            className="input"
            style={{ width: 'auto', minWidth: 180 }}
          >
            <option value="">Select an exam</option>
            {exams.map(e => (
              <option key={e.name} value={e.name}>{e.name} (/{e.max_score})</option>
            ))}
          </select>
          {selectedExam && examData && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
              Max: {examData.max_score}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selectedExam && (
            <button onClick={openEditModal} className="btn btn-secondary" style={{ fontSize: 13 }}>
              ✏️ Edit Marks
            </button>
          )}
          <button onClick={openAddModal} className="btn btn-primary" style={{ fontSize: 13 }}>
            ➕ Add Marks for Exam
          </button>
        </div>
      </div>

      {selectedExam && examData && (
        <div className="table-wrap animate-slide-up" style={{ animationDelay: '0.34s' }}>
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
                const avg = getStudentAverage(s);
                return (
                  <tr key={s.id} className="attendance-row">
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>
                      {i + 1}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</td>
                    {subjects.map(sub => {
                      const mark = stData?.marks?.[String(sub.id)];
                      return (
                        <td key={sub.id} style={{ textAlign: 'center' }}>
                          {mark !== null && mark !== undefined ? (
                            <span className="mark-display" style={{ color: sub.color || 'var(--accent)' }}>
                              {mark}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                      {avg !== null ? (
                        <span className={`mark-avg-badge ${parseFloat(avg) >= (examData.max_score * 0.6) ? 'mark-pass' : 'mark-fail'}`}>
                          {avg}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedExam && !examData && (
        <div className="glass animate-slide-up" style={{ padding: 40, textAlign: 'center', animationDelay: '0.34s' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📝</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>No marks recorded for this exam yet.</p>
          <button onClick={openAddModal} className="btn btn-primary" style={{ marginTop: 16 }}>
            Add Marks Now
          </button>
        </div>
      )}

      {!selectedExam && (
        <div className="glass animate-slide-up" style={{ padding: 40, textAlign: 'center', animationDelay: '0.34s' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Select an exam from the dropdown above or add a new one.</p>
        </div>
      )}

      {/* ─── Modal ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content marks-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalExamName ? `Edit Marks — ${modalExamName}` : 'Add Marks for Exam'}</h3>
              <button onClick={closeModal} className="modal-close">✕</button>
            </div>

            <div className="modal-body">
              {!modalExamName && (
                <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Exam Name
                    </label>
                    <input
                      type="text"
                      value={modalExamName}
                      onChange={(e) => setModalExamName(e.target.value)}
                      placeholder="e.g. Midterm, Unit Test 1"
                      className="input"
                      autoFocus
                    />
                  </div>
                  <div style={{ width: 120 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Max Score
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={modalMaxScore}
                      onChange={(e) => setModalMaxScore(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              )}

              {modalExamName && (
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                    Exam: <strong style={{ color: 'var(--text-primary)' }}>{modalExamName}</strong> &nbsp;|&nbsp; Max: <strong style={{ color: 'var(--text-primary)' }}>{modalMaxScore}</strong>
                  </span>
                </div>
              )}

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
                    {students.map((s, sIdx) => (
                      <tr key={s.id}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--card-bg)', fontWeight: 600, fontSize: 14, padding: '10px 14px' }}>
                          {s.name}
                        </td>
                        {subjects.map((sub, subIdx) => {
                          const key = `${s.id}-${sub.id}`;
                          return (
                            <td key={sub.id} style={{ padding: 6 }}>
                              <MarkInput
                                value={modalMarks[key]}
                                onChange={(val) => handleMarkChange(s.id, sub.id, val)}
                                onKeyDown={(e) => handleCellKeyDown(e, sIdx, subIdx)}
                                inputRef={(el) => { if (el) inputRefs.current[key] = el; }}
                                subjectColor={sub.color}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Tip: Press <strong>Enter</strong> or <strong>→</strong> to move next, <strong>↑↓</strong> for rows
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={closeModal} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={saveMarks} disabled={saving} className="btn btn-primary">
                {saving ? (
                  <>
                    <span className="spin-icon" style={{ marginRight: 8 }}>⟳</span>
                    Saving...
                  </>
                ) : (
                  '💾 Save Marks'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}