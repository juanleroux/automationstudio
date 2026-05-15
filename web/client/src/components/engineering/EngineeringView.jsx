import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Cpu } from 'lucide-react';
import TemplateTree from './TemplateTree';
import AttributeGrid from './AttributeGrid';
import ProfilePanel from './ProfilePanel';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import { uploadToIgnition } from '../../api/client';

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 260;

export default function EngineeringView() {
  const { project, updateProject } = useProject();
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [paneWidth, setPaneWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = (e) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = paneWidth;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + delta));
      setPaneWidth(newW);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center">
          <Cpu size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No Project Open</p>
          <p className="text-sm mt-1">Create or open a project from the sidebar</p>
        </div>
      </div>
    );
  }

  // Get selected template & instance
  const selectedTemplate = selected?.templateId
    ? project.templates.find(t => t.id === selected.templateId)
    : null;
  const selectedInstance = selected?.type === 'instance' && selectedTemplate
    ? (selectedTemplate.instances || []).find(i => i.id === selected.instanceId)
    : null;

  // Update template attributes
  const handleUpdateTemplateAttrs = useCallback((updater) => {
    if (!selectedTemplate) return;
    const now = new Date().toISOString();
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === selectedTemplate.id
          ? {
              ...t,
              lastModification: now,
              attributes: typeof updater === 'function' ? updater(t.attributes || []) : updater
            }
          : t
      )
    }));
  }, [selectedTemplate, updateProject]);

  // Update instance attributes
  const handleUpdateInstanceAttrs = useCallback((updater) => {
    if (!selectedTemplate || !selectedInstance) return;
    const now = new Date().toISOString();
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === selectedTemplate.id
          ? {
              ...t,
              instances: (t.instances || []).map(i =>
                i.id === selectedInstance.id
                  ? {
                      ...i,
                      lastModification: now,
                      attributes: typeof updater === 'function' ? updater(i.attributes || []) : updater
                    }
                  : i
              )
            }
          : t
      )
    }));
  }, [selectedTemplate, selectedInstance, updateProject]);

  // Update template (for profiles)
  const handleUpdateTemplate = useCallback((updater) => {
    if (!selectedTemplate) return;
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === selectedTemplate.id
          ? (typeof updater === 'function' ? updater(t) : updater)
          : t
      )
    }));
  }, [selectedTemplate, updateProject]);

  // Ignition Upload
  const handleIgnitionUpload = async () => {
    if (!selectedTemplate || !project.engineering?.ignitionGateway) {
      toast.error('Configure Ignition gateway in Settings first');
      return;
    }
    const eng = project.engineering;
    // Build UDT payload
    const udtType = {
      name: selectedTemplate.name,
      tagType: 'UdtType',
      typeId: selectedTemplate.name,
      parameters: (selectedTemplate.attributes || [])
        .filter(a => a.parameter)
        .map(a => ({ name: a.name, dataType: a.dataType, value: a.value })),
      tags: (selectedTemplate.attributes || [])
        .filter(a => !a.parameter)
        .map(a => ({
          name: a.name,
          tagType: 'AtomicTag',
          dataType: a.dataType,
          value: a.value
        }))
    };
    const instances = (selectedTemplate.instances || []).map(inst => ({
      name: inst.name,
      tagType: 'UdtInstance',
      typeId: selectedTemplate.name,
      parameters: (inst.attributes || []).reduce((acc, ia) => {
        const ta = (selectedTemplate.attributes || []).find(a => a.id === ia.id);
        if (ta?.parameter) acc[ta.name] = ia.value;
        return acc;
      }, {})
    }));
    try {
      await uploadToIgnition({
        gatewayUrl: eng.ignitionGateway,
        apiKey: eng.apiKey,
        payload: {
          tagType: 'Folder',
          name: eng.folderPath || selectedTemplate.name,
          tags: [udtType, ...instances]
        }
      });
      toast.success(`Uploaded "${selectedTemplate.name}" to Ignition`);
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.error || err.message));
    }
  };

  // Build tabs: Attributes + one per profile
  const profiles = selectedTemplate?.profiles || [];

  // Right panel content
  const RightPanel = () => {
    const [activeTab, setActiveTab] = useState(0);
    const mode = selected?.type === 'instance' ? 'instance' : 'template';

    useEffect(() => { setActiveTab(0); }, [selected?.templateId, selected?.instanceId]);

    if (!selected) {
      return (
        <div className="flex items-center justify-center h-full text-text-muted">
          <div className="text-center">
            <p>Select a template or instance from the tree</p>
          </div>
        </div>
      );
    }

    const tabs = [
      { id: 'attrs', label: mode === 'instance' ? `${selectedInstance?.name || 'Instance'} Attributes` : 'Attributes' },
      ...(mode === 'template' ? profiles.map((p, i) => ({ id: `profile_${i}`, label: p.name || `Profile ${i + 1}` })) : [])
    ];

    // Add Ignition upload action
    const showIgnitionBtn = mode === 'template' && project.engineering?.enableIgnitionMenuItems;

    return (
      <div className="flex flex-col h-full">
        {/* Tab bar */}
        <div className="flex items-center flex-shrink-0" style={{ borderBottom: '1px solid #333', background: '#1c1c1c' }}>
          <div className="flex-1 flex overflow-x-auto tab-bar" style={{ border: 'none' }}>
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                className={`tab-item ${activeTab === i ? 'active' : ''}`}
                onClick={() => setActiveTab(i)}
              >
                {tab.label}
              </button>
            ))}
            {mode === 'template' && (
              <button
                className="tab-item"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  updateProject(p => ({
                    ...p,
                    templates: p.templates.map(t =>
                      t.id === selectedTemplate.id
                        ? { ...t, profiles: [...(t.profiles || []), { name: `Profile ${(t.profiles || []).length + 1}`, description: '', exportType: 0, formatType: 0, tabularExportDelimiter: ',', structuralExportTemplate: '', attributes: [] }] }
                        : t
                    )
                  }));
                  setActiveTab(tabs.length);
                }}
                title="Add Profile tab"
              >
                + Profile
              </button>
            )}
          </div>
          {showIgnitionBtn && (
            <div className="px-2 flex-shrink-0">
              <button
                className="btn btn-primary text-xs"
                style={{ padding: '3px 10px' }}
                onClick={handleIgnitionUpload}
              >
                <Upload size={12} /> Upload to Ignition
              </button>
            </div>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 0 ? (
            <AttributeGrid
              attributes={mode === 'instance' ? (selectedInstance?.attributes || []) : (selectedTemplate?.attributes || [])}
              templateAttributes={mode === 'instance' ? selectedTemplate?.attributes : undefined}
              mode={mode}
              onChange={mode === 'instance' ? handleUpdateInstanceAttrs : handleUpdateTemplateAttrs}
            />
          ) : (
            // Profile tabs (only for templates)
            <ProfilePanel
              key={activeTab}
              template={selectedTemplate}
              onUpdateTemplate={handleUpdateTemplate}
            />
          )}
        </div>

        {/* Status bar */}
        {selected && (
          <div className="flex-shrink-0 px-3 py-1 text-xs text-text-muted flex items-center gap-4" style={{ borderTop: '1px solid #2a2a2a', background: '#1c1c1c' }}>
            {mode === 'template' && (
              <>
                <span>{selectedTemplate?.attributes?.length || 0} attributes</span>
                <span>{selectedTemplate?.instances?.length || 0} instances</span>
                <span>{selectedTemplate?.profiles?.length || 0} profiles</span>
              </>
            )}
            {mode === 'instance' && (
              <>
                <span>{selectedInstance?.name}</span>
                <span>Template: {selectedTemplate?.name}</span>
                {selectedInstance?.isFlagged && <span style={{ color: '#e55353' }}>● Flagged</span>}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Left tree panel */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: paneWidth, background: '#242424', borderRight: '1px solid #333' }}
      >
        <TemplateTree selected={selected} onSelect={setSelected} />
      </div>

      {/* Resize handle */}
      <div className="resize-handle" onMouseDown={onMouseDown} />

      {/* Right detail panel */}
      <div className="flex-1 overflow-hidden" style={{ background: '#1c1c1c' }}>
        <RightPanel />
      </div>
    </div>
  );
}
