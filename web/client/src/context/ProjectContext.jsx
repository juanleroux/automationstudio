import React, { createContext, useContext, useState, useCallback } from 'react';

const ProjectContext = createContext(null);

export const supportsFileSystemAccess =
  typeof window !== 'undefined' && 'showOpenFilePicker' in window;

const FILE_TYPES = [{
  description: 'Automation Studio Project',
  accept: { 'application/json': ['.atsproj.json', '.json'] },
}];

function blankProject(name) {
  return {
    name,
    description: '',
    templates: [],
    areas: [{ id: 1, name: 'Area 1', description: '', lastModification: new Date().toISOString() }],
    engineering: { ignitionGateway: '', apiKey: '', folderPath: '', enableIgnitionMenuItems: false },
    studio5000: { enableMenuItems: false, templateAOIs: {} },
    proposal: {
      folderPath: '',
      clientDetails: {
        name: '', description: '', companyName: '', contactName: '',
        phoneNumber: '', emailAddress: '', address: '', taxNumber: '', logoFilePath: '',
      },
      topics: [],
    },
    topology: { nodes: [], connections: [] },
  };
}

function suggestedFilename(project) {
  return (project.name || 'project').replace(/[^a-z0-9_-]/gi, '_') + '.atsproj.json';
}

function triggerDownload(project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedFilename(project);
  a.click();
  URL.revokeObjectURL(url);
}

export function ProjectProvider({ children }) {
  const [project, setProject]       = useState(null);
  const [fileHandle, setFileHandle] = useState(null); // FileSystemFileHandle | null
  const [filename, setFilename]     = useState(null); // display name only
  const [isDirty, setIsDirty]       = useState(false);
  const [isSaving, setIsSaving]     = useState(false);

  // Create a blank project in memory (no file association yet)
  const newProject = useCallback((name) => {
    setProject(blankProject(name));
    setFileHandle(null);
    setFilename(null);
    setIsDirty(true);
  }, []);

  // Open via File System Access API — throws AbortError if user cancels
  const openProject = useCallback(async () => {
    const [handle] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false });
    const file = await handle.getFile();
    const data = JSON.parse(await file.text());
    setProject(data);
    setFileHandle(handle);
    setFilename(file.name);
    setIsDirty(false);
    return data;
  }, []);

  // Load from already-read data (fallback for browsers without File System Access API)
  const loadProjectData = useCallback((data, fname) => {
    setProject(data);
    setFileHandle(null);
    setFilename(fname || null);
    setIsDirty(false);
  }, []);

  const updateProject = useCallback((updater) => {
    setProject(prev => (typeof updater === 'function' ? updater(prev) : updater));
    setIsDirty(true);
  }, []);

  // Save to existing handle, or fall back to Save As
  const saveCurrentProject = useCallback(async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(project, null, 2));
        await writable.close();
        setIsDirty(false);
      } else if (supportsFileSystemAccess) {
        const handle = await window.showSaveFilePicker({
          suggestedName: suggestedFilename(project),
          types: FILE_TYPES,
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(project, null, 2));
        await writable.close();
        setFileHandle(handle);
        setFilename(handle.name);
        setIsDirty(false);
      } else {
        triggerDownload(project);
        setIsDirty(false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [project, fileHandle]);

  // Always prompt for a new location
  const saveProjectAs = useCallback(async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      if (supportsFileSystemAccess) {
        const handle = await window.showSaveFilePicker({
          suggestedName: suggestedFilename(project),
          types: FILE_TYPES,
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(project, null, 2));
        await writable.close();
        setFileHandle(handle);
        setFilename(handle.name);
        setIsDirty(false);
      } else {
        triggerDownload(project);
        setIsDirty(false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [project]);

  const closeProject = useCallback(() => {
    setProject(null);
    setFileHandle(null);
    setFilename(null);
    setIsDirty(false);
  }, []);

  const getTemplate = useCallback((templateId) => {
    if (!project) return null;
    return project.templates.find(t => t.id === templateId) || null;
  }, [project]);

  const nextTemplateId = useCallback(() => {
    if (!project || !project.templates.length) return 1;
    return Math.max(...project.templates.map(t => t.id)) + 1;
  }, [project]);

  const nextAreaId = useCallback(() => {
    if (!project || !project.areas.length) return 1;
    return Math.max(...project.areas.map(a => a.id)) + 1;
  }, [project]);

  return (
    <ProjectContext.Provider value={{
      project, filename, isDirty, isSaving,
      newProject, openProject, loadProjectData,
      updateProject, saveCurrentProject, saveProjectAs,
      closeProject, getTemplate, nextTemplateId, nextAreaId,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
