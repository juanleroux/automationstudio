import React, { useState } from 'react';
import { ProjectProvider } from './context/ProjectContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/shared/Toast';
import Layout from './components/layout/Layout';
import DashboardView from './components/dashboard/DashboardView';
import EngineeringView from './components/engineering/EngineeringView';
import SettingsView from './components/settings/SettingsView';

function AppInner() {
  const [activeView, setActiveView] = useState('dashboard');

  return (
    <Layout activeView={activeView} onChangeView={setActiveView}>
      {activeView === 'dashboard'   && <DashboardView />}
      {activeView === 'engineering' && <EngineeringView />}
      {activeView === 'settings'    && <SettingsView />}
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
