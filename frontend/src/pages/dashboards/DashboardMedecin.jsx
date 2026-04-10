import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Brain, Activity, FlaskConical, AlertTriangle, AlertCircle, Info, RefreshCw, Clock, TrendingUp, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

const REFRESH_INTERVAL = 30000

const NIVEAU_CONFIG = {
  danger:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: AlertCircle, label: 'Critique' },
  warning: { color: '#d97706', bg: '#fffbeb', border: '#fcd34d', icon: AlertTriangle, label: 'Attention' },
  info:    { color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', icon: Info, label: 'Info' },
}

const TYPE_LABEL = {
  edss_eleve:       'EDSS élevé',
  progression_edss: 'Progression EDSS',
  suivi_manquant:   'Suivi manquant',
  irm_en_attente:   'IRM en attente',
}

export default function DashboardMedecin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [alertes, setAlertes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchStats = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await api.get('/dashboard/stats')
      setStats(res.data.stats)
      setAlertes(res.data.alertes)
      setLastRefresh(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(() => fetchStats(), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchStats])

  const formatTime = (date) => {
    if (!date) return '—'
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const cards = [
    {
      label: 'Mes patients', value: stats?.total_patients ?? '—',
      icon: Users, color: '#2563eb', gradient: 'stat-gradient-blue',
      onClick: () => navigate('/patients'),
    },
    {
      label: "Visites aujourd'hui", value: stats?.visites_aujourdhui ?? '—',
      icon: Activity, color: '#059669', gradient: 'stat-gradient-emerald',
      onClick: () => navigate('/visites'),
    },
    {
      label: 'IRM en attente', value: stats?.irm_en_attente ?? '—',
      icon: Brain, color: '#7c3aed', gradient: 'stat-gradient-violet',
      onClick: () => navigate('/irm'),
    },
    {
      label: 'Analyses en attente', value: stats?.analyses_en_attente ?? '—',
      icon: FlaskConical, color: '#d97706', gradient: 'stat-gradient-amber',
      onClick: null,
    },
  ]

  const dangerCount = alertes.filter(a => a.niveau === 'danger').length
  const warningCount = alertes.filter(a => a.niveau === 'warning').length

  return (
    <div className="animate-fadeIn" style={{ color: '#1a1d26' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1d26', margin: 0, letterSpacing: '-0.02em' }}>
            Bonjour, Dr. {user?.nom} 👋
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '6px' }}>
            Voici votre vue d'ensemble — mise à jour automatique
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastRefresh && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3b0', fontSize: '12px' }}>
              <Clock size={12} />
              {formatTime(lastRefresh)}
            </span>
          )}
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="btn-ghost"
            style={{ padding: '8px 14px', fontSize: '13px' }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────── */}
      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {cards.map(({ label, value, icon: Icon, color, gradient, onClick }) => (
          <div
            key={label}
            onClick={onClick}
            className={gradient}
            style={{
              borderRadius: '16px', padding: '24px',
              cursor: onClick ? 'pointer' : 'default',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => {
              if (onClick) {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = `0 8px 24px ${color}18`
              }
            }}
            onMouseLeave={e => {
              if (onClick) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: `${color}12`, border: `1px solid ${color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 700, color: '#1a1d26', letterSpacing: '-0.02em' }}>
              {loading ? <span style={{ fontSize: '20px', color: '#9ca3b0' }}>…</span> : value}
            </div>
            {onClick && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                marginTop: '12px', fontSize: '12px', color: '#9ca3b0', fontWeight: 500,
                transition: 'color 0.2s',
              }}>
                Voir détails <ArrowRight size={12} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Alerts Panel ────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: '16px',
        border: '1px solid #eef0f4',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #eef0f4',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#fffbeb', border: '1px solid #fcd34d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={18} color="#d97706" />
            </div>
            <span style={{ fontWeight: 600, fontSize: '16px', color: '#1a1d26' }}>Alertes patients</span>
            {!loading && alertes.length > 0 && (
              <span className="badge badge-amber">
                {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {dangerCount > 0 && <span className="badge badge-red">{dangerCount} critique{dangerCount > 1 ? 's' : ''}</span>}
            {warningCount > 0 && <span className="badge badge-amber">{warningCount} attention</span>}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3b0' }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', margin: '0 auto 12px',
              border: '2px solid #eef0f4', borderTopColor: '#4f46e5',
              animation: 'spin 0.8s linear infinite',
            }} />
            Chargement...
          </div>
        ) : alertes.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px', margin: '0 auto 14px',
              background: '#ecfdf5', border: '1px solid #a7f3d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={24} color="#059669" />
            </div>
            <div style={{ color: '#1a1d26', fontWeight: 600, fontSize: '16px', marginBottom: '6px' }}>
              Tout est en ordre ✓
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              Aucune alerte — tous vos patients sont à jour
            </div>
          </div>
        ) : (
          <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
            {alertes.map((alerte, i) => {
              const cfg = NIVEAU_CONFIG[alerte.niveau] || NIVEAU_CONFIG.info
              const Icon = cfg.icon
              return (
                <div
                  key={i}
                  onClick={() => navigate(`/patients/${alerte.patient_id}`)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '14px',
                    padding: '16px 24px',
                    borderBottom: i < alertes.length - 1 ? '1px solid #f4f5f7' : 'none',
                    borderLeft: `3px solid ${cfg.color}`,
                    background: cfg.bg,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${cfg.color}08` }}
                  onMouseLeave={e => { e.currentTarget.style.background = cfg.bg }}
                >
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                    background: '#fff', border: `1px solid ${cfg.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={16} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#1a1d26' }}>
                        {alerte.patient_nom}
                      </span>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em',
                        padding: '2px 8px', borderRadius: '10px',
                        background: '#fff', color: cfg.color,
                        border: `1px solid ${cfg.border}`,
                      }}>
                        {TYPE_LABEL[alerte.type] || alerte.type}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '3px' }}>
                      {alerte.message}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3b0', marginTop: '2px' }}>
                      {alerte.detail}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '12px', color: '#9ca3b0', whiteSpace: 'nowrap', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    Voir <ArrowRight size={12} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
