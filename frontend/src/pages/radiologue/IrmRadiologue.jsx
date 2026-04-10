import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Eye, FileText, CheckCircle, Clock, Search, Brain, Loader, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function IrmRadiologue() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [irms, setIrms] = useState([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('tous')

  /*const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }*/

  useEffect(() => { chargerIrms() }, [])

  const chargerIrms = async () => {
    setLoading(true)
    try {
      const resPatients = await api.get('/patients/?limit=100')
      const patients = resPatients.data.data || []
      const toutesIrms = []
      for (const patient of patients) {
        const resIrm = await api.get(`/patients/${patient.id}/irm/`)
        const irmsPatient = resIrm.data.data || []
        irmsPatient.forEach(irm => {
          toutesIrms.push({ ...irm, patient_nom: `${patient.prenom} ${patient.nom}`, patient_id: patient.id })
        })
    }
    setIrms(toutesIrms)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  

  const irmsFiltrees = irms.filter(irm => {
    const matchRecherche = irm.patient_nom?.toLowerCase().includes(recherche.toLowerCase())
    const matchStatut = filtreStatut === 'tous' || (filtreStatut === 'analyse' ? irm.rapport : !irm.rapport)
    return matchRecherche && matchStatut
  })

  const sequenceColor = {
    FLAIR: '#3b82f6', T1: '#8b5cf6', T2: '#10b981',
    DWI: '#f59e0b', T1_GADOLINIUM: '#ef4444'
  }

  const niveauCouleur = {
    aucune: '#22c55e', faible: '#84cc16', modere: '#f59e0b', eleve: '#ef4444'
  }

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>File d'IRM</h1>
        <p style={{ color: '#64748b' }}>Images à analyser et rapports radiologiques</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total IRM', value: irms.length, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'En attente', value: irms.filter(i => !i.rapport).length, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Analysées', value: irms.filter(i => i.rapport).length, color: '#22c55e', bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white', borderRadius: '12px', padding: '20px 24px',
            border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: s.bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: s.color
            }}>{s.value}</div>
            <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
          padding: '8px 14px', flex: 1, maxWidth: '320px'
        }}>
          <Search size={16} color="#94a3b8" />
          <input
            placeholder="Rechercher un patient..."
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '14px', width: '100%', color: '#0f172a' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { key: 'tous', label: 'Toutes' },
            { key: 'attente', label: '⏳ En attente' },
            { key: 'analyse', label: '✅ Analysées' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltreStatut(f.key)} style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              cursor: 'pointer', fontWeight: 500, fontSize: '13px',
              background: filtreStatut === f.key ? '#0f172a' : '#f1f5f9',
              color: filtreStatut === f.key ? 'white' : '#64748b',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Liste IRM */}
      {loading ? (
        <p style={{ color: '#64748b' }}>Chargement des IRM...</p>
      ) : irmsFiltrees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>Aucune IRM trouvée</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {irmsFiltrees.map(irm => {
            const dejaSegmente = irm.rapport?.segmentation_ia

            return (
              <div key={irm.id} style={{
                background: 'white', borderRadius: '12px',
                border: '1px solid #e2e8f0', overflow: 'hidden'
              }}>
                {/* Ligne principale */}
                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '12px',
                      background: (sequenceColor[irm.sequence_type] || '#94a3b8') + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700,
                      color: sequenceColor[irm.sequence_type] || '#94a3b8'
                    }}>{irm.sequence_type}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{irm.patient_nom}</div>
                      <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                        {irm.metadata?.dimensions
                          ? `${irm.metadata.dimensions[0]}×${irm.metadata.dimensions[1]}×${irm.metadata.dimensions[2]} voxels`
                          : 'Dimensions inconnues'}
                        {irm.metadata?.taille_mb && ` • ${irm.metadata.taille_mb} MB`}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                        Uploadé le {irm.uploaded_at ? new Date(irm.uploaded_at).toLocaleDateString('fr-FR') : '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Statut */}
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                      background: irm.rapport ? '#f0fdf4' : '#fffbeb',
                      color: irm.rapport ? '#166534' : '#92400e'
                    }}>
                      {irm.rapport ? <><CheckCircle size={13} /> Analysée</> : <><Clock size={13} /> En attente</>}
                    </span>


                    {/* Bouton rapport */}
                    <button
                      onClick={() => navigate(`/rapports/${irm.id}`, { state: { irm } })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', borderRadius: '8px', border: 'none',
                        background: irm.rapport ? '#f1f5f9' : '#0f172a',
                        color: irm.rapport ? '#475569' : 'white',
                        cursor: 'pointer', fontWeight: 600, fontSize: '13px'
                      }}>
                      {irm.rapport ? <><Eye size={15} /> Voir rapport</> : <><FileText size={15} /> Rédiger rapport</>}
                    </button>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}