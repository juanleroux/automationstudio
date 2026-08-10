const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, '..', 'config', 'app.config.json');

// GET /api/config
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(configPath)) {
      return res.json({
        proposal: {
          companyName: '',
          contactName: '',
          phoneNumber: '',
          emailAddress: '',
          address: '',
          taxNumber: '',
          currencySymbol: '$',
          taxAmount: '0',
          logoFilePath: '',
          previewBodyColor: '#FFFFFF',
          previewHeaderColor: '#528ED2',
          previewFooterColor: '#DDDDDD',
          previewSummaryColor: '#AAAAAA'
        }
      });
    }
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json(data);
  } catch (err) {
    console.error('GET /api/config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/config
router.put('/', (req, res) => {
  try {
    const data = req.body;
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/config error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
