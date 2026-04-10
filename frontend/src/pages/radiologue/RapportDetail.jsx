import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, CheckCircle } from 'lucide-react'

const CONCLUSIONS = [
  'Pas de nouvelles lésions détectées',
  'Lésions stables par rapport à l\'examen précédent',
  'Nouvelles lésions en hypersignal FLAIR détectées',
  'Lésions prenant le contraste — activité inflammatoire',
  'Atrophie cérébrale progressive',
  'Lésions médullaires associées',
]

export default function RapportDetail() {
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const irm = state?.irm || {}

  const token = localStorage.getItem('token')
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [rapport, setRapport] = useState({
    qualite_image: irm.rapport?.qualite_image || 'bonne',
    lesions_nouvelles: irm.rapport?.lesions_nouvelles ?? false,
    nombre_lesions: irm.rapport?.nombre_lesions || 0,
    localisation: irm.rapport?.localisation || [],
    prise_contraste: irm.rapport?.prise_contraste ?? false,
    conclusion: irm.rapport?.conclusion || '',
    recommandations: irm.rapport?.recommandations || '',
  })
  const [sauvegarde, setSauvegarde] = useState(false)
  const [loading, setLoading] = useState(false)

  const localisations = ['Périventriculaire', 'Sous-cortical', 'Cortical', 'Infratentoriel', 'Médullaire', 'Corpus callosum']

  const toggleLocalisation = (loc) => {
    setRapport(r => ({
      ...r,
      localisation: r.localisation.includes(loc)
        ? r.localisation.filter(l => l !== loc)
        : [...r.localisation, loc]
    }))
  }

  const sauvegarder = async () => {
    setLoading(true)
    try {
      await fetch(`/api/patients/${irm.patient_id}/irm/${irm.id}/rapport`, {
        method: 'POST',
        headers,
        body: JSON.stringify(rapport)
      })
      setSauvegarde(true)
      setTimeout(() => navigate(-1), 1500)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box'
  }
  const labelStyle = { fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
          background: 'white', cursor: 'pointer', fontSize: '13px', color: '#475569'
        }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
            Rapport radiologique
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            {irm.patient_nom} — {irm.sequence_type}
          </p>
        </div>
      </div>

      {sauvegarde && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
          background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0'
        }}>
          <CheckCircle size={18} /> Rapport sauvegardé ! Redirection...
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Qualité image */}
        <div>
          <label style={labelStyle}>Qualité de l'image</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['bonne', 'moyenne', 'mauvaise'].map(q => (
              <button key={q} onClick={() => setRapport(r => ({ ...r, qualite_image: q }))} style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: 500, fontSize: '13px', textTransform: 'capitalize',
                background: rapport.qualite_image === q ? '#0f172a' : '#f1f5f9',
                color: rapport.qualite_image === q ? 'white' : '#64748b',
              }}>
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Lésions nouvelles */}
        <div>
          <label style={labelStyle}>Nouvelles lésions détectées ?</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ val: true, label: 'Oui' }, { val: false, label: 'Non' }].map(o => (
              <button key={String(o.val)} onClick={() => setRapport(r => ({ ...r, lesions_nouvelles: o.val }))} style={{
                padding: '8px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: 500, fontSize: '13px',
                background: rapport.lesions_nouvelles === o.val
                  ? (o.val ? '#ef4444' : '#22c55e') : '#f1f5f9',
                color: rapport.lesions_nouvelles === o.val ? 'white' : '#64748b',
              }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nombre lésions */}
        {rapport.lesions_nouvelles && (
          <div>
            <label style={labelStyle}>Nombre de lésions</label>
            <input
              type="number" min="0" value={rapport.nombre_lesions}
              onChange={e => setRapport(r => ({ ...r, nombre_lesions: parseInt(e.target.value) || 0 }))}
              style={{ ...inputStyle, width: '120px' }}
            />
          </div>
        )}

        {/* Localisation */}
        <div>
          <label style={labelStyle}>Localisation des lésions</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {localisations.map(loc => (
              <button key={loc} onClick={() => toggleLocalisation(loc)} style={{
                padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 500,
                background: rapport.localisation.includes(loc) ? '#0f172a' : '#f1f5f9',
                color: rapport.localisation.includes(loc) ? 'white' : '#64748b',
              }}>
                {loc}
              </button>
            ))}
          </div>
        </div>

        {/* Prise de contraste */}
        <div>
          <label style={labelStyle}>Prise de contraste (activité inflammatoire) ?</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ val: true, label: 'Oui — lésions actives' }, { val: false, label: 'Non' }].map(o => (
              <button key={String(o.val)} onClick={() => setRapport(r => ({ ...r, prise_contraste: o.val }))} style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: 500, fontSize: '13px',
                background: rapport.prise_contraste === o.val ? '#0f172a' : '#f1f5f9',
                color: rapport.prise_contraste === o.val ? 'white' : '#64748b',
              }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conclusion */}
        <div>
          <label style={labelStyle}>Conclusion</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {CONCLUSIONS.map(c => (
              <button key={c} onClick={() => setRapport(r => ({ ...r, conclusion: c }))} style={{
                textAlign: 'left', padding: '8px 14px', borderRadius: '8px',
                border: `1px solid ${rapport.conclusion === c ? '#0f172a' : '#e2e8f0'}`,
                background: rapport.conclusion === c ? '#f8fafc' : 'white',
                cursor: 'pointer', fontSize: '13px', color: '#374151',
                fontWeight: rapport.conclusion === c ? 600 : 400
              }}>
                {rapport.conclusion === c ? '✓ ' : ''}{c}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Ou saisir une conclusion personnalisée..."
            value={rapport.conclusion}
            onChange={e => setRapport(r => ({ ...r, conclusion: e.target.value }))}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Recommandations */}
        <div>
          <label style={labelStyle}>Recommandations</label>
          <textarea
            placeholder="Recommandations pour le médecin traitant..."
            value={rapport.recommandations}
            onChange={e => setRapport(r => ({ ...r, recommandations: e.target.value }))}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Bouton sauvegarder */}
        <button onClick={sauvegarder} disabled={loading || sauvegarde} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '12px', borderRadius: '10px', border: 'none',
          background: sauvegarde ? '#22c55e' : '#0f172a',
          color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 600, fontSize: '15px'
        }}>
          <Save size={18} />
          {loading ? 'Sauvegarde...' : sauvegarde ? 'Sauvegardé !' : 'Sauvegarder le rapport'}
        </button>
      </div>
    </div>
  )
}