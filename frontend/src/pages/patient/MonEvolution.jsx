import { useEffect, useState } from 'react'
import { Activity, TrendingUp, TrendingDown, Minus, Calendar, ChevronDown, ChevronUp, Brain, Eye, Footprints, Zap } from 'lucide-react'
import { patientPortalService } from '../../services/patientPortalService'

const TEST_ICONS = {
  motricite: Footprints,
  vision: Eye,
  cognition: Brain,
  equilibre: Activity,
}

const TEST_LABELS = {
  motricite: 'Motricité',
  vision: 'Vision',
  cognition: 'Cognition',
  equilibre: 'Équilibre',
}

const SCORE_LABELS = {
  0: { label: 'Normal', color: '#059669', bg: '#ecfdf5' },
  1: { label: 'Léger', color: '#d97706', bg: '#fffbeb' },
  2: { label: 'Sévère', color: '#dc2626', bg: '#fef2f2' },
}

export default function MonEvolution() {
  const [evolution, setEvolution] = useState(null)
  const [visites, setVisites] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedVisite, setExpandedVisite] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [eRes, vRes] = await Promise.all([
          patientPortalService.getMonEvolution(),
          patientPortalService.getMesVisites(),
        ])
        setEvolution(eRes.data)
        setVisites(vRes.data.data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const tendanceConfig = {
    progression: { icon: TrendingUp, color: '#dc2626', bg: '#fef2f2', label: 'En progression', border: '#fecaca', message: 'Le score EDSS montre une tendance à la hausse. Discutez-en avec votre médecin.' },
    amelioration: { icon: TrendingDown, color: '#059669', bg: '#ecfdf5', label: 'En amélioration', border: '#a7f3d0', message: 'Bonne nouvelle ! Votre score EDSS s\'améliore.' },
    stable: { icon: Minus, color: '#2563eb', bg: '#eff6ff', label: 'Stable', border: '#93c5fd', message: 'Votre score EDSS est stable. Continuez votre suivi régulier.' },
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#9ca3b0' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', marginBottom: '16px',
        border: '2.5px solid #eef0f4', borderTopColor: '#4f46e5',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: '14px' }}>Chargement de votre évolution…</span>
    </div>
  )

  const tcfg = tendanceConfig[evolution?.tendance] || tendanceConfig.stable
  const TrendIcon = tcfg.icon

  return (
    <div className="animate-fadeIn" style={{ color: '#1a1d26' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1d26', margin: 0, letterSpacing: '-0.02em' }}>
            Mon évolution
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '6px' }}>
            Suivez l'évolution de votre score EDSS et de vos tests fonctionnels
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 16px', borderRadius: '10px',
          background: tcfg.bg, border: `1px solid ${tcfg.border}`,
        }}>
          <TrendIcon size={16} color={tcfg.color} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: tcfg.color }}>{tcfg.label}</span>
        </div>
      </div>

      {/* Tendance Banner */}
      <div style={{
        padding: '18px 22px', borderRadius: '14px', marginBottom: '24px',
        background: tcfg.bg, border: `1px solid ${tcfg.border}`,
        display: 'flex', alignItems: 'center', gap: '14px',
      }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '10px',
          background: '#fff', border: `1px solid ${tcfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <TrendIcon size={20} color={tcfg.color} />
        </div>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: tcfg.color, margin: '0 0 2px' }}>{tcfg.label}</p>
          <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>{tcfg.message}</p>
        </div>
      </div>

      {/* EDSS Chart */}
      <div style={{
        background: '#fff', borderRadius: '16px',
        border: '1px solid #eef0f4',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        padding: '24px', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: '#eef2ff', border: '1px solid #c7d2fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={17} color="#4f46e5" />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1d26', margin: 0 }}>Score EDSS dans le temps</h2>
            <p style={{ fontSize: '12px', color: '#9ca3b0', margin: '2px 0 0' }}>
              Échelle de 0 (normal) à 10 (handicap sévère)
            </p>
          </div>
        </div>

        {evolution?.evolution_edss?.length > 0 ? (
          <div>
            {/* Y-axis labels + bar chart */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {/* Y axis */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '180px', paddingBottom: '24px' }}>
                {[10, 7.5, 5, 2.5, 0].map(v => (
                  <span key={v} style={{ fontSize: '10px', color: '#9ca3b0', fontWeight: 500, textAlign: 'right', width: '24px' }}>{v}</span>
                ))}
              </div>
              {/* Bars */}
              <div style={{ flex: 1, position: 'relative' }}>
                {/* Grid lines */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: '24px', pointerEvents: 'none' }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{ height: '1px', background: '#f4f5f7' }} />
                  ))}
                </div>
                {/* Bar chart */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '180px', position: 'relative', zIndex: 1 }}>
                  {evolution.evolution_edss.map((point, i) => {
                    const maxScore = 10
                    const height = Math.max(6, (point.score / maxScore) * 150)
                    const barColor = point.score <= 3 ? '#059669' : point.score <= 6 ? '#d97706' : '#dc2626'
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: barColor }}>{point.score}</span>
                        <div style={{
                          width: '100%', maxWidth: '48px', height: `${height}px`,
                          borderRadius: '8px 8px 3px 3px',
                          background: `linear-gradient(180deg, ${barColor}, ${barColor}80)`,
                          boxShadow: `0 2px 8px ${barColor}25`,
                          transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        }} />
                        <span style={{ fontSize: '10px', color: '#9ca3b0', whiteSpace: 'nowrap' }}>
                          {new Date(point.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', justifyContent: 'center' }}>
              {[
                { label: '0-3 Normal', color: '#059669' },
                { label: '3.5-6 Modéré', color: '#d97706' },
                { label: '6.5-10 Sévère', color: '#dc2626' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.color }} />
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Activity size={32} color="#c4b5fd" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600, color: '#1a1d26', marginBottom: '4px' }}>Pas encore de données EDSS</p>
            <p style={{ fontSize: '13px', color: '#9ca3b0' }}>Les scores seront ajoutés lors de vos prochaines visites</p>
          </div>
        )}
      </div>

      {/* Timeline des visites */}
      <div style={{
        background: '#fff', borderRadius: '16px',
        border: '1px solid #eef0f4',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #eef0f4',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: '#ecfdf5', border: '1px solid #a7f3d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Calendar size={17} color="#059669" />
          </div>
          <div>
            <span style={{ fontWeight: 600, fontSize: '15px', color: '#1a1d26' }}>Historique des visites</span>
            <span className="badge badge-emerald" style={{ marginLeft: '10px' }}>{visites.length} visite{visites.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        {visites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Calendar size={28} color="#c4b5fd" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontWeight: 600, color: '#1a1d26', marginBottom: '4px' }}>Aucune visite</p>
            <p style={{ fontSize: '13px', color: '#9ca3b0' }}>Vos consultations apparaîtront ici</p>
          </div>
        ) : (
          <div>
            {visites.map((v, i) => {
              const isExpanded = expandedVisite === v.id
              const edssColor = v.edss_score <= 3 ? '#059669' : v.edss_score <= 6 ? '#d97706' : '#dc2626'
              return (
                <div key={v.id} style={{
                  borderBottom: i < visites.length - 1 ? '1px solid #f4f5f7' : 'none',
                }}>
                  <div
                    onClick={() => setExpandedVisite(isExpanded ? null : v.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px',
                      padding: '16px 24px', cursor: 'pointer', transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fafbfd' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Timeline dot */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '16px', flexShrink: 0 }}>
                      <div style={{
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: edssColor, border: `3px solid ${edssColor}25`,
                      }} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#1a1d26' }}>
                          {new Date(v.date_visite).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      {v.notes && !isExpanded && (
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                          {v.notes}
                        </p>
                      )}
                    </div>

                    {v.edss_score !== null && (
                      <span className={`badge ${
                        v.edss_score <= 3 ? 'badge-emerald' :
                        v.edss_score <= 6 ? 'badge-amber' : 'badge-red'
                      }`}>
                        EDSS : {v.edss_score}
                      </span>
                    )}

                    {isExpanded ? <ChevronUp size={16} color="#9ca3b0" /> : <ChevronDown size={16} color="#9ca3b0" />}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="animate-slideUp" style={{ padding: '0 24px 20px 56px' }}>
                      {/* Tests fonctionnels */}
                      {v.tests_fonctionnels && Object.keys(v.tests_fonctionnels).length > 0 && (
                        <div style={{ marginBottom: '14px' }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#5a6070', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Tests fonctionnels
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {Object.entries(v.tests_fonctionnels).map(([k, val]) => {
                              const Icon = TEST_ICONS[k] || Zap
                              const scoreCfg = SCORE_LABELS[val] || SCORE_LABELS[0]
                              return (
                                <div key={k} style={{
                                  padding: '10px', borderRadius: '10px',
                                  background: scoreCfg.bg, textAlign: 'center',
                                }}>
                                  <Icon size={16} color={scoreCfg.color} style={{ margin: '0 auto 4px' }} />
                                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1d26', margin: '0 0 2px' }}>
                                    {TEST_LABELS[k] || k}
                                  </p>
                                  <span style={{ fontSize: '11px', fontWeight: 500, color: scoreCfg.color }}>
                                    {scoreCfg.label}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {v.notes && (
                        <div style={{
                          padding: '12px 14px', borderRadius: '10px',
                          background: '#f8f9fc', border: '1px solid #eef0f4',
                        }}>
                          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3b0', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</p>
                          <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6, margin: 0 }}>{v.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
