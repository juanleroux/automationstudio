const express = require('express');
const router = express.Router();
const axios = require('axios');

function normalizeUrl(bridgeUrl) {
  return (bridgeUrl || '').trim().replace(/\/+$/, '');
}

// POST /api/siemens/test — verify TIA bridge service is reachable
router.post('/test', async (req, res) => {
  const { bridgeUrl } = req.body;

  if (!bridgeUrl) return res.status(400).json({ error: 'Bridge URL required' });

  const base = normalizeUrl(bridgeUrl);
  const url = `${base}/api/health`;

  try {
    const response = await axios.get(url, { timeout: 8000 });
    const version = response.data?.tiaVersion || response.data?.version || null;
    res.json({ success: true, status: response.status, tiaVersion: version });
  } catch (err) {
    if (err.response) {
      res.json({ success: true, status: err.response.status });
    } else {
      res.status(502).json({ error: err.message });
    }
  }
});

// GET /api/siemens/fb/list — list FB types from the open TIA project
router.get('/fb/list', async (req, res) => {
  const { bridgeUrl } = req.query;

  if (!bridgeUrl) return res.status(400).json({ error: 'bridgeUrl query param required' });

  const base = normalizeUrl(bridgeUrl);
  try {
    const response = await axios.get(`${base}/api/fb/list`, { timeout: 30000 });
    res.json(response.data);
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    res.status(502).json({ error: msg });
  }
});

// POST /api/siemens/project/open — open a TIA project via the bridge
router.post('/project/open', async (req, res) => {
  const { bridgeUrl, projectPath, withUi } = req.body;

  if (!bridgeUrl) return res.status(400).json({ error: 'bridgeUrl required' });
  if (!projectPath) return res.status(400).json({ error: 'projectPath required' });

  const base = normalizeUrl(bridgeUrl);
  try {
    const response = await axios.post(`${base}/api/project/open`, { projectPath, withUi: withUi ?? true }, { timeout: 60000 });
    res.json(response.data);
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    res.status(502).json({ error: msg });
  }
});

// POST /api/siemens/instances/create — create instance DBs in the open TIA project
router.post('/instances/create', async (req, res) => {
  const { bridgeUrl, fbName, instances, startDbIndex, targetFolder, fcName, fcNumber, tiaVersion } = req.body;

  if (!bridgeUrl) return res.status(400).json({ error: 'bridgeUrl required' });
  if (!fbName) return res.status(400).json({ error: 'fbName required' });
  if (!Array.isArray(instances) || instances.length === 0)
    return res.status(400).json({ error: 'instances array required' });

  const base = normalizeUrl(bridgeUrl);
  const payload = { fbName, instances };
  if (startDbIndex != null) payload.startDbIndex = startDbIndex;
  if (targetFolder) payload.targetFolder = targetFolder;
  if (fcName) payload.fcName = fcName;
  if (fcNumber != null) payload.fcNumber = fcNumber;
  if (tiaVersion) payload.tiaVersion = tiaVersion;
  try {
    const response = await axios.post(`${base}/api/instances/create`, payload, { timeout: 120000 });
    res.json(response.data);
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    res.status(502).json({ error: msg });
  }
});

// POST /api/siemens/project/close — close the open TIA project
router.post('/project/close', async (req, res) => {
  const { bridgeUrl } = req.body;

  if (!bridgeUrl) return res.status(400).json({ error: 'bridgeUrl required' });

  const base = normalizeUrl(bridgeUrl);
  try {
    const response = await axios.post(`${base}/api/project/close`, {}, { timeout: 30000 });
    res.json(response.data);
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    res.status(502).json({ error: msg });
  }
});

module.exports = router;
