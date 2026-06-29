import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, danger = false, confirmLabel }) {
  return (
    <Modal
      title={title || 'Confirm'}
      onClose={onCancel}
      width={420}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? (danger ? 'Delete' : 'Confirm')}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className={danger ? 'text-danger flex-shrink-0 mt-0.5' : 'text-yellow-400 flex-shrink-0 mt-0.5'} />
        <p className="text-text-secondary text-sm leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
}
