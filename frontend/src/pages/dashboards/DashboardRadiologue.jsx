import { useEffect, useState } from 'react'
import { Brain, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function DashboardRadiologue() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [irms, setIrms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchIRMs = async () => {
      try {
        const pRes = await api.get('/patients/?limit=100')
        const patients = pRes.data.data || []
        let allIrms = []
        for (const p of patients) {
          const iRes = await api.get(`/patients/${p.id}/irm/`)
          const irmsWithPatient = (iRes.data.data || []).map(irm => ({
            ...irm,
            patient_nom: `${p.prenom} ${p.nom}`
          }))
          allIrms = [...allIrms, ...irmsWithPatient]
        }
        setIrms(allIrms)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchIRMs()
  }, [])

  const pending = irms.filter(i => i.statut === 'pending')
  const analysee = irms.filter(i => i.statut === 'analysee')
  const done = irms.filter(i => i.statut === 'done')

  const cards = [
    { label: 'En attente', value: pending.length, icon: Clock, color: 'bg-orange-500' },
    { label: 'Analysées IA', value: analysee.length, icon: Brain, color: 'bg-purple-500' },
    { label: 'Terminées', value: done.length, icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Total IRM', value: irms.length, icon: AlertCircle, color: 'bg-blue-500' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour Dr. {user?.nom} 👋
        </h1>
        <p className="text-gray-500 mt-1">File d'attente IRM — vue radiologue</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`${color} p-2 rounded-lg`}>
                <Icon size={18} className="text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : value}
            </div>
          </div>
        ))}
      </div>

      {/* IRM en attente */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">IRM en attente de traitement</h2>
          <button
            onClick={() => navigate('/irm-queue')}
            className="text-sm text-blue-600 hover:underline"
          >
            Voir tout →
          </button>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Chargement...</div>
        ) : pending.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Aucune IRM en attente</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Sequence</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Taille</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pending.slice(0, 5).map(irm => (
                <tr key={irm.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{irm.patient_nom}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{irm.sequence_type || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{irm.metadata?.taille_mb} MB</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      En attente
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}