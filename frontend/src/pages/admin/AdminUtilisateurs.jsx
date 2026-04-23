import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { CheckCircle, XCircle, Clock, User } from 'lucide-react'

export default function AdminUtilisateurs() {
  const { user: currentUser } = useAuth()
  const [onglet, setOnglet] = useState('en_attente')
  const [utilisateurs, setUtilisateurs] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')



  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  

  useEffect(() => { charger() }, [onglet])

  const charger = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/api/admin/utilisateurs', { headers })
      const data = await res.json()
      const filtres = data.filter(u => u.role !== 'admin')
      if (onglet === 'en_attente') {
        setUtilisateurs(filtres.filter(u => u.statut === 'en_attente'))
      } else {
        setUtilisateurs(filtres.filter(u => u.statut !== 'en_attente'))
      }
    } catch {
      setMessage('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const action = async (id, acte) => {
    try {
      await fetch(`http://localhost:8000/api/admin/utilisateurs/${id}/${acte}`, {
        method: 'PUT', headers
      })
      setMessage(acte === 'valider' ? '✅ Compte validé' : '❌ Compte refusé')
      setTimeout(() => setMessage(''), 3000)
      charger()
    } catch {
      setMessage('Erreur')
    }
  }

  const roleColor = {
    medecin: '#3b82f6',
    radiologue: '#8b5cf6',
    laboratoire: '#10b981',
  }

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
        Gestion des utilisateurs
      </h1>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>
        Validation et suivi des comptes
      </p>

      {/* Message feedback */}
      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: message.includes('✅') ? '#f0fdf4' : '#fef2f2',
          color: message.includes('✅') ? '#166534' : '#991b1b',
          border: `1px solid ${message.includes('✅') ? '#bbf7d0' : '#fecaca'}`
        }}>
          {message}
        </div>
      )}

      {/* Onglets */}
      <div style={{
        display: 'flex', gap: '0', marginBottom: '24px',
        background: '#f1f5f9', borderRadius: '10px', padding: '4px', width: 'fit-content'
      }}>
        {[
          { key: 'en_attente', label: '⏳ En attente de validation' },
          { key: 'actifs', label: '✅ Utilisateurs actifs' },
        ].map(o => (
          <button key={o.key} onClick={() => setOnglet(o.key)} style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none',
            cursor: 'pointer', fontWeight: 500, fontSize: '14px',
            background: onglet === o.key ? 'white' : 'transparent',
            color: onglet === o.key ? '#0f172a' : '#64748b',
            boxShadow: onglet === o.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s'
          }}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {loading ? (
        <p style={{ color: '#64748b' }}>Chargement...</p>
      ) : utilisateurs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px', background: 'white',
          borderRadius: '12px', border: '1px solid #e2e8f0'
        }}>
          <Clock size={48} color="#94a3b8" style={{ margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: '#64748b' }}>
            {onglet === 'en_attente' ? 'Aucun compte en attente' : 'Aucun utilisateur actif'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {utilisateurs.map(u => (
            <div key={u.id} style={{
              background: 'white', borderRadius: '12px', padding: '20px 24px',
              border: '1px solid #e2e8f0', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              {/* Infos utilisateur */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: (roleColor[u.role] || '#94a3b8') + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 700,
                  color: roleColor[u.role] || '#94a3b8'
                }}>
                  {u.prenom?.[0]}{u.nom?.[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>
                    {u.prenom} {u.nom}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '13px' }}>{u.email}</div>
                  <span style={{
                    display: 'inline-block', marginTop: '4px',
                    background: (roleColor[u.role] || '#94a3b8') + '20',
                    color: roleColor[u.role] || '#94a3b8',
                    padding: '2px 10px', borderRadius: '20px',
                    fontSize: '12px', fontWeight: 600
                  }}>
                    {u.role}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {onglet === 'en_attente' ? (
                  <>
                    <button onClick={() => action(u.id, 'valider')} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 18px', borderRadius: '8px', border: 'none',
                      background: '#22c55e', color: 'white', cursor: 'pointer', fontWeight: 600
                    }}>
                      <CheckCircle size={16} /> Valider
                    </button>
                    <button onClick={() => action(u.id, 'refuser')} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 18px', borderRadius: '8px', border: 'none',
                      background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600
                    }}>
                      <XCircle size={16} /> Refuser
                    </button>
                  </>
                ) : (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: '#22c55e', fontSize: '13px', fontWeight: 500
                  }}>
                    <CheckCircle size={16} /> Actif
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}