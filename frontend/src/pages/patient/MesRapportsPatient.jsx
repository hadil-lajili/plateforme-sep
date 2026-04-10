import { useEffect, useState } from 'react'
import { FileText, Brain, Sparkles, Activity, Shield, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { patientPortalService } from '../../services/patientPortalService'

const TYPE_CONFIG = {
  segmentation: { icon: Brain, color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', label: 'Segmentation des lésions' },
  classification: { icon: Activity, color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', label: 'Classification SEP' },
  prediction: { icon: Sparkles, color: '#d97706', bg: '#fffbeb', border: '#fcd34d', label: 'Prédiction futures' },
}

export default function MesRapportsPatient() {
  const [rapports, setRapports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await patientPortalService.getMesRapports()
        setRapports(res.data.data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#9ca3b0' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', marginBottom: '16px',
        border: '2.5px solid #eef0f4', borderTopColor: '#4f46e5',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: '14px' }}>Chargement de vos rapports…</span>
    </div>
  )

  return (
    <div className="animate-fadeIn" style={{ color: '#1a1d26' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1d26', margin: 0, letterSpacing: '-0.02em' }}>
          Mes rapports médicaux
        </h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '6px' }}>
          Résultats des analyses IA de vos imageries — {rapports.length} rapport{rapports.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Info banner */}
      <div style={{
        padding: '16px 20px', borderRadius: '12px', marginBottom: '24px',
        background: '#eff6ff', border: '1px solid #93c5fd',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <Shield size={18} color="#2563eb" />
        <p style={{ fontSize: '13px', color: '#1e40af', margin: 0, lineHeight: 1.5 }}>
          Ces rapports sont générés par notre intelligence artificielle et doivent être interprétés par votre médecin traitant. 
          Ils ne constituent pas un diagnostic médical.
        </p>
      </div>

      {rapports.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 0',
          background: '#fff', borderRadius: '16px', border: '1px solid #eef0f4',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px', margin: '0 auto 16px',
            background: '#f5f3ff', border: '1px solid #c4b5fd',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={26} color="#7c3aed" />
          </div>
          <div style={{ fontWeight: 600, color: '#1a1d26', fontSize: '16px', marginBottom: '6px' }}>Aucun rapport disponible</div>
          <div style={{ color: '#9ca3b0', fontSize: '14px' }}>Les rapports apparaîtront après l'analyse de vos IRM</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {rapports.map((rapport, i) => (
            <div key={i} className="glass-card-glow animate-slideUp" style={{ padding: '24px', animationDelay: `${i * 80}ms` }}>

              {/* Rapport header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Brain size={20} color="#fff" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: '#1a1d26', margin: 0 }}>
                      IRM {rapport.sequence_type || 'FLAIR'}
                    </p>
                    <p style={{ fontSize: '12px', color: '#9ca3b0', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} />
                      {new Date(rapport.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <span className="badge badge-purple">
                  {Object.keys(rapport.rapport).length} analyse{Object.keys(rapport.rapport).length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Rapport results */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(rapport.rapport).map(([type, data]) => {
                  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.segmentation
                  const Icon = cfg.icon
                  return (
                    <div key={type} style={{
                      padding: '16px 18px', borderRadius: '12px',
                      background: cfg.bg, border: `1px solid ${cfg.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <Icon size={16} color={cfg.color} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                      </div>

                      {/* Segmentation results */}
                      {type === 'segmentation' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            {data.niveau === 'aucune' || data.niveau === 'faible' ? (
                              <CheckCircle2 size={16} color="#059669" />
                            ) : (
                              <AlertTriangle size={16} color="#d97706" />
                            )}
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1d26', textTransform: 'capitalize' }}>
                              Niveau : {data.niveau || '—'}
                            </span>
                          </div>
                          <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 10px', lineHeight: 1.5 }}>
                            {data.message}
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ padding: '10px', borderRadius: '8px', background: '#fff', textAlign: 'center' }}>
                              <p style={{ fontSize: '18px', fontWeight: 700, color: cfg.color, margin: 0 }}>{data.volume_lesions ?? '—'}</p>
                              <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>Volume (voxels)</p>
                            </div>
                            <div style={{ padding: '10px', borderRadius: '8px', background: '#fff', textAlign: 'center' }}>
                              <p style={{ fontSize: '18px', fontWeight: 700, color: cfg.color, margin: 0 }}>{data.coupes_touchees ?? '—'}</p>
                              <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>Coupes touchées</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Classification results */}
                      {type === 'classification' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '16px', fontWeight: 700, color: '#1a1d26' }}>{data.diagnostic}</span>
                            <span style={{ fontSize: '20px', fontWeight: 700, color: cfg.color }}>{data.confiance}%</span>
                          </div>
                          <p style={{ fontSize: '13px', color: '#374151', margin: 0, lineHeight: 1.5 }}>
                            {data.message}
                          </p>
                          <div style={{ background: '#e5e7eb', borderRadius: '8px', height: '6px', marginTop: '10px', overflow: 'hidden' }}>
                            <div style={{
                              height: '6px', borderRadius: '8px',
                              width: `${data.confiance}%`,
                              background: `linear-gradient(90deg, ${cfg.color}cc, ${cfg.color})`,
                              transition: 'width 1s ease-out',
                            }} />
                          </div>
                        </div>
                      )}

                      {/* Prediction results */}
                      {type === 'prediction' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            {data.rechute_probable ? (
                              <AlertTriangle size={16} color="#dc2626" />
                            ) : (
                              <CheckCircle2 size={16} color="#059669" />
                            )}
                            <span style={{ fontSize: '14px', fontWeight: 600, color: data.rechute_probable ? '#dc2626' : '#059669' }}>
                              {data.rechute_probable ? 'Risque de rechute détecté' : 'Pas de rechute anticipée'}
                            </span>
                            <span style={{ fontSize: '18px', fontWeight: 700, color: cfg.color, marginLeft: 'auto' }}>
                              {data.proba_rechute}%
                            </span>
                          </div>
                          <p style={{ fontSize: '13px', color: '#374151', margin: 0, lineHeight: 1.5 }}>
                            {data.message}
                          </p>
                          <div style={{ background: '#e5e7eb', borderRadius: '8px', height: '6px', marginTop: '10px', overflow: 'hidden' }}>
                            <div style={{
                              height: '6px', borderRadius: '8px',
                              width: `${data.proba_rechute}%`,
                              background: data.rechute_probable
                                ? 'linear-gradient(90deg, #f59e0b, #dc2626)'
                                : 'linear-gradient(90deg, #059669, #10b981)',
                              transition: 'width 1s ease-out',
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
