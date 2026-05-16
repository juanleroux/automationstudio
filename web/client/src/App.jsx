import React, { useState } from 'react';
import { ProjectProvider } from './context/ProjectContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/shared/Toast';
import Layout from './components/layout/Layout';
import DashboardView from './components/dashboard/DashboardView';
import EngineeringView from './components/engineering/EngineeringView';
import AreasView from './components/areas/AreasView';
import SettingsModal from './components/settings/SettingsModal';

function AppInner() {
  const [activeView, setActiveView] = useState('dashboard');
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
      {activeView === 'dashboard'   && <DashboardView />}
      {activeView === 'engineering' && <EngineeringView />}
      {activeView === 'areas'       && <AreasView />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ProjectProvider>
          <AppInner />
        </ProjectProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
