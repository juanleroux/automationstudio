import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Cpu, Plus } from 'lucide-react';
import TemplateTree from './TemplateTree';
import AttributeGrid from './AttributeGrid';
import ProfilePanel, { ProfileForm } from './ProfilePanel';
import Modal from '../shared/Modal';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import { uploadToIgnition } from '../../api/client';

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 260;

const BLANK_PROFILE = { name: '', description: '', exportType: 0, formatType: 0, tabularExportDelimiter: ',', structuralExportTemplate: '', customFormat: '' };

// Extracted as a proper top-level component so React doesn't remount it every render
function RightPanel({ selected, selectedTemplate, selectedInstance, project, onUpdateTemplateAttrs, onUpdateInstanceAttrs, onUpdateTemplate, onIgnitionUpload }) {
  const [activeTab, setActiveTab] = useState(0);
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [newProfileDraft, setNewProfileDraft] = useState(BLANK_PROFILE);
  const mode = selected?.type === 'instance' ? 'instance' : 'template';

  useEffect(() => { setActiveTab(0); }, [selected?.templateId, selected?.instanceId]);

  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-disabled)' }}>
        <div className="text-center">
          <p className="text-sm">Select a template or instance from the tree</p>
        </div>
      </div>
    );
  }

  const profiles = selectedTemplate?.profiles || [];
  const tabs = [
    { id: 'attrs', label: mode === 'instance' ? `${selectedInstance?.name || 'Instance'} Attributes` : 'Attributes' },
    ...(mode === 'template' ? profiles.map((p, i) => ({ id: `profile_${i}`, label: p.name || `Profile ${i + 1}` })) : [])
  ];

  const showIgnitionBtn = mode === 'template' && project?.engineering?.enableIgnitionMenuItems;

  const handleConfirmAddProfile = () => {
    onUpdateTemplate(t => ({
      ...t,
      profiles: [...(t.profiles || []), { ...newProfileDraft, attributes: [] }]
    }));
    setActiveTab(tabs.length);
    setShowAddProfileModal(false);
    setNewProfileDraft(BLANK_PROFILE);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add Profile Modal */}
      {showAddProfileModal && (
        <Modal
          title="Add Profile"
          onClose={() => { setShowAddProfileModal(false); setNewProfileDraft(BLANK_PROFILE); }}
          width={460}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowAddProfileModal(false); setNewProfileDraft(BLANK_PROFILE); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmAddProfile} disabled={!newProfileDraft.name.trim()}>Add</button>
            </>
          }
        >
          <ProfileForm profile={newProfileDraft} onChange={setNewProfileDraft} />
        </Modal>
      )}

      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-main)' }}>
        <div className="flex-1 flex overflow-x-auto" style={{ border: 'none' }}>
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
              className="tab-item add-profile-tab"
              onClick={() => { setNewProfileDraft(BLANK_PROFILE); setShowAddProfileModal(true); }}
              style={{ color: 'var(--text-disabled)', display: 'flex', alignItems: 'center', gap: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-disabled)'}
            >
              <Plus size={13} /> Add Profile
            </button>
          )}
        </div>
        {showIgnitionBtn && (
          <div className="px-2 flex-shrink-0">
            <button
              className="btn btn-primary text-xs"
              style={{ padding: '3px 10px' }}
              onClick={onIgnitionUpload}
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
            onChange={mode === 'instance' ? onUpdateInstanceAttrs : onUpdateTemplateAttrs}
          />
        ) : (
          <ProfilePanel
            key={activeTab}
            profile={profiles[activeTab - 1]}
            template={selectedTemplate}
            profileIndex={activeTab - 1}
            onUpdateTemplate={onUpdateTemplate}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex-shrink-0 px-3 py-1 text-xs flex items-center gap-4" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-main)', color: 'var(--text-disabled)' }}>
        {mode === 'template' && selectedTemplate && (
          <>
            <span>{selectedTemplate.attributes?.length || 0} attributes</span>
            <span>{selectedTemplate.instances?.length || 0} instances</span>
            <span>{selectedTemplate.profiles?.length || 0} profiles</span>
          </>
        )}
        {mode === 'instance' && selectedInstance && (
          <>
            <span>{selectedInstance.name}</span>
            <span>Template: {selectedTemplate?.name}</span>
            {selectedInstance.isFlagged && <span style={{ color: '#e55353' }}>● Flagged</span>}
          </>
        )}
      </div>
    </div>
  );
}

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
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const selectedTemplate = selected?.templateId
    ? (project?.templates || []).find(t => t.id === selected.templateId) || null
    : null;

  const selectedInstance = selected?.type === 'instance' && selectedTemplate
    ? (selectedTemplate.instances || []).find(i => i.id === selected.instanceId) || null
    : null;

  const handleUpdateTemplateAttrs = useCallback((updater) => {
    if (!selectedTemplate) return;
    const now = new Date().toISOString();
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === selectedTemplate.id
          ? { ...t, lastModification: now, attributes: typeof updater === 'function' ? updater(t.attributes || []) : updater }
          : t
      )
    }));
  }, [selectedTemplate, updateProject]);

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
                  ? { ...i, lastModification: now, attributes: typeof updater === 'function' ? updater(i.attributes || []) : updater }
                  : i
              )
            }
          : t
      )
    }));
  }, [selectedTemplate, selectedInstance, updateProject]);

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

  const handleIgnitionUpload = async () => {
    if (!selectedTemplate || !project?.engineering?.ignitionGateway) {
      toast.error('Configure Ignition gateway in Settings first');
      return;
    }
    const eng = project.engineering;
    const payload = {
      tagType: 'Folder',
      name: eng.folderPath || selectedTemplate.name,
      tags: [
        {
          name: selectedTemplate.name,
          tagType: 'UdtType',
          parameters: (selectedTemplate.attributes || [])
            .filter(a => a.parameter)
            .map(a => ({ name: a.name, dataType: a.dataType, value: a.value })),
          tags: (selectedTemplate.attributes || [])
            .filter(a => !a.parameter)
            .map(a => ({ name: a.name, tagType: 'AtomicTag', dataType: a.dataType, value: a.value }))
        },
        ...(selectedTemplate.instances || []).map(inst => ({
          name: inst.name,
          tagType: 'UdtInstance',
          typeId: selectedTemplate.name,
          parameters: (inst.attributes || []).reduce((acc, ia) => {
            const ta = (selectedTemplate.attributes || []).find(a => a.id === ia.id);
            if (ta?.parameter) acc[ta.name] = ia.value;
            return acc;
          }, {})
        }))
      ]
    };
    try {
      await uploadToIgnition({ gatewayUrl: eng.ignitionGateway, apiKey: eng.apiKey, payload });
      toast.success(`Uploaded "${selectedTemplate.name}" to Ignition`);
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.error || err.message));
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-disabled)' }}>
        <div className="text-center">
          <Cpu size={48} className="mx-auto mb-3" style={{ opacity: 0.2 }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-muted)' }}>No Project Open</p>
          <p className="text-sm mt-1">Create or open a project from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: paneWidth, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
      >
        <TemplateTree selected={selected} onSelect={setSelected} />
      </div>

      <div className="resize-handle" onMouseDown={onMouseDown} />

      <div className="flex-1 overflow-hidden" style={{ background: 'var(--bg-main)' }}>
        <RightPanel
          selected={selected}
          selectedTemplate={selectedTemplate}
          selectedInstance={selectedInstance}
          project={project}
          onUpdateTemplateAttrs={handleUpdateTemplateAttrs}
          onUpdateInstanceAttrs={handleUpdateInstanceAttrs}
          onUpdateTemplate={handleUpdateTemplate}
          onIgnitionUpload={handleIgnitionUpload}
        />
      </div>
    </div>
  );
}
