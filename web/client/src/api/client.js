import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Projects
export const listProjects = () => api.get('/projects').then(r => r.data);
export const createProject = (name) => api.post('/projects', { name }).then(r => r.data);
export const loadProject = (filename) => api.get(`/projects/${filename}`).then(r => r.data);
export const saveProject = (filename, data) => api.put(`/projects/${filename}`, data).then(r => r.data);
export const deleteProject = (filename) => api.delete(`/projects/${filename}`).then(r => r.data);

// Config
export const loadConfig = () => api.get('/config').then(r => r.data);
export const saveConfig = (data) => api.put('/config', data).then(r => r.data);

// Ignition
export const uploadToIgnition = (payload) => api.post('/ignition/upload', payload).then(r => r.data);
export const exportFromIgnition = (params) => api.get('/ignition/export', { params }).then(r => r.data);
export const testIgnitionConnection = (data) => api.post('/ignition/test', data).then(r => r.data);

export default api;
