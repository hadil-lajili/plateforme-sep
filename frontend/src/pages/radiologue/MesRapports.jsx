import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, CheckCircle, Eye } from 'lucide-react'
import api from '../../services/api'

export default function MesRapports() {
  const navigate = useNavigate()
  const [irms, setIrms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const charger = async () => {
      try {
        const pRes = await api.get('/patients/?limit=100')
        const patients = pRes.data.data || []
        const toutesIrms = []
        for (const p of patients) {
          const iRes = await api.get(`/patients/${p.id}/irm/`)
          const irmsPatient = (iRes.data.data || []).filter(i => i.rapport)
          irmsPatient.forEach(irm => toutesIrms.push({
            ...irm,
            patient_nom: `${p.prenom} ${p.nom}`,
            patient_id: p.id
          }))
        }
        toutesIrms.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
        setIrms(toutesIrms)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    charger()
  }, [])

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Mes rapports</h1>
        <p style={{ color: '#64748b' }}>{irms.length} rapport{irms.length > 1 ? 's' : ''} rédigé{irms.length > 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Chargement...</p>
      ) : irms.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px', background: 'white',
          borderRadius: '12px', border: '1px solid #e2e8f0'
        }}>
          <FileText size={48} color="#94a3b8" style={{ margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: '#64748b' }}>Aucun rapport rédigé pour l'instant</p>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '8px' }}>
            Allez dans "IRM & Imagerie" pour rédiger un rapport
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {irms.map(irm => (
            <div key={irm.id} style={{
              background: 'white', borderRadius: '12px', padding: '20px 24px',
              border: '1px solid #e2e8f0', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FileText size={20} color="#22c55e" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{irm.patient_nom}</div>
                  <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                    {irm.sequence_type} — {new Date(irm.uploaded_at).toLocaleDateString('fr-FR')}
                  </div>
                  {irm.rapport?.conclusion && (
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px', fontStyle: 'italic' }}>
                      {irm.rapport.conclusion.substring(0, 60)}...
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                  background: '#f0fdf4', color: '#166534'
                }}>
                  <CheckCircle size={13} /> Rédigé
                </span>
                <button
                  onClick={() => navigate(`/rapports/${irm.id}`, { state: { irm } })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: '#f1f5f9', color: '#475569',
                    cursor: 'pointer', fontWeight: 600, fontSize: '13px'
                  }}>
                  <Eye size={15} /> Voir rapport
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}