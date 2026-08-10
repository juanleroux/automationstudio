import React from 'react';
import { ArrowLeft, Zap } from 'lucide-react';
import { VERSION } from '../../version';

export default function NoProjectOpen() {
  return (
    <div className="relative h-full" style={{ userSelect: 'none', pointerEvents: 'none' }}>
      {/* Centred watermark */}
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3" style={{ opacity: 0.07 }}>
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{ width: 96, height: 96, background: 'var(--text-primary)' }}
          >
            <Zap size={56} color="var(--bg-main)" />
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
            Automation Studio
          </span>
        </div>
      </div>

      {/* Bottom-right version */}
      <span style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 11, color: 'var(--text-disabled)', opacity: 0.6 }}>
        Automation Studio {VERSION}
      </span>

      {/* Bottom-left prompt with pulsating arrow */}
      <div style={{ position: 'absolute', bottom: 28, left: 28, display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'auto' }}>
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
    </div>
  );
}
