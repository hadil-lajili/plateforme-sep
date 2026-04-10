import api from './api'

export const patientPortalService = {
  // Mon dossier (infos personnelles + résumé)
  getMonDossier: () =>
    api.get('/patient-portal/mon-dossier'),

  // Mes visites cliniques
  getMesVisites: () =>
    api.get('/patient-portal/mes-visites'),

  // Mes IRM
  getMesIRM: () =>
    api.get('/patient-portal/mes-irm'),

  // Mes rapports médicaux (IA)
  getMesRapports: () =>
    api.get('/patient-portal/mes-rapports'),

  // Mon évolution (EDSS timeline)
  getMonEvolution: () =>
    api.get('/patient-portal/mon-evolution'),

  // Actualités SEP
  getActualites: () =>
    api.get('/patient-portal/actualites'),
}
