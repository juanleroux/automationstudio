import React from 'react';
import { RefreshCw } from 'lucide-react';
import Modal from './Modal';

/**
 * Shared sync diff dialog used by both TemplateTree and AreasView.
 *
 * Props:
 *   syncDialog  – { direction, searching, diffs, notFound, instanceList, instanceIgnPath }
 *   onClose     – close without applying
 *   onToggle    – (diffKey) toggle one diff's checked state
 *   onSelectAll / onDeselectAll
 *   onConfirm   – apply checked diffs
 */
export default function SyncDiffDialog({ syncDialog, onClose, onToggle, onSelectAll, onDeselectAll, onConfirm }) {
  if (!syncDialog) return null;
  const { direction, searching, diffs, notFound } = syncDialog;
  const checkedCount = (diffs || []).filter(d => d.checked).length;

  return (
    <Modal
      title={direction === 'to' ? 'Sync To → Ignition' : 'Sync From ← Ignition'}
      onClose={onClose}
      width={720}
      footer={
        searching ? null : (
          <>
            {diffs.length > 0 && (
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
            {diffs.length > 0 && (
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
          <div>Searching Ignition for matching tags…</div>
        </div>
      ) : (
        <>
          {notFound.length > 0 && (
            <div style={{
              marginBottom: 12, padding: '8px 12px', borderRadius: 6, fontSize: 12,
              background: 'var(--bg-warning, #fef3c7)', color: 'var(--text-warning, #92400e)',
              border: '1px solid var(--border-warning, #fcd34d)',
            }}>
              Not found in Ignition: {notFound.join(', ')}
            </div>
          )}
          {diffs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              All values are already in sync — no differences found.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                {direction === 'to'
                  ? 'The following local values differ from Ignition. Tick the changes to push:'
                  : 'The following Ignition values differ from local. Tick the changes to pull:'}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ width: 28, padding: '6px 4px' }}></th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Instance</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Attribute</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {direction === 'to' ? 'Current (Ignition)' : 'Current (Local)'}
                      </th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {direction === 'to' ? 'New (Local)' : 'New (Ignition)'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map((d, i) => (
                      <tr
                        key={d.key}
                        style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-main)', cursor: 'pointer' }}
                        onClick={() => onToggle(d.key)}
                      >
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <input type="checkbox" checked={d.checked} onChange={() => {}} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-primary)', fontWeight: 500 }}>{d.instanceName}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{d.attributeName}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {direction === 'to' ? d.ignitionValue : d.localValue}
                        </td>
                        <td style={{ padding: '6px 8px', color: '#16a34a', fontFamily: 'monospace', fontWeight: 500 }}>
                          {direction === 'to' ? d.localValue : d.ignitionValue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
