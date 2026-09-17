import React, { useState, useEffect } from 'react';
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
import SequencesView from './components/sequences/SequencesView';
import AiChat from './components/shared/AiChat';
import { loadConfig } from './api/client';

function AppInner() {
  const [activeView, setActiveView] = useState('dashboard');
  const [subtitle, setSubtitle]     = useState('');
  const [aiOpen, setAiOpen]         = useState(false);
  const [aiEnabled, setAiEnabled]   = useState(true);

  useEffect(() => {
    loadConfig().then(c => setAiEnabled(c?.ai?.enabled !== false)).catch(() => {});
    const handler = e => setAiEnabled(e.detail?.enabled !== false);
    window.addEventListener('ai-settings-saved', handler);
    return () => window.removeEventListener('ai-settings-saved', handler);
  }, []);

  const handleChangeView = (view) => { setSubtitle(''); setActiveView(view); };

  return (
    <>
      <Layout activeView={activeView} onChangeView={handleChangeView} onToggleAiChat={aiEnabled ? () => setAiOpen(v => !v) : null} subtitle={subtitle} showAi={aiEnabled}>
        {activeView === 'dashboard'   && <DashboardView />}
        {activeView === 'topology'    && <TopologyView />}
        {activeView === 'engineering' && <EngineeringView />}
        {activeView === 'sequences'   && <SequencesView onSetSubtitle={setSubtitle} />}
        {activeView === 'notes'       && <NotesView />}
        {activeView === 'calculators' && <CalculatorsView />}
        {activeView === 'commtest'    && <CommTestView />}
        {activeView === 'settings'    && <SettingsView />}
      </Layout>
      {aiEnabled && <AiChat activeView={activeView} onChangeView={handleChangeView} open={aiOpen} onSetOpen={setAiOpen} />}
    </>
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
