import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Calendar, Phone, Mail, Plus, Brain, Activity, Image, Sparkles, Upload, FileText, ChevronRight } from 'lucide-react'
import { patientService } from '../../services/patientService'
import GraphiquesIA from '../../components/prediction/GraphiquesIA'
import ViewerIRM from '../../components/irm/ViewerIRM'

const TABS = [
  { key: 'Informations', icon: User, color: '#4f46e5' },
  { key: 'Visites', icon: Activity, color: '#059669' },
  { key: 'IRM', icon: Brain, color: '#0891b2' },
  { key: 'Prédiction IA', icon: Sparkles, color: '#7c3aed' },
]

function CarteIRM({ irm, patientId }) {
  const [showViewer, setShowViewer] = useState(false)

  return (
    <div className="glass-card-glow" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
          border: '1px solid #a7f3d0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Brain size={20} color="#059669" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '14px', color: '#1a1d26', margin: 0 }}>
            {irm.sequence_type || 'IRM'}
          </p>
          <p style={{ fontSize: '12px', color: '#9ca3b0', margin: 0 }}>
            {new Date(irm.uploaded_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <span className={`badge ${
          irm.statut === 'done' ? 'badge-emerald' :
          irm.statut === 'analysee' ? 'badge-purple' :
          'badge-blue'
        }`}>
          {irm.statut === 'done' ? '✓ Terminé' : irm.statut === 'analysee' ? '✓ Analysé' : irm.statut}
        </span>
      </div>

      {irm.metadata && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '0 20px 14px' }}>
          {[
            { label: 'Slices', value: irm.metadata.nb_slices ?? '—' },
            { label: 'Hauteur', value: `${irm.metadata.hauteur ?? '—'}px` },
            { label: 'Taille', value: `${irm.metadata.taille_mb ?? '—'} MB` },
          ].map(m => (
            <div key={m.label} style={{
              background: '#f8f9fc', borderRadius: '8px', padding: '10px',
              textAlign: 'center',
            }}>
              <p style={{ fontWeight: 600, fontSize: '13px', color: '#1a1d26', margin: 0 }}>{m.value}</p>
              <p style={{ fontSize: '11px', color: '#9ca3b0', margin: '2px 0 0' }}>{m.label}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '0 20px 16px' }}>
        <button
          onClick={() => setShowViewer(!showViewer)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '8px', border: '1px solid #e2e5eb',
            background: '#fff', fontSize: '13px', fontWeight: 500, color: '#4f46e5',
            cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.borderColor = '#c7d2fe' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e5eb' }}
        >
          <Image size={14} />
          {showViewer ? "Masquer le viewer" : "Visualiser l'IRM"}
        </button>
      </div>

      {showViewer && (
        <div style={{ padding: '0 20px 20px' }}>
          <ViewerIRM
            patientId={patientId}
            irmId={irm.id}
            sequenceType={irm.sequence_type}
          />
        </div>
      )}
    </div>
  )
}

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [visites, setVisites] = useState([])
  const [irms, setIrms] = useState([])
  const [activeTab, setActiveTab] = useState('Informations')
  const [loading, setLoading] = useState(true)

  // États modèle 1 — SEP/Sain
  const [sepSainLoading, setSepSainLoading] = useState(false)
  const [sepSainResultat, setSepSainResultat] = useState(null)

  // États modèle 2 — U-Net 2 canaux
  const [predLoading, setPredLoading] = useState(false)
  const [predResultat, setPredResultat] = useState(null)
  const [predErreur, setPredErreur] = useState(null)

  // États modèle 3 — ConvLSTM
  const [lstmLoading, setLstmLoading] = useState(false)
  const [lstmResultat, setLstmResultat] = useState(null)
  const [lstmErreur, setLstmErreur] = useState(null)

  // Formulaire visite
  const [showVisiteForm, setShowVisiteForm] = useState(false)
  const [visiteForm, setVisiteForm] = useState({
    date_visite: '', edss_score: '', notes: '',
    tests_fonctionnels: { motricite: 0, vision: 0, cognition: 0, equilibre: 0 }
  })

  // Formulaire IRM
  const [showIrmForm, setShowIrmForm] = useState(false)
  const [irmFile, setIrmFile] = useState(null)
  const [sequenceType, setSequenceType] = useState('FLAIR')
  const [uploading, setUploading] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pRes, vRes, iRes] = await Promise.all([
          patientService.getById(id),
          patientService.getVisites(id),
          patientService.getIRM(id),
        ])
        setPatient(pRes.data)
        setVisites(vRes.data.data || [])
        setIrms(iRes.data.data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handleCreateVisite = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await patientService.createVisite(id, {
        ...visiteForm,
        edss_score: visiteForm.edss_score ? parseFloat(visiteForm.edss_score) : null,
        tests_fonctionnels: visiteForm.tests_fonctionnels,
      })
      setSuccess('Visite ajoutée avec succès !')
      setShowVisiteForm(false)
      const vRes = await patientService.getVisites(id)
      setVisites(vRes.data.data || [])
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur')
    }
  }

  const handleUploadIRM = async (e) => {
    e.preventDefault()
    if (!irmFile) return
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('fichier', irmFile)
      await patientService.uploadIRM(id, formData, sequenceType)
      setSuccess('IRM uploadée avec succès !')
      setShowIrmForm(false)
      setIrmFile(null)
      const iRes = await patientService.getIRM(id)
      setIrms(iRes.data.data || [])
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur upload')
    } finally {
      setUploading(false)
    }
  }

  const lancerSepSain = async (irmId) => {
      setSepSainLoading(true)
      try {
        const res = await fetch(`/api/predictions/sep-sain/${irmId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        if (res.ok) setSepSainResultat(await res.json())
      } catch (e) { console.error(e) }
      finally { setSepSainLoading(false) }
    }

    const lancerPrediction = async (irmId) => {
      setPredLoading(true)
      setPredErreur(null)
      try {
        const res = await fetch(`/api/predictions/prediction/${irmId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        if (res.ok) setPredResultat(await res.json())
        else {
          const err = await res.json()
          setPredErreur(err.detail)
        }
      } catch (e) { setPredErreur('Erreur de connexion') }
      finally { setPredLoading(false) }
    }

    const lancerLSTM = async (irmId) => {
      setLstmLoading(true)
      setLstmErreur(null)
      try {
        const res = await fetch(`/api/predictions/temporal/${irmId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        if (res.ok) setLstmResultat(await res.json())
        else {
          const err = await res.json()
          setLstmErreur(err.detail)
        }
      } catch (e) { setLstmErreur('Erreur de connexion') }
      finally { setLstmLoading(false) }
    }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#9ca3b0' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', marginBottom: '16px',
        border: '2.5px solid #eef0f4', borderTopColor: '#4f46e5',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: '14px' }}>Chargement du dossier patient…</span>
    </div>
  )

  if (!patient) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{
        width: '52px', height: '52px', borderRadius: '14px', margin: '0 auto 14px',
        background: '#fef2f2', border: '1px solid #fecaca',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <User size={24} color="#dc2626" />
      </div>
      <div style={{ fontWeight: 600, color: '#1a1d26', marginBottom: '6px' }}>Patient non trouvé</div>
      <div style={{ color: '#9ca3b0', fontSize: '14px' }}>Ce dossier n'existe pas ou a été supprimé</div>
    </div>
  )

  return (
    <div className="animate-fadeIn" style={{ color: '#1a1d26' }}>

      {/* ── Header Patient ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <button
          onClick={() => navigate('/patients')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '38px', height: '38px', borderRadius: '10px',
            border: '1px solid #e2e5eb', background: '#fff',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.background = '#eef2ff' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e5eb'; e.currentTarget.style.background = '#fff' }}
        >
          <ArrowLeft size={18} color="#5a6070" />
        </button>

        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: 700, color: '#fff',
          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
          flexShrink: 0,
        }}>
          {patient.prenom[0]}{patient.nom[0]}
        </div>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1d26', margin: 0, letterSpacing: '-0.02em' }}>
            {patient.prenom} {patient.nom}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={patient.sexe === 'F' ? 'badge badge-purple' : 'badge badge-blue'}>
              {patient.sexe === 'F' ? 'Féminin' : 'Masculin'}
            </span>
            <span style={{ color: '#c9cdd5' }}>·</span>
            Né(e) le {patient.date_naissance}
          </p>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────── */}
      {success && (
        <div className="animate-slideUp" style={{
          marginBottom: '16px', padding: '14px 18px', borderRadius: '12px',
          background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857',
          fontSize: '14px', fontWeight: 500,
        }}>
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="animate-slideUp" style={{
          marginBottom: '16px', padding: '14px 18px', borderRadius: '12px',
          background: '#fef2f2', borderLeft: '3px solid #ef4444', color: '#dc2626',
          fontSize: '14px', fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '24px',
        borderBottom: '1px solid #eef0f4', paddingBottom: '0',
      }}>
        {TABS.map(({ key, icon: Icon, color }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 18px', fontSize: '13px', fontWeight: isActive ? 600 : 500,
                color: isActive ? '#4f46e5' : '#6b7280',
                background: 'transparent', border: 'none',
                borderBottom: isActive ? '2px solid #4f46e5' : '2px solid transparent',
                marginBottom: '-1px', cursor: 'pointer',
                transition: 'all 0.2s', fontFamily: 'inherit',
              }}
            >
              <Icon size={15} style={{ color: isActive ? '#4f46e5' : '#9ca3b0' }} />
              {key}
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════
         Tab: Informations
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'Informations' && (
        <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* Informations personnelles */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '8px',
                background: '#eef2ff', border: '1px solid #c7d2fe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={16} color="#4f46e5" />
              </div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1d26', margin: 0 }}>
                Informations personnelles
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: User, label: 'Nom complet', value: `${patient.prenom} ${patient.nom}` },
                { icon: Calendar, label: 'Date de naissance', value: patient.date_naissance },
                ...(patient.contact?.email ? [{ icon: Mail, label: 'Email', value: patient.contact.email }] : []),
                ...(patient.contact?.telephone ? [{ icon: Phone, label: 'Téléphone', value: patient.contact.telephone }] : []),
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: '#f8f9fc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={14} color="#9ca3b0" />
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#9ca3b0', fontWeight: 500, margin: 0 }}>{label}</p>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: '#1a1d26', margin: '2px 0 0' }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Résumé clinique */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '8px',
                background: '#ecfdf5', border: '1px solid #a7f3d0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={16} color="#059669" />
              </div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1d26', margin: 0 }}>
                Résumé clinique
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Visites', value: visites.length, gradient: 'stat-gradient-blue', color: '#2563eb' },
                { label: 'IRM', value: irms.length, gradient: 'stat-gradient-emerald', color: '#059669' },
                { label: 'Dernier EDSS', value: visites.length > 0 ? visites[visites.length - 1].edss_score ?? '—' : '—', gradient: 'stat-gradient-amber', color: '#d97706' },
                { label: 'Score risque', value: '—', gradient: 'stat-gradient-violet', color: '#7c3aed' },              ].map(({ label, value, gradient, color }) => (
                <div key={label} className={gradient} style={{ borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '28px', fontWeight: 700, color, margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginTop: '4px' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         Tab: Visites
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'Visites' && (
        <div className="animate-slideUp">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#1a1d26' }}>{visites.length} visite(s)</span>
            </div>
            <button onClick={() => setShowVisiteForm(!showVisiteForm)} className="btn-primary">
              <Plus size={15} /> Nouvelle visite
            </button>
          </div>

          {/* Formulaire visite */}
          {showVisiteForm && (
            <div className="glass-card-glow animate-slideUp" style={{ padding: '28px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Activity size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1d26', margin: 0 }}>Nouvelle visite</h3>
                  <p style={{ fontSize: '13px', color: '#9ca3b0', margin: 0 }}>Enregistrer une consultation</p>
                </div>
              </div>

              <form onSubmit={handleCreateVisite}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="label-light">Date *</label>
                    <input type="date" value={visiteForm.date_visite}
                      onChange={e => setVisiteForm({ ...visiteForm, date_visite: e.target.value })}
                      className="input-light" required />
                  </div>
                  <div>
                    <label className="label-light">Score EDSS (0-10)</label>
                    <input type="number" min="0" max="10" step="0.5" value={visiteForm.edss_score}
                      onChange={e => setVisiteForm({ ...visiteForm, edss_score: e.target.value })}
                      className="input-light" placeholder="ex: 3.5" />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="label-light">Tests fonctionnels</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    {['motricite', 'vision', 'cognition', 'equilibre'].map(test => (
                      <div key={test}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#9ca3b0', fontWeight: 500, marginBottom: '4px', textTransform: 'capitalize' }}>
                          {test}
                        </label>
                        <select value={visiteForm.tests_fonctionnels[test]}
                          onChange={e => setVisiteForm({
                            ...visiteForm,
                            tests_fonctionnels: { ...visiteForm.tests_fonctionnels, [test]: parseInt(e.target.value) }
                          })}
                          className="select-light">
                          <option value={0}>0 — Normal</option>
                          <option value={1}>1 — Léger</option>
                          <option value={2}>2 — Sévère</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label className="label-light">Notes</label>
                  <textarea value={visiteForm.notes}
                    onChange={e => setVisiteForm({ ...visiteForm, notes: e.target.value })}
                    rows={3} className="input-light" style={{ resize: 'vertical' }}
                    placeholder="Notes et observations…" />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn-primary">Enregistrer</button>
                  <button type="button" onClick={() => setShowVisiteForm(false)} className="btn-ghost">Annuler</button>
                </div>
              </form>
            </div>
          )}

          {/* Liste visites */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visites.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 0',
                background: '#fff', borderRadius: '16px', border: '1px solid #eef0f4',
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', margin: '0 auto 12px',
                  background: '#ecfdf5', border: '1px solid #a7f3d0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Activity size={22} color="#059669" />
                </div>
                <div style={{ fontWeight: 600, color: '#1a1d26', marginBottom: '4px' }}>Aucune visite</div>
                <div style={{ fontSize: '13px', color: '#9ca3b0' }}>Créez la première visite pour ce patient</div>
              </div>
            ) : visites.map(v => (
              <div key={v.id} className="glass-card" style={{ padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: v.notes || (v.tests_fonctionnels && Object.keys(v.tests_fonctionnels).length > 0) ? '12px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: v.edss_score <= 3 ? '#059669' : v.edss_score <= 6 ? '#d97706' : '#dc2626',
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#1a1d26' }}>{v.date_visite}</span>
                  </div>
                  {v.edss_score !== null && (
                    <span className={`badge ${
                      v.edss_score <= 3 ? 'badge-emerald' :
                      v.edss_score <= 6 ? 'badge-amber' :
                      'badge-red'
                    }`}>
                      EDSS : {v.edss_score}
                    </span>
                  )}
                </div>

                {v.tests_fonctionnels && Object.keys(v.tests_fonctionnels).length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {Object.entries(v.tests_fonctionnels).map(([k, val]) => (
                      <span key={k} style={{
                        fontSize: '11px', fontWeight: 500, padding: '3px 10px',
                        borderRadius: '6px', background: '#f8f9fc', color: '#5a6070',
                        textTransform: 'capitalize',
                      }}>
                        {k}: {val}
                      </span>
                    ))}
                  </div>
                )}

                {v.notes && (
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '6px 0 0', lineHeight: 1.5 }}>{v.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         Tab: IRM
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'IRM' && (
        <div className="animate-slideUp">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#1a1d26' }}>{irms.length} IRM enregistrée(s)</span>
            <button onClick={() => setShowIrmForm(!showIrmForm)} className="btn-primary" style={{
              background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
              boxShadow: '0 2px 8px rgba(8, 145, 178, 0.25)',
            }}>
              <Upload size={15} /> Uploader une IRM
            </button>
          </div>

          {/* Formulaire upload IRM */}
          {showIrmForm && (
            <div className="glass-card-glow animate-slideUp" style={{ padding: '28px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Brain size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1d26', margin: 0 }}>Upload IRM</h3>
                  <p style={{ fontSize: '13px', color: '#9ca3b0', margin: 0 }}>Formats acceptés : .nii, .nii.gz, .dcm</p>
                </div>
              </div>

              <form onSubmit={handleUploadIRM}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label className="label-light">Fichier *</label>
                    <input type="file" accept=".nii,.dcm,.gz"
                      onChange={e => setIrmFile(e.target.files[0])}
                      className="input-light" style={{ padding: '10px 14px' }} required />
                  </div>
                  <div>
                    <label className="label-light">Séquence</label>
                    <select value={sequenceType} onChange={e => setSequenceType(e.target.value)}
                      className="select-light">
                      <option>FLAIR</option>
                      <option>T1</option>
                      <option>T2</option>
                      <option>Gd+</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" disabled={uploading} className="btn-primary" style={{
                    background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
                    boxShadow: '0 2px 8px rgba(8, 145, 178, 0.25)',
                  }}>
                    {uploading ? 'Upload en cours…' : 'Uploader'}
                  </button>
                  <button type="button" onClick={() => setShowIrmForm(false)} className="btn-ghost">Annuler</button>
                </div>
              </form>
            </div>
          )}

          {/* Grille IRM */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {irms.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0',
                background: '#fff', borderRadius: '16px', border: '1px solid #eef0f4',
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', margin: '0 auto 12px',
                  background: '#e0f7fa', border: '1px solid #80deea',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Brain size={22} color="#0891b2" />
                </div>
                <div style={{ fontWeight: 600, color: '#1a1d26', marginBottom: '4px' }}>Aucune IRM</div>
                <div style={{ fontSize: '13px', color: '#9ca3b0' }}>Uploadez votre première IRM</div>
              </div>
            ) : irms.map(irm => (
              <CarteIRM key={irm.id} irm={irm} patientId={id} />
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         Tab: Prédiction IA
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'Prédiction IA' && (
        <div className="animate-slideUp">
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                border: '1px solid #c4b5fd',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={16} color="#7c3aed" />
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1d26', margin: 0 }}>
                  Analyse IA — 3 Modèles
                </h2>
                <p style={{ fontSize: '13px', color: '#9ca3b0', margin: 0 }}>
                  Classification SEP/Sain • Détection changements • Prédiction temporelle
                </p>
              </div>
            </div>
          </div>

          {irms.filter(i => i.sequence_type === 'FLAIR').length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 0',
              background: '#fffbeb', borderRadius: '16px', border: '1px solid #fcd34d',
            }}>
              <Brain size={32} color="#d97706" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, color: '#92400e' }}>Aucune IRM FLAIR disponible</div>
              <div style={{ fontSize: '13px', color: '#b45309' }}>Uploadez une IRM FLAIR dans l'onglet IRM</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ── Modèle 1 : ResNet-50 SEP/Sain ── */}
              <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#fff', fontSize: '12px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>1</span>
                  <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1a1d26', margin: 0 }}>
                    Classification — SEP vs Sain
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#9ca3b0', marginLeft: '38px', marginBottom: '16px' }}>
                  ResNet-50 Transfer Learning • Accuracy 99.35% • Sensibilité 99.35%
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {irms.filter(i => i.sequence_type === 'FLAIR').map(irm => (
                    <div key={irm.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: '10px', background: '#f8f9fc',
                    }}>
                      <p style={{ fontWeight: 600, fontSize: '13px', color: '#1a1d26', margin: 0 }}>
                        FLAIR — {new Date(irm.uploaded_at).toLocaleDateString('fr-FR')}
                      </p>
                      <button
                        onClick={() => lancerSepSain(irm.id)}
                        disabled={sepSainLoading}
                        className="btn-primary"
                        style={{
                          padding: '8px 16px', fontSize: '12px',
                          background: sepSainLoading ? '#ecfdf5' : 'linear-gradient(135deg, #059669, #10b981)',
                          color: sepSainLoading ? '#6ee7b7' : '#fff',
                          boxShadow: sepSainLoading ? 'none' : '0 2px 8px rgba(5, 150, 105, 0.25)',
                        }}
                      >
                        <Brain size={14} />
                        {sepSainLoading ? 'Analyse…' : 'Diagnostiquer'}
                      </button>
                    </div>
                  ))}
                </div>

                {sepSainResultat && (
                  <div className="animate-slideUp" style={{
                    marginTop: '16px', padding: '18px', borderRadius: '12px',
                    border: `1px solid ${sepSainResultat.interpretation.couleur}40`,
                    background: `${sepSainResultat.interpretation.couleur}08`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 700, fontSize: '16px', color: sepSainResultat.interpretation.couleur }}>
                        {sepSainResultat.diagnostic}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '28px', color: sepSainResultat.interpretation.couleur }}>
                        {sepSainResultat.confiance}%
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#374151', marginBottom: '14px' }}>
                      {sepSainResultat.interpretation.message}
                    </p>
                    <div style={{ background: '#e5e7eb', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                      <div style={{
                        height: '8px', borderRadius: '10px',
                        width: `${sepSainResultat.score * 100}%`,
                        background: `linear-gradient(90deg, ${sepSainResultat.interpretation.couleur}cc, ${sepSainResultat.interpretation.couleur})`,
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3b0', marginTop: '6px' }}>
                      <span>Sain</span>
                      <span>SEP</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                      <div style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
                        <p style={{ fontSize: '11px', color: '#9ca3b0', margin: 0 }}>Modèle</p>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1d26', margin: '2px 0 0' }}>ResNet-50 TL</p>
                      </div>
                      <div style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
                        <p style={{ fontSize: '11px', color: '#9ca3b0', margin: 0 }}>Performance</p>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#059669', margin: '2px 0 0' }}>Acc 99.35%</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Modèle 2 : U-Net 2 canaux ── */}
              <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                    color: '#fff', fontSize: '12px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>2</span>
                  <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1a1d26', margin: 0 }}>
                    Détection changements — T0 + T1
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#9ca3b0', marginLeft: '38px', marginBottom: '16px' }}>
                  U-Net 2 canaux • Dice 0.8215 • Compare 2 IRM et détecte les nouvelles lésions
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {irms.filter(i => i.sequence_type === 'FLAIR').map(irm => (
                    <div key={irm.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: '10px', background: '#f8f9fc',
                    }}>
                      <p style={{ fontWeight: 600, fontSize: '13px', color: '#1a1d26', margin: 0 }}>
                        FLAIR — {new Date(irm.uploaded_at).toLocaleDateString('fr-FR')}
                      </p>
                      <button
                        onClick={() => lancerPrediction(irm.id)}
                        disabled={predLoading}
                        className="btn-primary"
                        style={{
                          padding: '8px 16px', fontSize: '12px',
                          background: predLoading ? '#fffbeb' : 'linear-gradient(135deg, #d97706, #f59e0b)',
                          color: predLoading ? '#fbbf24' : '#fff',
                          boxShadow: predLoading ? 'none' : '0 2px 8px rgba(217, 119, 6, 0.25)',
                        }}
                      >
                        <Brain size={14} />
                        {predLoading ? 'Analyse…' : 'Détecter'}
                      </button>
                    </div>
                  ))}
                </div>

                {predErreur && (
                  <div style={{
                    marginTop: '14px', padding: '14px', borderRadius: '10px',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    fontSize: '13px', color: '#dc2626'
                  }}>
                    ❌ {predErreur}
                  </div>
                )}

                {predResultat && (
                  <div className="animate-slideUp" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{
                      padding: '18px', borderRadius: '12px',
                      border: `1px solid ${predResultat.interpretation.couleur}40`,
                      background: `${predResultat.interpretation.couleur}08`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: predResultat.interpretation.couleur }}>
                          {predResultat.rechute_probable ? '⚠️ Changements détectés' : '✅ Pas de changement significatif'}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '24px', color: predResultat.interpretation.couleur }}>
                          {predResultat.proba_rechute}%
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#374151', marginBottom: '14px' }}>
                        {predResultat.interpretation.message}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <div style={{ textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                          <p style={{ fontSize: '18px', fontWeight: 700, color: '#d97706', margin: 0 }}>
                            {predResultat.volume_lesions_futures}
                          </p>
                          <p style={{ fontSize: '11px', color: '#9ca3b0', margin: '2px 0 0' }}>Voxels lésions</p>
                        </div>
                        <div style={{ textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                          <p style={{ fontSize: '18px', fontWeight: 700, color: '#d97706', margin: 0 }}>
                            {predResultat.proba_rechute}%
                          </p>
                          <p style={{ fontSize: '11px', color: '#9ca3b0', margin: '2px 0 0' }}>Probabilité</p>
                        </div>
                        <div style={{ textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                          <p style={{ fontSize: '18px', fontWeight: 700, color: '#059669', margin: 0 }}>0.82</p>
                          <p style={{ fontSize: '11px', color: '#9ca3b0', margin: '2px 0 0' }}>Dice</p>
                        </div>
                      </div>
                    </div>

                    {predResultat.images_lesions && predResultat.images_lesions.length > 0 && (
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1d26', marginBottom: '10px' }}>
                          🔴 Nouvelles lésions détectées
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                          {predResultat.images_lesions.map((item, i) => (
                            <div key={i} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #1f2937', background: '#000' }}>
                              <img src={item.image} alt={`Coupe ${item.coupe}`}
                                style={{ width: '100%', display: 'block', imageRendering: 'pixelated' }} />
                              <div style={{ padding: '6px 10px', background: '#111827', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', color: '#9ca3af' }}>Coupe {item.coupe}</span>
                                {item.n_lesions > 0
                                  ? <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 600 }}>{item.n_lesions}px</span>
                                  : <span style={{ fontSize: '11px', color: '#4ade80' }}>✓</span>
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Modèle 3 : ConvLSTM ── */}
              <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                    color: '#fff', fontSize: '12px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>3</span>
                  <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1a1d26', margin: 0 }}>
                    Prédiction Temporelle — ConvLSTM
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#9ca3b0', marginLeft: '38px', marginBottom: '4px' }}>
                  ConvLSTM • Dice 0.7394 • Utilise 3 IRM consécutives pour prédire T4
                </p>
                <p style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '38px', marginBottom: '16px' }}>
                  ⚠️ Nécessite au moins 3 IRM FLAIR du même patient
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {irms.filter(i => i.sequence_type === 'FLAIR').map(irm => (
                    <div key={irm.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: '10px', background: '#f8f9fc',
                    }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '13px', color: '#1a1d26', margin: 0 }}>
                          FLAIR — {new Date(irm.uploaded_at).toLocaleDateString('fr-FR')}
                        </p>
                        <p style={{ fontSize: '11px', color: '#9ca3b0', margin: '2px 0 0' }}>
                          Utilisé comme T3 (le plus récent)
                        </p>
                      </div>
                      <button
                        onClick={() => lancerLSTM(irm.id)}
                        disabled={lstmLoading}
                        className="btn-primary"
                        style={{
                          padding: '8px 16px', fontSize: '12px',
                          background: lstmLoading ? '#f5f3ff' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                          color: lstmLoading ? '#a78bfa' : '#fff',
                          boxShadow: lstmLoading ? 'none' : '0 2px 8px rgba(124, 58, 237, 0.25)',
                        }}
                      >
                        <Brain size={14} />
                        {lstmLoading ? 'Analyse…' : 'Prédire T4'}
                      </button>
                    </div>
                  ))}
                </div>

                {lstmErreur && (
                  <div style={{
                    marginTop: '14px', padding: '14px', borderRadius: '10px',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    fontSize: '13px', color: '#dc2626'
                  }}>
                    ❌ {lstmErreur}
                  </div>
                )}

                {lstmResultat && (
                  <div className="animate-slideUp" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{
                      padding: '18px', borderRadius: '12px',
                      border: `1px solid ${lstmResultat.interpretation.couleur}40`,
                      background: `${lstmResultat.interpretation.couleur}08`,
                    }}>
                      <p style={{ fontWeight: 700, fontSize: '14px', color: lstmResultat.interpretation.couleur, marginBottom: '8px' }}>
                        {lstmResultat.interpretation.niveau === 'risque_eleve' ? '🚨 Risque élevé' :
                        lstmResultat.interpretation.niveau === 'risque_modere' ? '⚠️ Risque modéré' : '✅ Risque faible'}
                      </p>
                      <p style={{ fontSize: '13px', color: '#374151', marginBottom: '14px' }}>
                        {lstmResultat.interpretation.message}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <div style={{ textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                          <p style={{ fontSize: '18px', fontWeight: 700, color: '#7c3aed', margin: 0 }}>
                            {lstmResultat.volume_lesions_futures}
                          </p>
                          <p style={{ fontSize: '11px', color: '#9ca3b0', margin: '2px 0 0' }}>Voxels T4</p>
                        </div>
                        <div style={{ textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                          <p style={{ fontSize: '18px', fontWeight: 700, color: '#7c3aed', margin: 0 }}>
                            {lstmResultat.n_irm_utilisees}
                          </p>
                          <p style={{ fontSize: '11px', color: '#9ca3b0', margin: '2px 0 0' }}>IRM utilisées</p>
                        </div>
                        <div style={{ textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                          <p style={{ fontSize: '18px', fontWeight: 700, color: '#059669', margin: 0 }}>0.74</p>
                          <p style={{ fontSize: '11px', color: '#9ca3b0', margin: '2px 0 0' }}>Dice</p>
                        </div>
                      </div>
                    </div>

                    {lstmResultat.images_lesions && lstmResultat.images_lesions.length > 0 && (
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1d26', marginBottom: '10px' }}>
                          🔴 Lésions futures prédites (T4)
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                          {lstmResultat.images_lesions.map((item, i) => (
                            <div key={i} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #1f2937', background: '#000' }}>
                              <img src={item.image} alt={`Coupe ${item.coupe}`}
                                style={{ width: '100%', display: 'block', imageRendering: 'pixelated' }} />
                              <div style={{ padding: '6px 10px', background: '#111827', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', color: '#9ca3af' }}>Coupe {item.coupe}</span>
                                {item.n_lesions > 0
                                  ? <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 600 }}>{item.n_lesions}px</span>
                                  : <span style={{ fontSize: '11px', color: '#4ade80' }}>✓</span>
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                        <p style={{ fontSize: '11px', color: '#9ca3b0', marginTop: '8px', textAlign: 'center' }}>
                          Prédiction basée sur l'évolution temporelle de 3 IRM consécutives
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  )
}