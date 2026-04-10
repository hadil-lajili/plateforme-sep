import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, X, Calendar, Clock, Brain, FlaskConical, Bell, Activity } from 'lucide-react'

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default function Agenda() {
  const { user } = useAuth()
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [evenements, setEvenements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ titre: '', description: '', date_rappel: '' })
  const [filtre, setFiltre] = useState('tous')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => { charger() }, [])

  const charger = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agenda/evenements/', { headers })

      const data = await res.json()
      setEvenements(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  const creerRappel = async () => {
    if (!form.titre || !form.date_rappel) {
      setMessage('⚠️ Titre et date obligatoires')
      return
    }
    try {
      const res = await fetch('/api/agenda/rappels/', {

        method: 'POST', headers, body: JSON.stringify(form)
      })
      if (res.ok) {
        setMessage('✅ Rappel créé')
        setShowForm(false)
        setForm({ titre: '', description: '', date_rappel: '' })
        setTimeout(() => setMessage(''), 3000)
        charger()
      }
    } catch { setMessage('❌ Erreur') }
  }

  const supprimerRappel = async (id) => {
    await fetch(`/api/agenda/rappels/${id}`, { method: 'DELETE', headers })
    charger()
  }

  const typeIcon = {
    visite: <Activity size={16} color="#3b82f6" />,
    irm: <Brain size={16} color="#8b5cf6" />,
    analyse: <FlaskConical size={16} color="#10b981" />,
    rappel: <Bell size={16} color="#f59e0b" />,
  }

  const typeLabel = { visite: 'Visite', irm: 'IRM', analyse: 'Analyse', rappel: 'Rappel' }

  // Filtrer
  const evFiltres = evenements.filter(e => filtre === 'tous' || e.type === filtre)

  // Grouper par jour
  const isToday = (d) => { const dt = new Date(d); dt.setHours(0,0,0,0); return dt.getTime() === today.getTime() }
  const isThisWeek = (d) => {
    const dt = new Date(d); dt.setHours(0,0,0,0)
    const fin = new Date(today); fin.setDate(today.getDate() + 7)
    return dt >= today && dt <= fin
  }

  const auj = evFiltres.filter(e => e.date && isToday(e.date))
  const semaine = evFiltres.filter(e => e.date && isThisWeek(e.date) && !isToday(e.date))
  const avenir = evFiltres.filter(e => {
    if (!e.date) return false
    const dt = new Date(e.date); dt.setHours(0,0,0,0)
    const fin = new Date(today); fin.setDate(today.getDate() + 7)
    return dt > fin
  })

  const formatDate = (d) => {
    const dt = new Date(d)
    return `${JOURS[dt.getDay()]} ${dt.getDate()} ${MOIS[dt.getMonth()]} — ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`
  }

  const EvenementCard = ({ e }) => (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '14px',
      padding: '14px 16px', borderRadius: '10px', background: 'white',
      border: `1px solid #e2e8f0`, borderLeft: `4px solid ${e.couleur}`,
      marginBottom: '8px'
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px',
        background: e.couleur + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        {typeIcon[e.type]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{e.titre}</div>
        <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>{e.description}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
          <Clock size={12} color="#94a3b8" />
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>{e.date ? formatDate(e.date) : '—'}</span>
          <span style={{
            marginLeft: '6px', padding: '1px 8px', borderRadius: '20px',
            background: e.couleur + '20', color: e.couleur, fontSize: '11px', fontWeight: 600
          }}>{typeLabel[e.type]}</span>
        </div>
      </div>
      {e.type === 'rappel' && (
        <button onClick={() => supprimerRappel(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
          <X size={16} color="#94a3b8" />
        </button>
      )}
    </div>
  )

  const Section = ({ titre, evs, badge }) => evs.length === 0 ? null : (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#374151', margin: 0 }}>{titre}</h2>
        <span style={{
          background: badge === 'today' ? '#ef4444' : '#e2e8f0',
          color: badge === 'today' ? 'white' : '#64748b',
          padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: 600
        }}>{evs.length}</span>
      </div>
      {evs.map(e => <EvenementCard key={e.id + e.type} e={e} />)}
    </div>
  )

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Agenda</h1>
          <p style={{ color: '#64748b' }}>
            {today.getDate()} {MOIS[today.getMonth()]} {today.getFullYear()}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 20px', borderRadius: '10px', border: 'none',
          background: '#0f172a', color: 'white', cursor: 'pointer', fontWeight: 600
        }}>
          <Plus size={18} /> Nouveau rappel
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { key: 'tous', label: 'Tout', color: '#0f172a' },
          { key: 'visite', label: 'Visites', color: '#3b82f6' },
          { key: 'irm', label: 'IRM', color: '#8b5cf6' },
          { key: 'analyse', label: 'Analyses', color: '#10b981' },
          { key: 'rappel', label: 'Rappels', color: '#f59e0b' },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltre(f.key)} style={{
            padding: '7px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            fontWeight: 500, fontSize: '13px',
            background: filtre === f.key ? f.color : '#f1f5f9',
            color: filtre === f.key ? 'white' : '#64748b',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: message.includes('✅') ? '#f0fdf4' : '#fffbeb',
          color: message.includes('✅') ? '#166534' : '#92400e',
        }}>{message}</div>
      )}

      {/* Formulaire rappel */}
      {showForm && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Nouveau rappel</h2>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color="#64748b" />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Titre *</label>
              <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                placeholder="Ex: Appeler patient Dupont"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Date et heure *</label>
              <input type="datetime-local" value={form.date_rappel} onChange={e => setForm(f => ({ ...f, date_rappel: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Détails..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#475569' }}>Annuler</button>
            <button onClick={creerRappel} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#0f172a', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Créer</button>
          </div>
        </div>
      )}

      {/* Événements */}
      {loading ? <p style={{ color: '#64748b' }}>Chargement...</p> : (
        evenements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <Calendar size={48} color="#94a3b8" style={{ margin: '0 auto 16px', display: 'block' }} />
            <p style={{ color: '#64748b' }}>Aucun événement à venir</p>
          </div>
        ) : (
          <>
            <Section titre="Aujourd'hui" evs={auj} badge="today" />
            <Section titre="Cette semaine" evs={semaine} badge="week" />
            <Section titre="À venir" evs={avenir} badge="future" />
            {auj.length === 0 && semaine.length === 0 && avenir.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ color: '#64748b' }}>Aucun événement pour ce filtre</p>
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}