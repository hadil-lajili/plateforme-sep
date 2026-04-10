import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const STATUT_COLORS = {
  en_attente: 'bg-orange-100 text-orange-700',
  actif: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
}

const ROLE_COLORS = {
  medecin: 'bg-blue-100 text-blue-700',
  radiologue: 'bg-purple-100 text-purple-700',
  laboratoire: 'bg-yellow-100 text-yellow-700',
  admin: 'bg-gray-100 text-gray-700',
}

export default function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login')
      return
    }
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/utilisateurs')
      setUsers(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const valider = async (id) => {
    try {
      const res = await api.put(`/admin/utilisateurs/${id}/valider`)
      setMessage(res.data.message)
      fetchUsers()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error(err)
    }
  }

  const refuser = async (id) => {
    try {
      const res = await api.put(`/admin/utilisateurs/${id}/refuser`)
      setMessage(res.data.message)
      fetchUsers()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error(err)
    }
  }

  const enAttente = users.filter(u => u.statut === 'en_attente')
  const autres = users.filter(u => u.statut !== 'en_attente')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">SEP Platform — Administration</h1>
          <p className="text-sm text-gray-500">Gestion des comptes utilisateurs</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')}
            className="text-sm text-blue-600 hover:underline">
            Aller au dashboard
          </button>
          <button onClick={logout}
            className="text-sm text-red-500 hover:underline">
            Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto py-8 px-4">
        {message && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {message}
          </div>
        )}

        {/* En attente */}
        <div className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            En attente de validation
            <span className="ml-2 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">
              {enAttente.length}
            </span>
          </h2>
          {enAttente.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
              Aucune demande en attente
            </div>
          ) : (
            <div className="space-y-3">
              {enAttente.map(u => (
                <div key={u.id} className="bg-white rounded-xl border border-orange-200 p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-semibold text-sm">
                      {u.prenom[0]}{u.nom[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{u.prenom} {u.nom}</p>
                      <p className="text-sm text-gray-500">{u.email}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => valider(u.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
                      Valider
                    </button>
                    <button onClick={() => refuser(u.id)}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600">
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tous les utilisateurs */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Tous les utilisateurs</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Utilisateur</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">Chargement...</td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 text-sm">{u.prenom} {u.nom}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[u.statut]}`}>
                        {u.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.statut === 'en_attente' && (
                        <div className="flex gap-2">
                          <button onClick={() => valider(u.id)} className="text-green-600 text-sm hover:underline">Valider</button>
                          <button onClick={() => refuser(u.id)} className="text-red-500 text-sm hover:underline">Refuser</button>
                        </div>
                      )}
                      {u.statut === 'actif' && u.role !== 'admin' && (
                        <button onClick={() => refuser(u.id)} className="text-red-500 text-sm hover:underline">Désactiver</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}