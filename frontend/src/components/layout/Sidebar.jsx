import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Brain, Activity,
  Settings, LogOut, FlaskConical, FileText, Clock, Calendar, MessageSquare,
  Newspaper, Heart, Sparkles, FolderOpen
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const menuParRole = {
  medecin: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/patients', icon: Users, label: 'Patients' },
    { to: '/visites', icon: Activity, label: 'Visites cliniques' },
    { to: '/irm', icon: Brain, label: 'IRM' },
    { to: '/agenda', icon: Calendar, label: 'Agenda' },
    { to: '/chat', icon: MessageSquare, label: 'Assistant IA', badge: 'IA' },
  ],
  radiologue: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/irm', icon: Brain, label: 'IRM & Imagerie' },
    { to: '/rapports', icon: FileText, label: 'Mes rapports' },
  ],
  laboratoire: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/analyses', icon: FlaskConical, label: 'Analyses' },
    { to: '/resultats', icon: FileText, label: 'Résultats' },
  ],
  admin: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/utilisateurs', icon: Users, label: 'Utilisateurs' },
    { to: '/admin/validations', icon: Clock, label: 'Validations' },
    { to: '/admin/settings', icon: Settings, label: 'Paramètres' },
  ],
  patient: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/mon-dossier', icon: FolderOpen, label: 'Mon dossier' },
    { to: '/mon-evolution', icon: Activity, label: 'Mon évolution' },
    { to: '/mes-rapports', icon: FileText, label: 'Mes rapports' },
    { to: '/actualites', icon: Newspaper, label: 'Actualités SEP', badge: 'NEW' },
  ],
}

const roleLabel = {
  medecin: 'Médecin',
  radiologue: 'Radiologue',
  laboratoire: 'Laboratoire',
  admin: 'Administrateur',
  patient: 'Patient',
}

const roleColor = {
  medecin: '#4f46e5',
  radiologue: '#0891b2',
  laboratoire: '#059669',
  admin: '#d97706',
  patient: '#e11d48',
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const menu = menuParRole[user?.role] || []
  const accent = roleColor[user?.role] || '#4f46e5'

  return (
    <aside style={{
      width: '260px',
      minHeight: '100vh',
      background: '#ffffff',
      borderRight: '1px solid #eef0f4',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 24px 28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src="/logo-sep.png"
          alt="Neuro Predict MS"
          style={{ width: '42px', height: '42px', objectFit: 'contain', flexShrink: 0 }}
        />
        <div>
          <div style={{
            fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em',
            color: '#1a1d26',
          }}>
            Neuro Predict MS
          </div>
          <div style={{ fontSize: '10px', color: '#9ca3b0', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            by NeuroNova
          </div>
        </div>
      </div>

      {/* User Card */}
      <div style={{
        margin: '0 16px 24px',
        padding: '14px 16px',
        borderRadius: '12px',
        background: '#f8f9fc',
        border: '1px solid #eef0f4',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 700, color: '#fff',
            boxShadow: `0 2px 8px ${accent}30`,
          }}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '14px', fontWeight: 600, color: '#1a1d26',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user?.prenom} {user?.nom}
            </div>
            <div style={{
              fontSize: '12px', fontWeight: 500, color: accent,
            }}>
              {roleLabel[user?.role]}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0 12px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3b0', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 12px 10px' }}>
          Navigation
        </div>
        {menu.map(({ to, icon: Icon, label, badge }) => {
          const isActive = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to))
          return (
            <NavLink key={to} to={to} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 12px', borderRadius: '10px', marginBottom: '2px',
              textDecoration: 'none', fontSize: '14px', fontWeight: isActive ? 600 : 500,
              color: isActive ? '#4f46e5' : '#5a6070',
              background: isActive ? '#eef2ff' : 'transparent',
              transition: 'all 0.2s',
              position: 'relative',
            }}>
              {/* Active indicator */}
              {isActive && (
                <div style={{
                  position: 'absolute', left: '-12px', top: '50%', transform: 'translateY(-50%)',
                  width: '3px', height: '20px', borderRadius: '0 3px 3px 0',
                  background: 'linear-gradient(180deg, #4f46e5, #7c3aed)',
                }} />
              )}
              <Icon size={18} style={{
                color: isActive ? '#4f46e5' : '#9ca3b0',
                transition: 'color 0.2s',
              }} />
              <span style={{ flex: 1 }}>{label}</span>
              {badge && (
                <span style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em',
                  padding: '2px 7px', borderRadius: '6px',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#fff',
                }}>
                  {badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 12px 8px' }}>
        <div style={{ height: '1px', background: '#eef0f4', margin: '0 12px 12px' }} />
        <button onClick={() => { logout(); navigate('/login') }} style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          width: '100%', padding: '10px 12px', borderRadius: '10px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#9ca3b0', fontSize: '14px', fontWeight: 500,
          fontFamily: 'inherit', transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9ca3b0'; e.currentTarget.style.background = 'transparent' }}
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}