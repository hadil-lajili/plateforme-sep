import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Trash2, Brain, Microscope, FlaskConical } from 'lucide-react'
import api from '../services/api'
import { patientService } from '../services/patientService'

const s = {
  page: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', color: '#1a1d26', fontFamily: 'inherit',
  },
  header: {
    padding: '24px 32px', borderBottom: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0, background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerIcon: {
    width: '48px', height: '48px', borderRadius: '14px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
  },
  title: { fontSize: '20px', fontWeight: 700, color: '#1a1d26', letterSpacing: '-0.02em' },
  subtitle: { fontSize: '13px', color: '#64748b', marginTop: '4px' },
  patientBar: {
    padding: '16px 32px', borderBottom: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
    background: '#fafbfc',
  },
  patientLabel: { fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' },
  select: {
    flex: 1, maxWidth: '360px', padding: '10px 14px', borderRadius: '10px',
    background: '#ffffff', border: '1px solid #e2e8f0', color: '#1a1d26',
    fontSize: '14px', cursor: 'pointer', outline: 'none', transition: 'all 0.2s',
  },
  clearBtn: {
    padding: '8px 16px', borderRadius: '10px', background: '#fef2f2',
    border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px',
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', fontWeight: 500,
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '32px',
    display: 'flex', flexDirection: 'column', gap: '20px',
  },
  welcome: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', flex: 1, textAlign: 'center', gap: '16px',
    padding: '40px',
  },
  welcomeIcon: {
    width: '80px', height: '80px', borderRadius: '20px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 12px 40px rgba(139, 92, 246, 0.5)',
  },
  welcomeTitle: { fontSize: '28px', fontWeight: 700, color: '#1a1d26', letterSpacing: '-0.02em' },
  welcomeDesc: { fontSize: '15px', color: '#64748b', maxWidth: '500px', lineHeight: '1.7' },
  suggestions: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '8px' },
  suggBtn: {
    padding: '10px 18px', borderRadius: '12px', background: '#f5f3ff',
    border: '1px solid #e9d5ff', color: '#7c3aed', fontSize: '13px',
    cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500,
  },
  msgRow: (isUser) => ({
    display: 'flex', gap: '12px', flexDirection: isUser ? 'row-reverse' : 'row',
    alignItems: 'flex-start',
  }),
  avatar: (isUser) => ({
    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: isUser ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    boxShadow: isUser ? '0 4px 12px rgba(59, 130, 246, 0.3)' : '0 4px 12px rgba(139, 92, 246, 0.4)',
  }),
  bubble: (isUser) => ({
    maxWidth: '70%', padding: '14px 18px', borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
    background: isUser ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)' : '#ffffff',
    border: `1px solid ${isUser ? '#93c5fd' : '#e2e8f0'}`,
    fontSize: '14px', lineHeight: '1.7', color: '#1a1d26',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  }),
  typing: {
    display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0',
  },
  dot: (i) => ({
    width: '7px', height: '7px', borderRadius: '50%', background: '#8b5cf6',
    animation: `bounce 1.2s infinite`,
    animationDelay: `${i * 0.2}s`,
  }),
  inputArea: {
    padding: '20px 32px', borderTop: '1px solid #e2e8f0',
    display: 'flex', gap: '12px', alignItems: 'flex-end', flexShrink: 0,
    background: '#ffffff', boxShadow: '0 -1px 3px rgba(0,0,0,0.04)',
  },
  textarea: {
    flex: 1, padding: '14px 18px', borderRadius: '14px',
    background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1a1d26',
    fontSize: '14px', resize: 'none', outline: 'none', fontFamily: 'inherit',
    lineHeight: '1.6', maxHeight: '140px', minHeight: '50px', transition: 'all 0.2s',
  },
  sendBtn: (disabled) => ({
    width: '50px', height: '50px', borderRadius: '12px', flexShrink: 0,
    background: disabled ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s', boxShadow: disabled ? 'none' : '0 4px 16px rgba(139, 92, 246, 0.4)',
  }),
  disclaimer: {
    textAlign: 'center', fontSize: '12px', color: '#64748b', padding: '12px 32px 0',
    background: '#fafbfc',
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
      // Send only the main content (not analyse) as history context
      const histForApi = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const res = await api.post('/chat/message', {
        message: msg,
        patient_id: selectedPatient || null,
        historique: histForApi,
      })
      setMessages([...newHistory, {
        role: 'assistant',
        content: res.data.reponse,
        analyse: res.data.analyse || '',
      }])
    } catch (err) {
      const detail = err.response?.data?.detail || "Erreur de connexion à l'IA."
      setMessages([...newHistory, { role: 'assistant', content: `⚠️ ${detail}`, analyse: '' }])
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
            padding: '8px 16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '13px', 
            cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500,
          }}
          onMouseEnter={e => {
            e.target.style.background = '#fee2e2'
            e.target.style.borderColor = '#fca5a5'
          }}
          onMouseLeave={e => {
            e.target.style.background = '#fef2f2'
            e.target.style.borderColor = '#fecaca'
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
            fontSize: '12px', color: '#7c3aed', background: '#f5f3ff',
            padding: '6px 14px', borderRadius: '10px', border: '1px solid #e9d5ff',
            fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Brain size={14} />
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
              {SUGGESTIONS.map(sugg => (
                <button
                  key={sugg}
                  style={s.suggBtn}
                  onClick={() => send(sugg)}
                  onMouseEnter={e => {
                    e.target.style.background = '#ede9fe'
                    e.target.style.borderColor = '#c4b5fd'
                    e.target.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = '#f5f3ff'
                    e.target.style.borderColor = '#e9d5ff'
                    e.target.style.transform = 'translateY(0)'
                  }}
                >
                  {sugg}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && msg.analyse && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', maxWidth: '70%' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)', border: '1px solid #c7d2fe' }}>
                      <Brain size={14} color="#6366f1" />
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: '12px', background: '#fafbff', border: '1px solid #e0e7ff', fontSize: '12px', lineHeight: '1.6', color: '#6366f1', fontStyle: 'italic' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#818cf8', display: 'block', marginBottom: '4px' }}>Analyse</span>
                      {msg.analyse}
                    </div>
                  </div>
                )}
                <div style={s.msgRow(msg.role === 'user')}>
                  <div style={s.avatar(msg.role === 'user')}>
                    {msg.role === 'user'
                      ? <User size={16} color="#93c5fd" />
                      : <Bot size={16} color="#fff" />
                    }
                  </div>
                  <div style={s.bubble(msg.role === 'user')}>{msg.content}</div>
                </div>
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
          onMouseEnter={e => {
            if (input.trim() && !loading) {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.6)'
            }
          }}
          onMouseLeave={e => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = input.trim() && !loading ? '0 4px 16px rgba(139, 92, 246, 0.4)' : 'none'
          }}
        >
          <Send size={20} color={!input.trim() || loading ? '#475569' : '#fff'} />
        </button>
      </div>
    </div>
  )
}
