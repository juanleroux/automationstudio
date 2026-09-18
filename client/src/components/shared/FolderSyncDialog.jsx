import React, { useState, useEffect } from 'react';
import { RefreshCw, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import Modal from './Modal';

export default function FolderSyncDialog({
  syncDialog, onClose, onToggle, onSelectAll, onDeselectAll, onConfirm,
}) {
  const [collapsed, setCollapsed] = useState(new Set());

  // Reset collapsed state when a new sync dialog opens
  useEffect(() => { setCollapsed(new Set()); }, [syncDialog?.direction, syncDialog?.searching]);

  if (!syncDialog) return null;
  const { direction, searching, items } = syncDialog;

  const allItems = items || [];
  const checkedCount = allItems.filter(i => i.checked).length;

  const titles = {
    'folders-from': 'Sync Folders ← From Ignition',
    'folders-to': 'Sync Folders → To Ignition',
    'instances-from': 'Sync Instance Hierarchy ← From Ignition',
  };
  const descriptions = {
    'folders-from': 'Select Ignition folders to import as local areas. No instances will be moved:',
    'folders-to': 'Select local areas to create as folders in Ignition. No instances will be uploaded:',
    'instances-from': 'Select Ignition folders to assign local instances based on where they are found in Ignition:',
  };
  const emptyMessages = {
    'folders-from': 'No folders found in Ignition at the configured path.',
    'folders-to': 'No areas defined in this project.',
    'instances-from': 'No instances found in Ignition matching project instances.',
  };
  const searchMessages = {
    'folders-from': 'Fetching folder structure from Ignition…',
    'folders-to': 'Preparing areas…',
    'instances-from': 'Locating instances in Ignition…',
  };

  const itemHasChildren = (path) => allItems.some(i => i.path.startsWith(path + '/'));

  // Filter out items hidden by a collapsed ancestor
  const visibleItems = allItems.filter(item => {
    const parts = item.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      if (collapsed.has(parts.slice(0, i).join('/'))) return false;
    }
    return true;
  });

  const toggleCollapse = (e, path) => {
    e.stopPropagation();
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  return (
    <Modal
      title={titles[direction] || direction}
      onClose={onClose}
      width={480}
      footer={
        searching ? null : (
          <>
            {allItems.length > 0 && (
              <>
                <button className="btn btn-ghost" style={{ fontSize: 12, marginRight: 'auto' }} onClick={onSelectAll}>
                  Select All
                </button>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onDeselectAll}>
                  Deselect All
                </button>
              </>
            )}
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            {allItems.length > 0 && (
              <button className="btn btn-primary" disabled={checkedCount === 0} onClick={onConfirm}>
                Confirm ({checkedCount})
              </button>
            )}
          </>
        )
      }
    >
      {searching ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <RefreshCw size={20} style={{ marginBottom: 8, animation: 'spin 1s linear infinite' }} />
          <div>{searchMessages[direction] || 'Loading…'}</div>
        </div>
      ) : allItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          {emptyMessages[direction] || 'Nothing to show.'}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            {descriptions[direction] || ''}
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
            {visibleItems.map((item, idx) => {
              const hasChildren = itemHasChildren(item.path);
              const isCollapsed = collapsed.has(item.path);
              return (
                <div
                  key={item.key}
                  onClick={() => onToggle(item.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: `5px 12px 5px ${12 + item.depth * 20}px`,
                    cursor: 'pointer',
                    background: item.checked ? 'var(--accent-bg, rgba(59,130,246,0.06))' : 'transparent',
                    borderBottom: idx < visibleItems.length - 1 ? '1px solid var(--border)' : 'none',
                    userSelect: 'none',
                  }}
                >
                  {/* Expand/collapse chevron — only for items with children */}
                  <span
                    onClick={hasChildren ? e => toggleCollapse(e, item.path) : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', flexShrink: 0,
                      width: 14, color: 'var(--text-muted)',
                      cursor: hasChildren ? 'pointer' : 'default',
                      visibility: hasChildren ? 'visible' : 'hidden',
                    }}
                  >
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </span>
                  <input type="checkbox" checked={item.checked} onChange={() => {}} style={{ cursor: 'pointer', flexShrink: 0 }} />
                  {isCollapsed
                    ? <Folder size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    : <FolderOpen size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{item.name}</span>
                  {item.instanceCount != null && item.instanceCount > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {item.instanceCount} instance{item.instanceCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </Modal>
  );
}
