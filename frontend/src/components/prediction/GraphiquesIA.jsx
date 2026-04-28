import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

// ─── Jauge risque de rechute ──────────────────────────────────────────
function JaugeRisque({ score }) {
  const angle = -180 + (score / 100) * 180
  const couleur = score < 30 ? '#22c55e' : score < 60 ? '#f59e0b' : '#ef4444'
  const niveau = score < 30 ? 'Faible' : score < 60 ? 'Modéré' : 'Élevé'

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 200 110" style={{ width: '100%', maxWidth: '280px' }}>
        {/* Arc de fond */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
        {/* Arc vert */}
        <path d="M 20 100 A 80 80 0 0 1 87 24" fill="none" stroke="#22c55e" strokeWidth="16" strokeLinecap="round" opacity="0.3" />
        {/* Arc orange */}
        <path d="M 87 24 A 80 80 0 0 1 153 36" fill="none" stroke="#f59e0b" strokeWidth="16" strokeLinecap="round" opacity="0.3" />
        {/* Arc rouge */}
        <path d="M 153 36 A 80 80 0 0 1 180 100" fill="none" stroke="#ef4444" strokeWidth="16" strokeLinecap="round" opacity="0.3" />
        {/* Aiguille */}
        <line
          x1="100" y1="100"
          x2={100 + 65 * Math.cos((angle - 90) * Math.PI / 180)}
          y2={100 + 65 * Math.sin((angle - 90) * Math.PI / 180)}
          stroke={couleur} strokeWidth="3" strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="5" fill={couleur} />
        {/* Score */}
        <text x="100" y="88" textAnchor="middle" fontSize="22" fontWeight="bold" fill={couleur}>{score}</text>
        <text x="100" y="100" textAnchor="middle" fontSize="10" fill="#94a3b8">/100</text>
        {/* Labels */}
        <text x="18" y="115" fontSize="9" fill="#22c55e">Faible</text>
        <text x="82" y="18" fontSize="9" fill="#f59e0b">Modéré</text>
        <text x="155" y="115" fontSize="9" fill="#ef4444">Élevé</text>
      </svg>
      <div style={{
        display: 'inline-block', marginTop: '8px',
        padding: '4px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 700,
        background: couleur + '20', color: couleur
      }}>
        Risque {niveau}
      </div>
    </div>
  )
}

// ─── Graphique évolution EDSS ─────────────────────────────────────────
function GraphiqueEDSS({ visites }) {
  if (!visites || visites.length === 0) {
    return <p style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>Aucune visite enregistrée</p>
  }

  const data = visites.map(v => ({
    date: new Date(v.date_visite).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    edss: v.edss_score ?? null,
    motricite: v.tests_fonctionnels?.motricite ?? null,
    vision: v.tests_fonctionnels?.vision ?? null,
  })).filter(d => d.edss !== null)

  if (data.length === 0) {
    return <p style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>Aucun score EDSS enregistré</p>
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'white', border: '1px solid #e2e8f0',
          borderRadius: '8px', padding: '10px 14px', fontSize: '13px'
        }}>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{label}</p>
          {payload.map(p => (
            <p key={p.name} style={{ color: p.color }}>
              {p.name} : {p.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Léger', position: 'right', fontSize: 10, fill: '#22c55e' }} />
        <ReferenceLine y={6} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Modéré', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
        <Line
          type="monotone" dataKey="edss" name="EDSS"
          stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Carte de chaleur des lésions par région ──────────────────────────
function CarteChalleurLesions({ resultats }) {
  if (!resultats) return null

  const volume = resultats.volume_lesions_voxels
  const pct = resultats.pourcentage_coupes

  // Estimation des régions basée sur les coupes touchées
  const regions = [
    { nom: 'Périventriculaire', pct: Math.min(100, pct * 1.4), couleur: '#3b82f6' },
    { nom: 'Sous-cortical', pct: Math.min(100, pct * 0.9), couleur: '#8b5cf6' },
    { nom: 'Infratentoriel', pct: Math.min(100, pct * 0.6), couleur: '#10b981' },
    { nom: 'Corpus callosum', pct: Math.min(100, pct * 0.7), couleur: '#f59e0b' },
    { nom: 'Médullaire', pct: Math.min(100, pct * 0.3), couleur: '#ef4444' },
  ]

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
        Distribution estimée des lésions par région anatomique
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {regions.map(r => (
          <div key={r.nom}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', color: '#475569' }}>{r.nom}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: r.couleur }}>{r.pct.toFixed(0)}%</span>
            </div>
            <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                width: `${r.pct}%`,
                background: `linear-gradient(90deg, ${r.couleur}80, ${r.couleur})`,
                transition: 'width 0.8s ease'
              }} />
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px' }}>
        ⚠️ Distribution estimée à partir du volume total. Une analyse 3D détaillée nécessite une segmentation régionale.
      </p>
    </div>
  )
}

// ─── Comparaison avant/après ──────────────────────────────────────────
function ComparaisonIRM({ irms, onComparer }) {
  const [irm1, setIrm1] = useState('')
  const [irm2, setIrm2] = useState('')
  const [comparaison, setComparaison] = useState(null)
  const [loading, setLoading] = useState(false)

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const API_BASE = import.meta.env.VITE_API_URL || ''

  const flairIrms = irms.filter(i => i.sequence_type === 'FLAIR')

  const comparer = async () => {
    if (!irm1 || !irm2 || irm1 === irm2) return
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API_BASE}/api/predictions/segmentation/${irm1}`, { method: 'POST', headers }),
        fetch(`${API_BASE}/api/predictions/segmentation/${irm2}`, { method: 'POST', headers }),
      ])
      const [d1, d2] = await Promise.all([r1.json(), r2.json()])
      setComparaison({ avant: d1, apres: d2 })
    } finally {
      setLoading(false)
    }
  }

  if (flairIrms.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
        Il faut au moins 2 IRM FLAIR pour comparer l'évolution.
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>IRM 1 (avant)</label>
          <select value={irm1} onChange={e => setIrm1(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
            <option value="">Sélectionner</option>
            {flairIrms.map(i => (
              <option key={i.id} value={i.id}>
                FLAIR — {new Date(i.uploaded_at).toLocaleDateString('fr-FR')}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>IRM 2 (après)</label>
          <select value={irm2} onChange={e => setIrm2(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
            <option value="">Sélectionner</option>
            {flairIrms.map(i => (
              <option key={i.id} value={i.id}>
                FLAIR — {new Date(i.uploaded_at).toLocaleDateString('fr-FR')}
              </option>
            ))}
          </select>
        </div>
        <button onClick={comparer} disabled={!irm1 || !irm2 || irm1 === irm2 || loading}
          style={{
            padding: '8px 18px', borderRadius: '8px', border: 'none',
            background: (!irm1 || !irm2 || irm1 === irm2) ? '#e2e8f0' : '#3b82f6',
            color: (!irm1 || !irm2 || irm1 === irm2) ? '#94a3b8' : 'white',
            cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap'
          }}>
          {loading ? 'Analyse...' : 'Comparer'}
        </button>
      </div>

      {comparaison && (() => {
        const v1 = comparaison.avant.resultats.volume_lesions_voxels
        const v2 = comparaison.apres.resultats.volume_lesions_voxels
        const diff = v2 - v1
        const pctDiff = v1 > 0 ? ((diff / v1) * 100).toFixed(1) : 0

        return (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              {/* IRM 1 */}
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>IRM 1 (avant)</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>{v1}</p>
                <p style={{ fontSize: '11px', color: '#64748b' }}>voxels</p>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {comparaison.avant.resultats.n_coupes_touchees} coupes
                </p>
              </div>

              {/* Flèche évolution */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '24px', fontWeight: 700,
                  color: diff > 0 ? '#ef4444' : diff < 0 ? '#22c55e' : '#94a3b8'
                }}>
                  {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'}
                </div>
                <div style={{
                  fontSize: '13px', fontWeight: 600,
                  color: diff > 0 ? '#ef4444' : diff < 0 ? '#22c55e' : '#94a3b8'
                }}>
                  {diff > 0 ? '+' : ''}{diff} vox
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{pctDiff}%</div>
              </div>

              {/* IRM 2 */}
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>IRM 2 (après)</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#8b5cf6' }}>{v2}</p>
                <p style={{ fontSize: '11px', color: '#64748b' }}>voxels</p>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {comparaison.apres.resultats.n_coupes_touchees} coupes
                </p>
              </div>
            </div>

            {/* Interprétation */}
            <div style={{
              padding: '12px 16px', borderRadius: '8px', fontSize: '13px',
              background: diff > 0 ? '#fef2f2' : diff < 0 ? '#f0fdf4' : '#f8fafc',
              color: diff > 0 ? '#991b1b' : diff < 0 ? '#166534' : '#475569',
              border: `1px solid ${diff > 0 ? '#fecaca' : diff < 0 ? '#bbf7d0' : '#e2e8f0'}`
            }}>
              {diff > 0
                ? `⚠️ Progression des lésions (+${diff} voxels, +${pctDiff}%). Réévaluation thérapeutique recommandée.`
                : diff < 0
                ? `✅ Régression des lésions (${diff} voxels, ${pctDiff}%). Réponse au traitement favorable.`
                : `➡️ Charge lésionnelle stable. Surveillance continue recommandée.`
              }
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────
export default function GraphiquesIA({ predResultats, visites, irms, scoreRisque }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>

      {/* Ligne 1 : Jauge + Carte chaleur */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#374151' }}>
            🎯 Jauge de risque
          </h3>
          <JaugeRisque score={scoreRisque} />
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#374151' }}>
            🧠 Distribution des lésions
          </h3>
          <CarteChalleurLesions resultats={predResultats?.resultats} />
        </div>
      </div>

      {/* Ligne 2 : Graphique EDSS */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#374151' }}>
          📈 Évolution EDSS dans le temps
        </h3>
        <GraphiqueEDSS visites={visites} />
      </div>

      {/* Ligne 3 : Comparaison avant/après */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#374151' }}>
          🔄 Comparaison avant/après
        </h3>
        <ComparaisonIRM irms={irms} />
      </div>

    </div>
  )
}