const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const projectsRouter = require('./routes/projects');
const ignitionRouter = require('./routes/ignition');
const siemensRouter = require('./routes/siemens');
const configRouter = require('./routes/config');
const commtestRouter = require('./routes/commtest');
const connectionsRouter = require('./routes/connections');
const aiRouter = require('./routes/ai');

const app = express();
const PORT = 3001;
const HOST = '0.0.0.0';

// Ensure projects directory exists
const projectsDir = path.join(__dirname, 'projects');
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir, { recursive: true });
}

// Ensure config directory and file exist
// Named Docker volumes mount as directories, so config lives in a config/ subdir
const configDir = path.join(__dirname, 'config');
const configPath = path.join(configDir, 'app.config.json');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}
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
app.use('/api/siemens', siemensRouter);
app.use('/api/config', configRouter);
app.use('/api/commtest', commtestRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/ai', aiRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve built React app (production / Docker)
const distDir = path.join(__dirname, '../client/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, HOST, () => {
  console.log(`Automation Studio Server running on http://localhost:${PORT}`);
  console.log(`Projects directory: ${projectsDir}`);
  console.log(`Config file: ${configPath}`);
});
