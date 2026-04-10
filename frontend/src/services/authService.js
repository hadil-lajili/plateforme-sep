import api from './api'

export const authService = {
  login: (email, mot_de_passe) =>
    api.post('/auth/login', { email, mot_de_passe }),

  inscription: (data) =>
    api.post('/auth/inscription', data),

  me: () =>
    api.get('/auth/me'),
}