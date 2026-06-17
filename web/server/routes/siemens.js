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

module.exports = router;
