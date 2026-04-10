import api from './api'

export const patientService = {
  // Lister les patients
  getAll: (page = 1, limit = 10, search = '', sexe = '') =>
    api.get('/patients/', { params: { page, limit, search, sexe } }),

  // Un seul patient
  getById: (id) =>
    api.get(`/patients/${id}`),

  // Créer un patient
  create: (data) =>
    api.post('/patients/', data),

  // Modifier un patient
  update: (id, data) =>
    api.put(`/patients/${id}`, data),

  // Supprimer un patient
  delete: (id) =>
    api.delete(`/patients/${id}`),

  // Visites d'un patient
  getVisites: (patientId, page = 1) =>
    api.get(`/patients/${patientId}/visites`, { params: { page } }),

  // Créer une visite
  createVisite: (patientId, data) =>
    api.post(`/patients/${patientId}/visites`, data),

  // IRM d'un patient
  getIRM: (patientId) =>
    api.get(`/patients/${patientId}/irm`),

  // Uploader une IRM
  uploadIRM: (patientId, formData, sequenceType) =>
    api.post(`/patients/${patientId}/irm?sequence_type=${sequenceType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
}