import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Plus, FlaskConical, X, CheckCircle, Clock } from 'lucide-react'

const TYPES_ANALYSE = [
  { value: 'bilan_sanguin', label: 'Bilan sanguin', color: '#3b82f6' },
  { value: 'ponction_lombaire', label: 'Ponction lombaire', color: '#8b5cf6' },
  { value: 'bilan_inflammatoire', label: 'Bilan inflammatoire', color: '#ef4444' },
  { value: 'bilan_immunologique', label: 'Bilan immunologique', color: '#10b981' },
  { value: 'autre', label: 'Autre', color: '#94a3b8' },
]

const MARQUEURS = {
  bilan_sanguin: ['CRP', 'VS', 'NFS', 'Hémoglobine', 'Plaquettes', 'Leucocytes'],
  ponction_lombaire: ['Protéines LCR', 'Cellules LCR', 'Glucose LCR', 'Bandes oligoclonales', 'IgG index'],
  bilan_inflammatoire: ['CRP', 'VS', 'Fibrinogène', 'IL-6', 'TNF-α'],
  bilan_immunologique: ['IgG', 'IgM', 'IgA', 'Complément C3', 'Complément C4', 'ANA'],
  autre: ['Paramètre 1', 'Paramètre 2'],
}

export default function Analyses() {
  const { user } = useAuth()
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [analyses, setAnalyses] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    patient_id: '', type_analyse: 'bilan_sanguin', notes: '', resultats: {}
  })

  useEffect(() => { charger() }, [])

  const charger = async () => {
    setLoading(true)
    try {
      const [resA, resP] = await Promise.all([
        fetch('/api/analyses/', { headers }),
        fetch('/api/patients/?limit=100', { headers })
      ])
      const dataA = await resA.json()
      const dataP = await resP.json()
      setAnalyses(Array.isArray(dataA) ? dataA : [])
      setPatients(dataP.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const creer = async () => {
    if (!form.patient_id || !form.type_analyse) {
      setMessage('⚠️ Patient et type sont obligatoires')
      return
    }
    try {
      const res = await fetch('/api/analyses/', {
        method: 'POST', headers, body: JSON.stringify(form)
      })
      if (res.ok) {
        setMessage('✅ Analyse créée')
        setShowForm(false)
        setForm({ patient_id: '', type_analyse: 'bilan_sanguin', notes: '', resultats: {} })
        setTimeout(() => setMessage(''), 3000)
        charger()
      }
    } catch (e) {
      setMessage('❌ Erreur')
    }
  }

  const typeInfo = (val) => TYPES_ANALYSE.find(t => t.value === val) || TYPES_ANALYSE[4]

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Analyses biologiques</h1>
          <p style={{ color: '#64748b' }}>{analyses.length} analyse{analyses.length > 1 ? 's' : ''} enregistrée{analyses.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 20px', borderRadius: '10px', border: 'none',
          background: '#0f172a', color: 'white', cursor: 'pointer', fontWeight: 600
        }}>
          <Plus size={18} /> Nouvelle analyse
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total', value: analyses.length, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'En attente', value: analyses.filter(a => a.statut === 'en_attente').length, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Terminées', value: analyses.filter(a => a.statut === 'termine').length, color: '#22c55e', bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white', borderRadius: '12px', padding: '20px 24px',
            border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px', background: s.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 700, color: s.color
            }}>{s.value}</div>
            <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: message.includes('✅') ? '#f0fdf4' : message.includes('⚠️') ? '#fffbeb' : '#fef2f2',
          color: message.includes('✅') ? '#166534' : message.includes('⚠️') ? '#92400e' : '#991b1b',
          border: `1px solid ${message.includes('✅') ? '#bbf7d0' : message.includes('⚠️') ? '#fde68a' : '#fecaca'}`
        }}>{message}</div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div style={{
          background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
          padding: '24px', marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700 }}>Nouvelle analyse</h2>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color="#64748b" />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Patient *</label>
              <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}>
                <option value="">Sélectionner un patient</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Type d'analyse *</label>
              <select value={form.type_analyse} onChange={e => setForm(f => ({ ...f, type_analyse: e.target.value, resultats: {} }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}>
                {TYPES_ANALYSE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Marqueurs dynamiques */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '10px' }}>
                Résultats
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {(MARQUEURS[form.type_analyse] || []).map(marqueur => (
                  <div key={marqueur}>
                    <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>{marqueur}</label>
                    <input
                      placeholder="Valeur"
                      value={form.resultats[marqueur] || ''}
                      onChange={e => setForm(f => ({ ...f, resultats: { ...f.resultats, [marqueur]: e.target.value } }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Notes</label>
              <textarea rows={2} placeholder="Observations, commentaires..."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button onClick={() => setShowForm(false)} style={{
              padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0',
              background: 'white', cursor: 'pointer', fontSize: '14px', color: '#475569'
            }}>Annuler</button>
            <button onClick={creer} style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: '#0f172a', color: 'white', cursor: 'pointer', fontWeight: 600
            }}>Créer</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? <p style={{ color: '#64748b' }}>Chargement...</p> : analyses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <FlaskConical size={48} color="#94a3b8" style={{ margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: '#64748b' }}>Aucune analyse enregistrée</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {analyses.map(a => {
            const t = typeInfo(a.type_analyse)
            return (
              <div key={a.id} style={{
                background: 'white', borderRadius: '12px', padding: '20px 24px',
                border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: t.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <FlaskConical size={20} color={t.color} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{a.patient_nom}</div>
                    <span style={{
                      display: 'inline-block', marginTop: '3px',
                      background: t.color + '20', color: t.color,
                      padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600
                    }}>{t.label}</span>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '3px' }}>
                      {new Date(a.date_analyse).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                    background: a.statut === 'termine' ? '#f0fdf4' : '#fffbeb',
                    color: a.statut === 'termine' ? '#166534' : '#92400e'
                  }}>
                    {a.statut === 'termine' ? <><CheckCircle size={13} /> Terminée</> : <><Clock size={13} /> En attente</>}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                    {Object.keys(a.resultats || {}).length} résultat{Object.keys(a.resultats || {}).length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}