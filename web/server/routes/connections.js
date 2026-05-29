const express = require('express');
const router = express.Router();
const net = require('net');

// ─── Session store ────────────────────────────────────────────────────────────
// key: "opc:host:port" | "mqtt:host:port" | "modbus:host:port:unitId"
const store = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, s] of store) {
    if (now - s.lastUsed > 15 * 60 * 1000) {
      closeSession(s);
      store.delete(key);
    }
  }
}, 60_000);

function closeSession(s) {
  try { s.close?.(); } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPC UA — uses node-opcua for full browse + read
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/opc/connect', async (req, res) => {
  const { host, port = 4840, endpointPath = '' } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });

  const key = `opc:${host}:${port}`;
  if (store.has(key)) {
    store.get(key).lastUsed = Date.now();
    return res.json({ success: true, sessionId: key });
  }

  let opcua;
  try { opcua = require('node-opcua'); }
  catch { return res.status(500).json({ error: 'node-opcua package not available' }); }

  const endpointUrl = `opc.tcp://${host}:${port}${endpointPath}`;
  const client = opcua.OPCUAClient.create({
    endpointMustExist: false,
    connectionStrategy: { maxRetry: 0 },
    requestedSessionTimeout: 300_000,
  });

  const start = Date.now();
  try {
    await client.connect(endpointUrl);
    const session = await client.createSession();
    store.set(key, {
      type: 'opc', client, session, lastUsed: Date.now(),
      close: async () => { try { await session.close(); await client.disconnect(); } catch {} },
    });
    res.json({ success: true, sessionId: key, responseTime: Date.now() - start, endpoint: endpointUrl });
  } catch (err) {
    try { await client.disconnect(); } catch {}
    const msg = err.message.includes('ECONNREFUSED') ? 'Connection refused'
              : err.message.includes('ETIMEDOUT')    ? 'Connection timed out'
              : err.message;
    res.json({ success: false, error: msg, responseTime: Date.now() - start });
  }
});

router.post('/opc/browse', async (req, res) => {
  const { sessionId, nodeId = 'RootFolder' } = req.body;
  const s = store.get(sessionId);
  if (!s || s.type !== 'opc') return res.status(404).json({ error: 'Session not found — reconnect' });
  s.lastUsed = Date.now();

  let opcua;
  try { opcua = require('node-opcua'); } catch { return res.status(500).json({ error: 'node-opcua unavailable' }); }

  try {
    const result = await s.session.browse(nodeId);
    if (!result || result.statusCode?.value !== 0) {
      return res.json({ success: false, error: `Browse failed: ${result?.statusCode?.name}` });
    }
    const nodes = (result.references || []).map(r => ({
      nodeId: r.nodeId.toString(),
      browseName: r.browseName?.name || '',
      displayName: r.displayName?.text || r.browseName?.name || '',
      nodeClass: r.nodeClass,
      isVariable: r.nodeClass === opcua.NodeClass.Variable,
      hasChildren: r.nodeClass === opcua.NodeClass.Object
                || r.nodeClass === opcua.NodeClass.View
                || r.nodeClass === opcua.NodeClass.ObjectType,
    }));
    res.json({ success: true, nodes });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/opc/read', async (req, res) => {
  const { sessionId, nodeIds } = req.body;
  const s = store.get(sessionId);
  if (!s || s.type !== 'opc') return res.status(404).json({ error: 'Session not found — reconnect' });
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) return res.status(400).json({ error: 'nodeIds required' });
  s.lastUsed = Date.now();

  let opcua;
  try { opcua = require('node-opcua'); } catch { return res.status(500).json({ error: 'node-opcua unavailable' }); }

  try {
    const nodesToRead = nodeIds.map(id => ({ nodeId: id, attributeId: opcua.AttributeIds.Value }));
    const results = await s.session.read(nodesToRead);
    const values = results.map((r, i) => ({
      nodeId: nodeIds[i],
      value: r.value?.value ?? null,
      dataType: r.value?.dataType?.key ?? '',
      statusCode: r.statusCode?.name ?? 'Unknown',
      timestamp: r.serverTimestamp ?? new Date().toISOString(),
    }));
    res.json({ success: true, values });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/opc/disconnect', async (req, res) => {
  const { sessionId } = req.body;
  const s = store.get(sessionId);
  if (s) { closeSession(s); store.delete(sessionId); }
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MQTT — subscribe to topics, buffer messages
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/mqtt/connect', (req, res) => {
  const { host, port = 1883, username, password, clientId } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });

  const key = `mqtt:${host}:${port}`;

  // If already connected, return existing session
  if (store.has(key) && store.get(key).client?.connected) {
    store.get(key).lastUsed = Date.now();
    return res.json({ success: true, sessionId: key });
  }

  let mqtt;
  try { mqtt = require('mqtt'); }
  catch { return res.status(500).json({ error: 'mqtt package not available' }); }

  if (store.has(key)) { closeSession(store.get(key)); store.delete(key); }

  const start = Date.now();
  const id = clientId || `atstudio_${Math.random().toString(16).slice(2, 10)}`;
  const messages = [];   // { topic, payload, timestamp }
  const topicLatest = {}; // topic -> latest message (for topic list view)

  const client = mqtt.connect(`mqtt://${host}`, {
    port: parseInt(port, 10), clientId: id, connectTimeout: 5000, clean: true,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  });

  let settled = false;
  const finish = (result) => { if (!settled) { settled = true; res.json(result); } };
  const timer = setTimeout(() => {
    try { client.end(true); } catch {}
    finish({ success: false, error: 'Connection timed out' });
  }, 6000);

  client.on('connect', () => {
    clearTimeout(timer);
    client.subscribe('#', { qos: 0 });
    store.set(key, {
      type: 'mqtt', client, messages, topicLatest, lastUsed: Date.now(),
      close: () => { try { client.end(true); } catch {} },
    });
    finish({ success: true, sessionId: key, responseTime: Date.now() - start });
  });

  client.on('message', (topic, payload) => {
    const ts = new Date().toISOString();
    const val = payload.toString();
    messages.unshift({ topic, payload: val, timestamp: ts });
    topicLatest[topic] = { payload: val, timestamp: ts };
    if (messages.length > 500) messages.length = 500;
    const s = store.get(key);
    if (s) s.lastUsed = Date.now();
  });

  client.on('error', (err) => {
    clearTimeout(timer);
    try { client.end(true); } catch {}
    const msg = err.message.includes('ECONNREFUSED') ? 'Connection refused — is the broker running?'
              : err.message.includes('Not authorized')  ? 'Authentication failed'
              : err.message;
    finish({ success: false, error: msg });
  });
});

router.get('/mqtt/messages', (req, res) => {
  const { sessionId, filter = '', limit = 100 } = req.query;
  const s = store.get(sessionId);
  if (!s || s.type !== 'mqtt') return res.status(404).json({ error: 'Session not found' });
  s.lastUsed = Date.now();
  const connected = s.client?.connected ?? false;
  let msgs = s.messages;
  if (filter) msgs = msgs.filter(m => m.topic.includes(filter));
  res.json({ success: true, connected, messages: msgs.slice(0, parseInt(limit)), topicCount: Object.keys(s.topicLatest).length });
});

router.post('/mqtt/subscribe', (req, res) => {
  const { sessionId, topic } = req.body;
  const s = store.get(sessionId);
  if (!s || s.type !== 'mqtt') return res.status(404).json({ error: 'Session not found' });
  s.lastUsed = Date.now();
  try {
    s.client.subscribe(topic, { qos: 0 });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/mqtt/publish', (req, res) => {
  const { sessionId, topic, payload, qos = 0, retain = false } = req.body;
  const s = store.get(sessionId);
  if (!s || s.type !== 'mqtt') return res.status(404).json({ error: 'Session not found' });
  if (!topic) return res.status(400).json({ error: 'Topic required' });
  s.lastUsed = Date.now();
  try {
    s.client.publish(topic, String(payload ?? ''), { qos: parseInt(qos), retain: !!retain });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/mqtt/disconnect', (req, res) => {
  const { sessionId } = req.body;
  const s = store.get(sessionId);
  if (s) { closeSession(s); store.delete(sessionId); }
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Modbus TCP — connect then read registers on demand
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/modbus/connect', async (req, res) => {
  const { host, port = 502, unitId = 1 } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });

  const key = `modbus:${host}:${port}:${unitId}`;
  if (store.has(key)) { closeSession(store.get(key)); store.delete(key); }

  const start = Date.now();

  // Use raw Modbus TCP to test + keep connection open
  const portNum = parseInt(port, 10);
  const uid = parseInt(unitId, 10);

  const req_buf = Buffer.alloc(12);
  req_buf.writeUInt16BE(0x0001, 0);
  req_buf.writeUInt16BE(0x0000, 2);
  req_buf.writeUInt16BE(0x0006, 4);
  req_buf.writeUInt8(uid,       6);
  req_buf.writeUInt8(0x03,      7);
  req_buf.writeUInt16BE(0x0000, 8);
  req_buf.writeUInt16BE(0x0001, 10);

  try {
    await new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(5000);
      socket.connect(portNum, host, () => socket.write(req_buf));
      socket.on('data', () => { socket.destroy(); resolve(); });
      socket.on('timeout', () => { socket.destroy(); reject(new Error('Timed out')); });
      socket.on('error', reject);
    });

    // Use modbus-serial for persistent reads
    let ModbusRTU;
    try { ModbusRTU = require('modbus-serial'); } catch { return res.status(500).json({ error: 'modbus-serial unavailable' }); }

    const client = new ModbusRTU();
    client.setTimeout(4000);
    await client.connectTCP(host, { port: portNum });
    client.setID(uid);

    store.set(key, {
      type: 'modbus', client, host, portNum, uid, lastUsed: Date.now(),
      close: () => { try { client.close(); } catch {} },
    });
    res.json({ success: true, sessionId: key, responseTime: Date.now() - start });
  } catch (err) {
    const msg = err.message.includes('ECONNREFUSED') ? 'Connection refused'
              : err.message.includes('ETIMEDOUT') || err.message.includes('Timed out') ? 'Connection timed out'
              : err.message;
    res.json({ success: false, error: msg, responseTime: Date.now() - start });
  }
});

router.post('/modbus/read', async (req, res) => {
  const { sessionId, fc = 3, address = 0, count = 10 } = req.body;
  const s = store.get(sessionId);
  if (!s || s.type !== 'modbus') return res.status(404).json({ error: 'Session not found — reconnect' });
  s.lastUsed = Date.now();

  const fcNum = parseInt(fc, 10);
  const addrNum = parseInt(address, 10);
  const countNum = Math.min(parseInt(count, 10), 125);

  try {
    let result;
    if (fcNum === 1) result = await s.client.readCoils(addrNum, countNum);
    else if (fcNum === 2) result = await s.client.readDiscreteInputs(addrNum, countNum);
    else if (fcNum === 3) result = await s.client.readHoldingRegisters(addrNum, countNum);
    else if (fcNum === 4) result = await s.client.readInputRegisters(addrNum, countNum);
    else return res.status(400).json({ error: 'Invalid function code (use 1,2,3,4)' });

    const ts = new Date().toISOString();
    const data = result.data || [];
    const values = data.map((v, i) => ({ address: addrNum + i, value: v, timestamp: ts }));
    res.json({ success: true, values });
  } catch (err) {
    // Try to reconnect on next request
    res.json({ success: false, error: err.message });
  }
});

router.post('/modbus/disconnect', (req, res) => {
  const { sessionId } = req.body;
  const s = store.get(sessionId);
  if (s) { closeSession(s); store.delete(sessionId); }
  res.json({ success: true });
});

module.exports = router;
