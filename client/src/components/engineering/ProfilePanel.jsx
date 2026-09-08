import React from 'react';
import ProfileAttributeGrid from './ProfileAttributeGrid';

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

export default function ProfilePanel({ profile, profileIndex, template, onUpdateTemplate }) {
  if (!profile) return null;

  const updateProfileAttrs = (updater) => {
    onUpdateTemplate(t => {
      const profs = [...(t.profiles || [])];
      const p = { ...profs[profileIndex] };
      p.attributes = typeof updater === 'function' ? updater(p.attributes || []) : updater;
      profs[profileIndex] = p;
      return { ...t, profiles: profs };
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Profile settings bar */}
      <div className="flex items-center gap-4 px-3 py-2 flex-shrink-0 text-xs" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
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

      {/* Profile content */}
      <div className="flex-1 overflow-hidden">
        {profile.exportType === 0 ? (
          <ProfileAttributeGrid
            attributes={profile.attributes || []}
            templateAttributes={template.attributes || []}
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
                  profs[profileIndex] = { ...profs[profileIndex], structuralExportTemplate: val };
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
