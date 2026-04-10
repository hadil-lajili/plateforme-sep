import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'

export default function ComparaisonIRM({ patientId, irms }) {
  const [irm1, setIrm1] = useState('')
  const [irm2, setIrm2] = useState('')
  const [coupe, setCoupe] = useState(100)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sliderPos, setSliderPos] = useState(50)
  const containerRef = useRef(null)
  const isDragging = useRef(false)

  const charger = async () => {
    if (!irm1 || !irm2) return
    setLoading(true)
    try {
      const res = await api.get(
        `/patients/${patientId}/irm/comparer/?irm1_id=${irm1}&irm2_id=${irm2}&coupe=${coupe}`
      )
      setData(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (irm1 && irm2) charger()
  }, [coupe])

  const handleMouseMove = (e) => {
    if (!isDragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPos(pct)
  }

  const irms_flair = irms.filter(i => i.sequence_type === 'FLAIR')

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: '#1e293b' }}>
        🔍 Comparaison IRM — Avant / Après
      </h3>

      {/* Sélection des IRM */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
            IRM 1 (Avant)
          </label>
          <select
            value={irm1}
            onChange={e => setIrm1(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
          >
            <option value="">Sélectionner...</option>
            {irms_flair.map(irm => (
              <option key={irm.id} value={irm.id}>
                FLAIR — {new Date(irm.uploaded_at).toLocaleDateString('fr-FR')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
            IRM 2 (Après)
          </label>
          <select
            value={irm2}
            onChange={e => setIrm2(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
          >
            <option value="">Sélectionner...</option>
            {irms_flair.map(irm => (
              <option key={irm.id} value={irm.id}>
                FLAIR — {new Date(irm.uploaded_at).toLocaleDateString('fr-FR')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
            Coupe : {coupe}
          </label>
          <input
            type="range" min="0" max="300" value={coupe}
            onChange={e => setCoupe(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <button
        onClick={charger}
        disabled={!irm1 || !irm2 || loading}
        style={{
          padding: '10px 24px', borderRadius: '8px', border: 'none',
          background: (!irm1 || !irm2) ? '#e2e8f0' : '#3b82f6',
          color: (!irm1 || !irm2) ? '#94a3b8' : 'white',
          fontWeight: 600, cursor: (!irm1 || !irm2) ? 'not-allowed' : 'pointer',
          marginBottom: '20px'
        }}
      >
        {loading ? '⏳ Chargement...' : '🔍 Comparer'}
      </button>

      {/* Visualisation avec slider */}
      {data && (
        <div>
          {/* Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#3b82f6' }}>
              ← IRM Avant ({data.irm1.sequence_type})
            </span>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Coupe {data.coupe}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>
              IRM Après ({data.irm2.sequence_type}) →
            </span>
          </div>

          {/* Conteneur comparaison */}
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              width: '100%',
              height: '400px',
              borderRadius: '12px',
              overflow: 'hidden',
              cursor: 'ew-resize',
              userSelect: 'none',
              background: '#000'
            }}
            onMouseDown={() => isDragging.current = true}
            onMouseUp={() => isDragging.current = false}
            onMouseLeave={() => isDragging.current = false}
            onMouseMove={handleMouseMove}
          >
            {/* Image 2 (Après) — fond */}
            <img
              src={data.irm2.image}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                objectFit: 'contain'
              }}
              alt="IRM Après"
            />

            {/* Image 1 (Avant) — masquée par clip */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: `${sliderPos}%`, height: '100%',
              overflow: 'hidden'
            }}>
              <img
                src={data.irm1.image}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: `${100 / (sliderPos / 100)}%`,
                  height: '100%',
                  objectFit: 'contain'
                }}
                alt="IRM Avant"
              />
            </div>

            {/* Ligne séparatrice */}
            <div style={{
              position: 'absolute', top: 0,
              left: `${sliderPos}%`,
              transform: 'translateX(-50%)',
              width: '3px', height: '100%',
              background: 'white',
              boxShadow: '0 0 8px rgba(0,0,0,0.8)'
            }} />

            {/* Poignée slider */}
            <div style={{
              position: 'absolute',
              top: '50%', left: `${sliderPos}%`,
              transform: 'translate(-50%, -50%)',
              width: '40px', height: '40px',
              borderRadius: '50%',
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px'
            }}>
              ↔
            </div>

            {/* Labels sur l'image */}
            <div style={{
              position: 'absolute', top: '12px', left: '12px',
              background: 'rgba(59,130,246,0.8)',
              color: 'white', padding: '4px 10px',
              borderRadius: '6px', fontSize: '12px', fontWeight: 600
            }}>
              AVANT
            </div>
            <div style={{
              position: 'absolute', top: '12px', right: '12px',
              background: 'rgba(239,68,68,0.8)',
              color: 'white', padding: '4px 10px',
              borderRadius: '6px', fontSize: '12px', fontWeight: 600
            }}>
              APRÈS
            </div>
          </div>

          {/* Slider manuel */}
          <div style={{ marginTop: '12px' }}>
            <input
              type="range" min="0" max="100" value={sliderPos}
              onChange={e => setSliderPos(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
              <span>← Avant</span>
              <span>Après →</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}