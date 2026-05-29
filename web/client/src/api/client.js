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
export const renameProject = (filename, newName, description) =>
  api.patch(`/projects/${filename}`, { newName, description }).then(r => r.data);
export const deleteProject = (filename) => api.delete(`/projects/${filename}`).then(r => r.data);

// Config
export const loadConfig = () => api.get('/config').then(r => r.data);
export const saveConfig = (data) => api.put('/config', data).then(r => r.data);

// Ignition
export const uploadToIgnition = (payload) => api.post('/ignition/upload', payload).then(r => r.data);
export const exportFromIgnition = (params) => api.get('/ignition/export', { params }).then(r => r.data);
export const testIgnitionConnection = (data) => api.post('/ignition/test', data).then(r => r.data);

// Siemens TIA Portal bridge
export const testSiemensConnection = (data) => api.post('/siemens/test', data).then(r => r.data);

// Communications — session-based live connections
export const connectOpc     = (d) => api.post('/connections/opc/connect',     d).then(r => r.data);
export const browseOpc      = (d) => api.post('/connections/opc/browse',      d).then(r => r.data);
export const readOpc        = (d) => api.post('/connections/opc/read',        d).then(r => r.data);
export const disconnectOpc  = (d) => api.post('/connections/opc/disconnect',  d).then(r => r.data);

export const connectMqtt    = (d) => api.post('/connections/mqtt/connect',    d).then(r => r.data);
export const mqttMessages   = (p) => api.get('/connections/mqtt/messages', { params: p }).then(r => r.data);
export const subscribeMqtt  = (d) => api.post('/connections/mqtt/subscribe',  d).then(r => r.data);
export const publishMqtt    = (d) => api.post('/connections/mqtt/publish',    d).then(r => r.data);
export const disconnectMqtt = (d) => api.post('/connections/mqtt/disconnect', d).then(r => r.data);

export const connectModbus    = (d) => api.post('/connections/modbus/connect',    d).then(r => r.data);
export const readModbus       = (d) => api.post('/connections/modbus/read',       d).then(r => r.data);
export const disconnectModbus = (d) => api.post('/connections/modbus/disconnect', d).then(r => r.data);

export default api;
