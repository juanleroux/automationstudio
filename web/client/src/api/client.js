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
export const getFoldersFromIgnition = (params) => api.get('/ignition/folders', { params }).then(r => r.data);
export const testIgnitionConnection = (data) => api.post('/ignition/test', data).then(r => r.data);
export const resetIgnitionPassword = (newPassword) => api.post('/ignition/reset-password', { newPassword }).then(r => r.data);

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

export const connectEnip      = (d) => api.post('/connections/enip/connect',      d).then(r => r.data);
export const enipTags         = (d) => api.post('/connections/enip/tags',         d).then(r => r.data);
export const readEnip         = (d) => api.post('/connections/enip/read',         d).then(r => r.data);
export const disconnectEnip   = (d) => api.post('/connections/enip/disconnect',   d).then(r => r.data);

export const connectS7        = (d) => api.post('/connections/s7/connect',        d).then(r => r.data);
export const readS7           = (d) => api.post('/connections/s7/read',           d).then(r => r.data);
export const disconnectS7     = (d) => api.post('/connections/s7/disconnect',     d).then(r => r.data);

export const pingNode         = (d) => api.post('/connections/ping',              d).then(r => r.data);

export const snmpWalk         = (d) => api.post('/connections/snmp/walk',         d).then(r => r.data);
export const snmpGet          = (d) => api.post('/connections/snmp/get',          d).then(r => r.data);
export const snmpSet          = (d) => api.post('/connections/snmp/set',          d).then(r => r.data);

export default api;
