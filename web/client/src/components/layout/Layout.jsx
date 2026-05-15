import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({ activeView, onChangeView, children }) {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-main)' }}>
      <div className="flex flex-1 min-h-0">
        <Sidebar activeView={activeView} onChangeView={onChangeView} />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar activeView={activeView} />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
      {/* Bottom toolbar */}
      <div
        className="flex items-center justify-end px-4 flex-shrink-0"
        style={{ height: 24, background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', color: 'var(--text-disabled)', fontSize: 11 }}
      >
        <span>One Technology Limited &copy;</span>
      </div>
    </div>
  );
}
