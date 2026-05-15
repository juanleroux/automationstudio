const express = require('express');
const router = express.Router();
const axios = require('axios');

function normalizeUrl(gatewayUrl) {
  return gatewayUrl.trim().replace(/\/+$/, '');
}

// POST /api/ignition/upload - proxy upload to Ignition gateway
router.post('/upload', async (req, res) => {
  const { gatewayUrl, apiKey, payload } = req.body;

  if (!gatewayUrl) {
    return res.status(400).json({ error: 'Gateway URL required' });
  }

  const base = normalizeUrl(gatewayUrl);
  const url = `${base}/data/tag-cicd/tags`;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  // Ignition Tag CI/CD API expects an array of tag objects
  const body = Array.isArray(payload) ? payload : [payload];

  console.log('[Ignition upload] POST', url);
  console.log('[Ignition upload] body', JSON.stringify(body, null, 2));

  try {
    const response = await axios.post(url, body, { headers, timeout: 30000 });
    res.json({ success: true, data: response.data, status: response.status });
  } catch (err) {
    if (err.response) {
      const errData = err.response.data;
      // Strip HTML from Ignition/Jetty error pages so the toast is readable
      const message = typeof errData === 'string'
        ? errData.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : (errData?.error || err.message);
      console.error('[Ignition upload] error', err.response.status, message);
      res.status(err.response.status).json({ error: message, status: err.response.status, url });
    } else {
      console.error('[Ignition upload] network error', err.message);
      res.status(502).json({ error: err.message, url });
    }
  }
});

// GET /api/ignition/export - proxy export from Ignition gateway
router.get('/export', async (req, res) => {
  const { gatewayUrl, apiKey, folderPath } = req.query;

  if (!gatewayUrl) {
    return res.status(400).json({ error: 'Gateway URL required' });
  }

  const base = normalizeUrl(gatewayUrl);
  const url = `${base}/data/tag-cicd/tags`;

  const headers = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const response = await axios.get(url, { headers, params: { path: folderPath }, timeout: 30000 });
    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json({ error: err.response.data || err.message });
    } else {
      res.status(502).json({ error: err.message });
    }
  }
});

// POST /api/ignition/test - test connection to gateway
router.post('/test', async (req, res) => {
  const { gatewayUrl, apiKey } = req.body;

  if (!gatewayUrl) {
    return res.status(400).json({ error: 'Gateway URL required' });
  }

  const base = normalizeUrl(gatewayUrl);
  const url = `${base}/data/tag-cicd/tags`;

  const headers = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const response = await axios.get(url, { headers, timeout: 10000 });
    res.json({ success: true, status: response.status });
  } catch (err) {
    if (err.response) {
      // Even a 4xx means we reached the server
      res.json({ success: true, status: err.response.status });
    } else {
      res.status(502).json({ error: err.message });
    }
  }
});

module.exports = router;
