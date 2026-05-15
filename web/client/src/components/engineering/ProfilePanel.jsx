import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Download, Edit2, Check, X } from 'lucide-react';
import ProfileAttributeGrid from './ProfileAttributeGrid';
import Modal from '../shared/Modal';
import ConfirmDialog from '../shared/ConfirmDialog';
import { useToast } from '../shared/Toast';

const EXPORT_TYPES = [
  { value: 0, label: 'Tabular' },
  { value: 1, label: 'Structural' },
];

const FORMAT_TYPES = [
  { value: 0, label: 'CSV' },
  { value: 1, label: 'Text' },
  { value: 2, label: 'XML' },
  { value: 3, label: 'Custom' },
];

function buildTabularCSV(profile, template) {
  const delimiter = profile.tabularExportDelimiter || ',';
  const header = profile.attributes.map(a => a.name).join(delimiter);
  const rows = (template.instances || []).map(inst => {
    return profile.attributes.map(attr => {
      const rule = attr.rule || '';
      if (rule === 'Instance.Name') return inst.name;
      if (rule === 'Instance.Description') return inst.description;
      if (rule === 'Template.Name') return template.name;
      if (rule === 'Instance.Area') return '';
      if (rule === 'Attribute.Name') return attr.name;
      // Check if rule matches an attribute id
      const ta = template.attributes.find(a => a.name === rule);
      if (ta) {
        const ia = (inst.attributes || []).find(a => a.id === ta.id);
        return ia ? ia.value : ta.value;
      }
      return '';
    }).join(delimiter);
  });
  return [header, ...rows].join('\n');
}

function buildStructuralText(profile, template) {
  const tmpl = profile.structuralExportTemplate || '';
  return (template.instances || []).map(inst => {
    return tmpl
      .replace(/\{Instance\.Name\}/g, inst.name)
      .replace(/\{Instance\.Description\}/g, inst.description)
      .replace(/\{Template\.Name\}/g, template.name);
  }).join('\n---\n');
}

export default function ProfilePanel({ template, onUpdateTemplate }) {
  const toast = useToast();
  const profiles = template.profiles || [];
  const [activeProfile, setActiveProfile] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [newProfile, setNewProfile] = useState({ name: '', description: '', exportType: 0, formatType: 0, tabularExportDelimiter: ',', structuralExportTemplate: '' });
  const [editProfile, setEditProfile] = useState(null);

  const profile = profiles[activeProfile];

  const updateProfileAttrs = useCallback((updater) => {
    onUpdateTemplate(t => {
      const profs = [...(t.profiles || [])];
      const p = { ...profs[activeProfile] };
      p.attributes = typeof updater === 'function' ? updater(p.attributes || []) : updater;
      profs[activeProfile] = p;
      return { ...t, profiles: profs };
    });
  }, [activeProfile, onUpdateTemplate]);

  const addProfile = () => {
    onUpdateTemplate(t => ({
      ...t,
      profiles: [...(t.profiles || []), {
        ...newProfile,
        attributes: []
      }]
    }));
    setActiveProfile(profiles.length);
    setShowAddModal(false);
    setNewProfile({ name: '', description: '', exportType: 0, formatType: 0, tabularExportDelimiter: ',', structuralExportTemplate: '' });
    toast.success('Profile added');
  };

  const saveEditProfile = () => {
    onUpdateTemplate(t => {
      const profs = [...(t.profiles || [])];
      profs[activeProfile] = { ...profs[activeProfile], ...editProfile };
      return { ...t, profiles: profs };
    });
    setShowEditModal(false);
    toast.success('Profile updated');
  };

  const deleteProfile = (idx) => {
    onUpdateTemplate(t => {
      const profs = (t.profiles || []).filter((_, i) => i !== idx);
      return { ...t, profiles: profs };
    });
    setActiveProfile(p => Math.max(0, p - 1));
    setConfirmDelete(null);
    toast.success('Profile deleted');
  };

  const handleExport = () => {
    if (!profile) return;
    let content = '';
    let ext = 'txt';
    if (profile.exportType === 0) {
      content = buildTabularCSV(profile, template);
      ext = 'csv';
    } else {
      content = buildStructuralText(profile, template);
      ext = 'txt';
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}_${profile.name}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${template.instances?.length || 0} instances`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Profile tab bar */}
      <div className="flex items-center flex-shrink-0" style={{ borderBottom: '1px solid #333', background: '#1c1c1c' }}>
        <div className="flex-1 flex overflow-x-auto">
          {profiles.length === 0 && (
            <span className="px-4 py-2 text-xs text-text-muted italic">No profiles</span>
          )}
          {profiles.map((p, i) => (
            <button
              key={i}
              onClick={() => setActiveProfile(i)}
              className={`tab-item flex-shrink-0 ${activeProfile === i ? 'active' : ''}`}
            >
              {p.name || `Profile ${i + 1}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 px-2 flex-shrink-0">
          <button className="btn btn-secondary text-xs" style={{ padding: '3px 8px' }} onClick={() => setShowAddModal(true)}>
            <Plus size={12} /> Add Profile
          </button>
          {profile && (
            <>
              <button className="btn btn-ghost btn-icon" title="Edit profile" onClick={() => { setEditProfile({ ...profile }); setShowEditModal(true); }}>
                <Edit2 size={13} />
              </button>
              <button className="btn btn-ghost btn-icon" title="Delete profile" style={{ color: '#e55353' }} onClick={() => setConfirmDelete(activeProfile)}>
                <Trash2 size={13} />
              </button>
              <button className="btn btn-primary text-xs" style={{ padding: '3px 8px' }} onClick={handleExport}>
                <Download size={12} /> Export
              </button>
            </>
          )}
        </div>
      </div>

      {/* Profile settings bar */}
      {profile && (
        <div className="flex items-center gap-4 px-3 py-2 flex-shrink-0 text-xs" style={{ borderBottom: '1px solid #2a2a2a', background: '#242424' }}>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Export:</span>
            <span className="text-text-primary">{EXPORT_TYPES.find(e => e.value === profile.exportType)?.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Format:</span>
            <span className="text-text-primary">{FORMAT_TYPES.find(f => f.value === profile.formatType)?.label}</span>
          </div>
          {profile.exportType === 0 && (
            <div className="flex items-center gap-2">
              <span className="text-text-muted">Delimiter:</span>
              <span className="text-text-primary font-mono">{profile.tabularExportDelimiter || ','}</span>
            </div>
          )}
          {profile.description && (
            <span className="text-text-muted">{profile.description}</span>
          )}
        </div>
      )}

      {/* Profile content */}
      <div className="flex-1 overflow-hidden">
        {!profile ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            <div className="text-center">
              <p>No profile selected</p>
              <p className="text-xs mt-1">Add a profile to configure exports</p>
            </div>
          </div>
        ) : profile.exportType === 0 ? (
          <ProfileAttributeGrid
            attributes={profile.attributes || []}
            onChange={updateProfileAttrs}
          />
        ) : (
          <div className="p-4 h-full">
            <label className="block text-xs text-text-muted mb-2">Template String</label>
            <textarea
              value={profile.structuralExportTemplate || ''}
              onChange={e => {
                const val = e.target.value;
                onUpdateTemplate(t => {
                  const profs = [...(t.profiles || [])];
                  profs[activeProfile] = { ...profs[activeProfile], structuralExportTemplate: val };
                  return { ...t, profiles: profs };
                });
              }}
              rows={12}
              placeholder="Use {Instance.Name}, {Instance.Description}, {Template.Name} as placeholders..."
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
            <p className="text-xs text-text-muted mt-2">
              Available placeholders: {'{Instance.Name}'}, {'{Instance.Description}'}, {'{Template.Name}'}
            </p>
          </div>
        )}
      </div>

      {/* Add Profile Modal */}
      {showAddModal && (
        <Modal
          title="Add Profile"
          onClose={() => setShowAddModal(false)}
          width={460}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addProfile} disabled={!newProfile.name.trim()}>Add</button>
            </>
          }
        >
          <ProfileForm profile={newProfile} onChange={setNewProfile} />
        </Modal>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && editProfile && (
        <Modal
          title="Edit Profile"
          onClose={() => setShowEditModal(false)}
          width={460}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEditProfile}>Save</button>
            </>
          }
        >
          <ProfileForm profile={editProfile} onChange={setEditProfile} />
        </Modal>
      )}

      {/* Confirm Delete */}
      {confirmDelete !== null && (
        <ConfirmDialog
          title="Delete Profile"
          message={`Delete profile "${profiles[confirmDelete]?.name}"? This cannot be undone.`}
          danger
          onConfirm={() => deleteProfile(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export function ProfileForm({ profile, onChange }) {
  const set = (field, value) => onChange(p => ({ ...p, [field]: value }));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs text-text-muted mb-1">Name *</label>
        <input type="text" value={profile.name} onChange={e => set('name', e.target.value)} placeholder="CSV Export" />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Description</label>
        <input type="text" value={profile.description} onChange={e => set('description', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">Export Type</label>
          <select value={profile.exportType} onChange={e => set('exportType', Number(e.target.value))}>
            <option value={0}>Tabular</option>
            <option value={1}>Structural</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Format</label>
          <select value={profile.formatType} onChange={e => set('formatType', Number(e.target.value))}>
            <option value={0}>CSV</option>
            <option value={1}>Text</option>
            <option value={2}>XML</option>
            <option value={3}>Custom</option>
          </select>
        </div>
      </div>
      {profile.exportType === 0 && (
        <div>
          <label className="block text-xs text-text-muted mb-1">Delimiter</label>
          <input
            type="text"
            value={profile.tabularExportDelimiter}
            onChange={e => set('tabularExportDelimiter', e.target.value)}
            style={{ maxWidth: 80 }}
            maxLength={5}
          />
        </div>
      )}
    </div>
  );
}
