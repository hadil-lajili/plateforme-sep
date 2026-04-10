import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FlaskConical, CheckCircle, Clock, Edit3, Save } from 'lucide-react'

export default function Resultats() {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [message, setMessage] = useState('')

  useEffect(() => { charger() }, [])

  const charger = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analyses/', { headers })
      const data = await res.json()
      setAnalyses(Array.isArray(data) ? data.filter(a => Object.keys(a.resultats || {}).length > 0) : [])
    } finally {
      setLoading(false)
    }
  }

  const sauvegarder = async (id) => {
    try {
      await fetch(`/api/analyses/${id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ resultats: editData.resultats, notes: editData.notes, statut: 'termine' })
      })
      setMessage('✅ Résultats sauvegardés')
      setEditId(null)
      setTimeout(() => setMessage(''), 3000)
      charger()
    } catch {
      setMessage('❌ Erreur')
    }
  }

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Résultats</h1>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>Analyses avec résultats enregistrés</p>

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: message.includes('✅') ? '#f0fdf4' : '#fef2f2',
          color: message.includes('✅') ? '#166534' : '#991b1b',
          border: `1px solid ${message.includes('✅') ? '#bbf7d0' : '#fecaca'}`
        }}>{message}</div>
      )}

      {loading ? <p style={{ color: '#64748b' }}>Chargement...</p> : analyses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <FlaskConical size={48} color="#94a3b8" style={{ margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: '#64748b' }}>Aucun résultat disponible</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {analyses.map(a => (
            <div key={a.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>{a.patient_nom}</span>
                  <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '12px' }}>{a.type_analyse?.replace('_', ' ')}</span>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '12px' }}>
                    {new Date(a.date_analyse).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                    background: a.statut === 'termine' ? '#f0fdf4' : '#fffbeb',
                    color: a.statut === 'termine' ? '#166534' : '#92400e'
                  }}>
                    {a.statut === 'termine' ? <><CheckCircle size={13} /> Terminée</> : <><Clock size={13} /> En attente</>}
                  </span>
                  {editId !== a.id ? (
                    <button onClick={() => { setEditId(a.id); setEditData({ resultats: { ...a.resultats }, notes: a.notes || '' }) }} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
                      background: 'white', cursor: 'pointer', fontSize: '13px', color: '#475569'
                    }}>
                      <Edit3 size={14} /> Modifier
                    </button>
                  ) : (
                    <button onClick={() => sauvegarder(a.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '8px', border: 'none',
                      background: '#22c55e', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                    }}>
                      <Save size={14} /> Sauvegarder
                    </button>
                  )}
                </div>
              </div>

              {/* Résultats */}
              <div style={{ padding: '16px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                  {Object.entries(editId === a.id ? editData.resultats : (a.resultats || {})).map(([key, val]) => (
                    <div key={key} style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{key}</div>
                      {editId === a.id ? (
                        <input value={val} onChange={e => setEditData(d => ({ ...d, resultats: { ...d.resultats, [key]: e.target.value } }))}
                          style={{ width: '100%', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{val || '—'}</div>
                      )}
                    </div>
                  ))}
                </div>
                {(editId === a.id ? editData.notes : a.notes) && (
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Notes</div>
                    {editId === a.id ? (
                      <textarea value={editData.notes} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
                        rows={2} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontSize: '13px', color: '#475569' }}>{a.notes}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}