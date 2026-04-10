import { useAuth } from '../context/AuthContext'
import DashboardMedecin from './dashboards/DashboardMedecin'
import DashboardRadiologue from './dashboards/DashboardRadiologue'
import DashboardLaboratoire from './dashboards/DashboardLaboratoire'
import DashboardPatient from './dashboards/DashboardPatient'

export default function Dashboard() {
  const { user } = useAuth()

  if (user?.role === 'radiologue') return <DashboardRadiologue />
  if (user?.role === 'laboratoire') return <DashboardLaboratoire />
  if (user?.role === 'patient') return <DashboardPatient />
  return <DashboardMedecin />
}