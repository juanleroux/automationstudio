import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import changelog from '../../changelog.json';

const TYPE_COLOR = {
  feat:  { bg: 'var(--accent)',        label: 'feat' },
  fix:   { bg: '#e05252',              label: 'fix'  },
  refactor: { bg: '#888',              label: 'refactor' },
  chore: { bg: '#666',                 label: 'chore' },
  docs:  { bg: '#5b8dd9',              label: 'docs' },
};

function typeOf(subject) {
  const m = subject.match(/^(\w+)[\((:]/);
  return (m && TYPE_COLOR[m[1]]) ? m[1] : null;
}

function cleanSubject(subject) {
  // strip conventional commit prefix e.g. "feat(foo): bar" → "bar"
  return subject.replace(/^\w+(\([^)]*\))?:\s*/, '');
}

function groupByMonth(entries) {
  const groups = [];
  let current = null;
  for (const e of entries) {
    const month = e.date.slice(0, 7); // YYYY-MM
    if (!current || current.month !== month) {
      current = { month, entries: [] };
      groups.push(current);
    }
    current.entries.push(e);
  }
  return groups;
}

function Tag({ type }) {
  const cfg = TYPE_COLOR[type] || { bg: '#666', label: type };
  return (
    <span style={{
      background: cfg.bg,
      color: '#fff',
      fontSize: 9,
      fontWeight: 700,
      padding: '1px 5px',
      borderRadius: 3,
      flexShrink: 0,
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
    }}>
      {cfg.label}
    </span>
  );
}

export default function ChangelogModal({ onClose }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return changelog;
    return changelog.filter(e =>
      e.subject.toLowerCase().includes(q) ||
      e.hash.startsWith(q) ||
      e.date.includes(q)
    );
  }, [search]);

  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        width: 640,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Changelog
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {changelog.length} commits
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, borderRadius: 4,
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search commits…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6, padding: '6px 10px',
              color: 'var(--text-primary)', fontSize: 12,
              outline: 'none',
            }}
            autoFocus
          />
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {groups.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No commits match your search.
            </div>
          )}
          {groups.map(group => (
            <div key={group.month}>
              <div style={{
                padding: '8px 16px 4px',
                fontSize: 10, fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                position: 'sticky', top: 0,
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                {new Date(group.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}
              </div>
              {group.entries.map(entry => {
                const type = typeOf(entry.subject);
                const clean = cleanSubject(entry.subject);
                return (
                  <div key={entry.hash} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '7px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 10,
                      color: 'var(--text-muted)', flexShrink: 0,
                      paddingTop: 2, minWidth: 52,
                    }}>
                      {entry.hash}
                    </span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 10,
                      color: 'var(--accent)', flexShrink: 0,
                      paddingTop: 2, minWidth: 56,
                    }}>
                      {entry.version}
                    </span>
                    {type && <Tag type={type} />}
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>
                      {clean}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 2 }}>
                      {entry.date}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
