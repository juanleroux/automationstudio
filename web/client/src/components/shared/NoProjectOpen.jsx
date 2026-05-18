import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function NoProjectOpen() {
  return (
    <div style={{ position: 'absolute', top: 28, left: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
      <ArrowLeft
        size={28}
        className="arrow-heartbeat"
        style={{ color: 'var(--accent)', flexShrink: 0 }}
      />
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>
          No Project Open
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-disabled)', margin: '3px 0 0' }}>
          Create or open a project from the sidebar
        </p>
      </div>
    </div>
  );
}
