const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const projectsRouter = require('./routes/projects');
const ignitionRouter = require('./routes/ignition');
const configRouter = require('./routes/config');

const app = express();
const PORT = 3001;

// Ensure projects directory exists
const projectsDir = path.join(__dirname, 'projects');
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir, { recursive: true });
}

// Ensure config file exists
const configPath = path.join(__dirname, 'app.config.json');
if (!fs.existsSync(configPath)) {
  const defaultConfig = {
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
  };
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/projects', projectsRouter);
app.use('/api/ignition', ignitionRouter);
app.use('/api/config', configRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Automation Studio Server running on http://localhost:${PORT}`);
  console.log(`Projects directory: ${projectsDir}`);
  console.log(`Config file: ${configPath}`);
});
