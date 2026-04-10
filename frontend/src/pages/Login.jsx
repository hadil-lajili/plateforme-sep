import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Sparkles, ArrowRight, Brain, Shield, Activity } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', mot_de_passe: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.mot_de_passe)
      if (user.role === 'admin') navigate('/admin')
      else navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: '#f8f9fc',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* ── Left Panel — Visual ─────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #eef2ff 0%, #f0f9ff 50%, #faf5ff 100%)',
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)',
          top: '10%', left: '20%', filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)',
          bottom: '15%', right: '15%', filter: 'blur(40px)',
        }} />

        {/* Orbiting animation */}
        <div style={{ position: 'relative', width: '280px', height: '280px', marginBottom: '40px' }}>
          {/* Center brain icon */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '88px', height: '88px', borderRadius: '22px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(79, 70, 229, 0.3)',
          }}>
            <Brain size={40} color="#fff" />
          </div>
          {/* Orbit ring */}
          <div style={{
            position: 'absolute', inset: '20px',
            border: '1.5px dashed rgba(79,70,229,0.15)',
            borderRadius: '50%',
          }} />
          {/* Orbiting elements */}
          {[
            { icon: Shield, delay: '0s', color: '#0891b2', bg: '#e0f7fa' },
            { icon: Activity, delay: '-4s', color: '#059669', bg: '#ecfdf5' },
            { icon: Sparkles, delay: '-8s', color: '#d97706', bg: '#fffbeb' },
          ].map(({ icon: Icon, delay, color, bg }, i) => (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: '0', height: '0',
              animation: `orbit 14s linear infinite`,
              animationDelay: delay,
            }}>
              <div style={{
                position: 'absolute', transform: 'translate(-50%, -50%)',
                width: '44px', height: '44px', borderRadius: '12px',
                background: bg, border: `1.5px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 2px 8px ${color}15`,
              }}>
                <Icon size={20} color={color} />
              </div>
            </div>
          ))}
        </div>

        {/* Tagline */}
        <h2 style={{
          fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em',
          textAlign: 'center', margin: 0, color: '#1a1d26',
        }}>
          Intelligence Artificielle
          <br />
          <span className="gradient-text">pour la Neurologie</span>
        </h2>
        <p style={{
          fontSize: '14px', color: '#6b7280', marginTop: '16px',
          textAlign: 'center', maxWidth: '380px', lineHeight: '1.7',
        }}>
          Classification SEP • Prédiction de lésions • Suivi EDSS • Chat IA médical
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { text: 'ResNet-50 · 99.35%', color: '#4f46e5', bg: '#eef2ff' },
            { text: 'U-Net · Dice 0.82', color: '#0891b2', bg: '#e0f7fa' },
            { text: 'Llama 3.3 70B', color: '#7c3aed', bg: '#f5f3ff' },
          ].map(p => (
            <span key={p.text} style={{
              padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              background: p.bg, color: p.color,
              border: `1px solid ${p.color}20`,
            }}>
              {p.text}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right Panel — Form ──────────────────────────────── */}
      <div style={{
        width: '480px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px',
        background: '#fff',
        borderLeft: '1px solid #eef0f4',
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '44px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <span style={{ fontSize: '17px', fontWeight: 700, color: '#1a1d26', letterSpacing: '-0.02em' }}>
              SEP Platform
            </span>
          </div>

          <h1 style={{
            fontSize: '26px', fontWeight: 700, color: '#1a1d26', margin: '0 0 8px',
            letterSpacing: '-0.02em',
          }}>
            Bienvenue 👋
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 36px' }}>
            Connectez-vous à votre espace médical
          </p>

          {error && (
            <div style={{
              marginBottom: '20px', padding: '12px 16px', borderRadius: '10px',
              background: '#fef2f2', border: '1px solid #fecaca',
              color: '#dc2626', fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label className="label-light">Email professionnel</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="input-light"
                placeholder="votre@email.com"
                required
              />
            </div>
            <div style={{ marginBottom: '28px' }}>
              <label className="label-light">Mot de passe</label>
              <input
                type="password"
                value={form.mot_de_passe}
                onChange={e => setForm({ ...form, mot_de_passe: e.target.value })}
                className="input-light"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  Connexion...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Se connecter <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', marginTop: '28px' }}>
            Pas encore de compte ?{' '}
            <Link to="/inscription" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>
              S'inscrire
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(110px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(110px) rotate(-360deg); }
        }
      `}</style>
    </div>
  )
}