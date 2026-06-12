const express = require('express');
const router = express.Router();
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

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
  try {
    // Find the Ignition container
    const { stdout: psOut } = await execAsync('docker ps --format "{{.Names}}"', { timeout: 10000 });
    const containers = psOut.trim().split('\n').filter(Boolean);
    const container = containers.find(c => c.toLowerCase().includes('ignition'));
    if (!container) {
      const list = containers.length ? containers.join(', ') : '(none running)';
      return res.status(404).json({ error: `No Ignition container found. Running containers: ${list}` });
    }

    console.log('[Ignition reset-password] using container:', container);

    // Locate gwcmd.sh — try known path first, fall back to find
    let gwcmdPath = '/usr/local/bin/ignition/gwcmd.sh';
    try {
      await execAsync(`docker exec ${container} test -f "${gwcmdPath}"`, { timeout: 10000 });
    } catch {
      const { stdout: findOut } = await execAsync(
        `docker exec ${container} find / -name "gwcmd.sh" 2>/dev/null | head -1`,
        { timeout: 20000 }
      );
      gwcmdPath = findOut.trim();
      if (!gwcmdPath) {
        return res.status(404).json({ error: `gwcmd.sh not found in container "${container}"` });
      }
    }

    console.log('[Ignition reset-password] gwcmd path:', gwcmdPath);

    // Execute the password reset
    const { stdout, stderr } = await execAsync(
      `docker exec ${container} "${gwcmdPath}" -p`,
      { timeout: 30000 }
    );

    const output = (stdout + stderr).trim();
    console.log('[Ignition reset-password] output:', output);
    return res.json({ success: true, container, gwcmdPath, output });
  } catch (err) {
    console.error('[Ignition reset-password] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
