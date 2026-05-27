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

module.exports = router;
