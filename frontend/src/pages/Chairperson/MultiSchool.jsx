import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell, Legend, Area, AreaChart, PieChart, Pie, LineChart, Line, ComposedChart,
} from 'recharts';
import {
  Building2, Bot, GraduationCap, Users, TrendingUp, TrendingDown, Trophy,
  AlertTriangle, CheckCircle2, BarChart3, Target, SendHorizontal, Sparkles,
  ChevronRight, X, Award, Zap, Lightbulb, ArrowUpRight, ArrowDownRight,
  Activity, Layers, Crown, PieChart as PieIcon, Network,
} from 'lucide-react';
import api from '../../api/client';
import { Page, EASE, SPRING, staggerContainer, staggerItem, statHover } from '../../lib/motion.jsx';
import { CountUp, Toast, Modal } from '../../components/ui.jsx';

const COLORS = ['#4f7df3', '#34bfa1', '#f0a04b', '#8b7cf6', '#e85d75', '#0ea5e9'];
const gradeColor = (avg) => avg >= 70 ? '#10b981' : avg >= 50 ? '#f59e0b' : '#ef4444';

const AI_SUGGESTIONS = [
  'Compare all my schools',
  'Which school needs the most attention?',
  'Which school leads in each subject?',
  'What are the cross-school insights?',
  'Recommend actions for improvement',
];

function ThinkingWave() {
  return (
    <div className="ai-thinking">
      <div className="ai-wave">
        {[0, 1, 2, 3, 4].map(i => (
          <motion.span key={i} animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }} />
        ))}
      </div>
      <motion.span className="ai-thinking-text" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }}>Analyzing all schools…</motion.span>
    </div>
  );
}
function MarkdownLite({ text }) {
  if (!text) return null;
  const lines = text.split('\n'); const out = []; let listType = null; let listItems = [];
  const flush = () => { if (listItems.length) { out.push(listType === 'ol' ? <ol key={`l${out.length}`}>{listItems}</ol> : <ul key={`l${out.length}`}>{listItems}</ul>); listItems = []; listType = null; } };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flush(); return; }
    if (t.startsWith('### ') || t.startsWith('## ') || t.startsWith('# ')) { flush(); out.push(<h3 key={i}>{inline(t.replace(/^#+\s/, ''))}</h3>); }
    else if (t.startsWith('- ') || t.startsWith('* ')) { if (listType !== 'ul') { flush(); listType = 'ul'; } listItems.push(<li key={i}>{inline(t.slice(2))}</li>); }
    else if (/^\d+\.\s/.test(t)) { if (listType !== 'ol') { flush(); listType = 'ol'; } listItems.push(<li key={i}>{inline(t.replace(/^\d+\.\s/, ''))}</li>); }
    else { flush(); out.push(<p key={i}>{inline(t)}</p>); }
  });
  flush(); return <>{out}</>;
}
function inline(text) {
  const parts = []; let rest = text; let key = 0;
  while (rest.length) {
    const b = rest.match(/\*\*([^*]+)\*\*/); const c = rest.match(/`([^`]+)`/); let next = null;
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
    <motion.div className="insight-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} style={{ borderLeft: `3px solid ${c}` }}>
      <div className="insight-card-header"><Lightbulb size={16} style={{ color: c }} /><span className="insight-title">{insight.title}</span><span className="insight-value" style={{ color: c, fontWeight: 700 }}>{insight.value}</span></div>
      {insight.detail && <p className="insight-detail">{insight.detail}</p>}
    </motion.div>
  );
}

export default function ChairpersonMultiSchool() {
  const [overview, setOverview] = useState(null);
  const [schools, setSchools] = useState([]);
  const [compare, setCompare] = useState(null);
  const [rankings, setRankings] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [aiOpen, setAiOpen] = useState(true);
  const [schoolInspect, setSchoolInspect] = useState(null);

  const [messages, setMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const showToast = (m, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 2600); };

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/chairperson/overview'),
      api.get('/chairperson/schools'),
      api.get('/chairperson/compare'),
      api.get('/chairperson/rankings'),
      api.get('/chairperson/insights'),
    ]).then(([o, s, c, r, ins]) => {
      setOverview(o.data); setSchools(s.data); setCompare(c.data); setRankings(r.data); setInsights(ins.data);
    }).catch(e => { console.error(e); showToast('Failed to load', 'error'); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, aiLoading]);

  const askAI = async (q) => {
    const question = (q ?? aiInput).trim();
    if (!question || aiLoading) return;
    setAiInput(''); setMessages(prev => [...prev, { role: 'user', content: question }]); setAiLoading(true);
    try { const res = await api.post('/chairperson/ai/analyze', { question }); setMessages(prev => [...prev, { role: 'bot', content: res.data.answer, source: res.data.source }]); }
    catch { setMessages(prev => [...prev, { role: 'bot', content: 'AI unavailable.' }]); }
    setAiLoading(false);
  };

  const inspectSchool = async (id) => {
    try { const r = await api.get(`/chairperson/schools/${id}/inspect`); setSchoolInspect(r.data); }
    catch { showToast('Failed to inspect school', 'error'); }
  };

  if (loading) return <Page><div className="glass" style={{ padding: 80, textAlign: 'center' }}>Loading multi-school analytics…</div></Page>;
  if (!overview) return <Page><div className="glass" style={{ padding: 60, textAlign: 'center' }}>No data.</div></Page>;

  const schoolAvgData = schools.map(s => ({ name: s.name?.length > 12 ? s.name.slice(0, 12) + '…' : s.name, avg: Math.round(s.average), att: Math.round(s.attendance_rate || 0) }));
  const subjectLeaders = compare?.subject_leaders || [];
  const radarData = (compare?.schools || schools).map(s => ({ school: s.name?.slice(0, 8), avg: Math.round(s.average) }));
  const ranked = rankings?.by_average || schools.slice().sort((a, b) => (b.average || 0) - (a.average || 0));

  return (
    <Page>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero */}
      <motion.div className="hero-banner" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <div className="hero-banner-icon"><Network size={26} color="white" /></div>
        <div style={{ flex: 1 }}>
          <h2>Multi-School Command Center</h2>
          <p>Overseeing {overview.total_schools} schools · click any school to inspect</p>
        </div>
        <motion.button className="btn btn-primary" onClick={() => setAiOpen(o => !o)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Bot size={16} /> {aiOpen ? 'Hide AI' : 'AI'} Assistant
        </motion.button>
      </motion.div>

      <div className="dash-grid">
        <div>
          {/* Stat cards */}
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="stat-grid">
            {[
              { v: overview.total_schools, l: 'Schools', c: '#4f7df3', Icon: Building2, bg: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)' },
              { v: overview.total_students, l: 'Students', c: '#10b981', Icon: GraduationCap, bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' },
              { v: overview.overall_average || 0, l: 'Overall Avg %', c: '#f59e0b', Icon: TrendingUp, bg: 'linear-gradient(135deg,#fef3c7,#fde68a)' },
              { v: insights.length, l: 'AI Insights', c: '#8b5cf6', Icon: Zap, bg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' },
            ].map((s, i) => (
              <motion.div key={i} variants={staggerItem} className="stat-card" {...statHover}>
                <div className="stat-icon" style={{ background: s.bg }}><s.Icon size={22} color={s.c} /></div>
                <div style={{ fontSize: 36, fontWeight: 800, color: s.c, letterSpacing: '-1px' }}><CountUp value={s.v} decimals={s.v % 1 ? 1 : 0} /></div>
                <div className="stat-label">{s.l}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Best school + most-improved */}
          <motion.div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            {overview.best_school && (
              <div className="glass chart-card" style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span className="hero-banner-icon" style={{ width: 48, height: 48, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}><Crown size={22} color="white" /></span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#d97706' }}>Best Performing</div>
                    <div style={{ fontSize: 19, fontWeight: 800 }}>{overview.best_school.name}</div>
                    <div style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>{overview.best_school.average}% average</div>
                  </div>
                </div>
              </div>
            )}
            {overview.most_improved_school && (
              <div className="glass chart-card" style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span className="hero-banner-icon" style={{ width: 48, height: 48, background: 'linear-gradient(135deg,#34d399,#10b981)' }}><TrendingUp size={22} color="white" /></span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#16a34a' }}>Most Improved</div>
                    <div style={{ fontSize: 19, fontWeight: 800 }}>{overview.most_improved_school.name}</div>
                    <div style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>+{overview.most_improved_school.improvement?.toFixed(1) || 0}% growth</div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* School comparison bar chart — clickable */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="chart-card-title"><BarChart3 size={18} /> School Comparison <span className="chart-hint">click a bar to inspect</span></div>
            <div className="chart-wrap" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={schoolAvgData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,210,230,0.3)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(79,125,243,0.2)', fontSize: 13 }} />
                  <Legend />
                  <Bar dataKey="avg" name="Avg %" radius={[8, 8, 0, 0]} onClick={(d, i) => inspectSchool(schools[i]?.id)} cursor="pointer">
                    {schoolAvgData.map((d, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                  <Line dataKey="att" name="Attendance %" stroke="#f0a04b" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Subject leadership — which school leads each subject */}
          {subjectLeaders.length > 0 && (
            <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="chart-card-title"><Trophy size={18} /> Subject Leadership</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Subject</th><th>Leading School</th><th style={{ textAlign: 'center' }}>Avg %</th><th>Runner-up</th><th style={{ textAlign: 'center' }}>Gap</th></tr></thead>
                  <tbody>
                    {subjectLeaders.map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700 }}>{s.subject}</td>
                        <td><span className="pill" style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706', fontSize: 11 }}>{s.leader}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#10b981' }}>{s.leader_avg}%</td>
                        <td style={{ fontSize: 13 }}>{s.runner_up}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>+{s.gap?.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* School radar + rankings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <div className="chart-card-title"><Target size={18} /> School Averages</div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(200,210,230,0.4)" />
                    <PolarAngleAxis dataKey="school" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Radar dataKey="avg" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.3} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
            <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <div className="chart-card-title"><Award size={18} /> School Rankings <span className="chart-hint">click to inspect</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                {ranked.map((s, i) => (
                  <motion.div key={i} className="ranking-row clickable" onClick={() => inspectSchool(s.id)} whileHover={{ x: 3 }}>
                    <span className="rank-num" style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : 'var(--text-muted)' }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{s.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: gradeColor(s.average || 0) }}>{s.average}%</span>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Cross-school insights */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <div className="chart-card-title"><Lightbulb size={18} /> Cross-School Insights <span className="chart-hint">{insights.length} findings</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="insights-grid">
              {insights.slice(0, 12).map((ins, i) => <InsightCard key={i} insight={ins} index={i} />)}
            </div>
          </motion.div>

          {/* Detailed comparison table */}
          <motion.div className="glass chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="chart-card-title"><Layers size={18} /> Detailed School Comparison <span className="chart-hint">click to inspect</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>School</th><th style={{ textAlign: 'center' }}>Students</th><th style={{ textAlign: 'center' }}>Classes</th><th style={{ textAlign: 'center' }}>Avg %</th><th style={{ textAlign: 'center' }}>Attendance</th><th style={{ textAlign: 'center' }}>At-Risk</th><th>Top Student</th><th style={{ width: 40 }}></th></tr></thead>
                <tbody>
                  {schools.map((s, i) => (
                    <motion.tr key={i} className="compare-row clickable" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} onClick={() => inspectSchool(s.id)} whileHover={{ backgroundColor: 'rgba(79,125,243,0.04)' }}>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td style={{ textAlign: 'center' }}>{s.students}</td>
                      <td style={{ textAlign: 'center' }}>{s.classes}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: gradeColor(s.average || 0) }}>{s.average}%</td>
                      <td style={{ textAlign: 'center' }}>{s.attendance_rate || s.attendance}%</td>
                      <td style={{ textAlign: 'center' }}>{s.at_risk_count || '—'}</td>
                      <td style={{ fontSize: 13 }}>{s.top_student?.name || '—'}</td>
                      <td><ChevronRight size={16} color="var(--text-muted)" /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* AI SIDEBAR */}
        <AnimatePresence>
          {aiOpen && (
            <motion.div className="glass ai-sidebar" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.4, ease: EASE }}>
              <div className="ai-header">
                <div className="ai-header-icon"><Bot size={18} color="white" /></div>
                <div><div style={{ fontWeight: 800, fontSize: 15 }}>AI Assistant</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sees all {overview.total_schools} schools</div></div>
              </div>
              <div className="ai-messages">
                {messages.length === 0 && (
                  <div className="ai-msg ai-msg-bot" style={{ background: 'rgba(79,125,243,0.04)' }}>
                    <Sparkles size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--accent)' }} />
                    Hi! I oversee {overview.total_schools} schools with {overview.total_students} students total. Ask me to compare schools, find weaknesses, or recommend cross-school actions.
                  </div>
                )}
                {messages.map((m, i) => (<div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>{m.role === 'bot' ? <MarkdownLite text={m.content} /> : m.content}</div>))}
                {aiLoading && <div className="ai-msg ai-msg-bot"><ThinkingWave /></div>}
                <div ref={messagesEndRef} />
              </div>
              {messages.length === 0 && (<div className="ai-suggest">{AI_SUGGESTIONS.map(s => <button key={s} onClick={() => askAI(s)}>{s}</button>)}</div>)}
              <form className="ai-input-row" onSubmit={e => { e.preventDefault(); askAI(); }}>
                <input className="input" placeholder="Ask about your schools…" value={aiInput} onChange={e => setAiInput(e.target.value)} disabled={aiLoading} />
                <button type="submit" className="btn btn-primary" disabled={aiLoading || !aiInput.trim()} style={{ padding: '10px 14px' }}>{aiLoading ? <Activity size={16} className="spin" /> : <SendHorizontal size={16} />}</button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal open={!!schoolInspect} onClose={() => setSchoolInspect(null)} title={schoolInspect ? `${schoolInspect.school?.name || schoolInspect.name} — Inspection` : ''} wide>
        {schoolInspect && <SchoolInspect data={schoolInspect} />}
      </Modal>
    </Page>
  );
}

function SchoolInspect({ data }) {
  const grades = data.grades || [];
  const subjects = data.subjects || [];
  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', marginBottom: 16 }}>
        <div className="mini-stat"><div><div className="mini-stat-label">Students</div><div className="mini-stat-val">{data.total_students || data.students}</div></div></div>
        <div className="mini-stat"><div><div className="mini-stat-label">Classes</div><div className="mini-stat-val">{data.total_classes || data.classes}</div></div></div>
        <div className="mini-stat"><div><div className="mini-stat-label">Avg %</div><div className="mini-stat-val" style={{ color: gradeColor(data.school_average || data.average || 0) }}>{data.school_average || data.average}%</div></div></div>
        <div className="mini-stat"><div><div className="mini-stat-label">At-Risk</div><div className="mini-stat-val">{data.at_risk_count || 0}</div></div></div>
      </div>
      {grades.length > 0 && (
        <>
          <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 700 }}>Grade breakdown</h4>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead><tr><th>Grade</th><th style={{ textAlign: 'center' }}>Classes</th><th style={{ textAlign: 'center' }}>Students</th><th style={{ textAlign: 'center' }}>Avg %</th></tr></thead>
              <tbody>{grades.map((g, i) => (<tr key={i}><td style={{ fontWeight: 700 }}>Grade {g.grade}</td><td style={{ textAlign: 'center' }}>{g.classes}</td><td style={{ textAlign: 'center' }}>{g.students}</td><td style={{ textAlign: 'center', fontWeight: 700, color: gradeColor(g.average) }}>{g.average}%</td></tr>))}</tbody>
            </table>
          </div>
        </>
      )}
      {subjects.length > 0 && (
        <>
          <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 700 }}>Subject performance</h4>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Subject</th><th style={{ textAlign: 'center' }}>Avg %</th><th style={{ textAlign: 'center' }}>Pass Rate</th></tr></thead>
              <tbody>{subjects.map((s, i) => (<tr key={i}><td style={{ fontWeight: 600 }}>{s.name}</td><td style={{ textAlign: 'center', fontWeight: 700, color: gradeColor(s.average) }}>{s.average}%</td><td style={{ textAlign: 'center' }}>{s.pass_rate}%</td></tr>))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
