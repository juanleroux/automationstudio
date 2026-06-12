const express = require('express');
const router = express.Router();
const axios = require('axios');
const http = require('http'); // Docker socket API

// ── Docker socket helpers ─────────────────────────────────────────────────────
const DOCKER_SOCK = '/var/run/docker.sock';

function dockerGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: DOCKER_SOCK, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function dockerPost(path, payload) {
  const bodyStr = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request({
      socketPath: DOCKER_SOCK, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// Run exec and capture output via multiplexed Docker stream
function dockerExecAttached(execId) {
  const bodyStr = '{"Detach":false,"Tty":false}';
  return new Promise((resolve, reject) => {
    const req = http.request({
      socketPath: DOCKER_SOCK,
      path: `/exec/${execId}/start`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        // Docker multiplexed stream: 8-byte header [stream(1), 0,0,0, size(4BE)] + payload
        const buf = Buffer.concat(chunks);
        let output = '';
        let offset = 0;
        while (offset + 8 <= buf.length) {
          const size = buf.readUInt32BE(offset + 4);
          offset += 8;
          if (offset + size > buf.length) break;
          output += buf.slice(offset, offset + size).toString('utf8');
          offset += size;
        }
        resolve(output.trim());
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function normalizeUrl(gatewayUrl) {
  return (gatewayUrl || '').trim().replace(/\/+$/, '');
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function ignitionHeaders(apiKey) {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (apiKey) h['X-Ignition-API-Token'] = apiKey;
  return h;
}

// POST /api/ignition/upload — import tags into Ignition via standard REST API
router.post('/upload', async (req, res) => {
  const { gatewayUrl, apiKey, payload, provider = 'default', collisionPolicy = 'Overwrite', folderPath } = req.body;

  if (!gatewayUrl) return res.status(400).json({ error: 'Gateway URL required' });

  const base = normalizeUrl(gatewayUrl);
  // UDT type payloads embed _types_ in the body and must NOT use path=.
  // Instance-only payloads pass folderPath so instances land in the right folder.
  let url = `${base}/data/api/v1/tags/import?provider=${encodeURIComponent(provider)}&collisionPolicy=${encodeURIComponent(collisionPolicy)}&type=json`;
  if (folderPath) url += `&path=${encodeURIComponent(folderPath)}`;

  console.log('[Ignition import] POST', url);
  console.log('[Ignition import] body', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(url, payload, { headers: ignitionHeaders(apiKey), timeout: 30000 });
    console.log('[Ignition import] response', response.status, JSON.stringify(response.data));
    return res.json({ success: true, data: response.data, status: response.status });
  } catch (err) {
    if (err.response) {
      const raw = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
      const message = raw.includes('<html') ? stripHtml(raw) : raw;
      console.error('[Ignition import] error', err.response.status, message.slice(0, 300));
      return res.status(err.response.status).json({ error: message, status: err.response.status, url });
    }
    console.error('[Ignition import] network error', err.message);
    res.status(502).json({ error: err.message, url });
  }
});

// GET /api/ignition/export — export tags from Ignition via standard REST API
router.get('/export', async (req, res) => {
  const { gatewayUrl, apiKey, provider = 'default', folderPath } = req.query;

  if (!gatewayUrl) return res.status(400).json({ error: 'Gateway URL required' });

  const base = normalizeUrl(gatewayUrl);
  let url = `${base}/data/api/v1/tags/export?provider=${encodeURIComponent(provider)}&type=json`;
  if (folderPath) url += `&path=${encodeURIComponent(folderPath)}`;

  console.log('[Ignition export] GET', url);
  console.log('[Ignition export] API key present:', !!apiKey, apiKey ? `(${apiKey.length} chars, starts: ${apiKey.slice(0,4)}...)` : '(none)');

  try {
    const response = await axios.get(url, { headers: ignitionHeaders(apiKey), timeout: 30000 });
    console.log('[Ignition export] response', response.status);
    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response) {
      const raw = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
      const message = raw.includes('<html') ? stripHtml(raw) : raw;
      console.error('[Ignition export] error', err.response.status, message.slice(0, 300));
      res.status(err.response.status).json({ error: message, url });
    } else {
      console.error('[Ignition export] network error', err.message);
      res.status(502).json({ error: err.message, url });
    }
  }
});

// GET /api/ignition/folders — export only folder structure from Ignition
router.get('/folders', async (req, res) => {
  const { gatewayUrl, apiKey, provider = 'default', folderPath } = req.query;

  if (!gatewayUrl) return res.status(400).json({ error: 'Gateway URL required' });

  const base = normalizeUrl(gatewayUrl);
  let url = `${base}/data/api/v1/tags/export?provider=${encodeURIComponent(provider)}&type=json`;
  if (folderPath) url += `&path=${encodeURIComponent(folderPath)}`;

  console.log('[Ignition folders] GET', url);

  function extractFolders(node, parentPath) {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;
    const result = { name: node.name, path, children: [] };
    if (Array.isArray(node.tags)) {
      for (const child of node.tags) {
        if (child.tagType === 'Folder') {
          result.children.push(extractFolders(child, path));
        }
      }
    }
    return result;
  }

  try {
    const response = await axios.get(url, { headers: ignitionHeaders(apiKey), timeout: 30000 });
    const root = response.data;
    // root is the top-level object; extract its folder children
    const folders = [];
    if (Array.isArray(root.tags)) {
      for (const child of root.tags) {
        if (child.tagType === 'Folder') {
          folders.push(extractFolders(child, ''));
        }
      }
    }
    res.json({ success: true, folders });
  } catch (err) {
    if (err.response) {
      const raw = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
      const message = raw.includes('<html') ? stripHtml(raw) : raw;
      console.error('[Ignition folders] error', err.response.status, message.slice(0, 300));
      res.status(err.response.status).json({ error: message, url });
    } else {
      console.error('[Ignition folders] network error', err.message);
      res.status(502).json({ error: err.message, url });
    }
  }
});

// POST /api/ignition/test — verify gateway connectivity
router.post('/test', async (req, res) => {
  const { gatewayUrl, apiKey, provider = 'default' } = req.body;

  if (!gatewayUrl) return res.status(400).json({ error: 'Gateway URL required' });

  const base = normalizeUrl(gatewayUrl);
  const url = `${base}/data/api/v1/tags/export?provider=${encodeURIComponent(provider)}&type=json`;

  try {
    const response = await axios.get(url, { headers: ignitionHeaders(apiKey), timeout: 10000 });
    res.json({ success: true, status: response.status });
  } catch (err) {
    if (err.response) {
      // Any HTTP response means the gateway is reachable
      res.json({ success: true, status: err.response.status });
    } else {
      res.status(502).json({ error: err.message });
    }
  }
});

// POST /api/ignition/reset-password — run gwcmd.sh -p inside the Ignition Docker container
router.post('/reset-password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || !newPassword.trim()) {
    return res.status(400).json({ error: 'New password is required' });
  }

  try {
    // List running containers via Docker socket
    const listRes = await dockerGet('/containers/json');
    if (listRes.status !== 200) {
      return res.status(502).json({ error: `Docker socket error ${listRes.status}: ${JSON.stringify(listRes.data)}` });
    }
    const containers = listRes.data;
    const container = containers.find(c =>
      (c.Names || []).some(n => n.toLowerCase().includes('ignition'))
    );
    if (!container) {
      const names = containers.flatMap(c => c.Names || []).join(', ') || '(none running)';
      return res.status(404).json({ error: `No Ignition container found. Running containers: ${names}` });
    }

    const containerId = container.Id;
    const containerName = (container.Names[0] || containerId).replace(/^\//, '');
    console.log('[Ignition reset-password] using container:', containerName);

    // Locate gwcmd.sh — check known path first, fall back to find
    let gwcmdPath = '/usr/local/bin/ignition/gwcmd.sh';
    const testExec = await dockerPost(`/containers/${containerId}/exec`, {
      AttachStdout: true, AttachStderr: true,
      Cmd: ['test', '-f', gwcmdPath],
    });
    const testId = testExec.data?.Id;
    if (testId) {
      await dockerPost(`/exec/${testId}/start`, { Detach: false, Tty: false });
      const inspectRes = await dockerGet(`/exec/${testId}/json`);
      if (inspectRes.data?.ExitCode !== 0) {
        const findExec = await dockerPost(`/containers/${containerId}/exec`, {
          AttachStdout: true, AttachStderr: true,
          Cmd: ['find', '/', '-name', 'gwcmd.sh', '-maxdepth', '8'],
        });
        const findOutput = await dockerExecAttached(findExec.data.Id);
        gwcmdPath = findOutput.split('\n').find(l => l.trim()) || '';
        if (!gwcmdPath) {
          return res.status(404).json({ error: `gwcmd.sh not found in container "${containerName}"` });
        }
      }
    }

    console.log('[Ignition reset-password] gwcmd path:', gwcmdPath);

    // gwcmd.sh -p is interactive: it reads the new password twice from stdin.
    // Pipe it in via printf so it runs non-interactively.
    // Shell-escape single quotes in the password to prevent injection.
    const safePass = newPassword.replace(/'/g, "'\\''");
    const shellCmd = `printf '${safePass}\\n${safePass}\\n' | '${gwcmdPath}' -p`;

    const resetExec = await dockerPost(`/containers/${containerId}/exec`, {
      AttachStdout: true, AttachStderr: true, AttachStdin: false,
      Cmd: ['sh', '-c', shellCmd],
    });
    if (!resetExec.data?.Id) {
      return res.status(502).json({ error: 'Failed to create exec instance', detail: resetExec.data });
    }

    const output = await dockerExecAttached(resetExec.data.Id);

    // Get the exit code from exec inspect
    const inspectRes = await dockerGet(`/exec/${resetExec.data.Id}/json`);
    const exitCode = inspectRes.data?.ExitCode ?? -1;

    console.log('[Ignition reset-password] exitCode:', exitCode, 'output:', output);
    return res.json({ success: exitCode === 0, container: containerName, gwcmdPath, output, exitCode });
  } catch (err) {
    console.error('[Ignition reset-password] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
