const express = require('express');
const router = express.Router();
const axios = require('axios');
const http = require('http');
const https = require('https');

function normalizeUrl(gatewayUrl) {
  return gatewayUrl.trim().replace(/\/+$/, '');
}

/**
 * Make an HTTP/HTTPS request using Node's built-in modules so we can set
 * Content-Length explicitly. Ignition's Jetty rejects chunked transfer
 * encoding (which axios uses when it can't pre-compute the body size),
 * returning a 400 "Bad Request / badURI" error.
 */
function rawPost(urlStr, bodyObj, headers) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(bodyObj);
    const bodyBuf = Buffer.from(bodyStr, 'utf8');
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
        ...headers,
      },
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, raw });
      });
    });

    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// POST /api/ignition/upload - proxy upload to Ignition gateway
router.post('/upload', async (req, res) => {
  const { gatewayUrl, apiKey, payload } = req.body;

  if (!gatewayUrl) {
    return res.status(400).json({ error: 'Gateway URL required' });
  }

  const base = normalizeUrl(gatewayUrl);
  const url = `${base}/data/tag-cicd/tags`;

  const headers = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  // Send payload as-is (already in native Ignition export format)
  const body = payload;

  console.log('[Ignition upload] POST', url);
  console.log('[Ignition upload] body', JSON.stringify(body, null, 2));

  try {
    const { status, raw } = await rawPost(url, body, headers);
    console.log('[Ignition upload] response', status, raw.slice(0, 200));

    if (status >= 200 && status < 300) {
      let data;
      try { data = JSON.parse(raw); } catch { data = raw; }
      return res.json({ success: true, data, status });
    }

    const message = raw.includes('<html') ? stripHtml(raw) : raw;
    const hint = status === 400 && raw.includes('badURI')
      ? ' — The Tag CI/CD module may not be installed on this Ignition gateway.'
      : '';
    return res.status(status).json({ error: message + hint, status, url });
  } catch (err) {
    console.error('[Ignition upload] network error', err.message);
    res.status(502).json({ error: err.message, url });
  }
});

// GET /api/ignition/export - proxy export from Ignition gateway
router.get('/export', async (req, res) => {
  const { gatewayUrl, apiKey, folderPath } = req.query;

  if (!gatewayUrl) {
    return res.status(400).json({ error: 'Gateway URL required' });
  }

  const base = normalizeUrl(gatewayUrl);
  const path = folderPath ? `/data/tag-cicd/tags?path=${encodeURIComponent(folderPath)}` : '/data/tag-cicd/tags';
  const url = `${base}${path}`;

  const headers = { Accept: 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  console.log('[Ignition export] GET', url);

  try {
    const response = await axios.get(url, { headers, timeout: 30000 });
    console.log('[Ignition export] response', response.status);
    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response) {
      const raw = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
      const message = raw.includes('<html') ? stripHtml(raw) : raw;
      const hint = err.response.status === 400 && raw.includes('badURI')
        ? ' — The Tag CI/CD module may not be installed on this Ignition gateway.'
        : '';
      console.error('[Ignition export] error', err.response.status, message.slice(0, 200));
      res.status(err.response.status).json({ error: message + hint, url });
    } else {
      console.error('[Ignition export] network error', err.message);
      res.status(502).json({ error: err.message, url });
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
      res.json({ success: true, status: err.response.status });
    } else {
      res.status(502).json({ error: err.message });
    }
  }
});

module.exports = router;
