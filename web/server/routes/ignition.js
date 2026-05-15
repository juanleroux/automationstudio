const express = require('express');
const router = express.Router();
const axios = require('axios');

// POST /api/ignition/upload - proxy upload to Ignition gateway
router.post('/upload', async (req, res) => {
  const { gatewayUrl, apiKey, payload } = req.body;

  if (!gatewayUrl) {
    return res.status(400).json({ error: 'Gateway URL required' });
  }

  try {
    const url = `${gatewayUrl}/data/tag-cicd/tags`;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Ignition Tag CI/CD API expects an array of tag objects
    const body = Array.isArray(payload) ? payload : [payload];

    const response = await axios.post(url, body, {
      headers,
      timeout: 30000
    });

    res.json({ success: true, data: response.data, status: response.status });
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json({
        error: err.response.data || err.message,
        status: err.response.status
      });
    } else {
      res.status(502).json({ error: err.message });
    }
  }
});

// GET /api/ignition/export - proxy export from Ignition gateway
router.get('/export', async (req, res) => {
  const { gatewayUrl, apiKey, folderPath } = req.query;

  if (!gatewayUrl) {
    return res.status(400).json({ error: 'Gateway URL required' });
  }

  try {
    const url = `${gatewayUrl}/data/tag-cicd/tags`;
    const headers = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await axios.get(url, {
      headers,
      params: { path: folderPath },
      timeout: 30000
    });

    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json({
        error: err.response.data || err.message,
        status: err.response.status
      });
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

  try {
    const url = `${gatewayUrl}/data/tag-cicd/tags`;
    const headers = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await axios.get(url, {
      headers,
      timeout: 10000
    });

    res.json({ success: true, status: response.status });
  } catch (err) {
    if (err.response) {
      // Even a 4xx is a "connection success" in terms of reaching the server
      res.json({ success: true, status: err.response.status, message: 'Connected (auth may be required)' });
    } else {
      res.status(502).json({ error: err.message });
    }
  }
});

module.exports = router;
