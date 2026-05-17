const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const projectsDir = path.join(__dirname, '..', 'projects');

function ensureProjectsDir() {
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }
}

function getProjectPath(filename) {
  const safe = path.basename(filename);
  return path.join(projectsDir, safe);
}

// GET /api/projects - list all project files
router.get('/', (req, res) => {
  try {
    ensureProjectsDir();
    const files = fs.readdirSync(projectsDir)
      .filter(f => f.endsWith('.atsproj.json'))
      .map(f => {
        const filePath = path.join(projectsDir, f);
        const stat = fs.statSync(filePath);
        let name = f.replace('.atsproj.json', '');
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (data.name) name = data.name;
        } catch (e) {}
        return {
          filename: f,
          name,
          size: stat.size,
          modified: stat.mtime.toISOString()
        };
      });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects - create new project
router.post('/', (req, res) => {
  try {
    ensureProjectsDir();
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const filename = `${name.replace(/[^a-zA-Z0-9_\-]/g, '_')}.atsproj.json`;
    const filePath = getProjectPath(filename);

    if (fs.existsSync(filePath)) {
      return res.status(409).json({ error: 'Project already exists' });
    }

    const now = new Date().toISOString();
    const project = {
      name,
      templates: [],
      areas: [
        { id: 1, name: 'Area 1', description: '', lastModification: now }
      ],
      engineering: {
        ignitionGateway: '',
        apiKey: '',
        folderPath: '',
        enableIgnitionMenuItems: true
      },
      proposal: {
        folderPath: '',
        clientDetails: {
          name: '',
          description: '',
          companyName: '',
          contactName: '',
          phoneNumber: '',
          emailAddress: '',
          address: '',
          taxNumber: '',
          logoFilePath: ''
        },
        topics: []
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(project, null, 2));
    res.status(201).json({ filename, project });
  } catch (err) {
    console.error('POST /api/projects error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// GET /api/projects/:filename - load project
router.get('/:filename', (req, res) => {
  try {
    const filePath = getProjectPath(req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:filename - save project
router.put('/:filename', (req, res) => {
  try {
    ensureProjectsDir();
    const filePath = getProjectPath(req.params.filename);
    const data = req.body;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ success: true, filename: req.params.filename });
  } catch (err) {
    console.error('PUT /api/projects error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:filename - delete project
router.delete('/:filename', (req, res) => {
  try {
    const filePath = getProjectPath(req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
