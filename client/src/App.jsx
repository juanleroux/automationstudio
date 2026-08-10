import React, { useState } from 'react';
import { ProjectProvider } from './context/ProjectContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/shared/Toast';
import Layout from './components/layout/Layout';
import DashboardView from './components/dashboard/DashboardView';
import EngineeringView from './components/engineering/EngineeringView';
import CalculatorsView from './components/calculators/CalculatorsView';
import CommTestView from './components/commtest/CommTestView';
import SettingsView from './components/settings/SettingsView';
import TopologyView from './components/topology/TopologyView';
import NotesView from './components/notes/NotesView';

function AppInner() {
  const [activeView, setActiveView] = useState('dashboard');

  return (
    <Layout activeView={activeView} onChangeView={setActiveView}>
      {activeView === 'dashboard'   && <DashboardView />}
      {activeView === 'topology'    && <TopologyView />}
      {activeView === 'engineering' && <EngineeringView />}
      {activeView === 'notes'       && <NotesView />}
      {activeView === 'calculators' && <CalculatorsView />}
      {activeView === 'commtest'    && <CommTestView />}
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
