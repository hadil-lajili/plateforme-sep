/* ═══════════════════════════════════════════════════════════════
   INSCRIPTION PAGE — Neuro Predict MS
   Formulaire d'inscription avec sélection de rôle interactive
   (médecin, radiologue, laboratoire, patient)
   Auteur: Wiem Saafi | NeuroNova Team
   ═══════════════════════════════════════════════════════════════ */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { Sparkles, ArrowRight, Stethoscope, Brain, FlaskConical, CheckCircle2, Heart } from 'lucide-react'

const ROLES = [
  { value: 'medecin', label: 'Médecin', desc: 'Consultation, visites, prédictions IA', icon: Stethoscope, color: '#4f46e5', bg: '#eef2ff' },
  { value: 'radiologue', label: 'Radiologue', desc: 'Upload et analyse des IRM', icon: Brain, color: '#0891b2', bg: '#e0f7fa' },
  { value: 'laboratoire', label: 'Laboratoire', desc: 'Résultats biologiques', icon: FlaskConical, color: '#059669', bg: '#ecfdf5' },
  { value: 'patient', label: 'Patient', desc: 'Suivi de votre maladie et rapports', icon: Heart, color: '#e11d48', bg: '#fff1f2' },
]

export default function Inscription() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', mot_de_passe: '', role: 'medecin'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authService.inscription(form)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    const isPatient = form.role === 'patient'
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8f9fc', fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <div className="animate-slideUp" style={{
          maxWidth: '420px', width: '100%', textAlign: 'center',
          padding: '48px 40px', borderRadius: '20px',
          background: '#fff',
          border: '1px solid #eef0f4',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 20px',
            background: '#ecfdf5', border: '1px solid #a7f3d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle2 size={28} color="#059669" />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1d26', marginBottom: '12px' }}>
            {isPatient ? 'Compte créé avec succès !' : 'Inscription envoyée !'}
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.7', marginBottom: '28px' }}>
            {isPatient
              ? 'Votre compte patient est actif. Vous pouvez vous connecter dès maintenant pour accéder à votre espace.'
              : "Votre compte est en attente de validation par l'administrateur. Vous recevrez une confirmation une fois votre compte activé."
            }
          </p>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            color: '#4f46e5', textDecoration: 'none', fontWeight: 600, fontSize: '14px',
          }}>
            {isPatient ? 'Se connecter maintenant' : 'Retour à la connexion'} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8f9fc 0%, #eef2ff 50%, #f0f9ff 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: '32px',
    }}>
      <div className="animate-slideUp" style={{ maxWidth: '480px', width: '100%' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
          }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <span style={{ fontSize: '17px', fontWeight: 700, color: '#1a1d26', letterSpacing: '-0.02em' }}>
            Neuro Predict MS
          </span>
        </div>

        {/* Card */}
        <div style={{
          padding: '36px', borderRadius: '20px',
          background: '#fff',
          border: '1px solid #eef0f4',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1d26', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Créer un compte
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 28px' }}>
            Rejoignez la plateforme médicale Neuro Predict MS
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="label-light">Nom *</label>
                <input type="text" value={form.nom}
                  onChange={e => setForm({ ...form, nom: e.target.value })}
                  className="input-light" required />
              </div>
              <div>
                <label className="label-light">Prénom *</label>
                <input type="text" value={form.prenom}
                  onChange={e => setForm({ ...form, prenom: e.target.value })}
                  className="input-light" required />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="label-light">Email professionnel *</label>
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="input-light" placeholder="prenom.nom@chu-lyon.fr" required />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="label-light">Mot de passe *</label>
              <input type="password" value={form.mot_de_passe}
                onChange={e => setForm({ ...form, mot_de_passe: e.target.value })}
                className="input-light" placeholder="Minimum 6 caractères" required />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label className="label-light">Votre rôle *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ROLES.map(role => {
                  const Icon = role.icon
                  const isSelected = form.role === role.value
                  return (
                    <label key={role.value} style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
                      background: isSelected ? role.bg : '#f8f9fc',
                      border: `1.5px solid ${isSelected ? role.color + '40' : '#eef0f4'}`,
                      transition: 'all 0.2s',
                    }}>
                      <input type="radio" name="role" value={role.value}
                        checked={isSelected}
                        onChange={e => setForm({ ...form, role: e.target.value })}
                        style={{ display: 'none' }}
                      />
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                        background: isSelected ? `${role.color}15` : '#eef0f4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}>
                        <Icon size={20} color={isSelected ? role.color : '#9ca3b0'} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#1a1d26', margin: 0 }}>
                          {role.label}
                        </p>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                          {role.desc}
                        </p>
                      </div>
                      {isSelected && (
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: role.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: `0 2px 6px ${role.color}30`,
                        }}>
                          <CheckCircle2 size={12} color="#fff" />
                        </div>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            <button type="submit" disabled={loading}
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
                  Envoi en cours...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Envoyer la demande <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', marginTop: '24px' }}>
            Déjà un compte ?{' '}
            <Link to="/login" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}