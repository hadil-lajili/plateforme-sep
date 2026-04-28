import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

export default function Visualisation3D({ patientId, irmId }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    if (!mountRef.current) return

    // ── Setup Three.js ──
    const width = mountRef.current.clientWidth
    const height = 450

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setClearColor(0x0a0a1a, 1)
    mountRef.current.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100)
    camera.position.set(0, 0, 3)

    // Lumières
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const light = new THREE.DirectionalLight(0xffffff, 0.8)
    light.position.set(5, 5, 5)
    scene.add(light)

    // Grille de référence
    const gridHelper = new THREE.GridHelper(2, 10, 0x333366, 0x222244)
    gridHelper.position.y = -1
    scene.add(gridHelper)

    sceneRef.current = { scene, camera, renderer }

    // Animation rotation
    let rotY = 0
    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      rotY += 0.005
      scene.rotation.y = rotY
      renderer.render(scene, camera)
    }
    animate()

    // Drag pour rotation manuelle
    let isDragging = false
    let prevX = 0
    const onMouseDown = (e) => { isDragging = true; prevX = e.clientX }
    const onMouseUp = () => { isDragging = false }
    const onMouseMove = (e) => {
      if (!isDragging) return
      const dx = e.clientX - prevX
      rotY += dx * 0.01
      prevX = e.clientX
    }
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)

    return () => {
      cancelAnimationFrame(animId)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  const charger3D = async () => {
    if (!irmId || !sceneRef.current) return
    setLoading(true)
    setErreur(null)

    try {
      const token = localStorage.getItem('token')
      const API_BASE = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${API_BASE}/api/predictions/lesions3d/${irmId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('Erreur serveur')
      const data = await res.json()

      const { scene } = sceneRef.current

      // Supprimer anciens points
      const toRemove = []
      scene.traverse(obj => {
        if (obj.userData.type === 'lesion' || obj.userData.type === 'cerveau')
          toRemove.push(obj)
      })
      toRemove.forEach(obj => scene.remove(obj))

      // ── Points cerveau (gris transparent) ──
      if (data.cerveau.length > 0) {
        const geo = new THREE.BufferGeometry()
        const positions = new Float32Array(data.cerveau.flat())
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        const mat = new THREE.PointsMaterial({
          color: 0x4488aa,
          size: 0.015,
          transparent: true,
          opacity: 0.25
        })
        const points = new THREE.Points(geo, mat)
        points.userData.type = 'cerveau'
        scene.add(points)
      }

      // ── Points lésions (rouge brillant) ──
      if (data.lesions.length > 0) {
        const geo = new THREE.BufferGeometry()
        const positions = new Float32Array(data.lesions.flat())
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        const mat = new THREE.PointsMaterial({
          color: 0xff2244,
          size: 0.04,
          transparent: true,
          opacity: 0.9
        })
        const points = new THREE.Points(geo, mat)
        points.userData.type = 'lesion'
        scene.add(points)
      }

      setStats({
        n_lesions: data.n_lesions,
        n_points_cerveau: data.cerveau.length
      })

    } catch (e) {
      setErreur('Erreur lors du chargement 3D')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'white', borderRadius: '16px',
      border: '1px solid #e2e8f0', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            🧠 Visualisation 3D des Lésions
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            Points bleus = cerveau · Points rouges = lésions prédites
          </p>
        </div>
        <button
          onClick={charger3D}
          disabled={!irmId || loading}
          style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none',
            background: !irmId ? '#e2e8f0' : '#6366f1',
            color: !irmId ? '#94a3b8' : 'white',
            fontWeight: 600, cursor: !irmId ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {loading ? '⏳ Génération...' : '🔮 Générer 3D'}
        </button>
      </div>

      {/* Canvas 3D */}
      <div style={{ position: 'relative', background: '#0a0a1a' }}>
        <div ref={mountRef} style={{ width: '100%', height: '450px' }} />

        {/* Overlay loading */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(10,10,26,0.85)'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              border: '4px solid #6366f1',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ color: '#a5b4fc', marginTop: '16px', fontSize: '14px' }}>
              Analyse des lésions en cours...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Pas d'IRM sélectionnée */}
        {!irmId && !loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🧠</div>
            <p style={{ color: '#4488aa', fontSize: '14px' }}>
              Sélectionnez une IRM FLAIR pour visualiser les lésions en 3D
            </p>
          </div>
        )}

        {/* Instructions */}
        {stats && (
          <div style={{
            position: 'absolute', bottom: '12px', left: '12px',
            background: 'rgba(0,0,0,0.6)',
            color: '#94a3b8', padding: '6px 12px',
            borderRadius: '6px', fontSize: '11px'
          }}>
            🖱️ Cliquer-glisser pour tourner
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div style={{
          padding: '16px 24px',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px', borderTop: '1px solid #f1f5f9'
        }}>
          <div style={{ textAlign: 'center', padding: '12px', background: '#fef2f2', borderRadius: '10px' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#ef4444', margin: 0 }}>
              {stats.n_lesions}
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Points lésions</p>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#eff6ff', borderRadius: '10px' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#3b82f6', margin: 0 }}>
              {stats.n_points_cerveau}
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Points cerveau</p>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '10px' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#22c55e', margin: 0 }}>
              {stats.n_lesions > 0 ? '⚠️' : '✅'}
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
              {stats.n_lesions > 0 ? 'Lésions détectées' : 'Aucune lésion'}
            </p>
          </div>
        </div>
      )}

      {erreur && (
        <div style={{ padding: '16px 24px', color: '#ef4444', fontSize: '13px' }}>
          ❌ {erreur}
        </div>
      )}
    </div>
  )
}