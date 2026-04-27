import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Layers, Box, ChevronLeft, ChevronRight } from 'lucide-react'

export default function ViewerIRM({ patientId, irmId, sequenceType }) {
  const canvasRef = useRef(null)
  const niivueRef = useRef(null)
  const [mode, setMode] = useState('2D') // '2D' ou '3D'
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [slice, setSlice] = useState(0)
  const [totalSlices, setTotalSlices] = useState(0)
  const [plein, setPlein] = useState(false)

  const token = localStorage.getItem('token')
  const API_BASE = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    chargerViewer()
    return () => {
      if (niivueRef.current) {
        niivueRef.current = null
      }
    }
  }, [irmId, mode])

  const chargerViewer = async () => {
    setLoading(true)
    setErreur(null)
    try {
      // D'abord vérifier si l'IRM existe
      const checkResponse = await fetch(`${API_BASE}/api/patients/${patientId}/irm/${irmId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!checkResponse.ok) {
        setErreur("Aucune IRM trouvée pour ce patient")
        setLoading(false)
        return
      }

      const irmData = await checkResponse.json()
      
      // Vérifier si l'IRM a un fichier
      if (!irmData.gridfs_id) {
        setErreur("Aucun fichier IRM disponible pour cette IRM")
        setLoading(false)
        return
      }

      const { Niivue, SLICE_TYPE } = await import('@niivue/niivue')

      if (niivueRef.current) {
        niivueRef.current = null
      }

      // Télécharger le fichier via fetch authentifié puis créer un blob URL local
      const fichierResp = await fetch(`${API_BASE}/api/patients/${patientId}/irm/${irmId}/fichier`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!fichierResp.ok) {
        setErreur("Impossible de télécharger le fichier IRM")
        setLoading(false)
        return
      }
      const blob = await fichierResp.blob()
      const blobUrl = URL.createObjectURL(blob)

      const nv = new Niivue({
        show3Dcrosshair: true,
        backColor: [0, 0, 0, 1],
        crosshairColor: [1, 0, 0, 1],
        isColorbar: true,
      })

      niivueRef.current = nv
      await nv.attachToCanvas(canvasRef.current)

      const nomFichier = `${sequenceType || 'IRM'}.nii`
      await nv.loadVolumes([{
        url: blobUrl,
        name: nomFichier,
        colormap: 'gray',
        opacity: 1,
      }])
      URL.revokeObjectURL(blobUrl)

      // Auto-fenêtrage : percentiles 2%-98% pour éviter la saturation
      const vol0 = nv.volumes[0]
      if (vol0) {
        const img = vol0.img
        const sorted = Float32Array.from(img).filter(v => v > 0).sort()
        if (sorted.length > 0) {
          const lo = sorted[Math.floor(sorted.length * 0.02)]
          const hi = sorted[Math.floor(sorted.length * 0.98)]
          vol0.cal_min = lo
          vol0.cal_max = hi
          nv.updateGLVolume()
        }
      }

      // Configurer le mode
      if (mode === '3D') {
        nv.setSliceType(SLICE_TYPE.RENDER)
      } else {
        nv.setSliceType(SLICE_TYPE.MULTIPLANAR)
      }

      const vol = nv.volumes[0]
      if (vol && vol.dims) {
        const nz = vol.dims[3] ?? vol.dims[2] ?? 0
        setTotalSlices(nz)
        setSlice(Math.floor(nz / 2))
      }

      setLoading(false)
    } catch (e) {
      console.error(e)
      if (e.message && e.message.includes('404')) {
        setErreur("Aucun fichier IRM disponible")
      } else if (e.message && e.message.includes('Not Found')) {
        setErreur("Aucun fichier IRM disponible")
      } else {
        setErreur('Erreur lors du chargement de l\'IRM')
      }
      setLoading(false)
    }
  }

  const changerSlice = (delta) => {
    if (!niivueRef.current) return
    const newSlice = Math.max(0, Math.min(totalSlices - 1, slice + delta))
    setSlice(newSlice)
    niivueRef.current.scene.crosshairPos[2] = newSlice / totalSlices
    niivueRef.current.drawScene()
  }

  return (
    <div style={{
      background: '#000', borderRadius: '12px', overflow: 'hidden',
      position: 'relative',
      height: plein ? '80vh' : '400px',
      transition: 'height 0.3s ease'
    }}>
      {/* Toolbar */}
      <div style={{
        position: 'absolute', top: '10px', left: '10px', right: '10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 10
      }}>
        {/* Infos */}
        <div style={{
          background: 'rgba(0,0,0,0.7)', borderRadius: '8px',
          padding: '6px 12px', color: 'white', fontSize: '12px',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>{sequenceType || 'IRM'}</span>
          {totalSlices > 0 && <span style={{ color: '#94a3b8' }}>Coupe {slice + 1}/{totalSlices}</span>}
        </div>

        {/* Contrôles */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setMode(mode === '2D' ? '3D' : '2D')}
            style={{
              background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px', padding: '6px 12px', color: 'white',
              cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
            {mode === '2D' ? <><Box size={14} /> 3D</> : <><Layers size={14} /> 2D</>}
          </button>
          <button
            onClick={() => setPlein(!plein)}
            style={{
              background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px', padding: '6px 10px', color: 'white', cursor: 'pointer'
            }}>
            {plein ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Canvas Niivue */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: loading || erreur ? 'none' : 'block' }}
      />

      {/* Loading */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: 'white'
        }}>
          <div style={{
            width: '40px', height: '40px', border: '3px solid #1e3a5f',
            borderTop: '3px solid #38bdf8', borderRadius: '50%',
            animation: 'spin 1s linear infinite', marginBottom: '12px'
          }} />
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>Chargement de l'IRM...</p>
        </div>
      )}

      {/* Erreur */}
      {erreur && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: 'white', padding: '24px'
        }}>
          <p style={{ color: '#ef4444', fontSize: '14px', textAlign: 'center' }}>❌ {erreur}</p>
          <button onClick={chargerViewer} style={{
            marginTop: '12px', padding: '8px 16px', borderRadius: '8px',
            background: '#1e3a5f', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px'
          }}>Réessayer</button>
        </div>
      )}

      {/* Navigation coupes (mode 2D) */}
      {!loading && !erreur && mode === '2D' && totalSlices > 0 && (
        <div style={{
          position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(0,0,0,0.7)', borderRadius: '20px', padding: '6px 12px'
        }}>
          <button onClick={() => changerSlice(-1)} style={{
            background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px'
          }}>
            <ChevronLeft size={18} />
          </button>
          <input
            type="range" min="0" max={totalSlices - 1} value={slice}
            onChange={e => { setSlice(Number(e.target.value)); changerSlice(0) }}
            style={{ width: '120px', accentColor: '#38bdf8' }}
          />
          <button onClick={() => changerSlice(1)} style={{
            background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px'
          }}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}