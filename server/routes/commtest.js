const express = require('express');
const router = express.Router();
const net = require('net');

// ─── OPC UA ───────────────────────────────────────────────────────────────────
// Uses raw TCP + OPC UA Hello handshake (no extra package).
// A valid OPC UA server returns ACK; a bad endpoint returns ERR — both mean reachable.
router.post('/opc', (req, res) => {
  const { host, port = 4840, endpointPath = '' } = req.body;
  if (!host) return res.status(400).json({ error: 'Host is required' });

  const portNum = parseInt(port, 10);
  const endpointUrl = `opc.tcp://${host}:${portNum}${endpointPath}`;
  const urlBuf = Buffer.from(endpointUrl, 'utf8');
  const msgSize = 32 + urlBuf.length;

  const hel = Buffer.alloc(msgSize);
  let o = 0;
  hel.write('HEL', o, 'ascii'); o += 3;
  hel.write('F',   o, 'ascii'); o += 1;
  hel.writeUInt32LE(msgSize, o); o += 4;
  hel.writeUInt32LE(0,      o); o += 4; // ProtocolVersion
  hel.writeUInt32LE(65536,  o); o += 4; // ReceiveBufferSize
  hel.writeUInt32LE(65536,  o); o += 4; // SendBufferSize
  hel.writeUInt32LE(0,      o); o += 4; // MaxMessageSize
  hel.writeUInt32LE(0,      o); o += 4; // MaxChunkCount
  hel.writeUInt32LE(urlBuf.length, o); o += 4;
  urlBuf.copy(hel, o);

  const start = Date.now();
  const socket = new net.Socket();
  let settled = false;

  const finish = (result) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    res.json({ ...result, responseTime: Date.now() - start });
  };

  socket.setTimeout(5000);
  socket.connect(portNum, host, () => socket.write(hel));

  socket.on('data', (data) => {
    const type = data.slice(0, 3).toString('ascii');
    if (type === 'ACK') {
      finish({ success: true, detail: 'OPC UA server acknowledged connection', endpoint: endpointUrl });
    } else if (type === 'ERR') {
      // Server is reachable and OPC UA, but rejected the endpoint path
      finish({ success: true, detail: 'OPC UA server reachable (endpoint rejected — check path)', endpoint: endpointUrl });
    } else {
      finish({ success: true, detail: 'TCP connection succeeded (non-OPC UA response)', endpoint: endpointUrl });
    }
  });

  socket.on('timeout', () => finish({ success: false, error: 'Connection timed out (5s)' }));
  socket.on('error', (err) => {
    const msg = err.code === 'ECONNREFUSED' ? 'Connection refused — is the OPC UA server running?'
              : err.code === 'ETIMEDOUT'     ? 'Network timeout — check host and firewall'
              : err.message;
    finish({ success: false, error: msg });
  });
});

// ─── MQTT ─────────────────────────────────────────────────────────────────────
router.post('/mqtt', (req, res) => {
  const { host, port = 1883, username, password, clientId } = req.body;
  if (!host) return res.status(400).json({ error: 'Host is required' });

  let mqtt;
  try { mqtt = require('mqtt'); }
  catch { return res.status(500).json({ error: 'MQTT package not available on server' }); }

  const start = Date.now();
  const id = clientId || `atstudio_${Math.random().toString(16).slice(2, 8)}`;
  const options = {
    port: parseInt(port, 10),
    clientId: id,
    connectTimeout: 5000,
    clean: true,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  };

  let settled = false;
  const client = mqtt.connect(`mqtt://${host}`, options);

  const finish = (result) => {
    if (settled) return;
    settled = true;
    try { client.end(true); } catch {}
    res.json({ ...result, responseTime: Date.now() - start });
  };

  const timer = setTimeout(() => finish({ success: false, error: 'Connection timed out (5s)' }), 6000);

  client.on('connect', () => {
    clearTimeout(timer);
    finish({ success: true, detail: `Connected to broker as "${id}"`, broker: `${host}:${port}` });
  });

  client.on('error', (err) => {
    clearTimeout(timer);
    const msg = err.message.includes('ECONNREFUSED') ? 'Connection refused — is the MQTT broker running?'
              : err.message.includes('Not authorized')  ? 'Authentication failed — check username/password'
              : err.message;
    finish({ success: false, error: msg });
  });
});

// ─── Modbus TCP ───────────────────────────────────────────────────────────────
// Raw TCP with a Read Holding Registers request (FC 03, addr 0, qty 1).
// A Modbus exception response still means the device is reachable.
router.post('/modbus', (req, res) => {
  const { host, port = 502, unitId = 1 } = req.body;
  if (!host) return res.status(400).json({ error: 'Host is required' });

  const portNum = parseInt(port, 10);
  const uid     = parseInt(unitId, 10);

  // Modbus TCP ADU: MBAP header (7 bytes) + PDU (5 bytes)
  const req_buf = Buffer.alloc(12);
  req_buf.writeUInt16BE(0x0001, 0); // Transaction ID
  req_buf.writeUInt16BE(0x0000, 2); // Protocol ID (always 0)
  req_buf.writeUInt16BE(0x0006, 4); // Length of remaining bytes (6)
  req_buf.writeUInt8(uid,       6); // Unit ID
  req_buf.writeUInt8(0x03,      7); // Function Code: Read Holding Registers
  req_buf.writeUInt16BE(0x0000, 8); // Starting Address
  req_buf.writeUInt16BE(0x0001, 10); // Quantity of Registers

  const start = Date.now();
  const socket = new net.Socket();
  let settled = false;

  const finish = (result) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    res.json({ ...result, responseTime: Date.now() - start });
  };

  socket.setTimeout(5000);
  socket.connect(portNum, host, () => socket.write(req_buf));

  socket.on('data', (data) => {
    if (data.length < 8) return finish({ success: true, detail: 'Device responded (short frame)' });
    const fc = data[7];
    if (fc === 0x03) {
      finish({ success: true, detail: `Holding register read OK (unit ${uid})` });
    } else if (fc === 0x83) {
      // Exception — device is reachable, register may not exist
      const exCode = data[8];
      const exNames = { 1: 'Illegal Function', 2: 'Illegal Data Address', 3: 'Illegal Data Value', 4: 'Server Failure' };
      finish({ success: true, detail: `Device reachable — exception code ${exCode} (${exNames[exCode] || 'Unknown'})` });
    } else {
      finish({ success: true, detail: `Device responded (FC ${fc.toString(16).toUpperCase()})` });
    }
  });

  socket.on('timeout', () => finish({ success: false, error: 'Connection timed out (5s)' }));
  socket.on('error', (err) => {
    const msg = err.code === 'ECONNREFUSED' ? 'Connection refused — check host and port'
              : err.code === 'ETIMEDOUT'     ? 'Network timeout — check host and firewall'
              : err.message;
    finish({ success: false, error: msg });
  });
});

module.exports = router;
