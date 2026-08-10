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

// ═══════════════════════════════════════════════════════════════════════════════
// EtherNet/IP — Logix tag browser + read
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/enip/connect', async (req, res) => {
  const { host, port = 44818, slot = 0 } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });

  const key = `enip:${host}:${port}:${slot}`;
  if (store.has(key)) { closeSession(store.get(key)); store.delete(key); }

  let EthernetIP;
  try { EthernetIP = require('ethernet-ip'); }
  catch { return res.status(500).json({ error: 'ethernet-ip package not available' }); }

  const { Controller } = EthernetIP;
  const plc = new Controller();
  const start = Date.now();

  try {
    await plc.connect(host, parseInt(slot));
    store.set(key, {
      type: 'enip', plc, EthernetIP, lastUsed: Date.now(),
      close: () => { try { plc.destroy(); } catch {} },
    });
    res.json({ success: true, sessionId: key, responseTime: Date.now() - start });
  } catch (err) {
    try { plc.destroy(); } catch {}
    const msg = err.message.includes('ECONNREFUSED') ? 'Connection refused'
              : err.message.includes('ETIMEDOUT') || err.message.includes('timed out') ? 'Connection timed out'
              : err.message;
    res.json({ success: false, error: msg, responseTime: Date.now() - start });
  }
});

router.post('/enip/tags', async (req, res) => {
  const { sessionId } = req.body;
  const s = store.get(sessionId);
  if (!s || s.type !== 'enip') return res.status(404).json({ error: 'Session not found — reconnect' });
  s.lastUsed = Date.now();

  try {
    await s.plc.getTagList();
    const tags = [];
    s.plc.tagList.forEach((tag, name) => {
      tags.push({ name, type: tag.type?.name || String(tag.type ?? '') });
    });
    tags.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ success: true, tags });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/enip/read', async (req, res) => {
  const { sessionId, tagNames } = req.body;
  const s = store.get(sessionId);
  if (!s || s.type !== 'enip') return res.status(404).json({ error: 'Session not found — reconnect' });
  if (!Array.isArray(tagNames) || tagNames.length === 0) return res.status(400).json({ error: 'tagNames required' });
  s.lastUsed = Date.now();

  const { Tag } = s.EthernetIP;
  const ts = new Date().toISOString();

  try {
    const values = await Promise.all(tagNames.map(async name => {
      const tag = new Tag(name);
      s.plc.addTag(tag);
      try {
        await s.plc.readTag(tag);
        return { name, value: tag.value, type: tag.type?.name || String(tag.type ?? ''), timestamp: ts };
      } catch (e) {
        return { name, value: null, type: '', timestamp: ts, error: e.message };
      } finally {
        s.plc.removeTag(tag);
      }
    }));
    res.json({ success: true, values });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/enip/disconnect', (req, res) => {
  const { sessionId } = req.body;
  const s = store.get(sessionId);
  if (s) { closeSession(s); store.delete(sessionId); }
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROFINET / S7 — Siemens S7-300/400/1200/1500 via nodes7
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/s7/connect', async (req, res) => {
  const { host, port = 102, rack = 0, slot = 1 } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });

  const key = `s7:${host}:${port}:${rack}:${slot}`;
  if (store.has(key)) { closeSession(store.get(key)); store.delete(key); }

  let NodeS7;
  try { NodeS7 = require('nodes7'); }
  catch { return res.status(500).json({ error: 'nodes7 package not available' }); }

  const conn = new NodeS7({ silent: true });
  const start = Date.now();

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try { conn.dropConnection(); } catch {}
        reject(new Error('Connection timed out'));
      }, 8000);
      conn.initiateConnection({ port: parseInt(port), host, rack: parseInt(rack), slot: parseInt(slot) }, (err) => {
        clearTimeout(timer);
        if (err) { try { conn.dropConnection(); } catch {}; reject(new Error(`Connection failed (code ${err})`)); }
        else resolve();
      });
    });

    store.set(key, {
      type: 's7', conn, lastUsed: Date.now(),
      close: () => { try { conn.dropConnection(); } catch {} },
    });
    res.json({ success: true, sessionId: key, responseTime: Date.now() - start });
  } catch (err) {
    const msg = err.message.includes('ECONNREFUSED') ? 'Connection refused'
              : err.message.includes('timed out') ? 'Connection timed out'
              : err.message;
    res.json({ success: false, error: msg, responseTime: Date.now() - start });
  }
});

router.post('/s7/read', async (req, res) => {
  const { sessionId, variables } = req.body;
  const s = store.get(sessionId);
  if (!s || s.type !== 's7') return res.status(404).json({ error: 'Session not found — reconnect' });
  if (!Array.isArray(variables) || variables.length === 0) return res.status(400).json({ error: 'variables required' });
  s.lastUsed = Date.now();

  try {
    const vals = await new Promise((resolve, reject) => {
      s.conn.addItems(variables);
      s.conn.readAllItems((err, values) => {
        s.conn.removeItems(variables);
        if (err) reject(new Error('Read error'));
        else resolve(values);
      });
    });

    const ts = new Date().toISOString();
    const results = variables.map(v => ({ variable: v, value: vals[v] ?? null, timestamp: ts }));
    res.json({ success: true, values: results });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/s7/disconnect', (req, res) => {
  const { sessionId } = req.body;
  const s = store.get(sessionId);
  if (s) { closeSession(s); store.delete(sessionId); }
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SNMP — walk / get / set
// ═══════════════════════════════════════════════════════════════════════════════

function makeSnmpSession(snmp, host, port, community, version) {
  const verMap = { '1': snmp.Version1, '2c': snmp.Version2c };
  return snmp.createSession(host, community, {
    port: parseInt(port) || 161,
    version: verMap[version] ?? snmp.Version2c,
    timeout: 5000,
    retries: 1,
  });
}

router.post('/snmp/walk', (req, res) => {
  const { host, port = 161, community = 'public', version = '2c', oid = '1.3.6.1.2.1.1' } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });

  let snmp;
  try { snmp = require('net-snmp'); }
  catch { return res.status(500).json({ error: 'net-snmp package not available' }); }

  const session = makeSnmpSession(snmp, host, port, community, version);
  const results = [];

  session.walk(oid, 20,
    (varbinds) => {
      for (const vb of varbinds) {
        if (!snmp.isVarbindError(vb)) {
          let value;
          try { value = vb.value instanceof Buffer ? vb.value.toString('utf8') : String(vb.value); }
          catch { value = String(vb.value); }
          results.push({ oid: vb.oid, type: snmp.ObjectType[vb.type] ?? String(vb.type), value });
        }
      }
    },
    (err) => {
      session.close();
      if (err && results.length === 0) {
        return res.json({ success: false, error: err.message.includes('Timeout') ? 'Request timed out — check host and community string' : err.message });
      }
      res.json({ success: true, results });
    }
  );
});

router.post('/snmp/get', (req, res) => {
  const { host, port = 161, community = 'public', version = '2c', oids } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });
  if (!Array.isArray(oids) || oids.length === 0) return res.status(400).json({ error: 'oids required' });

  let snmp;
  try { snmp = require('net-snmp'); } catch { return res.status(500).json({ error: 'net-snmp unavailable' }); }

  const session = makeSnmpSession(snmp, host, port, community, version);
  session.get(oids, (err, varbinds) => {
    session.close();
    if (err) return res.json({ success: false, error: err.message.includes('Timeout') ? 'Request timed out' : err.message });
    const results = varbinds.map(vb => ({
      oid: vb.oid,
      type: snmp.ObjectType[vb.type] ?? String(vb.type),
      value: snmp.isVarbindError(vb) ? `Error: ${snmp.varbindError(vb)}` : (vb.value instanceof Buffer ? vb.value.toString('utf8') : String(vb.value)),
    }));
    res.json({ success: true, results });
  });
});

router.post('/snmp/set', (req, res) => {
  const { host, port = 161, community = 'public', version = '2c', oid, value, type = 'OctetString' } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });
  if (!oid) return res.status(400).json({ error: 'OID required' });

  let snmp;
  try { snmp = require('net-snmp'); } catch { return res.status(500).json({ error: 'net-snmp unavailable' }); }

  const typeMap = {
    OctetString: snmp.ObjectType.OctetString,
    Integer: snmp.ObjectType.Integer,
    Gauge: snmp.ObjectType.Gauge,
    Counter: snmp.ObjectType.Counter,
    TimeTicks: snmp.ObjectType.TimeTicks,
    IpAddress: snmp.ObjectType.IpAddress,
  };

  const intTypes = new Set(['Integer', 'Gauge', 'Counter', 'TimeTicks']);
  const varbind = {
    oid,
    type: typeMap[type] ?? snmp.ObjectType.OctetString,
    value: intTypes.has(type) ? parseInt(value) : (type === 'IpAddress' ? value : Buffer.from(String(value ?? ''))),
  };

  const session = makeSnmpSession(snmp, host, port, community, version);
  session.set([varbind], (err) => {
    session.close();
    if (err) return res.json({ success: false, error: err.message });
    res.json({ success: true });
  });
});

// ─── Ping (TCP connect — no root required, works across most firewalls) ──────
// Tries a TCP connection on the given port (default 80).
// ECONNREFUSED = host is alive (port closed but reachable).
// Timeout / EHOSTUNREACH = host is unreachable.
router.post('/ping', (req, res) => {
  const { host, port = 80 } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });

  const start  = Date.now();
  const sock   = new net.Socket();
  let settled  = false;

  const done = (alive, message) => {
    if (settled) return;
    settled = true;
    try { sock.destroy(); } catch {}
    res.json({ alive, rtt: alive ? Date.now() - start : null, message });
  };

  sock.setTimeout(2500);
  sock.once('connect',  ()    => done(true,  `Reachable (TCP:${port} open, ${Date.now() - start}ms)`));
  sock.once('timeout',  ()    => done(false, 'No response (timed out)'));
  sock.once('error',    (err) => {
    if (err.code === 'ECONNREFUSED') done(true, `Reachable (TCP:${port} refused, ${Date.now() - start}ms)`);
    else done(false, err.message);
  });
  sock.connect(Number(port), host);
});

module.exports = router;
