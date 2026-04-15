/* ═══════════════════════════════════════════════════════════════
   TOPBAR COMPONENT — Neuro Predict MS
   Barre supérieure avec recherche, notifications et profil
   Auteur: Wiem Saafi | NeuroNova Team
   ═══════════════════════════════════════════════════════════════ */
import { Bell, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/patients': 'Patients',
  '/visites': 'Visites cliniques',
  '/irm': 'IRM & Imagerie',
  '/agenda': 'Agenda',
  '/chat': 'Assistant IA',
  '/analyses': 'Analyses biologiques',
  '/resultats': 'Résultats',
  '/rapports': 'Mes rapports',
  '/admin/utilisateurs': 'Gestion utilisateurs',
  '/admin/validations': 'Validations',
}

export default function Topbar() {
  const { user } = useAuth()
  const location = useLocation()

  const getTitle = () => {
    if (location.pathname.startsWith('/patients/')) return 'Détail patient'
    if (location.pathname.startsWith('/rapports/')) return 'Rapport IRM'
    return PAGE_TITLES[location.pathname] || 'Neuro Predict MS'
  }

  return (
    <header style={{
      height: '64px',
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid #eef0f4',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      {/* Left — Title */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1d26', margin: 0, letterSpacing: '-0.01em' }}>
          {getTitle()}
        </h2>
      </div>

      {/* Right — Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px', borderRadius: '10px',
          background: '#f4f5f7',
          border: '1px solid #eef0f4',
          color: '#9ca3b0', fontSize: '13px', cursor: 'pointer',
          transition: 'all 0.2s',
          minWidth: '200px',
        }}>
          <Search size={14} />
          <span>Rechercher...</span>
          <span style={{
            marginLeft: 'auto',
            fontSize: '11px', color: '#b8bdc7',
            padding: '2px 6px', borderRadius: '4px',
            background: '#eef0f4',
          }}>⌘K</span>
        </div>

        {/* Notifications */}
        <button style={{
          position: 'relative',
          width: '36px', height: '36px', borderRadius: '10px',
          background: '#f4f5f7',
          border: '1px solid #eef0f4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s',
          color: '#9ca3b0',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#c9cdd5'; e.currentTarget.style.color = '#5a6070' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#eef0f4'; e.currentTarget.style.color = '#9ca3b0' }}
        >
          <Bell size={16} />
          <span style={{
            position: 'absolute', top: '7px', right: '7px',
            width: '7px', height: '7px', borderRadius: '50%',
            background: '#ef4444', border: '1.5px solid #fff',
          }} />
        </button>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: '#fff',
          }}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1d26', margin: 0 }}>
              {user?.prenom} {user?.nom}
            </p>
            <p style={{ fontSize: '11px', color: '#9ca3b0', margin: 0, textTransform: 'capitalize' }}>
              {user?.role}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}