/* ═══════════════════════════════════════════════════════════════
   APP.JSX — Neuro Predict MS
   Router principal avec routes protégées par rôle
   (médecin, radiologue, laboratoire, admin, patient)
   Auteur: Wiem Saafi | NeuroNova Team
   ═══════════════════════════════════════════════════════════════ */
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import PatientsList from './pages/patients/PatientsList'
import PatientDetail from './pages/patients/PatientDetail'
import IRMQueue from './pages/IRMQueue'
import Login from './pages/Login'
import Inscription from './pages/Inscription'
import Admin from './pages/Admin'
import IrmRadiologue from './pages/radiologue/IrmRadiologue'
import RapportDetail from './pages/radiologue/RapportDetail'
import Analyses from './pages/laboratoire/Analyses'
import Resultats from './pages/laboratoire/Resultats'
import AdminUtilisateurs from './pages/admin/AdminUtilisateurs'
import AdminValidations from './pages/admin/AdminValidations'
import Visites from './pages/Visites'
import Agenda from './pages/Agenda'
import MesRapports from './pages/radiologue/MesRapports'
import ChatIA from './pages/ChatIA'

// Patient pages
import MonDossier from './pages/patient/MonDossier'
import MonEvolution from './pages/patient/MonEvolution'
import MesRapportsPatient from './pages/patient/MesRapportsPatient'
import ActualitesSEP from './pages/patient/ActualitesSEP'


function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Chargement...</div>
  if (!user) return <Navigate to="/home" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/home" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/inscription" element={<Inscription />} />
      <Route path="/admin" element={<Navigate to="/admin/utilisateurs" replace />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
      <Route path="agenda" element={<PrivateRoute roles={['medecin', 'admin']}><Agenda /></PrivateRoute>} />
      <Route path="chat" element={<PrivateRoute roles={['medecin', 'admin']}><ChatIA /></PrivateRoute>} />
      <Route path="rapports" element={<PrivateRoute roles={['radiologue']}><MesRapports /></PrivateRoute>} />

        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Médecin */}
        <Route path="patients" element={<PrivateRoute roles={['medecin', 'admin']}><PatientsList /></PrivateRoute>} />
        <Route path="patients/:id" element={<PrivateRoute roles={['medecin', 'admin']}><PatientDetail /></PrivateRoute>} />
        <Route path="visites" element={<PrivateRoute roles={['medecin', 'admin']}><Visites /></PrivateRoute>} />
        {/* Radiologue */}
        <Route path="irm-queue" element={<PrivateRoute roles={['radiologue', 'admin']}><IRMQueue /></PrivateRoute>} />
        <Route path="irm" element={<PrivateRoute roles={['radiologue', 'admin']}><IrmRadiologue /></PrivateRoute>} />
        <Route path="rapports/:id" element={<PrivateRoute roles={['radiologue']}><RapportDetail /></PrivateRoute>} />

        {/* Laboratoire */}
        <Route path="analyses" element={<PrivateRoute roles={['laboratoire']}><Analyses /></PrivateRoute>} />
        <Route path="resultats" element={<PrivateRoute roles={['laboratoire']}><Resultats /></PrivateRoute>} />

        {/* Admin */}
        <Route path="admin/utilisateurs" element={<PrivateRoute roles={['admin']}><AdminUtilisateurs /></PrivateRoute>} />
        <Route path="admin/validations" element={<PrivateRoute roles={['admin']}><AdminValidations /></PrivateRoute>} />

        {/* Patient */}
        <Route path="mon-dossier" element={<PrivateRoute roles={['patient']}><MonDossier /></PrivateRoute>} />
        <Route path="mon-evolution" element={<PrivateRoute roles={['patient']}><MonEvolution /></PrivateRoute>} />
        <Route path="mes-rapports" element={<PrivateRoute roles={['patient']}><MesRapportsPatient /></PrivateRoute>} />
        <Route path="actualites" element={<PrivateRoute roles={['patient']}><ActualitesSEP /></PrivateRoute>} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App