import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  getMe: () => api.get('/auth/me')
};

export const houseAPI = {
  getAll: () => api.get('/houses'),
  getById: (id) => api.get(`/houses/${id}`),
  create: (data) => api.post('/houses', data),
  update: (id, data) => api.put(`/houses/${id}`, data),
  updateStatus: (id, status) => api.patch(`/houses/${id}/status`, { status }),
  
  getEvaluations: (houseId) => api.get(`/houses/${houseId}/evaluations`),
  createEvaluation: (houseId, data) => api.post(`/houses/${houseId}/evaluations`, data),
  updateEvaluationStatus: (evalId, status) => api.patch(`/houses/evaluations/${evalId}/status`, { status }),
  confirmEvaluation: (evalId) => api.post(`/houses/evaluations/${evalId}/confirm`),
  
  getSchemes: (houseId) => api.get(`/houses/${houseId}/schemes`),
  createScheme: (houseId, data) => api.post(`/houses/${houseId}/schemes`, data),
  updateScheme: (schemeId, data) => api.put(`/houses/schemes/${schemeId}`, data),
  updateSchemeStatus: (schemeId, status) => api.patch(`/houses/schemes/${schemeId}/status`, { status }),
  confirmScheme: (schemeId) => api.post(`/houses/schemes/${schemeId}/confirm`),
  
  getObjections: (houseId) => api.get(`/houses/${houseId}/objections`),
  createObjection: (houseId, data) => api.post(`/houses/${houseId}/objections`, data),
  updateObjection: (objId, data) => api.patch(`/houses/objections/${objId}`, data),
  
  getContracts: (houseId) => api.get(`/houses/${houseId}/contracts`),
  createContract: (houseId, data) => api.post(`/houses/${houseId}/contracts`, data),
  updateContractStatus: (contractId, status) => api.patch(`/houses/contracts/${contractId}/status`, { status }),
  signContract: (contractId) => api.post(`/houses/contracts/${contractId}/sign`),
  freezeContract: (contractId) => api.post(`/houses/contracts/${contractId}/freeze`),
  
  getAuditLogs: (houseId) => api.get(`/houses/${houseId}/audit-logs`)
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getRecentActivity: () => api.get('/dashboard/recent-activity'),
  getDashboard: () => api.get('/dashboard')
};

export default api;
