import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({ activeView, onChangeView, children }) {
  return (
    <div className="flex h-full" style={{ background: '#1c1c1c' }}>
      <Sidebar activeView={activeView} onChangeView={onChangeView} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar activeView={activeView} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
