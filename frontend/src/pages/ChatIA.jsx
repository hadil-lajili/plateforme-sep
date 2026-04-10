import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Trash2, ChevronDown } from 'lucide-react'
import api from '../services/api'
import { patientService } from '../services/patientService'

const s = {
  page: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: '#0f172a', color: '#f1f5f9', fontFamily: 'inherit',
  },
  header: {
    padding: '20px 24px 16px', borderBottom: '1px solid #1e293b',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerIcon: {
    width: '40px', height: '40px', borderRadius: '10px',
    background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: '18px', fontWeight: 700, color: '#f1f5f9' },
  subtitle: { fontSize: '12px', color: '#64748b', marginTop: '2px' },
  patientBar: {
    padding: '12px 24px', borderBottom: '1px solid #1e293b',
    display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
    background: '#0b1120',
  },
  patientLabel: { fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' },
  select: {
    flex: 1, maxWidth: '320px', padding: '8px 12px', borderRadius: '8px',
    background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9',
    fontSize: '13px', cursor: 'pointer', outline: 'none',
  },
  clearBtn: {
    padding: '6px 12px', borderRadius: '8px', background: 'transparent',
    border: '1px solid #334155', color: '#94a3b8', fontSize: '12px',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '24px',
    display: 'flex', flexDirection: 'column', gap: '16px',
  },
  welcome: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', flex: 1, textAlign: 'center', gap: '16px',
    padding: '40px',
  },
  welcomeIcon: {
    width: '64px', height: '64px', borderRadius: '16px',
    background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  welcomeTitle: { fontSize: '20px', fontWeight: 700, color: '#f1f5f9' },
  welcomeDesc: { fontSize: '14px', color: '#64748b', maxWidth: '400px', lineHeight: '1.6' },
  suggestions: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '8px' },
  suggBtn: {
    padding: '8px 14px', borderRadius: '20px', background: '#1e293b',
    border: '1px solid #334155', color: '#94a3b8', fontSize: '13px',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  msgRow: (isUser) => ({
    display: 'flex', gap: '12px', flexDirection: isUser ? 'row-reverse' : 'row',
    alignItems: 'flex-start',
  }),
  avatar: (isUser) => ({
    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: isUser ? '#1e3a5f' : 'linear-gradient(135deg, #38bdf8, #818cf8)',
  }),
  bubble: (isUser) => ({
    maxWidth: '70%', padding: '12px 16px', borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
    background: isUser ? '#1e3a5f' : '#1e293b',
    border: `1px solid ${isUser ? '#2563eb33' : '#334155'}`,
    fontSize: '14px', lineHeight: '1.6', color: '#e2e8f0',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  }),
  typing: {
    display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0',
  },
  dot: (i) => ({
    width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8',
    animation: `bounce 1.2s infinite`,
    animationDelay: `${i * 0.2}s`,
  }),
  inputArea: {
    padding: '16px 24px', borderTop: '1px solid #1e293b',
    display: 'flex', gap: '12px', alignItems: 'flex-end', flexShrink: 0,
    background: '#0b1120',
  },
  textarea: {
    flex: 1, padding: '12px 16px', borderRadius: '12px',
    background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9',
    fontSize: '14px', resize: 'none', outline: 'none', fontFamily: 'inherit',
    lineHeight: '1.5', maxHeight: '120px', minHeight: '44px',
  },
  sendBtn: (disabled) => ({
    width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
    background: disabled ? '#1e293b' : 'linear-gradient(135deg, #38bdf8, #818cf8)',
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  }),
  disclaimer: {
    textAlign: 'center', fontSize: '11px', color: '#475569', padding: '8px 24px 0',
  },
}

const SUGGESTIONS = [
  "Que signifie un EDSS de 3.5 ?",
  "Quels sont les DMT de 1ère ligne pour la SEP ?",
  "Comment interpréter des lésions T2 périventriculaires ?",
  "Quelle surveillance pour un patient sous natalizumab ?",
]

export default function ChatIA() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState('')
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    patientService.getAll(1, 100).then(res => {
      setPatients(res.data.data || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleInput = (e) => {
    setInput(e.target.value)
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = '44px'
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const userMsg = { role: 'user', content: msg }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '44px'
    setLoading(true)

    try {
      const res = await api.post('/chat/message', {
        message: msg,
        patient_id: selectedPatient || null,
        historique: messages.slice(-10),
      })
      setMessages([...newHistory, { role: 'assistant', content: res.data.reponse }])
    } catch (err) {
      const detail = err.response?.data?.detail || "Erreur de connexion à l'IA."
      setMessages([...newHistory, { role: 'assistant', content: `⚠️ ${detail}` }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => setMessages([])

  const selectedPatientName = () => {
    if (!selectedPatient) return null
    const p = patients.find(p => p.id === selectedPatient)
    return p ? `${p.prenom} ${p.nom}` : null
  }

  return (
    <div style={s.page}>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}><Bot size={22} color="#fff" /></div>
          <div>
            <div style={s.title}>Assistant IA SEP</div>
            <div style={s.subtitle}>Spécialisé en neurologie — Sclérose En Plaques</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '8px', background: 'transparent',
            border: '1px solid #334155', color: '#94a3b8', fontSize: '13px', cursor: 'pointer',
          }}>
            <Trash2 size={14} /> Effacer
          </button>
        )}
      </div>

      {/* Sélecteur patient */}
      <div style={s.patientBar}>
        <span style={s.patientLabel}>Patient (optionnel) :</span>
        <select
          style={s.select}
          value={selectedPatient}
          onChange={e => setSelectedPatient(e.target.value)}
        >
          <option value="">— Aucun patient sélectionné —</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
          ))}
        </select>
        {selectedPatient && (
          <button style={s.clearBtn} onClick={() => setSelectedPatient('')}>
            Retirer
          </button>
        )}
        {selectedPatient && (
          <span style={{
            fontSize: '12px', color: '#38bdf8', background: '#0f2942',
            padding: '4px 10px', borderRadius: '20px', border: '1px solid #1e3a5f',
          }}>
            Contexte : {selectedPatientName()}
          </span>
        )}
      </div>

      {/* Zone messages */}
      <div style={s.messages}>
        {messages.length === 0 ? (
          <div style={s.welcome}>
            <div style={s.welcomeIcon}><Bot size={32} color="#fff" /></div>
            <div style={s.welcomeTitle}>Assistant IA — SEP</div>
            <div style={s.welcomeDesc}>
              Posez vos questions cliniques sur la Sclérose En Plaques.
              Sélectionnez un patient pour obtenir des réponses contextualisées à son dossier.
            </div>
            <div style={s.suggestions}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  style={s.suggBtn}
                  onClick={() => send(s)}
                  onMouseEnter={e => e.target.style.borderColor = '#38bdf8'}
                  onMouseLeave={e => e.target.style.borderColor = '#334155'}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} style={s.msgRow(msg.role === 'user')}>
                <div style={s.avatar(msg.role === 'user')}>
                  {msg.role === 'user'
                    ? <User size={16} color="#93c5fd" />
                    : <Bot size={16} color="#fff" />
                  }
                </div>
                <div style={s.bubble(msg.role === 'user')}>{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div style={s.msgRow(false)}>
                <div style={s.avatar(false)}><Bot size={16} color="#fff" /></div>
                <div style={s.bubble(false)}>
                  <div style={s.typing}>
                    <div style={s.dot(0)} />
                    <div style={s.dot(1)} />
                    <div style={s.dot(2)} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Disclaimer */}
      <div style={s.disclaimer}>
        L'IA est une aide à la décision clinique — ne remplace pas le jugement médical.
      </div>

      {/* Zone de saisie */}
      <div style={s.inputArea}>
        <textarea
          ref={textareaRef}
          style={s.textarea}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Posez votre question... (Entrée pour envoyer, Maj+Entrée pour sauter une ligne)"
          rows={1}
          disabled={loading}
        />
        <button
          style={s.sendBtn(!input.trim() || loading)}
          onClick={() => send()}
          disabled={!input.trim() || loading}
        >
          <Send size={18} color={!input.trim() || loading ? '#475569' : '#fff'} />
        </button>
      </div>
    </div>
  )
}
