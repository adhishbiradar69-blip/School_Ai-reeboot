import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell, Legend, Area, AreaChart, PieChart, Pie,
} from 'recharts';
import {
  Building2, Bot, GraduationCap, ClipboardList, TrendingUp, TrendingDown, Trophy,
  AlertTriangle, CheckCircle2, BarChart3, Target, SendHorizontal, Sparkles,
  ChevronRight, Users, Award, Zap, Lightbulb, ArrowUpRight, ArrowDownRight,
  Minus, Activity, Layers, Clock, Calendar, ArrowRight, Flame, Eye, Download,
} from 'lucide-react';
import api from '../../api/client';
import { Page, EASE, SPRING, staggerContainer, staggerItem } from '../../lib/motion.jsx';
import { CountUp, Toast, Modal } from '../../components/ui.jsx';

const COLORS = ['#4f7df3', '#34bfa1', '#f0a04b', '#8b7cf6', '#e85d75', '#0ea5e9', '#fbbf24', '#10b981'];
const gradeColor = (avg) => avg >= 70 ? '#10b981' : avg >= 50 ? '#f59e0b' : '#ef4444';

const AI_SUGGESTIONS = [
  'How is the school performing?',
  'Which grade needs attention?',
  'Who are the at-risk students?',
  'What should I improve first?',
];

function ThinkingWave() {
  return (
    <div className="ai-thinking">
      <div className="ai-wave">
        {[0,1,2,3,4].map(i => <motion.span key={i} animate={{ scaleY: [0.4,1,0.4], opacity: [0.5,1,0.5] }} transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: i*0.12 }} />)}
      </div>
      <motion.span className="ai-thinking-text" animate={{ opacity: [0.5,1,0.5] }} transition={{ duration: 1.4, repeat: Infinity }}>Analyzing school data…</motion.span>
    </div>
  );
}

function MarkdownLite({ text }) {
  if (!text) return null;
  const lines = text.split('\n'); const out = []; let lt = null; let li = [];
  const flush = () => { if (li.length) { out.push(lt==='ol'?<ol key={`l${out.length}`}>{li}</ol>:<ul key={`l${out.length}`}>{li}</ul>); li=[]; lt=null; } };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flush(); return; }
    if (t.startsWith('### ')||t.startsWith('## ')||t.startsWith('# ')) { flush(); out.push(<h3 key={i}>{inline(t.replace(/^#+\s/,''))}</h3>); }
    else if (t.startsWith('- ')||t.startsWith('* ')) { if(lt!=='ul'){flush();lt='ul';} li.push(<li key={i}>{inline(t.slice(2))}</li>); }
    else if (/^\d+\.\s/.test(t)) { if(lt!=='ol'){flush();lt='ol';} li.push(<li key={i}>{inline(t.replace(/^\d+\.\s/,''))}</li>); }
    else { flush(); out.push(<p key={i}>{inline(t)}</p>); }
  });
  flush(); return <>{out}</>;
}
function inline(text) {
  const parts=[]; let rest=text; let k=0;
  while(rest.length) {
    const b=rest.match(/\*\*([^*]+)\*\*/); const c=rest.match(/`([^`]+)`/); let n=null;
    if(b&&(!c||b.index<c.index)) n={type:'b',text:b[1],index:b.index,len:b[0].length};
    else if(c) n={type:'c',text:c[1],index:c.index,len:c[0].length};
    if(!n){parts.push(rest);break;}
    if(n.index>0) parts.push(rest.slice(0,n.index));
    if(n.type==='b') parts.push(<strong key={k++}>{n.text}</strong>);
    else parts.push(<code key={k++} style={{background:'rgba(79,125,243,0.1)',padding:'1px 5px',borderRadius:4,fontSize:'0.9em'}}>{n.text}</code>);
    rest=rest.slice(n.index+n.len);
  }
  return parts;
}

function TrendBadge({ value }) {
  if (value == null || value === 0) return <span className="trend-badge trend-flat"><Minus size={10} /> Flat</span>;
  return value > 0
    ? <span className="trend-badge trend-up"><ArrowUpRight size={10} /> +{value.toFixed(1)}%</span>
    : <span className="trend-badge trend-down"><ArrowDownRight size={10} /> {value.toFixed(1)}%</span>;
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
  const [gradeInspect, setGradeInspect] = useState(null);
  const [classInspect, setClassInspect] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const showToast = (m, t='success') => { setToast({message:m,type:t}); setTimeout(()=>setToast(null),2600); };

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
    ]).then(([d,c,s,ar,t,r,ins]) => {
      setData(d.data); setCompare(c.data); setSubjects(s.data); setAtRisk(ar.data);
      setTrends(t.data); setRankings(r.data); setInsights(ins.data);
    }).catch(e => { console.error(e); showToast('Failed to load dashboard','error'); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages, aiLoading]);

  const askAI = async (q) => {
    const question = (q ?? aiInput).trim();
    if (!question || aiLoading) return;
    setAiInput(''); setMessages(p => [...p, {role:'user',content:question}]); setAiLoading(true);
    try { const res = await api.post('/principal/ai/analyze', {question}); setMessages(p => [...p, {role:'bot',content:res.data.answer,source:res.data.source}]); }
    catch { setMessages(p => [...p, {role:'bot',content:'AI unavailable.'}]); }
    setAiLoading(false);
  };

  const inspectGrade = async (grade) => { try { const r = await api.get(`/principal/grades/${grade}/inspect`); setGradeInspect({...r.data, grade}); } catch { showToast('Failed','error'); } };
  const inspectClass = async (id) => { try { const r = await api.get(`/principal/classes/${id}/inspect`); setClassInspect(r.data); setGradeInspect(null); } catch { showToast('Failed','error'); } };
  const viewStudent = async (id) => { try { const r = await api.get(`/principal/students/${id}/profile`); setStudentProfile(r.data); setClassInspect(null); } catch { showToast('Failed','error'); } };

  if (loading) return <Page><div className="skeleton-card" style={{padding:80,textAlign:'center',color:'var(--text-muted)'}}>Loading command center…</div></Page>;
  if (!data) return <Page><div className="glass" style={{padding:60,textAlign:'center'}}>No data. Seed data first.</div></Page>;

  const school = data.school;
  const gradeData = (trends?.by_grade || data.grades || []).map(g => ({grade:`G${g.grade}`, gradeNum:g.grade, avg:g.average, students:g.students}));
  const subjectData = subjects.map((s,i) => ({name:s.name, avg:Math.round(s.average), pass:Math.round(s.pass_rate), color:s.color||COLORS[i%COLORS.length]}));
  const examData = (trends?.by_exam || []).map(e => ({name:e.exam_name||e.name, avg:Math.round(e.average)}));
  const radarData = subjects.slice(0,8).map(s => ({subject:s.name, avg:Math.round(s.average)}));
  const topStudents = rankings?.top || [];
  const improvedStudents = rankings?.most_improved || [];
  const bottomStudents = rankings?.bottom || atRisk.slice(0,10);

  // build "morning briefing" — top 3 things the principal needs to know
  const briefingItems = [];
  if (data.top_performer) briefingItems.push({ icon: Trophy, bg: 'linear-gradient(135deg,#fef3c7,#fde68a)', color:'#d97706', label:'Top performer', value:data.top_performer.name, sub:`${data.top_performer.average}% average` });
  briefingItems.push({ icon: AlertTriangle, bg: atRisk.length?'linear-gradient(135deg,#fee2e2,#fecaca)':'linear-gradient(135deg,#d1fae5,#a7f3d0)', color:atRisk.length?'#dc2626':'#16a34a', label:'Needs attention', value:`${atRisk.length} at-risk students`, sub: atRisk.length?'Review their profiles':'All on track' });
  const weakestSubject = subjectData.sort((a,b)=>a.avg-b.avg)[0];
  if (weakestSubject) briefingItems.push({ icon: Target, bg:'linear-gradient(135deg,#e0e7ff,#c7d2fe)', color:'#4f7df3', label:'Weakest subject', value:weakestSubject.name, sub:`${weakestSubject.avg}% average` });

  // action items — derived from insights
  const actionItems = insights.filter(i => i.severity === 'critical' || i.severity === 'warning').slice(0,5).map(i => ({
    title: i.title, meta: i.detail || i.value, priority: i.severity === 'critical' ? 'high' : 'med'
  }));
  if (atRisk.length > 5) actionItems.unshift({ title:`${atRisk.length} students at risk`, meta:'Below 50% avg or 60% attendance', priority:'high' });

  return (
    <Page>
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}

      {/* HERO */}
      <motion.div className="hero-premium" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:0.5,ease:EASE}}>
        <div className="hero-premium-icon"><Building2 size={26} color="white" /></div>
        <div className="hero-premium-text">
          <h2>{school.name}</h2>
          <p>Principal Command Center — click any grade, class or student to drill down</p>
        </div>
        <motion.button className="btn btn-primary" onClick={()=>setAiOpen(o=>!o)} whileHover={{scale:1.05}} whileTap={{scale:0.95}}>
          <Bot size={16} /> {aiOpen?'Hide':'AI'} Assistant
        </motion.button>
      </motion.div>

      <div className={`dash-premium ${aiOpen?'with-sidebar':''}`}>
        <div className="dash-main">
          {/* MORNING BRIEFING */}
          <motion.div className="briefing" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.1}}>
            <div className="briefing-header">
              <Sparkles size={16} style={{color:'var(--accent)'}} />
              <span className="briefing-title">Morning Briefing</span>
              <span style={{marginLeft:'auto',fontSize:11,color:'var(--text-muted)'}}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</span>
            </div>
            <div className="briefing-grid">
              {briefingItems.map((b,i) => (
                <motion.div key={i} className="briefing-item" initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:0.15+i*0.08}}>
                  <div className="briefing-icon" style={{background:b.bg}}><b.icon size={18} color={b.color} /></div>
                  <div className="briefing-content">
                    <div className="briefing-label">{b.label}</div>
                    <div className="briefing-value">{b.value}</div>
                    <div className="briefing-sub">{b.sub}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* KPI CARDS */}
          <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16}}>
            {[
              { v:data.total_students, l:'Students', Icon:GraduationCap, c:'#4f7df3', bg:'linear-gradient(135deg,#e0e7ff,#c7d2fe)', trend:2.3 },
              { v:data.total_classes, l:'Classes', Icon:ClipboardList, c:'#10b981', bg:'linear-gradient(135deg,#d1fae5,#a7f3d0)' },
              { v:data.school_average, l:'School Avg', Icon:TrendingUp, c:'#f59e0b', bg:'linear-gradient(135deg,#fef3c7,#fde68a)', trend:-1.2, decimals:1 },
              { v:data.total_exams, l:'Exams', Icon:Award, c:'#8b5cf6', bg:'linear-gradient(135deg,#ede9fe,#ddd6fe)' },
            ].map((s,i) => (
              <motion.div key={i} variants={staggerItem} className="stat-card-premium" style={{'--card-accent':s.c}}>
                <div className="stat-top">
                  <div className="stat-icon-box" style={{background:s.bg}}><s.Icon size={20} color={s.c} /></div>
                  {s.trend != null && <TrendBadge value={s.trend} />}
                </div>
                <div className="stat-value" style={{color:s.c}}><CountUp value={s.v} decimals={s.decimals||0} /></div>
                <div className="stat-label">{s.l}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* ACTION ITEMS + TOP PERFORMER */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}} className="two-col-charts">
            <motion.div className="chart-card-premium" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.25}}>
              <div className="chart-header-premium">
                <div className="chart-title-premium"><Zap size={18} /> Action Items</div>
                <span className="chart-annotation">{actionItems.length} priorities</span>
              </div>
              <div className="action-list">
                {actionItems.slice(0,5).map((a,i) => (
                  <motion.div key={i} className="action-item" initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}>
                    <div className={`action-priority priority-${a.priority}`}></div>
                    <div className="action-text">
                      <div className="action-title">{a.title}</div>
                      <div className="action-meta">{a.meta}</div>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </motion.div>
                ))}
                {!actionItems.length && <div className="empty-mini">No urgent actions. All clear.</div>}
              </div>
            </motion.div>

            <motion.div className="chart-card-premium" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.3}}>
              <div className="chart-header-premium">
                <div className="chart-title-premium"><Trophy size={18} /> Top Performers</div>
                <span className="chart-annotation">School-wide</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {topStudents.slice(0,5).map((s,i) => (
                  <motion.div key={s.student_id||i} className="ranking-row" onClick={()=>viewStudent(s.student_id)} whileHover={{x:3}} style={{cursor:'pointer'}}>
                    <span className="rank-num" style={{color: i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#d97706':'var(--text-muted)'}}>{i+1}</span>
                    <span style={{fontWeight:600,fontSize:13,flex:1}}>{s.name}</span>
                    <span style={{fontSize:13,fontWeight:700,color:'#10b981'}}>{s.average}%</span>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </motion.div>
                ))}
                {!topStudents.length && <div className="empty-mini">No data.</div>}
              </div>
            </motion.div>
          </div>

          {/* GRADE PERFORMANCE — interactive */}
          <motion.div className="chart-card-premium" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.35}}>
            <div className="chart-header-premium">
              <div className="chart-title-premium"><BarChart3 size={18} /> Grade Performance</div>
              <span className="chart-annotation">Click a bar to inspect</span>
            </div>
            <div style={{width:'100%',height:280}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeData} margin={{top:10,right:10,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,210,230,0.3)" />
                  <XAxis dataKey="grade" tick={{fontSize:12,fill:'var(--text-secondary)'}} />
                  <YAxis domain={[0,100]} tick={{fontSize:12,fill:'var(--text-secondary)'}} />
                  <Tooltip contentStyle={{borderRadius:12,border:'1px solid rgba(79,125,243,0.2)',fontSize:13}} />
                  <Bar dataKey="avg" radius={[8,8,0,0]} onClick={(d)=>inspectGrade(d.gradeNum)} cursor="pointer">
                    {gradeData.map((d,i) => <Cell key={i} fill={gradeColor(d.avg)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* SUBJECT RADAR + EXAM TREND */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}} className="two-col-charts">
            <motion.div className="chart-card-premium" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.4}}>
              <div className="chart-header-premium">
                <div className="chart-title-premium"><Target size={18} /> Subject Strength</div>
              </div>
              <div style={{width:'100%',height:260}}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(200,210,230,0.4)" />
                    <PolarAngleAxis dataKey="subject" tick={{fontSize:10,fill:'var(--text-secondary)'}} />
                    <PolarRadiusAxis domain={[0,100]} tick={{fontSize:10,fill:'var(--text-muted)'}} />
                    <Radar dataKey="avg" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.3} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
            <motion.div className="chart-card-premium" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.45}}>
              <div className="chart-header-premium">
                <div className="chart-title-premium"><TrendingUp size={18} /> Exam Trend</div>
              </div>
              <div style={{width:'100%',height:260}}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={examData} margin={{top:10,right:10,left:-20,bottom:0}}>
                    <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cf6" stopOpacity={0.4} /><stop offset="100%" stopColor="#8b7cf6" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,210,230,0.3)" />
                    <XAxis dataKey="name" tick={{fontSize:10,fill:'var(--text-secondary)'}} />
                    <YAxis domain={[0,100]} tick={{fontSize:12,fill:'var(--text-secondary)'}} />
                    <Tooltip contentStyle={{borderRadius:12,border:'1px solid rgba(139,124,246,0.2)',fontSize:13}} />
                    <Area dataKey="avg" stroke="#8b7cf6" strokeWidth={2.5} fill="url(#eg)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* INSIGHTS */}
          <motion.div className="chart-card-premium" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.5}}>
            <div className="chart-header-premium">
              <div className="chart-title-premium"><Lightbulb size={18} /> Algorithmic Insights</div>
              <span className="chart-annotation">{insights.length} findings</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}} className="insights-grid">
              {insights.slice(0,8).map((ins,i) => {
                const c = ins.severity==='good'?'#10b981':ins.severity==='warning'?'#f59e0b':ins.severity==='critical'?'#ef4444':'#4f7df3';
                return (
                  <motion.div key={i} className="insight-premium" style={{'--insight-color':c}} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}>
                    <div className="insight-premium-header">
                      <Lightbulb size={14} style={{color:c}} />
                      <span className="insight-premium-title">{ins.title}</span>
                      <span className="insight-premium-value" style={{color:c}}>{ins.value}</span>
                    </div>
                    {ins.detail && <p className="insight-premium-detail">{ins.detail}</p>}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* CLASS COMPARISON — clickable */}
          <motion.div className="chart-card-premium" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.55}}>
            <div className="chart-header-premium">
              <div className="chart-title-premium"><Layers size={18} /> Class Comparison</div>
              <span className="chart-annotation">Click a row to inspect</span>
            </div>
            <div className="table-premium">
              <table>
                <thead><tr><th>Class</th><th style={{textAlign:'center'}}>Students</th><th style={{textAlign:'center'}}>Avg</th><th style={{textAlign:'center'}}>Attendance</th><th>Top Student</th><th>Weakest</th></tr></thead>
                <tbody>
                  {compare.map((c,i) => (
                    <motion.tr key={c.class_id||i} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.03}} onClick={()=>inspectClass(c.class_id)}>
                      <td style={{fontWeight:700}}>{c.label}</td>
                      <td style={{textAlign:'center'}}>{c.student_count}</td>
                      <td style={{textAlign:'center',fontWeight:700,color:gradeColor(c.average_percentage)}}>{c.average_percentage}%</td>
                      <td style={{textAlign:'center'}}>{c.attendance_rate}%</td>
                      <td style={{fontSize:12}}>{c.top_student?.name||'—'}</td>
                      <td style={{fontSize:12,color:'var(--text-secondary)'}}>{c.weakest_subject?.name||'—'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* AT-RISK */}
          <motion.div className="chart-card-premium" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.6}}>
            <div className="chart-header-premium">
              <div className="chart-title-premium"><AlertTriangle size={18} color="#ef4444" /> At-Risk Students</div>
              <span className="chart-annotation" style={{background:'rgba(239,68,68,0.08)',color:'#dc2626'}}>{atRisk.length} need attention</span>
            </div>
            <div style={{maxHeight:340,overflowY:'auto'}}>
              {atRisk.map((s,i) => (
                <motion.div key={s.student_id||i} className="ranking-row" onClick={()=>viewStudent(s.student_id)} whileHover={{x:3}} style={{cursor:'pointer'}} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.03}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13}}>{s.name}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{s.class_label||s.label} · {s.weakest_subject?.name?`Weak: ${s.weakest_subject.name}`:''}</div>
                  </div>
                  <span className="pill-tag" style={{background:s.average<50?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.12)',color:s.average<50?'#dc2626':'#d97706'}}>{s.average}% avg</span>
                  <span className="pill-tag" style={{background:s.attendance_rate<60?'rgba(239,68,68,0.12)':'rgba(16,185,129,0.12)',color:s.attendance_rate<60?'#dc2626':'#16a34a'}}>{s.attendance_rate}% att</span>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </motion.div>
              ))}
              {!atRisk.length && <div className="empty-mini">No at-risk students. Everyone is on track.</div>}
            </div>
          </motion.div>
        </div>

        {/* AI SIDEBAR */}
        <AnimatePresence>
          {aiOpen && (
            <motion.div className="ai-sidebar-premium" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:30}} transition={{duration:0.4,ease:EASE}}>
              <div className="ai-sidebar-header">
                <div className="ai-avatar"><Bot size={18} color="white" /></div>
                <div>
                  <div className="ai-sidebar-title">AI Assistant</div>
                  <div className="ai-sidebar-sub">Sees all {school.name} data</div>
                </div>
              </div>
              <div className="ai-messages-premium">
                {messages.length===0 && (
                  <div className="ai-msg-premium ai-msg-bot-premium" style={{background:'rgba(79,125,243,0.05)'}}>
                    <Sparkles size={14} style={{display:'inline',marginRight:6,color:'var(--accent)'}} />
                    Good morning. I have full access to {school.name} — {data.total_students} students, {data.total_classes} classes, {data.school_average}% average. How can I help you today?
                  </div>
                )}
                {messages.map((m,i) => (
                  <div key={i} className={`ai-msg-premium ${m.role==='user'?'ai-msg-user-premium':'ai-msg-bot-premium'}`}>
                    {m.role==='bot'?<MarkdownLite text={m.content} />:m.content}
                  </div>
                ))}
                {aiLoading && <div className="ai-msg-premium ai-msg-bot-premium"><ThinkingWave /></div>}
                <div ref={messagesEndRef} />
              </div>
              {messages.length===0 && (
                <div className="ai-suggest-premium">
                  {AI_SUGGESTIONS.map(s => <button key={s} onClick={()=>askAI(s)}>{s}</button>)}
                </div>
              )}
              <form className="ai-input-premium" onSubmit={e=>{e.preventDefault();askAI();}}>
                <input className="input" placeholder="Ask about your school…" value={aiInput} onChange={e=>setAiInput(e.target.value)} disabled={aiLoading} />
                <button type="submit" disabled={aiLoading||!aiInput.trim()}>
                  {aiLoading ? <Activity size={16} className="spin" /> : <SendHorizontal size={16} />}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DRILL-DOWN MODALS */}
      <Modal open={!!gradeInspect} onClose={()=>setGradeInspect(null)} title={gradeInspect?`Grade ${gradeInspect.grade} — Inspection`:''} wide>
        {gradeInspect && <GradeInspect data={gradeInspect} onClassClick={inspectClass} />}
      </Modal>
      <Modal open={!!classInspect} onClose={()=>setClassInspect(null)} title={classInspect?`${classInspect.label} — Class Inspection`:''} wide>
        {classInspect && <ClassInspect data={classInspect} onStudentClick={viewStudent} />}
      </Modal>
      <Modal open={!!studentProfile} onClose={()=>setStudentProfile(null)} title={studentProfile?`${studentProfile.name} — Student Profile`:''} wide>
        {studentProfile && <StudentProfile data={studentProfile} />}
      </Modal>
    </Page>
  );
}

function GradeInspect({ data, onClassClick }) {
  const sections = data.sections || data.classes || [];
  const subjectMatrix = data.subject_comparison || data.subject_averages || [];
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
        <div className="kpi-tile"><div className="kpi-tile-label">Sections</div><div className="kpi-tile-value">{sections.length}</div></div>
        <div className="kpi-tile"><div className="kpi-tile-label">Students</div><div className="kpi-tile-value">{data.total_students||data.students_count||'—'}</div></div>
        <div className="kpi-tile"><div className="kpi-tile-label">Grade Avg</div><div className="kpi-tile-value" style={{color:gradeColor(data.grade_average||0)}}>{data.grade_average}%</div></div>
      </div>
      <h4 style={{margin:'16px 0 8px',fontSize:14,fontWeight:700}}>Sections — click to inspect class</h4>
      <div className="table-premium" style={{marginBottom:16}}>
        <table>
          <thead><tr><th>Section</th><th style={{textAlign:'center'}}>Students</th><th style={{textAlign:'center'}}>Avg</th><th style={{textAlign:'center'}}>Attendance</th><th>Top Student</th></tr></thead>
          <tbody>
            {sections.map((s,i) => (
              <tr key={i} onClick={()=>onClassClick(s.class_id)}>
                <td style={{fontWeight:700}}>{s.label||s.section}</td>
                <td style={{textAlign:'center'}}>{s.student_count||s.students}</td>
                <td style={{textAlign:'center',fontWeight:700,color:gradeColor(s.average_percentage||s.average||0)}}>{s.average_percentage||s.average}%</td>
                <td style={{textAlign:'center'}}>{s.attendance_rate||s.attendance}%</td>
                <td style={{fontSize:12}}>{s.top_student?.name||'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {subjectMatrix.length>0 && (
        <>
          <h4 style={{margin:'16px 0 8px',fontSize:14,fontWeight:700}}>Subject comparison across sections</h4>
          <div className="table-premium">
            <table>
              <thead><tr><th>Subject</th>{sections.map((s,i)=><th key={i} style={{textAlign:'center'}}>{s.label||s.section}</th>)}</tr></thead>
              <tbody>
                {subjectMatrix.map((sub,i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{sub.name||sub.subject}</td>
                    {sections.map((s,j)=><td key={j} style={{textAlign:'center',color:gradeColor(sub[s.label]||sub[s.section]||0)}}>{sub[s.label]||sub[s.section]||'—'}%</td>)}
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
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
        <div className="kpi-tile"><div className="kpi-tile-label">Students</div><div className="kpi-tile-value">{students.length}</div></div>
        <div className="kpi-tile"><div className="kpi-tile-label">Subjects</div><div className="kpi-tile-value">{(data.subjects||[]).length}</div></div>
        <div className="kpi-tile"><div className="kpi-tile-label">Class Avg</div><div className="kpi-tile-value" style={{color:gradeColor(data.average_percentage||data.average||0)}}>{data.average_percentage||data.average}%</div></div>
      </div>
      <h4 style={{margin:'16px 0 8px',fontSize:14,fontWeight:700}}>Students — click for full profile</h4>
      <div className="table-premium">
        <table>
          <thead><tr><th>#</th><th>Student</th><th style={{textAlign:'center'}}>Avg</th><th style={{textAlign:'center'}}>Attendance</th><th style={{textAlign:'center'}}>Rank</th></tr></thead>
          <tbody>
            {students.map((s,i) => (
              <tr key={s.student_id||i} onClick={()=>onStudentClick(s.student_id)}>
                <td style={{textAlign:'center',color:'var(--text-muted)'}}>{i+1}</td>
                <td style={{fontWeight:600}}>{s.name}</td>
                <td style={{textAlign:'center',fontWeight:700,color:gradeColor(s.average||0)}}>{s.average}%</td>
                <td style={{textAlign:'center'}}>{s.attendance_rate||s.attendance}%</td>
                <td style={{textAlign:'center',fontWeight:700}}>#{s.rank_in_class||i+1}</td>
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
  const TrendIcon = trend.direction==='improving'?TrendingUp:trend.direction==='declining'?TrendingDown:Minus;
  const trendColor = trend.direction==='improving'?'#10b981':trend.direction==='declining'?'#ef4444':'#8a92a8';
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12,marginBottom:16}}>
        <div className="kpi-tile"><div className="kpi-tile-label">Average</div><div className="kpi-tile-value" style={{color:gradeColor(data.average||0)}}>{data.average}%</div></div>
        <div className="kpi-tile"><div className="kpi-tile-label">Rank in Class</div><div className="kpi-tile-value">#{data.rank_in_class}</div></div>
        <div className="kpi-tile"><div className="kpi-tile-label">Rank in Grade</div><div className="kpi-tile-value">#{data.rank_in_grade}</div></div>
        <div className="kpi-tile"><div className="kpi-tile-label">Attendance</div><div className="kpi-tile-value">{data.attendance_rate||data.attendance}%</div></div>
      </div>
      {data.class_label && <p style={{fontSize:13,color:'var(--text-secondary)',marginBottom:16}}>{data.class_label} · Strongest: <strong>{data.strongest_subject?.name}</strong> ({data.strongest_subject?.average}%) · Weakest: <strong>{data.weakest_subject?.name}</strong> ({data.weakest_subject?.average}%)</p>}
      {trend.first_avg!=null && (
        <div className="kpi-tile" style={{marginBottom:16,flexDirection:'row',alignItems:'center',gap:10}}>
          <TrendIcon size={20} color={trendColor} />
          <div><div className="kpi-tile-label">Improvement Trend</div><div style={{fontSize:14,fontWeight:700,color:trendColor}}>{trend.first_avg}% → {trend.last_avg}% ({trend.delta>0?'+':''}{trend.delta?.toFixed(1)}% · {trend.direction})</div></div>
        </div>
      )}
      {marks.length>0 && (
        <>
          <h4 style={{margin:'16px 0 8px',fontSize:14,fontWeight:700}}>Subject × Exam marks</h4>
          <div className="table-premium">
            <table>
              <thead><tr><th>Subject</th><th>Exam</th><th style={{textAlign:'center'}}>Score</th><th style={{textAlign:'center'}}>Max</th><th style={{textAlign:'center'}}>%</th></tr></thead>
              <tbody>
                {marks.map((m,i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{m.subject||m.subject_name}</td>
                    <td>{m.exam||m.exam_name}</td>
                    <td style={{textAlign:'center'}}>{m.score}</td>
                    <td style={{textAlign:'center',color:'var(--text-muted)'}}>{m.max_score||m.max}</td>
                    <td style={{textAlign:'center',fontWeight:700,color:gradeColor(((m.score/(m.max_score||m.max||100))*100))}}>{((m.score/(m.max_score||m.max||100))*100).toFixed(0)}%</td>
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
