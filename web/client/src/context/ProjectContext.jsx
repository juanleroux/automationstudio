import React, { createContext, useContext, useState, useCallback } from 'react';
import { loadProject, saveProject } from '../api/client';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [project, setProject] = useState(null);
  const [filename, setFilename] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const openProject = useCallback(async (fname) => {
    const data = await loadProject(fname);
    setProject(data);
    setFilename(fname);
    setIsDirty(false);
  }, []);

  const updateProject = useCallback((updater) => {
    setProject(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
    setIsDirty(true);
  }, []);

  const saveCurrentProject = useCallback(async () => {
    if (!filename || !project) return;
    setIsSaving(true);
    try {
      await saveProject(filename, project);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  }, [filename, project]);

  const closeProject = useCallback(() => {
    setProject(null);
    setFilename(null);
    setIsDirty(false);
  }, []);

  // Template helpers
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
      project,
      filename,
      isDirty,
      isSaving,
      openProject,
      updateProject,
      saveCurrentProject,
      closeProject,
      getTemplate,
      nextTemplateId,
      nextAreaId
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
