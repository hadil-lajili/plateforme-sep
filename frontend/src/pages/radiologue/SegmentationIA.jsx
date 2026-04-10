import { useState } from 'react'
import { Brain, Loader, CheckCircle, AlertTriangle } from 'lucide-react'

export default function SegmentationIA({ irmId, irmPath, onTermine }) {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const [loading, setLoading] = useState(false)
  const [resultats, setResultats] = useState(null)
  const [erreur, setErreur] = useState(null)

  const lancer = async () => {
    setLoading(true)
    setErreur(null)
    try {
      const res = await fetch(`/api/predictions/segmentation/${irmId}`, {
        method: 'POST', headers
      })
      if (res.ok) {
        const data = await res.json()
        setResultats(data)
        if (onTermine) onTermine(data)
      } else {
        const err = await res.json()
        setErreur(err.detail)
      }
    } catch (e) {
      setErreur('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'white', borderRadius: '12px',
      border: '1px solid #e2e8f0', padding: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Brain size={22} color="#8b5cf6" />
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Segmentation IA des lésions</h3>
        <span style={{
          background: '#f3f4f6', color: '#6b7280',
          padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600
        }}>U-Net • Dice 0.648</span>
      </div>

      {!resultats && !loading && (
        <div>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
            Le modèle U-Net va analyser toutes les coupes de cette IRM FLAIR
            et détecter automatiquement les lésions de la SEP.
          </p>
          <button onClick={lancer} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: '10px', border: 'none',
            background: '#8b5cf6', color: 'white', cursor: 'pointer', fontWeight: 600
          }}>
            <Brain size={18} /> Lancer la segmentation
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#8b5cf6' }}>
          <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
          <div>
            <div style={{ fontWeight: 600 }}>Analyse en cours...</div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              Le modèle analyse chaque coupe IRM. Cela peut prendre 1-2 minutes.
            </div>
          </div>
        </div>
      )}

      {erreur && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px',
          background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca'
        }}>
          ❌ {erreur}
        </div>
      )}

      {resultats && (
        <div>
          {/* Niveau d'alerte */}
          <div style={{
            padding: '14px 18px', borderRadius: '10px', marginBottom: '16px',
            background: resultats.interpretation.couleur + '15',
            border: `1px solid ${resultats.interpretation.couleur}40`,
            display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            {resultats.interpretation.niveau === 'aucune'
              ? <CheckCircle size={20} color={resultats.interpretation.couleur} />
              : <AlertTriangle size={20} color={resultats.interpretation.couleur} />
            }
            <span style={{ color: resultats.interpretation.couleur, fontWeight: 600, fontSize: '14px' }}>
              {resultats.interpretation.message}
            </span>
          </div>

          {/* Métriques */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: 'Volume lésions', value: `${resultats.resultats.volume_lesions_voxels} voxels` },
              { label: 'Coupes touchées', value: `${resultats.resultats.n_coupes_touchees}/${resultats.resultats.n_coupes_total}` },
              { label: 'Pourcentage', value: `${resultats.resultats.pourcentage_coupes}%` },
            ].map(m => (
              <div key={m.label} style={{
                background: '#f8fafc', borderRadius: '8px', padding: '12px', textAlign: 'center'
              }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}