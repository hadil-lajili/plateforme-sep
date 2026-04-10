import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Activity, Plus, X } from 'lucide-react'

export default function Visites() {
  const { user } = useAuth()
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [patients, setPatients] = useState([])
  const [visites, setVisites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    patient_id: '', date_visite: '', edss_score: '', motif: '', notes: ''
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    chargerDonnees()
  }, [])

  const chargerDonnees = async () => {
    setLoading(true)
    try {
      const resP = await fetch('http://localhost:8000/api/patients?limit=100', { headers })
      const dataP = await resP.json()
      const listePatients = dataP.data || []
      setPatients(listePatients)

      // Charger les visites de tous les patients
      const toutesVisites = []
      for (const p of listePatients) {
        const resV = await fetch(`http://localhost:8000/api/patients/${p.id}/visites`, { headers })
        const dataV = await resV.json()
        const liste = Array.isArray(dataV) ? dataV : (dataV.data || [])
        liste.forEach(v => toutesVisites.push({
          ...v,
          patient_nom: `${p.prenom} ${p.nom}`,
          patient_id: p.id
        }))
      }
      // Trier par date décroissante
      toutesVisites.sort((a, b) => new Date(b.date_visite) - new Date(a.date_visite))
      setVisites(toutesVisites)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const creerVisite = async () => {
    if (!form.patient_id || !form.date_visite) {
      setMessage('⚠️ Patient et date sont obligatoires')
      return
    }
    try {
      const body = {
        date_visite: form.date_visite,
        motif: form.motif,
        notes: form.notes,
        edss_score: form.edss_score ? parseFloat(form.edss_score) : null,
      }
      const res = await fetch(`http://localhost:8000/api/patients/${form.patient_id}/visites`, {
        method: 'POST', headers, body: JSON.stringify(body)
      })
      if (res.ok) {
        setMessage('✅ Visite créée avec succès')
        setShowForm(false)
        setForm({ patient_id: '', date_visite: '', edss_score: '', motif: '', notes: '' })
        setTimeout(() => setMessage(''), 3000)
        chargerDonnees()
      } else {
        const err = await res.json()
        setMessage('❌ ' + (err.detail || 'Erreur'))
      }
    } catch (e) {
      setMessage('❌ Erreur de connexion')
    }
  }

  const edssColor = (score) => {
    if (score <= 2) return { bg: '#f0fdf4', color: '#166534' }
    if (score <= 4) return { bg: '#fffbeb', color: '#92400e' }
    return { bg: '#fef2f2', color: '#991b1b' }
  }

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Visites cliniques</h1>
          <p style={{ color: '#64748b' }}>{visites.length} visite{visites.length > 1 ? 's' : ''} enregistrée{visites.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 20px', borderRadius: '10px', border: 'none',
          background: '#0f172a', color: 'white', cursor: 'pointer', fontWeight: 600
        }}>
          <Plus size={18} /> Nouvelle visite
        </button>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: message.includes('✅') ? '#f0fdf4' : message.includes('⚠️') ? '#fffbeb' : '#fef2f2',
          color: message.includes('✅') ? '#166534' : message.includes('⚠️') ? '#92400e' : '#991b1b',
          border: `1px solid ${message.includes('✅') ? '#bbf7d0' : message.includes('⚠️') ? '#fde68a' : '#fecaca'}`
        }}>
          {message}
        </div>
      )}

      {/* Formulaire nouvelle visite */}
      {showForm && (
        <div style={{
          background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
          padding: '24px', marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700 }}>Nouvelle visite</h2>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color="#64748b" />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Patient *
              </label>
              <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}>
                <option value="">Sélectionner un patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Date de visite *
              </label>
              <input type="datetime-local" value={form.date_visite}
                onChange={e => setForm(f => ({ ...f, date_visite: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Score EDSS (0–10)
              </label>
              <input type="number" min="0" max="10" step="0.5" placeholder="Ex: 3.5"
                value={form.edss_score} onChange={e => setForm(f => ({ ...f, edss_score: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Motif
              </label>
              <input type="text" placeholder="Motif de la visite"
                value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Notes cliniques
              </label>
              <textarea rows={3} placeholder="Observations, notes..."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button onClick={() => setShowForm(false)} style={{
              padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0',
              background: 'white', cursor: 'pointer', fontSize: '14px', color: '#475569'
            }}>
              Annuler
            </button>
            <button onClick={creerVisite} style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: '#0f172a', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '14px'
            }}>
              Créer la visite
            </button>
          </div>
        </div>
      )}

      {/* Liste des visites */}
      {loading ? (
        <p style={{ color: '#64748b' }}>Chargement...</p>
      ) : visites.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <Activity size={48} color="#94a3b8" style={{ margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: '#64748b' }}>Aucune visite enregistrée</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Patient', 'Date', 'Motif', 'Score EDSS', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visites.map((v, i) => (
                <tr key={v.id || i} style={{ borderBottom: i < visites.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>{v.patient_nom}</td>
                  <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                    {v.date_visite ? new Date(v.date_visite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#475569', fontSize: '14px' }}>{v.motif || '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {v.edss_score != null ? (
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                        ...edssColor(v.edss_score)
                      }}>
                        {v.edss_score}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}