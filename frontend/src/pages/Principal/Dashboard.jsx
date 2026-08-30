import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell, Legend, Area, AreaChart, PieChart, Pie, ComposedChart,
} from 'recharts';
import {
  Building2, Bot, GraduationCap, Library, TrendingUp, TrendingDown, Trophy,
  AlertTriangle, CheckCircle2, BarChart3, Target, SendHorizontal, Sparkles,
  ChevronRight, X, Users, ClipboardList, Award, Zap, Lightbulb, ArrowUpRight,
  ArrowDownRight, Minus, Search, Activity, Layers,
} from 'lucide-react';
import api from '../../api/client';
import { Page, EASE, SPRING, staggerContainer, staggerItem, statHover } from '../../lib/motion.jsx';
import { CountUp, Toast, Modal } from '../../components/ui.jsx';

const COLORS = ['#4f7df3', '#34bfa1', '#f0a04b', '#8b7cf6', '#e85d75', '#0ea5e9', '#fbbf24', '#10b981'];
const gradeColor = (avg) => avg >= 70 ? '#10b981' : avg >= 50 ? '#f59e0b' : '#ef4444';

const AI_SUGGESTIONS = [
  'How is the school performing overall?',
  'Which grade needs the most attention?',
  'Who are the at-risk students and why?',
  'Which subject is weakest and how to improve?',
  'Compare my top and bottom classes',
  'What actionable improvements do you recommend?',
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
  if (!text) return null;
  const lines = text.split('\n');
  const out = [];
  let listType = null;
  let listItems = [];
  const flush = () => {
    if (listItems.length) {
      out.push(listType === 'ol' ? <ol key={`l${out.length}`}>{listItems}</ol> : <ul key={`l${out.length}`}>{listItems}</ul>);
      listItems = []; listType = null;
    }
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flush(); return; }
    if (t.startsWith('### ') || t.startsWith('## ') || t.startsWith('# ')) { flush(); out.push(<h3 key={i}>{inline(t.replace(/^#+\s/, ''))}</h3>); }
    else if (t.startsWith('- ') || t.startsWith('* ')) { if (listType !== 'ul') { flush(); listType = 'ul'; } listItems.push(<li key={i}>{inline(t.slice(2))}</li>); }
    else if (/^\d+\.\s/.test(t)) { if (listType !== 'ol') { flush(); listType = 'ol'; } listItems.push(<li key={i}>{inline(t.replace(/^\d+\.\s/, ''))}</li>); }
    else { flush(); out.push(<p key={i}>{inline(t)}</p>); }
  });
  flush();
  return <>{out}</>;
}
function inline(text) {
  const parts = []; let rest = text; let key = 0;
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

function InsightCard({ insight, index }) {
  const colors = { good: '#10b981', warning: '#f59e0b', critical: '#ef4444' };
  const c = colors[insight.severity] || '#4f7df3';
  return (
    <motion.div className="insight-card"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      style={{ borderLeft: `3px solid ${c}` }}>
      <div className="insight-card-header">
        <Lightbulb size={16} style={{ color: c }} />
        <span className="insight-title">{insight.title}</span>
        <span className="insight-value" style={{ color: c, fontWeight: 700 }}>{insight.value}</span>
      </div>
      {insight.detail && <p className="insight-detail">{insight.detail}</p>}
    </motion.div>
  );
}

export default function PrincipalDashboard() {
  const [data, setData] = useState(null);
  const [compare, setCompare] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [atRisk, setAtRisk] = useState([]);
  const [trends, setTrends] = useState(null);
  const [rankings, setRankings] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [aiOpen, setAiOpen] = useState(true);

  // drill-down state
  const [gradeInspect, setGradeInspect] = useState(null);
  const [classInspect, setClassInspect] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);

  // AI chat
  const [messages, setMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const showToast = (m, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 2600); };

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/principal/dashboard'),
      api.get('/principal/classes/compare'),
      api.get('/principal/subjects/breakdown'),
      api.get('/principal/at-risk'),
      api.get('/principal/trends'),
      api.get('/principal/rankings'),
      api.get('/principal/insights'),
    ]).then(([d, c, s, ar, t, r, ins]) => {
      setData(d.data); setCompare(c.data); setSubjects(s.data); setAtRisk(ar.data);
      setTrends(t.data); setRankings(r.data); setInsights(ins.data);
    }).catch(e => { console.error(e); showToast('Failed to load dashboard', 'error'); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, aiLoading]);

  const askAI = async (q) => {
    const question = (q ?? aiInput).trim();
    if (!question || aiLoading) return;
    setAiInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setAiLoading(true);
    try {
      const res = await api.post('/principal/ai/analyze', { question });
      setMessages(prev => [...prev, { role: 'bot', content: res.data.answer, source: res.data.source }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', content: 'AI service unavailable. Please try again.' }]);
    }
    setAiLoading(false);
  };

  const inspectGrade = async (grade) => {
    try {
      const res = await api.get(`/principal/grades/${grade}/inspect`);
      setGradeInspect({ ...res.data, grade });
    } catch (e) { showToast('Failed to inspect grade', 'error'); }
  };
  const inspectClass = async (classId) => {
    try {
      const res = await api.get(`/principal/classes/${classId}/inspect`);
      setClassInspect(res.data);
      setGradeInspect(null);
    } catch (e) { showToast('Failed to inspect class', 'error'); }
  };
  const viewStudent = async (studentId) => {
    try {
      const res = await api.get(`/principal/students/${studentId}/profile`);
      setStudentProfile(res.data);
      setClassInspect(null);
    } catch (e) { showToast('Failed to load student', 'error'); }
  };

  if (loading) return <Page><div className="glass" style={{ padding: 80, textAlign: 'center' }}>Loading dashboard…</div></Page>;
  if (!data) return <Page><div className="glass" style={{ padding: 60, textAlign: 'center' }}>No data. Seed data first.</div></Page>;

  const school = data.school;
  const gradeData = (trends?.by_grade || data.grades || []).map(g => ({ grade: `G${g.grade}`, gradeNum: g.grade, avg: g.average, students: g.students }));
  const subjectData = subjects.map((s, i) => ({ name: s.name, avg: Math.round(s.average), pass: Math.round(s.pass_rate), color: s.color || COLORS[i % COLORS.length] }));
  const examData = (trends?.by_exam || []).map(e => ({ name: e.exam_name || e.name, avg: Math.round(e.average) }));
  const radarData = subjects.slice(0, 8).map(s => ({ subject: s.name, avg: Math.round(s.average) }));
  const topStudents = rankings?.top || [];
  const improvedStudents = rankings?.most_improved || [];
  const consistentStudents = rankings?.most_consistent || [];
  const bottomStudents = rankings?.bottom || atRisk.slice(0, 10);

  return (
    <Page>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero */}
      <motion.div className="hero-banner"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <div className="hero-banner-icon"><Building2 size={26} color="white" /></div>
        <div style={{ flex: 1 }}>
          <h2>{school.name}</h2>
          <p>School-wide performance analytics & AI insights — click any grade, class or student to inspect</p>
        </div>
        <motion.button className="btn btn-primary" onClick={() => setAiOpen(o => !o)}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Bot size={16} /> {aiOpen ? 'Hide AI' : 'AI'} Assistant
        </motion.button>
      </motion.div>

      <div className="dash-grid">
        {/* MAIN COLUMN */}
        <div>
          {/* Stat cards */}
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="stat-grid">
            {[
              { v: data.total_students, l: 'Students', c: '#4f7df3', Icon: GraduationCap, bg: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)' },
              { v: data.total_classes, l: 'Classes', c: '#10b981', Icon: ClipboardList, bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' },
              { v: data.school_average, l: 'School Avg %', c: '#f59e0b', Icon: TrendingUp, bg: 'linear-gradient(135deg,#fef3c7,#fde68a)' },
              { v: data.total_exams, l: 'Exams', c: '#8b5cf6', Icon: Award, bg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' },
            ].map((s, i) => (
              <motion.div key={i} variants={staggerItem} className="stat-card" {...statHover}>
                <div className="stat-icon" style={{ background: s.bg }}><s.Icon size={22} color={s.c} /></div>
                <div style={{ fontSize: 36, fontWeight: 800, color: s.c, letterSpacing: '-1px' }}>
                  <CountUp value={s.v} decimals={s.v % 1 ? 1 : 0} />
                </div>
                <div className="stat-label">{s.l}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Top performer + at-risk + insights preview */}
          <motion.div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            {data.top_performer && (
              <div className="glass chart-card" style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span className="hero-banner-icon" style={{ width: 48, height: 48, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}><Trophy size={22} color="white" /></span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#d97706' }}>Top Performer</div>
                    <div style={{ fontSize: 19, fontWeight: 800 }}>{data.top_performer.name}</div>
                    <div style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>{data.top_performer.average}% average</div>
                  </div>
                </div>
              </div>
            )}
            <div className="glass chart-card" style={{ background: atRisk.length ? 'linear-gradient(135deg,#fef2f2,#fee2e2)' : 'linear-gradient(135deg,#f0fdf4,#dcfce7)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="hero-banner-icon" style={{ width: 48, height: 48, background: atRisk.length ? 'linear-gradient(135deg,#f87171,#dc2626)' : 'linear-gradient(135deg,#34d399,#10b981)' }}>
                  {atRisk.length ? <AlertTriangle size={22} color="white" /> : <CheckCircle2 size={22} color="white" />}
                </span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: atRisk.length ? '#dc2626' : '#16a34a' }}>At-Risk</div>
                  <div style={{ fontSize: 19, fontWeight: 800 }}>{atRisk.length}</div>
                  <div style={{ fontSize: 13, color: atRisk.length ? '#991b1b' : '#15803d', fontWeight: 600 }}>{atRisk.length ? 'Need attention' : 'All on track'}</div>
                </div>
              </div>
            </div>
            <div className="glass chart-card" style={{ background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="hero-banner-icon" style={{ width: 48, height: 48, background: 'linear-gradient(135deg,#818cf8,#4f7df3)' }}><Zap size={22} color="white" /></span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#4f7df3' }}>AI Insights</div>
                  <div style={{ fontSize: 19, fontWeight: 800 }}>{insights.length}</div>
                  <div style={{ fontSize: 13, color: '#4338ca', fontWeight: 600 }}>Algorithmic findings</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Interactive grade chart — click a grade to inspect */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="chart-card-title"><BarChart3 size={18} /> Grade-wise Performance <span className="chart-hint">click a bar to inspect</span></div>
            <div className="chart-wrap" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,210,230,0.3)" />
                  <XAxis dataKey="grade" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(79,125,243,0.2)', fontSize: 13 }} />
                  <Bar dataKey="avg" radius={[8, 8, 0, 0]} onClick={(d) => inspectGrade(d.gradeNum)} cursor="pointer">
                    {gradeData.map((d, i) => <Cell key={i} fill={gradeColor(d.avg)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Subject radar + exam trend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="two-col-charts">
            <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="chart-card-title"><Target size={18} /> Subject Performance</div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(200,210,230,0.4)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Radar dataKey="avg" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.3} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
            <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <div className="chart-card-title"><TrendingUp size={18} /> Exam Performance Trend</div>
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
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(139,124,246,0.2)', fontSize: 13 }} />
                    <Area dataKey="avg" stroke="#8b7cf6" strokeWidth={2.5} fill="url(#examGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Rankings — top, most improved, most consistent */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }} className="rankings-grid">
            <RankingCard title="Top Performers" icon={<Trophy size={16} color="#f59e0b" />} students={topStudents} onClick={viewStudent} color="#f59e0b" />
            <RankingCard title="Most Improved" icon={<TrendingUp size={16} color="#10b981" />} students={improvedStudents} onClick={viewStudent} color="#10b981" showDelta />
            <RankingCard title="Most Consistent" icon={<Activity size={16} color="#8b7cf6" />} students={consistentStudents} onClick={viewStudent} color="#8b7cf6" showVariance />
          </div>

          {/* AI Insights (algorithmic) */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="chart-card-title"><Lightbulb size={18} /> Algorithmic Insights <span className="chart-hint">{insights.length} findings</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="insights-grid">
              {insights.slice(0, 12).map((ins, i) => <InsightCard key={i} insight={ins} index={i} />)}
            </div>
          </motion.div>

          {/* Class comparison — clickable */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <div className="chart-card-title"><Layers size={18} /> Class Comparison <span className="chart-hint">click a row to inspect</span></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Class</th><th style={{ textAlign: 'center' }}>Students</th>
                    <th style={{ textAlign: 'center' }}>Avg %</th><th style={{ textAlign: 'center' }}>Attendance</th>
                    <th>Top Student</th><th>Weakest Subject</th><th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map((c, i) => (
                    <motion.tr key={c.class_id || i} className="compare-row clickable"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      onClick={() => inspectClass(c.class_id)} whileHover={{ backgroundColor: 'rgba(79,125,243,0.04)' }}>
                      <td style={{ fontWeight: 700 }}>{c.label}</td>
                      <td style={{ textAlign: 'center' }}>{c.student_count}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: gradeColor(c.average_percentage) }}>{c.average_percentage}%</td>
                      <td style={{ textAlign: 'center' }}>{c.attendance_rate}%</td>
                      <td style={{ fontSize: 13 }}>{c.top_student?.name || '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.weakest_subject?.name ? `${c.weakest_subject.name} (${c.weakest_subject.average}%)` : '—'}</td>
                      <td><ChevronRight size={16} color="var(--text-muted)" /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* At-risk students */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="chart-card-title"><AlertTriangle size={18} color="#ef4444" /> At-Risk Students ({atRisk.length}) <span className="chart-hint">click to view profile</span></div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <AnimatePresence>
                {atRisk.map((s, i) => (
                  <motion.div key={s.student_id || i} className="at-risk-row clickable"
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.04 }} onClick={() => viewStudent(s.student_id)} whileHover={{ x: 2 }}>
                    <div>
                      <div className="at-risk-name">{s.name}</div>
                      <div className="at-risk-meta">{s.class_label || s.label} · {s.weakest_subject?.name ? `Weak: ${s.weakest_subject.name}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span className="pill" style={{ background: s.average < 50 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: s.average < 50 ? '#dc2626' : '#d97706', fontSize: 11 }}>{s.average}% avg</span>
                      <span className="pill" style={{ background: s.attendance_rate < 60 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: s.attendance_rate < 60 ? '#dc2626' : '#16a34a', fontSize: 11 }}>{s.attendance_rate}% att</span>
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!atRisk.length && <div className="empty-mini">No at-risk students. Everyone is on track.</div>}
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
                <div className="ai-header-icon"><Bot size={18} color="white" /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>AI Assistant</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sees all {school.name} data</div>
                </div>
              </div>
              <div className="ai-messages">
                {messages.length === 0 && (
                  <div className="ai-msg ai-msg-bot" style={{ background: 'rgba(79,125,243,0.04)' }}>
                    <Sparkles size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--accent)' }} />
                    Hi! I'm your AI assistant with full access to {school.name}'s data — {data.total_students} students, {data.total_classes} classes, {data.school_average}% school average. Ask me anything about performance, at-risk students, or improvements.
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
                    {m.role === 'bot' ? <MarkdownLite text={m.content} /> : m.content}
                  </div>
                ))}
                {aiLoading && <div className="ai-msg ai-msg-bot"><ThinkingWave /></div>}
                <div ref={messagesEndRef} />
              </div>
              {messages.length === 0 && (
                <div className="ai-suggest">
                  {AI_SUGGESTIONS.map(s => <button key={s} onClick={() => askAI(s)}>{s}</button>)}
                </div>
              )}
              <form className="ai-input-row" onSubmit={e => { e.preventDefault(); askAI(); }}>
                <input className="input" placeholder="Ask about school performance…" value={aiInput}
                  onChange={e => setAiInput(e.target.value)} disabled={aiLoading} />
                <button type="submit" className="btn btn-primary" disabled={aiLoading || !aiInput.trim()} style={{ padding: '10px 14px' }}>
                  {aiLoading ? <Activity size={16} className="spin" /> : <SendHorizontal size={16} />}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DRILL-DOWN MODALS */}
      <Modal open={!!gradeInspect} onClose={() => setGradeInspect(null)} title={gradeInspect ? `Grade ${gradeInspect.grade} — Inspection` : ''} wide>
        {gradeInspect && <GradeInspect data={gradeInspect} onClassClick={inspectClass} />}
      </Modal>
      <Modal open={!!classInspect} onClose={() => setClassInspect(null)} title={classInspect ? `${classInspect.label} — Class Inspection` : ''} wide>
        {classInspect && <ClassInspect data={classInspect} onStudentClick={viewStudent} />}
      </Modal>
      <Modal open={!!studentProfile} onClose={() => setStudentProfile(null)} title={studentProfile ? `${studentProfile.name} — Student Profile` : ''} wide>
        {studentProfile && <StudentProfile data={studentProfile} />}
      </Modal>
    </Page>
  );
}

function RankingCard({ title, icon, students, onClick, color, showDelta, showVariance }) {
  return (
    <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="chart-card-title">{icon} {title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {students.slice(0, 5).map((s, i) => (
          <motion.div key={s.student_id || i} className="ranking-row clickable"
            onClick={() => onClick(s.student_id)} whileHover={{ x: 3 }}>
            <span className="rank-num" style={{ color }}>{i + 1}</span>
            <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{s.name}</span>
            {showDelta && s.improvement != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 700, color: s.improvement >= 0 ? '#10b981' : '#ef4444' }}>
                {s.improvement >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {Math.abs(s.improvement).toFixed(1)}%
              </span>
            )}
            {showVariance && s.variance != null && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>σ {s.variance.toFixed(1)}</span>
            )}
            <span style={{ fontSize: 12, color, fontWeight: 700 }}>{s.average}%</span>
          </motion.div>
        ))}
        {!students.length && <div className="empty-mini">No data.</div>}
      </div>
    </motion.div>
  );
}

function GradeInspect({ data, onClassClick }) {
  const sections = data.sections || data.classes || [];
  const subjectMatrix = data.subject_comparison || data.subject_averages || [];
  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
        <div className="mini-stat"><div><div className="mini-stat-label">Sections</div><div className="mini-stat-val">{sections.length}</div></div></div>
        <div className="mini-stat"><div><div className="mini-stat-label">Students</div><div className="mini-stat-val">{data.total_students || data.students_count || '—'}</div></div></div>
        <div className="mini-stat"><div><div className="mini-stat-label">Grade Avg</div><div className="mini-stat-val" style={{ color: gradeColor(data.grade_average || 0) }}>{data.grade_average}%</div></div></div>
      </div>
      <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 700 }}>Sections (click to inspect class)</h4>
      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Section</th><th style={{ textAlign: 'center' }}>Students</th><th style={{ textAlign: 'center' }}>Avg</th><th style={{ textAlign: 'center' }}>Attendance</th><th>Top Student</th></tr></thead>
          <tbody>
            {sections.map((s, i) => (
              <tr key={i} className="clickable" onClick={() => onClassClick(s.class_id)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 700 }}>{s.label || s.section}</td>
                <td style={{ textAlign: 'center' }}>{s.student_count || s.students}</td>
                <td style={{ textAlign: 'center', fontWeight: 700, color: gradeColor(s.average_percentage || s.average || 0) }}>{s.average_percentage || s.average}%</td>
                <td style={{ textAlign: 'center' }}>{s.attendance_rate || s.attendance}%</td>
                <td style={{ fontSize: 13 }}>{s.top_student?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {subjectMatrix.length > 0 && (
        <>
          <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 700 }}>Subject comparison across sections</h4>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Subject</th>{sections.map((s,i) => <th key={i} style={{ textAlign: 'center' }}>{s.label || s.section}</th>)}</tr></thead>
              <tbody>
                {subjectMatrix.map((sub, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{sub.name || sub.subject}</td>
                    {sections.map((s, j) => <td key={j} style={{ textAlign: 'center', color: gradeColor(sub[s.label] || sub[s.section] || 0) }}>{sub[s.label] || sub[s.section] || '—'}%</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ClassInspect({ data, onStudentClick }) {
  const students = data.students || [];
  const subjects = data.subjects || [];
  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
        <div className="mini-stat"><div><div className="mini-stat-label">Students</div><div className="mini-stat-val">{students.length}</div></div></div>
        <div className="mini-stat"><div><div className="mini-stat-label">Subjects</div><div className="mini-stat-val">{subjects.length}</div></div></div>
        <div className="mini-stat"><div><div className="mini-stat-label">Class Avg</div><div className="mini-stat-val" style={{ color: gradeColor(data.average_percentage || data.average || 0) }}>{data.average_percentage || data.average}%</div></div></div>
      </div>
      <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 700 }}>Students (click to view full profile)</h4>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Student</th><th style={{ textAlign: 'center' }}>Avg %</th><th style={{ textAlign: 'center' }}>Attendance</th><th style={{ textAlign: 'center' }}>Rank</th><th style={{ width: 40 }}></th></tr></thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.student_id || i} className="clickable" onClick={() => onStudentClick(s.student_id)} style={{ cursor: 'pointer' }}>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td style={{ textAlign: 'center', fontWeight: 700, color: gradeColor(s.average || 0) }}>{s.average}%</td>
                <td style={{ textAlign: 'center' }}>{s.attendance_rate || s.attendance}%</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>#{s.rank_in_class || i + 1}</td>
                <td><ChevronRight size={14} color="var(--text-muted)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentProfile({ data }) {
  const marks = data.subject_exam_grid || data.marks || [];
  const trend = data.improvement_trend || {};
  const TrendIcon = trend.direction === 'improving' ? TrendingUp : trend.direction === 'declining' ? TrendingDown : Minus;
  const trendColor = trend.direction === 'improving' ? '#10b981' : trend.direction === 'declining' ? '#ef4444' : '#8a92a8';
  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', marginBottom: 16 }}>
        <div className="mini-stat"><div><div className="mini-stat-label">Average</div><div className="mini-stat-val" style={{ color: gradeColor(data.average || 0) }}>{data.average}%</div></div></div>
        <div className="mini-stat"><div><div className="mini-stat-label">Rank in Class</div><div className="mini-stat-val">#{data.rank_in_class}</div></div></div>
        <div className="mini-stat"><div><div className="mini-stat-label">Rank in Grade</div><div className="mini-stat-val">#{data.rank_in_grade}</div></div></div>
        <div className="mini-stat"><div><div className="mini-stat-label">Attendance</div><div className="mini-stat-val">{data.attendance_rate || data.attendance}%</div></div></div>
      </div>
      {data.class_label && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{data.class_label} · Strongest: <strong>{data.strongest_subject?.name}</strong> ({data.strongest_subject?.average}%) · Weakest: <strong>{data.weakest_subject?.name}</strong> ({data.weakest_subject?.average}%)</p>}
      {trend.first_avg != null && (
        <div className="mini-stat" style={{ marginBottom: 16 }}>
          <TrendIcon size={18} color={trendColor} />
          <div>
            <div className="mini-stat-label">Improvement Trend</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: trendColor }}>
              {trend.first_avg}% → {trend.last_avg}% ({trend.delta > 0 ? '+' : ''}{trend.delta?.toFixed(1)}% · {trend.direction})
            </div>
          </div>
        </div>
      )}
      {marks.length > 0 && (
        <>
          <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 700 }}>Subject × Exam marks</h4>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Subject</th><th>Exam</th><th style={{ textAlign: 'center' }}>Score</th><th style={{ textAlign: 'center' }}>Max</th><th style={{ textAlign: 'center' }}>%</th></tr></thead>
              <tbody>
                {marks.map((m, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{m.subject || m.subject_name}</td>
                    <td>{m.exam || m.exam_name}</td>
                    <td style={{ textAlign: 'center' }}>{m.score}</td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{m.max_score || m.max}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: gradeColor(((m.score / (m.max_score || m.max || 100)) * 100)) }}>{((m.score / (m.max_score || m.max || 100)) * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
