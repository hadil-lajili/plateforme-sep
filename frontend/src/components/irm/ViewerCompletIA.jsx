import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Loader, X, Maximize2, Minimize2 } from 'lucide-react'

export default function ViewerCompletIA({ irmId, onClose }) {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const API_BASE = import.meta.env.VITE_API_URL || ''

  const [nCoupes, setNCoupes] = useState(0)
  const [slice, setSlice] = useState(0)
  const [showOverlay, setShowOverlay] = useState(false)
  const [plein, setPlein] = useState(false)

  const [origSrc, setOrigSrc] = useState(null)
  const [overlaySrc, setOverlaySrc] = useState(null)
  const [origLoading, setOrigLoading] = useState(false)
  const [overlayLoading, setOverlayLoading] = useState(false)
  const [nLesions, setNLesions] = useState(null)

  const debounceRef = useRef(null)

  // Charger infos au montage
  useEffect(() => {
    fetch(`${API_BASE}/api/predictions/viewer/${irmId}/info`, { headers })
      .then(r => r.json())
      .then(d => {
        setNCoupes(d.n_coupes || 0)
        setSlice(Math.floor((d.n_coupes || 0) / 2))
      })
      .catch(() => {})
  }, [irmId])

  // Charger la coupe originale dès que slice change
  useEffect(() => {
    if (!nCoupes) return
    setOrigSrc(null)
    setOrigLoading(true)
    fetch(`${API_BASE}/api/predictions/viewer/${irmId}/coupe/${slice}`, { headers })
      .then(r => r.json())
      .then(d => { setOrigSrc(d.image); setOrigLoading(false) })
      .catch(() => setOrigLoading(false))
  }, [irmId, slice, nCoupes])

  // Charger overlay avec debounce (300ms) si activé
  useEffect(() => {
    if (!showOverlay || !nCoupes) return
    setOverlaySrc(null)
    setOverlayLoading(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetch(`${API_BASE}/api/predictions/viewer/${irmId}/overlay/${slice}`, { headers })
        .then(r => r.json())
        .then(d => {
          setOverlaySrc(d.image)
          setNLesions(d.n_lesions ?? null)
          setOverlayLoading(false)
        })
        .catch(() => setOverlayLoading(false))
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [irmId, slice, showOverlay, nCoupes])

  // Reset overlay quand on le désactive
  useEffect(() => {
    if (!showOverlay) { setOverlaySrc(null); setNLesions(null) }
  }, [showOverlay])

  const changer = useCallback((delta) => {
    setSlice(s => Math.max(0, Math.min(nCoupes - 1, s + delta)))
  }, [nCoupes])

  const pct = nCoupes > 0 ? Math.round((slice / (nCoupes - 1)) * 100) : 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#0f172a', borderRadius: '16px', overflow: 'hidden',
        width: plein ? '100%' : '900px', maxWidth: '100%',
        maxHeight: plein ? '100%' : '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #1e293b',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px' }}>
              IRM complète — Coupe {slice + 1} / {nCoupes}
            </span>
            {nLesions !== null && (
              <span style={{
                background: nLesions > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                color: nLesions > 0 ? '#f87171' : '#4ade80',
                padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
              }}>
                {nLesions > 0 ? `🔴 ${nLesions} px détectés` : '✓ Aucune lésion'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setPlein(p => !p)} style={btnStyle}>
              {plein ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            {onClose && (
              <button onClick={onClose} style={btnStyle}>
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Images */}
        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: showOverlay ? '1fr 1fr' : '1fr',
          gap: 0, overflow: 'hidden', minHeight: 0,
        }}>
          {/* Coupe originale */}
          <div style={{ position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {origLoading
              ? <Loader size={28} color="#38bdf8" style={{ animation: 'spin 1s linear infinite' }} />
              : origSrc
                ? <img src={origSrc} alt="IRM originale" style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                : <span style={{ color: '#475569', fontSize: '13px' }}>Chargement…</span>
            }
            <span style={labelStyle}>IRM originale</span>
          </div>

          {/* Overlay IA */}
          {showOverlay && (
            <div style={{ position: 'relative', background: '#000', borderLeft: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {overlayLoading
                ? <div style={{ textAlign: 'center' }}>
                    <Loader size={28} color="#ef4444" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px' }}>Analyse IA…</p>
                  </div>
                : overlaySrc
                  ? <img src={overlaySrc} alt="Lésions IA" style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                  : <span style={{ color: '#475569', fontSize: '13px' }}>En attente…</span>
              }
              <span style={{ ...labelStyle, background: 'rgba(239,68,68,0.8)' }}>Lésions IA</span>
            </div>
          )}
        </div>

        {/* Contrôles */}
        <div style={{
          padding: '16px 20px', borderTop: '1px solid #1e293b',
          display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0,
          background: '#0f172a',
        }}>
          {/* Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => changer(-1)} disabled={slice === 0} style={navBtn(slice === 0)}>
              <ChevronLeft size={18} />
            </button>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="range" min={0} max={Math.max(0, nCoupes - 1)} value={slice}
                onChange={e => setSlice(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', color: '#475569' }}>0</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                  Coupe {slice + 1} — {pct}%
                </span>
                <span style={{ fontSize: '10px', color: '#475569' }}>{nCoupes}</span>
              </div>
            </div>
            <button onClick={() => changer(1)} disabled={slice >= nCoupes - 1} style={navBtn(slice >= nCoupes - 1)}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Toggle overlay */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Utilisez le slider ou les flèches du clavier pour naviguer
            </span>
            <button
              onClick={() => setShowOverlay(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: showOverlay ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
                color: showOverlay ? '#f87171' : '#818cf8',
                fontWeight: 600, fontSize: '13px', transition: 'all 0.2s',
              }}
            >
              {showOverlay ? <EyeOff size={15} /> : <Eye size={15} />}
              {showOverlay ? 'Masquer les lésions IA' : 'Afficher les lésions IA'}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const btnStyle = {
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px', padding: '6px 8px', color: '#94a3b8', cursor: 'pointer',
  display: 'flex', alignItems: 'center',
}
const navBtn = (disabled) => ({
  background: disabled ? 'transparent' : 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px', padding: '6px', color: disabled ? '#334155' : '#94a3b8',
  cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
})
const labelStyle = {
  position: 'absolute', top: '8px', left: '8px',
  background: 'rgba(0,0,0,0.7)', color: '#e2e8f0',
  fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '5px',
}
