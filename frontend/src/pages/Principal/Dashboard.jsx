import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell, Legend, Area, AreaChart,
} from 'recharts';
import api from '../../api/client';
import { Page, EASE, SPRING, staggerContainer, staggerItem, statHover } from '../../lib/motion.jsx';
import { CountUp, Toast } from '../../components/ui.jsx';

const COLORS = ['#4f7df3', '#34bfa1', '#f0a04b', '#8b7cf6', '#e85d75', '#0ea5e9', '#fbbf24', '#10b981'];

const AI_SUGGESTIONS = [
  'How is the school performing overall?',
  'Which grade needs the most attention?',
  'Who are the at-risk students?',
  'Which subject is weakest?',
  'Compare my top and bottom classes',
];

function ThinkingWave() {
  return (
    <div className="ai-thinking">
      <div className="ai-wave">
        {[0, 1, 2, 3, 4].map(i => (
          <motion.span key={i}
            animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }} />
        ))}
      </div>
      <motion.span className="ai-thinking-text"
        animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }}>
        Analyzing school data…
      </motion.span>
    </div>
  );
}

function MarkdownLite({ text }) {
  // Simple markdown renderer: headers, bold, lists, tables-lite
  if (!text) return null;
  const lines = text.split('\n');
  const out = [];
  let listType = null; // 'ul' | 'ol'
  let listItems = [];
  const flush = () => {
    if (listItems.length) {
      if (listType === 'ol') out.push(<ol key={`l${out.length}`}>{listItems}</ol>);
      else out.push(<ul key={`l${out.length}`}>{listItems}</ul>);
      listItems = []; listType = null;
    }
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flush(); return; }
    if (t.startsWith('### ')) { flush(); out.push(<h3 key={i}>{inline(t.slice(4))}</h3>); }
    else if (t.startsWith('## ')) { flush(); out.push(<h3 key={i}>{inline(t.slice(3))}</h3>); }
    else if (t.startsWith('# ')) { flush(); out.push(<h3 key={i}>{inline(t.slice(2))}</h3>); }
    else if (t.startsWith('- ') || t.startsWith('* ')) { flush(); if (listType !== 'ul') { listType = 'ul'; } listItems.push(<li key={i}>{inline(t.slice(2))}</li>); }
    else if (/^\d+\.\s/.test(t)) { flush(); if (listType !== 'ol') { listType = 'ol'; } listItems.push(<li key={i}>{inline(t.replace(/^\d+\.\s/, ''))}</li>); }
    else { flush(); out.push(<p key={i}>{inline(t)}</p>); }
  });
  flush();
  return <>{out}</>;
}
function inline(text) {
  // **bold** and `code`
  const parts = [];
  let rest = text;
  let key = 0;
  while (rest.length) {
    const b = rest.match(/\*\*([^*]+)\*\*/);
    const c = rest.match(/`([^`]+)`/);
    let next = null;
    if (b && (!c || b.index < c.index)) next = { type: 'b', text: b[1], index: b.index, len: b[0].length };
    else if (c) next = { type: 'c', text: c[1], index: c.index, len: c[0].length };
    if (!next) { parts.push(rest); break; }
    if (next.index > 0) parts.push(rest.slice(0, next.index));
    if (next.type === 'b') parts.push(<strong key={key++}>{next.text}</strong>);
    else parts.push(<code key={key++} style={{ background: 'rgba(79,125,243,0.1)', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em' }}>{next.text}</code>);
    rest = rest.slice(next.index + next.len);
  }
  return parts;
}

export default function PrincipalDashboard() {
  const [data, setData] = useState(null);
  const [compare, setCompare] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [atRisk, setAtRisk] = useState([]);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [aiOpen, setAiOpen] = useState(true);

  // AI chat state
  const [messages, setMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const showToast = (m, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 2600); };

  useEffect(() => {
    Promise.all([
      api.get('/principal/dashboard'),
      api.get('/principal/classes/compare'),
      api.get('/principal/subjects/breakdown'),
      api.get('/principal/at-risk'),
      api.get('/principal/trends'),
    ]).then(([d, c, s, ar, t]) => {
      setData(d.data); setCompare(c.data); setSubjects(s.data); setAtRisk(ar.data); setTrends(t.data);
    }).catch(e => { console.error(e); showToast('Failed to load dashboard data', 'error'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, aiLoading]);

  const askAI = async (q) => {
    const question = (q ?? aiInput).trim();
    if (!question || aiLoading) return;
    setAiInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setAiLoading(true);
    try {
      const res = await api.post('/principal/ai/analyze', { question });
      setMessages(prev => [...prev, { role: 'bot', content: res.data.answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', content: 'AI service unavailable. Please try again.' }]);
    }
    setAiLoading(false);
  };

  if (loading) return <Page><div className="glass" style={{ padding: 80, textAlign: 'center' }}>Loading dashboard…</div></Page>;
  if (!data) return <Page><div className="glass" style={{ padding: 60, textAlign: 'center' }}>No data available. Seed data first.</div></Page>;

  const school = data.school;
  const gradeData = (trends?.by_grade || data.grades || []).map(g => ({ grade: `G${g.grade}`, avg: g.average }));
  const subjectData = subjects.map((s, i) => ({ name: s.name, avg: Math.round(s.average), pass: Math.round(s.pass_rate), color: s.color || COLORS[i % COLORS.length] }));
  const examData = (trends?.by_exam || []).map(e => ({ name: e.exam_name || e.name, avg: Math.round(e.average) }));
  const radarData = subjects.slice(0, 8).map(s => ({ subject: s.name, avg: Math.round(s.average) }));

  return (
    <Page>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero banner */}
      <motion.div className="hero-banner"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <div className="hero-banner-icon">🏫</div>
        <div style={{ flex: 1 }}>
          <h2>{school.name}</h2>
          <p>School-wide performance analytics & AI insights</p>
        </div>
        <motion.button className="btn btn-primary" onClick={() => setAiOpen(o => !o)}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          🤖 {aiOpen ? 'Hide' : 'AI'} Assistant
        </motion.button>
      </motion.div>

      <div className="dash-grid">
        {/* MAIN COLUMN */}
        <div>
          {/* Stat cards */}
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="stat-grid">
            {[
              { v: data.total_students, l: 'Students', c: '#4f7df3', i: '👨‍🎓', bg: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)' },
              { v: data.total_classes, l: 'Classes', c: '#10b981', i: '📚', bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' },
              { v: data.school_average, l: 'School Avg %', c: '#f59e0b', i: '📈', bg: 'linear-gradient(135deg,#fef3c7,#fde68a)' },
              { v: data.total_exams, l: 'Exams', c: '#8b5cf6', i: '📝', bg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' },
            ].map((s, i) => (
              <motion.div key={i} variants={staggerItem} className="stat-card" {...statHover}>
                <div className="stat-icon" style={{ background: s.bg, fontSize: 22 }}>{s.i}</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: s.c, letterSpacing: '-1px' }}>
                  <CountUp value={s.v} decimals={s.v % 1 ? 1 : 0} />
                </div>
                <div className="stat-label">{s.l}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Top performer + at-risk count */}
          <motion.div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            {data.top_performer && (
              <div className="glass chart-card" style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 40 }}>🏆</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#d97706' }}>Top Performer</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{data.top_performer.name}</div>
                    <div style={{ fontSize: 14, color: '#92400e', fontWeight: 600 }}>{data.top_performer.average}% average</div>
                  </div>
                </div>
              </div>
            )}
            <div className="glass chart-card" style={{ background: atRisk.length ? 'linear-gradient(135deg,#fef2f2,#fee2e2)' : 'linear-gradient(135deg,#f0fdf4,#dcfce7)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 40 }}>{atRisk.length ? '⚠️' : '✅'}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: atRisk.length ? '#dc2626' : '#16a34a' }}>At-Risk Students</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{atRisk.length}</div>
                  <div style={{ fontSize: 14, color: atRisk.length ? '#991b1b' : '#15803d', fontWeight: 600 }}>{atRisk.length ? 'Need attention' : 'All on track'}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Grade-wise average bar chart */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <h3>📊 Grade-wise Average Performance</h3>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,210,230,0.3)" />
                  <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#5a6278' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#5a6278' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(79,125,243,0.2)', fontSize: 13 }} />
                  <Bar dataKey="avg" radius={[8, 8, 0, 0]}>
                    {gradeData.map((d, i) => <Cell key={i} fill={d.avg >= 70 ? '#10b981' : d.avg >= 50 ? '#f59e0b' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Two-column: subject breakdown radar + exam trend line */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="two-col-charts">
            <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h3>🎯 Subject Performance</h3>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(200,210,230,0.4)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#5a6278' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#8a92a8' }} />
                    <Radar dataKey="avg" stroke="#4f7df3" fill="#4f7df3" fillOpacity={0.3} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
            <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <h3>📈 Exam Performance Trend</h3>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={examData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="examGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b7cf6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#8b7cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,210,230,0.3)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5a6278' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#5a6278' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(139,124,246,0.2)', fontSize: 13 }} />
                    <Area dataKey="avg" stroke="#8b7cf6" strokeWidth={2.5} fill="url(#examGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Subject pass-rate breakdown */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <h3>📚 Subject Pass Rate</h3>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,210,230,0.3)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5a6278' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#5a6278' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(79,125,243,0.2)', fontSize: 13 }} />
                  <Legend />
                  <Bar dataKey="avg" name="Avg %" radius={[6, 6, 0, 0]}>
                    {subjectData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                  <Bar dataKey="pass" name="Pass Rate %" radius={[6, 6, 0, 0]} fill="rgba(16,185,129,0.3)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Class comparison table */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <h3>🏫 Class Comparison</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th style={{ textAlign: 'center' }}>Students</th>
                    <th style={{ textAlign: 'center' }}>Avg %</th>
                    <th style={{ textAlign: 'center' }}>Attendance</th>
                    <th>Top Student</th>
                    <th>Weakest Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map((c, i) => (
                    <motion.tr key={c.class_id || i} className="compare-row"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <td style={{ fontWeight: 700 }}>{c.label}</td>
                      <td style={{ textAlign: 'center' }}>{c.student_count}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: c.average_percentage >= 70 ? '#10b981' : c.average_percentage >= 50 ? '#f59e0b' : '#ef4444' }}>
                        {c.average_percentage}%
                      </td>
                      <td style={{ textAlign: 'center' }}>{c.attendance_rate}%</td>
                      <td style={{ fontSize: 13 }}>{c.top_student?.name || '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {c.weakest_subject?.name ? `${c.weakest_subject.name} (${c.weakest_subject.average}%)` : '—'}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* At-risk students */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <h3>⚠️ At-Risk Students ({atRisk.length})</h3>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <AnimatePresence>
                {atRisk.map((s, i) => (
                  <motion.div key={s.student_id || i} className="at-risk-row"
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.04 }}>
                    <div>
                      <div className="at-risk-name">{s.name}</div>
                      <div className="at-risk-meta">{s.class_label || s.label} · {s.weakest_subject?.name ? `Weak: ${s.weakest_subject.name}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span className="pill" style={{ background: s.average < 50 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: s.average < 50 ? '#dc2626' : '#d97706', fontSize: 11 }}>
                        {s.average}% avg
                      </span>
                      <span className="pill" style={{ background: s.attendance_rate < 60 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: s.attendance_rate < 60 ? '#dc2626' : '#16a34a', fontSize: 11 }}>
                        {s.attendance_rate}% att
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!atRisk.length && <div className="empty-mini">No at-risk students. Everyone is on track!</div>}
            </div>
          </motion.div>
        </div>

        {/* AI SIDEBAR */}
        <AnimatePresence>
          {aiOpen && (
            <motion.div className="glass ai-sidebar"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.4, ease: EASE }}>
              <div className="ai-header">
                <div className="ai-header-icon">🤖</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>AI Assistant</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sees all {school.name} data</div>
                </div>
              </div>

              <div className="ai-messages">
                {messages.length === 0 && (
                  <div className="ai-msg ai-msg-bot" style={{ background: 'rgba(79,125,243,0.04)' }}>
                    👋 Hi! I'm your AI assistant with full access to {school.name}'s data — {data.total_students} students, {data.total_classes} classes, {data.school_average}% school average.
                    Ask me anything about performance, at-risk students, or improvements needed.
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
                    {m.role === 'bot' ? <MarkdownLite text={m.content} /> : m.content}
                  </div>
                ))}
                {aiLoading && (
                  <div className="ai-msg ai-msg-bot"><ThinkingWave /></div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {messages.length === 0 && (
                <div className="ai-suggest">
                  {AI_SUGGESTIONS.map(s => <button key={s} onClick={() => askAI(s)}>{s}</button>)}
                </div>
              )}

              <form className="ai-input-row" onSubmit={e => { e.preventDefault(); askAI(); }}>
                <input className="input" placeholder="Ask about school performance…"
                  value={aiInput} onChange={e => setAiInput(e.target.value)} disabled={aiLoading} />
                <button type="submit" className="btn btn-primary" disabled={aiLoading || !aiInput.trim()}
                  style={{ padding: '10px 16px' }}>
                  {aiLoading ? '…' : '➤'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Page>
  );
}
