import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuthStore } from '../../store/authStore'
import { CheckCircle, XCircle, Clock, User } from 'lucide-react'

export default function AdminValidations() {
  const { token } = useAuthStore()
  const [utilisateurs, setUtilisateurs] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    chargerEnAttente()
  }, [])

  const chargerEnAttente = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/admin/utilisateurs?statut=en_attente', { headers })
      setUtilisateurs(res.data)
    } catch {
      setMessage('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const valider = async (id) => {
    try {
      await axios.put(`http://localhost:8000/api/admin/utilisateurs/${id}/valider`, {}, { headers })
      setMessage('✅ Compte validé')
      chargerEnAttente()
    } catch {
      setMessage('❌ Erreur lors de la validation')
    }
  }

  const refuser = async (id) => {
    try {
      await axios.put(`http://localhost:8000/api/admin/utilisateurs/${id}/refuser`, {}, { headers })
      setMessage('❌ Compte refusé')
      chargerEnAttente()
    } catch {
      setMessage('Erreur')
    }
  }

  const roleColor = { medecin: '#3b82f6', radiologue: '#8b5cf6', laboratoire: '#10b981' }

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Validations en attente</h1>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>Comptes en attente d'activation</p>

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

      {loading ? (
        <p style={{ color: '#64748b' }}>Chargement...</p>
      ) : utilisateurs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px', background: 'white',
          borderRadius: '12px', border: '1px solid #e2e8f0'
        }}>
          <Clock size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: '16px' }}>Aucun compte en attente de validation</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {utilisateurs.map(u => (
            <div key={u.id} style={{
              background: 'white', borderRadius: '12px', padding: '20px 24px',
              border: '1px solid #e2e8f0', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <User size={22} color="#64748b" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{u.prenom} {u.nom}</div>
                  <div style={{ color: '#64748b', fontSize: '13px' }}>{u.email}</div>
                  <span style={{
                    display: 'inline-block', marginTop: '4px',
                    background: roleColor[u.role] + '20', color: roleColor[u.role],
                    padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600
                  }}>
                    {u.role}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => valider(u.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  background: '#22c55e', color: 'white', cursor: 'pointer', fontWeight: 600
                }}>
                  <CheckCircle size={16} /> Valider
                </button>
                <button onClick={() => refuser(u.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600
                }}>
                  <XCircle size={16} /> Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}