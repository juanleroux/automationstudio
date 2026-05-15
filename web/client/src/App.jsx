import React, { useState } from 'react';
import { ProjectProvider } from './context/ProjectContext';
import { ToastProvider } from './components/shared/Toast';
import Layout from './components/layout/Layout';
import EngineeringView from './components/engineering/EngineeringView';
import AreasView from './components/areas/AreasView';
import ProposalView from './components/proposal/ProposalView';
import SettingsModal from './components/settings/SettingsModal';

function AppInner() {
  const [activeView, setActiveView] = useState('engineering');
  const [showSettings, setShowSettings] = useState(false);

  const handleChangeView = (view) => {
    if (view === 'settings') {
      setShowSettings(true);
      return;
    }
    setActiveView(view);
  };

  return (
    <Layout activeView={activeView} onChangeView={handleChangeView}>
      {activeView === 'engineering' && <EngineeringView />}
      {activeView === 'areas' && <AreasView />}
      {activeView === 'proposal' && <ProposalView />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ProjectProvider>
        <AppInner />
      </ProjectProvider>
    </ToastProvider>
  );
}
