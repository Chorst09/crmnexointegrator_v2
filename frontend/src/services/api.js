// API Service Layer
import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: import.meta.env.VITE_API_TIMEOUT || 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
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

// API Methods
export const apiService = {
  // Auth
  auth: {
    login: (credentials) => api.post('/api/auth/login', credentials),
    logout: () => api.post('/api/auth/logout'),
    me: () => api.get('/api/auth/me'),
    refreshToken: () => api.post('/api/auth/refresh')
  },

  // Companies
  companies: {
    getAll: (params) => api.get('/api/companies', { params }),
    getById: (id) => api.get(`/api/companies/${id}`),
    create: (data) => api.post('/api/companies', data),
    update: (id, data) => api.put(`/api/companies/${id}`, data),
    delete: (id) => api.delete(`/api/companies/${id}`)
  },

  // Opportunities
  opportunities: {
    getAll: (params) => api.get('/api/opportunities', { params }),
    getById: (id) => api.get(`/api/opportunities/${id}`),
    create: (data) => api.post('/api/opportunities', data),
    update: (id, data) => api.put(`/api/opportunities/${id}`, data),
    delete: (id) => api.delete(`/api/opportunities/${id}`)
  },

  // Proposals
  proposals: {
    getAll: (params) => api.get('/api/proposals', { params }),
    getById: (id) => api.get(`/api/proposals/${id}`),
    create: (data) => api.post('/api/proposals', data),
    update: (id, data) => api.put(`/api/proposals/${id}`, data),
    delete: (id) => api.delete(`/api/proposals/${id}`),
    send: (id) => api.post(`/api/proposals/${id}/send`)
  },

  // Contracts
  contracts: {
    getAll: (params) => api.get('/api/contracts', { params }),
    getById: (id) => api.get(`/api/contracts/${id}`),
    create: (data) => api.post('/api/contracts', data),
    update: (id, data) => api.put(`/api/contracts/${id}`, data),
    delete: (id) => api.delete(`/api/contracts/${id}`),
    uploadAttachment: (id, file) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/api/contracts/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
  },

  // Users
  users: {
    getAll: (params) => api.get('/api/users', { params }),
    getById: (id) => api.get(`/api/users/${id}`),
    create: (data) => api.post('/api/users', data),
    update: (id, data) => api.put(`/api/users/${id}`, data),
    delete: (id) => api.delete(`/api/users/${id}`)
  },

  // Products
  products: {
    getAll: (params) => api.get('/api/products', { params }),
    getById: (id) => api.get(`/api/products/${id}`),
    create: (data) => api.post('/api/products', data),
    update: (id, data) => api.put(`/api/products/${id}`, data),
    delete: (id) => api.delete(`/api/products/${id}`)
  },

  // Dashboard
  dashboard: {
    getStats: () => api.get('/api/dashboard/stats'),
    getCharts: () => api.get('/api/dashboard/charts')
  },

  // Kickoff
  kickoff: {
    getStats: () => api.get('/api/kickoff/stats'),
    getMeetings: (params) => api.get('/api/kickoff/meetings', { params }),
    getMeeting: (id) => api.get(`/api/kickoff/meetings/${id}`),
    createMeeting: (data) => api.post('/api/kickoff/meetings', data),
    updateMeeting: (id, data) => api.put(`/api/kickoff/meetings/${id}`, data),
    deleteMeeting: (id) => api.delete(`/api/kickoff/meetings/${id}`),
    updateStatus: (id, data) => api.patch(`/api/kickoff/meetings/${id}/status`, data),
    saveNotes: (id, data) => api.put(`/api/kickoff/meetings/${id}/notes`, data),
    getOpportunityPreview: (id) => api.get(`/api/kickoff/opportunities/${id}/preview`),
    getTemplates: (params) => api.get('/api/kickoff/templates', { params }),
    createTemplate: (data) => api.post('/api/kickoff/templates', data),
    updateTemplate: (id, data) => api.put(`/api/kickoff/templates/${id}`, data),
    deleteTemplate: (id) => api.delete(`/api/kickoff/templates/${id}`),
    addParticipant: (meetingId, data) => api.post(`/api/kickoff/meetings/${meetingId}/participants`, data),
    updateParticipant: (id, data) => api.patch(`/api/kickoff/participants/${id}`, data),
    deleteParticipant: (id) => api.delete(`/api/kickoff/participants/${id}`),
    addAgendaItem: (meetingId, data) => api.post(`/api/kickoff/meetings/${meetingId}/agenda`, data),
    deleteAgendaItem: (id) => api.delete(`/api/kickoff/agenda/${id}`),
    addChecklistItem: (meetingId, data) => api.post(`/api/kickoff/meetings/${meetingId}/checklist`, data),
    toggleChecklistItem: (id, data) => api.patch(`/api/kickoff/checklist/${id}`, data),
    deleteChecklistItem: (id) => api.delete(`/api/kickoff/checklist/${id}`),
    addActionItem: (meetingId, data) => api.post(`/api/kickoff/meetings/${meetingId}/action-items`, data),
    updateActionItem: (id, data) => api.patch(`/api/kickoff/action-items/${id}`, data),
    deleteActionItem: (id) => api.delete(`/api/kickoff/action-items/${id}`)
  }
};

export default api;