import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/client';
import { Page, EASE, SPRING } from '../../lib/motion.jsx';

const SUGGESTIONS = [
  'How is the school performing overall?',
  'Who is the top performer?',
  'Which grade needs attention?',
];

function ThinkingWave() {
  return (
    <div className="ai-thinking">
      <div className="ai-wave">
        {[0, 1, 2, 3, 4].map(i => (
          <motion.span key={i}
            animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
          />
        ))}
      </div>
      <motion.span className="ai-thinking-text"
        animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }}>
        Analyzing school data…
      </motion.span>
    </div>
  );
}

export default function PrincipalAI() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const ask = async (q) => {
    const query = (q ?? question).trim();
    if (!query) return;
    setQuestion(query);
    setLoading(true); setAnswer('');
    try {
      const res = await api.post('/principal/ai/analyze', { scope_type: 'grade', scope: 'all', question: query });
      setAnswer(res.data.summary || 'No response');
    } catch (err) {
      setAnswer('AI service unavailable. Please ensure you are assigned to a school.');
    }
    setLoading(false);
  };

  return (
    <Page>
      <div className="page-header">
        <h2>AI Assistant</h2>
        <p>Ask questions about school performance</p>
      </div>

      <div className="glass" style={{ padding: 28, marginBottom: 24 }}>
        <form onSubmit={e => { e.preventDefault(); ask(); }} style={{ display: 'flex', gap: 12 }}>
          <input type="text" placeholder="e.g., How is the school performing overall?"
            value={question} onChange={e => setQuestion(e.target.value)} className="input" style={{ flex: 1 }} />
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 100 }}>
            {loading ? '…' : 'Ask'}
          </button>
        </form>
        {!answer && !loading && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {SUGGESTIONS.map(s => (
              <button key={s} type="button" className="chip" onClick={() => ask(s)}
                style={{ padding: '8px 16px', borderRadius: 20, fontSize: 13 }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="thinking" className="glass" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <ThinkingWave />
          </motion.div>
        )}
        {answer && !loading && (
          <motion.div key="answer" className="glass"
            initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }} transition={SPRING}
            style={{ padding: 28, background: 'linear-gradient(135deg,#faf5ff,#f0e6ff)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 22 }}>🤖</span>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Response
              </h3>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
