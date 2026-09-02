import React from 'react';
import { Sparkles } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

const VIEW_LABELS = {
  dashboard:   'Dashboard',
  topology:    'Topology',
  engineering: 'Assets',
  notes:       'Notes',
  proposal:    'Proposal',
  calculators: 'Calculators',
  commtest:    'Connections',
  settings:    'Settings',
};

export default function TopBar({ activeView, onToggleAiChat }) {
  const { project, filename, isDirty } = useProject();

  return (
    <div
      className="flex items-center justify-between px-5 flex-shrink-0"
      style={{
        height: 48,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)'
      }}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-text-primary">
          {VIEW_LABELS[activeView] || activeView}
        </h1>
        {project && (
          <>
            <span className="text-text-muted">/</span>
            <span className="text-sm text-text-muted">
              {project.name || filename?.replace('.atsproj.json', '')}
            </span>
            {isDirty && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,193,7,0.15)', color: '#ffc107' }}
              >
                Unsaved
              </span>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>One Technology Limited &copy;</span>
        <button
          title="AI Assistant"
          onClick={onToggleAiChat}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-main)', cursor: 'pointer', color: 'var(--accent)',
            fontSize: 12, fontWeight: 500,
          }}
        >
          <Sparkles size={13} />
          AI
        </button>
      </div>
    </div>
  );
}
