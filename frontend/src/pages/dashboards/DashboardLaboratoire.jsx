import { useAuth } from '../../context/AuthContext'
import { FlaskConical } from 'lucide-react'

export default function DashboardLaboratoire() {
  const { user } = useAuth()
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour {user?.prenom} {user?.nom} 👋
        </h1>
        <p className="text-gray-500 mt-1">Espace laboratoire</p>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
        <FlaskConical size={40} className="text-yellow-500 mx-auto mb-4" />
        <h3 className="font-semibold text-yellow-800 mb-2">Module laboratoire</h3>
        <p className="text-yellow-600 text-sm">
          Les fonctionnalites du laboratoire seront disponibles prochainement.
        </p>
      </div>
    </div>
  )
}