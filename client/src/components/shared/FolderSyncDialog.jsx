import React from 'react';
import { RefreshCw, Folder } from 'lucide-react';
import Modal from './Modal';

export default function FolderSyncDialog({
  syncDialog, onClose, onToggle, onSelectAll, onDeselectAll, onConfirm,
}) {
  if (!syncDialog) return null;
  const { direction, searching, items } = syncDialog;
  const checkedCount = (items || []).filter(i => i.checked).length;

  return (
    <Modal
      title={direction === 'to' ? 'Sync Areas → Ignition' : 'Sync Folders ← Ignition'}
      onClose={onClose}
      width={480}
      footer={
        searching ? null : (
          <>
            {(items || []).length > 0 && (
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
            {(items || []).length > 0 && (
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
          <div>{direction === 'to' ? 'Preparing areas…' : 'Fetching folder structure from Ignition…'}</div>
        </div>
      ) : (items || []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          {direction === 'to' ? 'No areas defined in this project.' : 'No folders found in Ignition at the configured path.'}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            {direction === 'to'
              ? 'Select local areas to sync to Ignition. Instances in each area will be uploaded to the matching folder:'
              : 'Select Ignition folders to import as local areas. Matching instances will be reassigned:'}
          </div>
          <div style={{
            maxHeight: 420, overflowY: 'auto',
            border: '1px solid var(--border)', borderRadius: 6,
          }}>
            {(items || []).map((item, idx) => (
              <div
                key={item.key}
                onClick={() => onToggle(item.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: `5px 12px 5px ${12 + item.depth * 20}px`,
                  cursor: 'pointer',
                  background: item.checked ? 'var(--accent-bg, rgba(59,130,246,0.06))' : 'transparent',
                  borderBottom: idx < (items.length - 1) ? '1px solid var(--border)' : 'none',
                  userSelect: 'none',
                }}
              >
                <input type="checkbox" checked={item.checked} onChange={() => {}} style={{ cursor: 'pointer', flexShrink: 0 }} />
                <Folder size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{item.name}</span>
                {item.instanceCount != null && item.instanceCount > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {item.instanceCount} instance{item.instanceCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </Modal>
  );
}
