import React from 'react';
import { useProject } from '../../context/ProjectContext';

const VIEW_LABELS = {
  dashboard:   'Dashboard',
  engineering: 'Assets',
  proposal:    'Proposal',
  calculators: 'Calculators',
  commtest:    'Connections',
  settings:    'Settings',
};

const BETA_VIEWS = new Set(['commtest']);

export default function TopBar({ activeView }) {
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
        {BETA_VIEWS.has(activeView) && (
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            padding: '2px 6px', borderRadius: 4,
            background: 'rgba(251,146,60,0.15)', color: '#fb923c',
            border: '1px solid rgba(251,146,60,0.3)',
          }}>
            Beta
          </span>
        )}
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
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span>One Technology Limited &copy;</span>
      </div>
    </div>
  );
}
