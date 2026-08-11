import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Zap, SlidersHorizontal, RotateCcw, Cpu, FolderOpen, Play, Square, RefreshCw, FileCode, RotateCw, Layers } from 'lucide-react';
import ColorPicker from '../shared/ColorPicker';
import { useProject } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../shared/Toast';
import { loadConfig, saveConfig, testIgnitionConnection, resetIgnitionPassword, ignitionGatewayControl, testSiemensConnection, listTiaFunctionBlocks, openTiaProject, closeTiaProject } from '../../api/client';

export default function SettingsView() {
  const { project, updateProject } = useProject();
  const { theme, setTheme, accentColor, setAccentColor, resetAccentColor } = useTheme();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const accentSwatchRef = useRef(null);
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [generalSubTab, setGeneralSubTab] = useState('general');
  const [config, setConfig] = useState(null);
  const [engineering, setEngineering] = useState(
    project?.engineering || {
      ignitionGateway: '',
      apiKey: '',
      provider: 'default',
      folderPath: '',
      collisionPolicy: 'Overwrite',
      enableIgnitionMenuItems: true
    }
  );
  const [projectDetails, setProjectDetails] = useState({
    name: project?.name || '',
    description: project?.description || '',
  });
  // studio5000 reads directly from project so it persists across view changes without Save
  const studio5000 = project?.studio5000 || { enableMenuItems: false, templateAOIs: {} };
  const updateStudio5000 = (updater) => {
    if (!project) return;
    updateProject(p => ({
      ...p,
      studio5000: typeof updater === 'function'
        ? updater(p.studio5000 || { enableMenuItems: false, templateAOIs: {} })
        : updater,
    }));
  };
  const [templateListKey, setTemplateListKey] = useState(0);
  const studio5000FileRef = useRef(null);
  const studio5000ProjectFileRef = useRef(null);
  const [studio5000PendingTemplateId, setStudio5000PendingTemplateId] = useState(null);

  // controlExpert reads directly from project so it persists across view changes without Save
  const controlExpert = project?.controlExpert || { enableMenuItems: false, templateFBs: {} };
  const updateControlExpert = (updater) => {
    if (!project) return;
    updateProject(p => ({
      ...p,
      controlExpert: typeof updater === 'function'
        ? updater(p.controlExpert || { enableMenuItems: false, templateFBs: {} })
        : updater,
    }));
  };
  const [ceTemplateListKey, setCeTemplateListKey] = useState(0);
  const ceXDBFileRef = useRef(null);
  const ceProjectXDBFileRef = useRef(null);
  const [cePendingTemplateId, setCePendingTemplateId] = useState(null);
  const [siemens, setSiemens] = useState(
    project?.siemens || {
      tiaVersion: 'V21',
      projectPath: '',
      bridgeUrl: 'http://localhost:5180',
      openWithUI: false,
      enableSiemensMenuItems: true,
      templateFBs: {},
    }
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [siemensTesting, setSiemensTesting] = useState(false);
  const [siemensTestResult, setSiemensTestResult] = useState(null);
  const [tiaFBs, setTiaFBs] = useState([]);
  const [loadingFBs, setLoadingFBs] = useState(false);
  const [fbListKey, setFbListKey] = useState(0);
  const [tiaProjectOpen, setTiaProjectOpen] = useState(false);
  const [openingProject, setOpeningProject] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null); // { success, output, exitCode }
  const [gatewayAction, setGatewayAction] = useState(null); // 'start'|'stop'|'restart' while in progress
  const tiaProjectFileRef = useRef(null);

  useEffect(() => {
    loadConfig().then(setConfig).catch(() => setConfig({
      proposal: {
        companyName: '', contactName: '', phoneNumber: '', emailAddress: '',
        address: '', taxNumber: '', currencySymbol: '$', taxAmount: '0',
        logoFilePath: '', previewBodyColor: '#FFFFFF', previewHeaderColor: '#528ED2',
        previewFooterColor: '#DDDDDD', previewSummaryColor: '#AAAAAA'
      }
    }));
  }, []);

  const setCompany = (field, value) => {
    setConfig(prev => ({ ...prev, proposal: { ...prev.proposal, [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (project) {
        updateProject({
          ...project,
          name: projectDetails.name.trim() || project.name,
          description: projectDetails.description,
          engineering,
          siemens,
          // studio5000 is written directly to project on change — no need to re-apply here
        });
      }
      if (config) {
        await saveConfig(config);
      }
      toast.success('Settings saved');
    } catch (err) {
      const detail = err.response?.data?.error || err.message;
      toast.error('Failed to save: ' + detail);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSiemensConnection = async () => {
    if (!siemens.bridgeUrl) {
      toast.error('Enter a bridge URL first');
      return;
    }
    setSiemensTesting(true);
    setSiemensTestResult(null);
    try {
      const result = await testSiemensConnection({ bridgeUrl: siemens.bridgeUrl });
      const versionNote = result.tiaVersion ? ` · TIA ${result.tiaVersion}` : '';
      setSiemensTestResult({ success: true, message: `Bridge reachable (HTTP ${result.status})${versionNote}` });
    } catch (err) {
      setSiemensTestResult({ success: false, message: err.response?.data?.error || err.message });
    } finally {
      setSiemensTesting(false);
    }
  };

  const handleOpenTiaProject = async () => {
    if (!siemens.bridgeUrl) { toast.error('Enter a Bridge URL first'); return; }
    if (!siemens.projectPath) { toast.error('Enter a TIA Project Path first'); return; }
    setOpeningProject(true);
    toast.info('Opening TIA project… If TIA Portal shows an Openness access dialog, click "Yes to all" to continue.', 15000);
    try {
      const result = await openTiaProject({ bridgeUrl: siemens.bridgeUrl, projectPath: siemens.projectPath, withUi: siemens.openWithUI });
      setTiaProjectOpen(true);
      toast.success(`Opened project: ${result.projectName}`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setOpeningProject(false);
    }
  };

  const handleCloseTiaProject = async () => {
    if (!siemens.bridgeUrl) return;
    try {
      await closeTiaProject({ bridgeUrl: siemens.bridgeUrl });
      setTiaProjectOpen(false);
      setTiaFBs([]);
      toast.success('TIA project closed');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleRefreshFBs = async () => {
    if (!siemens.bridgeUrl) { toast.error('Enter a Bridge URL first'); return; }
    setLoadingFBs(true);
    try {
      const result = await listTiaFunctionBlocks(siemens.bridgeUrl);
      if (result.skipped?.length) toast.info(`${result.skipped.length} FB(s) skipped (inconsistent — compile in TIA Portal first)`);
      setTiaFBs(result.functionBlocks || []);
      toast.success(`Found ${(result.functionBlocks || []).length} FB(s)`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoadingFBs(false);
    }
  };

  const handleGatewayControl = async (action) => {
    setGatewayAction(action);
    try {
      const result = await ignitionGatewayControl(action);
      toast.success(result.message || `Gateway ${action} successful`);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    } finally {
      setGatewayAction(null);
    }
  };

  const handleResetPassword = async () => {
    setConfirmReset(false);
    setResetting(true);
    setResetResult(null);
    try {
      const result = await resetIgnitionPassword(resetPassword);
      setResetResult({ success: result.success, output: result.output, exitCode: result.exitCode, container: result.container });
      if (result.success) {
        toast.success('Password reset complete');
      } else {
        toast.error(`gwcmd exited with code ${result.exitCode}`);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message;
      setResetResult({ success: false, output: msg, exitCode: -1 });
      toast.error(msg);
    } finally {
      setResetting(false);
      setResetPassword('');
    }
  };

  const handleTestConnection = async () => {
    if (!engineering.ignitionGateway) {
      toast.error('Enter a gateway URL first');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testIgnitionConnection({
        gatewayUrl: engineering.ignitionGateway,
        apiKey: engineering.apiKey,
        provider: engineering.provider || 'default',
      });
      setTestResult({ success: true, message: `Connected (HTTP ${result.status})` });
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || err.message });
    } finally {
      setTesting(false);
    }
  };

  const tabs = [
    { id: 'general',       label: 'General',              desc: 'Project & Appearance',   icon: SlidersHorizontal },
    { id: 'engineering',   label: 'Ignition',             desc: 'Project Settings',        icon: Zap },
    { id: 'siemens',       label: 'Siemens',              desc: 'Project Settings',        icon: Cpu },
    { id: 'studio5000',    label: 'Rockwell Automation',  desc: 'Project Settings',        icon: FileCode },
    { id: 'controlExpert', label: 'Schneider Electric',   desc: 'Project Settings',        icon: Layers },
  ];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div style={{
        width: 210, flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
            Settings
          </span>
        </div>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                background: isActive ? 'var(--bg-active, rgba(59,130,246,0.08))' : 'transparent',
                borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: 'var(--text-primary)' }}>
                {tab.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{tab.desc}</div>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', fontSize: 12 }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-main)', padding: '24px 24px' }}>
        <div style={{ maxWidth: 660 }}>

          {/* General tab */}
          {activeTab === 'general' && (
            <div className="flex flex-col gap-6">

              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
                {[
                  { id: 'general', label: 'General' },
                  { id: 'company', label: 'Company' },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setGeneralSubTab(sub.id)}
                    style={{
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: generalSubTab === sub.id ? 600 : 400,
                      color: generalSubTab === sub.id ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: 'none',
                      border: 'none',
                      borderBottom: generalSubTab === sub.id ? '2px solid var(--accent)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {generalSubTab === 'general' && (
                <>
              {/* Project Details */}
              {project ? (
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Project Details</label>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Project Name</label>
                      <input
                        type="text"
                        value={projectDetails.name}
                        onChange={e => setProjectDetails(p => ({ ...p, name: e.target.value }))}
                        placeholder="My Project"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Description</label>
                      <textarea
                        value={projectDetails.description}
                        onChange={e => setProjectDetails(p => ({ ...p, description: e.target.value }))}
                        placeholder="Optional project description"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-md text-sm" style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.2)', color: 'var(--text-muted)' }}>
                  Open a project to edit project details
                </div>
              )}

              {/* Appearance */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Appearance</label>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {/* Base color scheme */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>Base color scheme</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Choose the application color scheme.</div>
                    </div>
                    <select
                      value={theme}
                      onChange={e => setTheme(e.target.value)}
                      style={{ width: 'auto', minWidth: 160 }}
                    >
                      <option value="system">Adapt to system</option>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </div>

                  {/* Accent color */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>Accent color</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Choose the accent color used throughout the app.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        onClick={resetAccentColor}
                        title="Reset to default"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        ref={accentSwatchRef}
                        onClick={() => setColorPickerOpen(o => !o)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: accentColor,
                          border: '2px solid var(--border)',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                          cursor: 'pointer',
                          transition: 'transform 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      />
                      {colorPickerOpen && (
                        <ColorPicker
                          value={accentColor}
                          onChange={setAccentColor}
                          anchorRef={accentSwatchRef}
                          onClose={() => setColorPickerOpen(false)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
                </>
              )}

              {generalSubTab === 'company' && (
                config ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Company Name</label>
                        <input type="text" value={config.proposal?.companyName || ''} onChange={e => setCompany('companyName', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Contact Name</label>
                        <input type="text" value={config.proposal?.contactName || ''} onChange={e => setCompany('contactName', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Phone Number</label>
                        <input type="text" value={config.proposal?.phoneNumber || ''} onChange={e => setCompany('phoneNumber', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Email Address</label>
                        <input type="email" value={config.proposal?.emailAddress || ''} onChange={e => setCompany('emailAddress', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Address</label>
                      <textarea value={config.proposal?.address || ''} onChange={e => setCompany('address', e.target.value)} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Tax Number</label>
                        <input type="text" value={config.proposal?.taxNumber || ''} onChange={e => setCompany('taxNumber', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Tax Amount (%)</label>
                        <input type="number" value={config.proposal?.taxAmount || '0'} onChange={e => setCompany('taxAmount', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Currency Symbol</label>
                        <input type="text" value={config.proposal?.currencySymbol || '$'} onChange={e => setCompany('currencySymbol', e.target.value)} style={{ maxWidth: 80 }} maxLength={5} />
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <p className="text-xs text-text-muted mb-2">Preview Colors</p>
                      <div className="grid grid-cols-2 gap-3">
                        {['previewBodyColor', 'previewHeaderColor', 'previewFooterColor', 'previewSummaryColor'].map(key => (
                          <div key={key} className="flex items-center gap-2">
                            <input
                              type="color"
                              value={config.proposal?.[key] || '#ffffff'}
                              onChange={e => setCompany(key, e.target.value)}
                              style={{ width: 36, height: 30, padding: 2, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer' }}
                            />
                            <label className="text-xs text-text-muted capitalize">
                              {key.replace('preview', '').replace('Color', '')}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-text-muted text-sm">Loading...</div>
                )
              )}

            </div>
          )}

          {/* Engineering tab */}
          {activeTab === 'engineering' && (
            <div className="flex flex-col gap-4">
              {!project && (
                <div className="p-3 rounded-md text-sm text-yellow-400" style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.2)' }}>
                  Open a project to configure engineering settings
                </div>
              )}
              <div>
                <label className="block text-xs text-text-muted mb-1">Ignition Gateway URL</label>
                <input
                  type="url"
                  value={engineering.ignitionGateway}
                  onChange={e => setEngineering(p => ({ ...p, ignitionGateway: e.target.value }))}
                  placeholder="http://192.168.1.100:8088"
                  disabled={!project}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">API Key (X-Ignition-API-Token)</label>
                <input
                  type="password"
                  value={engineering.apiKey}
                  onChange={e => setEngineering(p => ({ ...p, apiKey: e.target.value }))}
                  placeholder="Generate in Gateway → Platform → Security → API Keys"
                  disabled={!project}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Tag Provider</label>
                  <input
                    type="text"
                    value={engineering.provider || 'default'}
                    onChange={e => setEngineering(p => ({ ...p, provider: e.target.value }))}
                    placeholder="default"
                    disabled={!project}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Collision Policy</label>
                  <select
                    value={engineering.collisionPolicy || 'Overwrite'}
                    onChange={e => setEngineering(p => ({ ...p, collisionPolicy: e.target.value }))}
                    disabled={!project}
                  >
                    <option value="Overwrite">Overwrite</option>
                    <option value="MergeOverwrite">Merge Overwrite</option>
                    <option value="Ignore">Ignore</option>
                    <option value="Abort">Abort</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Tag Folder Path (optional)</label>
                <input
                  type="text"
                  value={engineering.folderPath}
                  onChange={e => setEngineering(p => ({ ...p, folderPath: e.target.value }))}
                  placeholder="Devices/Motors"
                  disabled={!project}
                />
                <p className="text-xs text-text-muted mt-1">Sub-folder within the provider to import/export (leave blank for root)</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="btn btn-secondary"
                  onClick={handleTestConnection}
                  disabled={testing || !engineering.ignitionGateway}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                {testResult && (
                  <div className="flex items-center gap-2 text-sm">
                    {testResult.success
                      ? <><Wifi size={14} style={{ color: 'var(--accent)' }} /><span style={{ color: 'var(--accent)' }}>{testResult.message}</span></>
                      : <><WifiOff size={14} style={{ color: '#e55353' }} /><span style={{ color: '#e55353' }}>{testResult.message}</span></>
                    }
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  id="enableIgnition"
                  checked={engineering.enableIgnitionMenuItems}
                  onChange={e => setEngineering(p => ({ ...p, enableIgnitionMenuItems: e.target.checked }))}
                  disabled={!project}
                />
                <label htmlFor="enableIgnition" className="text-sm text-text-primary cursor-pointer">
                  Enable Ignition Menu Items
                </label>
              </div>

              {/* Danger zone */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                <div style={{ border: '1px solid rgba(229,83,83,0.35)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', background: 'rgba(229,83,83,0.06)', borderBottom: '1px solid rgba(229,83,83,0.2)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 2 }}>Danger Zone</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>These actions are irreversible and affect the running Ignition instance.</div>
                  </div>
                  {/* Gateway controls */}
                  <div style={{ padding: '14px', borderBottom: '1px solid rgba(229,83,83,0.2)' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Gateway Control</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Start, stop, or restart the Ignition gateway container.
                      Stop uses <code style={{ fontSize: 11, background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>gwcmd --quit</code> for a graceful shutdown.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, gap: 6 }}
                        disabled={!!gatewayAction}
                        onClick={() => handleGatewayControl('start')}
                      >
                        <Play size={13} />
                        {gatewayAction === 'start' ? 'Starting…' : 'Start'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, gap: 6 }}
                        disabled={!!gatewayAction}
                        onClick={() => handleGatewayControl('stop')}
                      >
                        <Square size={13} />
                        {gatewayAction === 'stop' ? 'Stopping…' : 'Stop'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, gap: 6 }}
                        disabled={!!gatewayAction}
                        onClick={() => handleGatewayControl('restart')}
                      >
                        <RefreshCw size={13} />
                        {gatewayAction === 'restart' ? 'Restarting…' : 'Restart'}
                      </button>
                    </div>
                  </div>

                  {/* Reset password */}
                  <div style={{ padding: '14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>Reset Administrator Password</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Runs <code style={{ fontSize: 11, background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>gwcmd.sh -p</code> inside
                        the Ignition Docker container to reset the admin account password to the factory default.
                      </div>
                    </div>
                    <button
                      className="btn btn-danger"
                      style={{ flexShrink: 0, fontSize: 12 }}
                      onClick={() => setConfirmReset(true)}
                      disabled={resetting}
                    >
                      {resetting ? 'Resetting…' : 'Reset Password'}
                    </button>
                  </div>

                  {confirmReset && (
                    <div style={{ margin: '0 14px 14px', padding: '12px 14px', background: 'var(--danger-bg)', border: '1px solid rgba(229,83,83,0.4)', borderRadius: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 6 }}>
                        Are you sure?
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.55 }}>
                        This will execute <code style={{ fontSize: 11, background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>gwcmd.sh -p</code> in
                        the running Ignition container. Enter the new administrator password below.
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>New Password</label>
                        <input
                          type="password"
                          value={resetPassword}
                          onChange={e => setResetPassword(e.target.value)}
                          placeholder="Enter new administrator password"
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && resetPassword.trim() && handleResetPassword()}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => { setConfirmReset(false); setResetPassword(''); }}>Cancel</button>
                        <button className="btn btn-danger" style={{ fontSize: 12 }} disabled={!resetPassword.trim()} onClick={handleResetPassword}>Reset Password</button>
                      </div>
                    </div>
                  )}

                  {resetResult && !confirmReset && (
                    <div style={{ margin: '0 14px 14px', padding: '12px 14px', background: resetResult.success ? 'rgba(62,207,142,0.08)' : 'var(--danger-bg)', border: `1px solid ${resetResult.success ? 'rgba(62,207,142,0.3)' : 'rgba(229,83,83,0.4)'}`, borderRadius: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: resetResult.success ? '#3ecf8e' : 'var(--danger)', marginBottom: 6 }}>
                        {resetResult.success ? `Password reset successfully (${resetResult.container})` : `Reset failed (exit code ${resetResult.exitCode})`}
                      </div>
                      {resetResult.output && (
                        <pre style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-main)', padding: '8px 10px', borderRadius: 4, margin: '0 0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflowY: 'auto' }}>
                          {resetResult.output}
                        </pre>
                      )}
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setResetResult(null)}>Dismiss</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Siemens tab */}
          {activeTab === 'siemens' && (
            <div className="flex flex-col gap-4">
              {!project && (
                <div className="p-3 rounded-md text-sm text-yellow-400" style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.2)' }}>
                  Open a project to configure Siemens settings
                </div>
              )}
              <div className="p-3 rounded-md text-sm" style={{ background: 'rgba(0,114,198,0.08)', border: '1px solid rgba(0,114,198,0.25)', color: 'var(--text-secondary)' }}>
                TIA Portal Openness is a .NET-only API, so a small bridge service must run on the
                Windows machine that has TIA Portal installed and licensed for Openness. This app
                talks to that bridge over HTTP.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">TIA Portal Version</label>
                  <select
                    value={siemens.tiaVersion || 'V21'}
                    onChange={e => setSiemens(p => ({ ...p, tiaVersion: e.target.value }))}
                    disabled={!project}
                  >
                    <option value="V21">V21</option>
                    <option value="V20">V20</option>
                    <option value="V19">V19</option>
                    <option value="V18">V18</option>
                    <option value="V17">V17</option>
                  </select>
                  <p className="text-xs text-text-muted mt-1">Must match the installed TIA Portal version</p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Bridge URL</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="url"
                    value={siemens.bridgeUrl || ''}
                    onChange={e => setSiemens(p => ({ ...p, bridgeUrl: e.target.value }))}
                    placeholder="http://localhost:5180"
                    disabled={!project}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={handleTestSiemensConnection}
                    disabled={!project || siemensTesting || !siemens.bridgeUrl}
                    style={{ flexShrink: 0, fontSize: 12 }}
                  >
                    {siemensTesting ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-1">Address of the TIA Openness bridge service running on the Windows engineering workstation</p>
                {siemensTestResult && (
                  <div className="flex items-center gap-2 text-sm" style={{ marginTop: 6 }}>
                    {siemensTestResult.success
                      ? <><Wifi size={14} style={{ color: 'var(--accent)' }} /><span style={{ color: 'var(--accent)' }}>{siemensTestResult.message}</span></>
                      : <><WifiOff size={14} style={{ color: '#e55353' }} /><span style={{ color: '#e55353' }}>{siemensTestResult.message}</span></>
                    }
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">TIA Project Path (optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={siemens.projectPath}
                    onChange={e => setSiemens(p => ({ ...p, projectPath: e.target.value }))}
                    placeholder="C:\Projects\MyPlant\MyPlant.ap21"
                    disabled={!project}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={() => tiaProjectFileRef.current?.click()}
                    disabled={!project}
                    title="Browse for TIA project file"
                    style={{ flexShrink: 0, padding: '0 10px' }}
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
                <input
                  ref={tiaProjectFileRef}
                  type="file"
                  accept=".ap21,.ap20,.ap19,.ap18,.ap17"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setSiemens(p => ({ ...p, projectPath: file.name }));
                    e.target.value = '';
                  }}
                />
                <p className="text-xs text-text-muted mt-1">Full path to the TIA Portal project file on the machine running the bridge service</p>
                <div className="flex gap-2 mt-2">
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12 }}
                    disabled={!project || openingProject || tiaProjectOpen || !siemens.projectPath || !siemens.bridgeUrl}
                    onClick={handleOpenTiaProject}
                  >
                    {openingProject ? 'Opening...' : 'Open in TIA'}
                  </button>
                  {tiaProjectOpen && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, color: 'var(--text-muted)' }}
                      onClick={handleCloseTiaProject}
                    >
                      Close Project
                    </button>
                  )}
                  {tiaProjectOpen && (
                    <span style={{ fontSize: 12, color: 'var(--accent)', alignSelf: 'center' }}>● Project open</span>
                  )}
                </div>
              </div>

              {/* FB Mapping */}
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>FB Mapping</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Associate a TIA Portal Function Block with each template. Requires the bridge to be running with a project open.
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, gap: 6, flexShrink: 0 }}
                  onClick={handleRefreshFBs}
                  disabled={!project || loadingFBs || !siemens.bridgeUrl}
                  title="Fetch FB list from TIA Portal via bridge"
                >
                  <RefreshCw size={13} /> {loadingFBs ? 'Loading...' : 'Refresh from TIA'}
                </button>
              </div>

              <div key={fbListKey} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>Template</th>
                      <th style={{ width: 150 }}>Function Block</th>
                      <th>Target Folder</th>
                      <th style={{ width: 55 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!project && (
                      <tr><td colSpan={4} style={{ color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: 12 }}>Open a project to see templates</td></tr>
                    )}
                    {project && (project.templates || []).length === 0 && (
                      <tr><td colSpan={4} style={{ color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: 12 }}>No templates defined — create templates in Assets first</td></tr>
                    )}
                    {[...(project?.templates || [])].sort((a, b) => a.name.localeCompare(b.name)).map(t => {
                      const mapped = siemens.templateFBs?.[t.id];
                      return (
                        <React.Fragment key={t.id}>
                        <tr>
                          <td style={{ fontWeight: 500, fontSize: 13 }}>{t.name}</td>
                          <td>
                            <select
                              value={mapped?.fbName || ''}
                              disabled={!project}
                              style={{ fontSize: 12, width: '100%' }}
                              onChange={e => {
                                const fb = tiaFBs.find(f => f.Name === e.target.value);
                                setSiemens(prev => {
                                  const existing = prev.templateFBs?.[t.id];
                                  return {
                                    ...prev,
                                    templateFBs: {
                                      ...prev.templateFBs,
                                      [t.id]: fb
                                        ? { fbName: fb.Name, fbNumber: fb.Number, parameters: fb.Parameters, targetFolder: existing?.targetFolder, fcName: existing?.fcName, fcNumber: existing?.fcNumber }
                                        : null,
                                    },
                                  };
                                });
                              }}
                            >
                              <option value="">{tiaFBs.length === 0 && !mapped ? 'Refresh to load FBs' : '— Select FB —'}</option>
                              {mapped?.fbName && !tiaFBs.find(f => f.Name === mapped.fbName) && (
                                <option value={mapped.fbName}>{mapped.fbName}</option>
                              )}
                              {tiaFBs.map(fb => (
                                <option key={fb.Name} value={fb.Name}>FB{fb.Number}: {fb.Name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              value={mapped?.targetFolder || ''}
                              disabled={!mapped || !project}
                              placeholder="\Folder\Subfolder"
                              style={{ fontSize: 12, width: '100%', padding: '3px 6px' }}
                              onChange={e => {
                                const val = e.target.value;
                                setSiemens(prev => ({
                                  ...prev,
                                  templateFBs: {
                                    ...prev.templateFBs,
                                    [t.id]: { ...(prev.templateFBs?.[t.id] || {}), targetFolder: val || undefined },
                                  },
                                }));
                              }}
                            />
                          </td>
                          <td>
                            {mapped && (
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => setSiemens(prev => ({
                                  ...prev,
                                  templateFBs: { ...prev.templateFBs, [t.id]: null },
                                }))}
                              >
                                Clear
                              </button>
                            )}
                          </td>
                        </tr>
                        {mapped && (
                          <tr style={{ background: 'var(--bg-surface)' }}>
                            <td colSpan={4} style={{ padding: '4px 12px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>FC Name:</span>
                                <input
                                  type="text"
                                  value={mapped.fcName || ''}
                                  placeholder={`FC_${mapped.fbName || 'Name'} (leave blank to skip)`}
                                  disabled={!project}
                                  style={{ fontSize: 11, flex: 1, padding: '3px 6px' }}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setSiemens(prev => ({
                                      ...prev,
                                      templateFBs: { ...prev.templateFBs, [t.id]: { ...(prev.templateFBs?.[t.id] || {}), fcName: val || undefined } },
                                    }));
                                  }}
                                />
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>FC #:</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={65535}
                                  value={mapped.fcNumber ?? ''}
                                  placeholder="Auto"
                                  disabled={!project}
                                  style={{ fontSize: 11, width: 70, padding: '3px 6px' }}
                                  onChange={e => {
                                    const raw = e.target.value;
                                    const val = raw === '' ? undefined : parseInt(raw, 10);
                                    setSiemens(prev => ({
                                      ...prev,
                                      templateFBs: { ...prev.templateFBs, [t.id]: { ...(prev.templateFBs?.[t.id] || {}), fcNumber: val } },
                                    }));
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="openWithUI"
                    checked={siemens.openWithUI || false}
                    onChange={e => setSiemens(p => ({ ...p, openWithUI: e.target.checked }))}
                    disabled={!project}
                  />
                  <label htmlFor="openWithUI" className="text-sm text-text-primary cursor-pointer">
                    Open TIA Portal with UI visible
                  </label>
                </div>
                <p className="text-xs text-text-muted" style={{ paddingLeft: 22 }}>
                  When unchecked, TIA Portal runs headless in the background
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="checkbox"
                    id="enableSiemens"
                    checked={siemens.enableSiemensMenuItems}
                    onChange={e => setSiemens(p => ({ ...p, enableSiemensMenuItems: e.target.checked }))}
                    disabled={!project}
                  />
                  <label htmlFor="enableSiemens" className="text-sm text-text-primary cursor-pointer">
                    Enable Siemens Menu Items
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Studio 5000 tab */}
          {activeTab === 'studio5000' && (
            <div className="flex flex-col gap-4">
              {!project && (
                <div className="p-3 rounded-md text-sm text-yellow-400" style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.2)' }}>
                  Open a project to configure Studio 5000 settings
                </div>
              )}

              {/* Project File Location */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Project File Location</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Select a Studio 5000 project L5X file. When Studio 5000 menu items are enabled, this unlocks
                  an "Import from Studio 5000" option in the Assets view to pull AOIs and instances directly
                  from your PLC project.
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={studio5000.projectL5X?.fileName || ''}
                    placeholder="No project file selected"
                    readOnly
                    disabled={!project}
                    style={{ flex: 1, fontSize: 12, cursor: 'default' }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={() => studio5000ProjectFileRef.current?.click()}
                    disabled={!project}
                    title="Browse for Studio 5000 project L5X"
                    style={{ flexShrink: 0, padding: '0 10px' }}
                  >
                    <FolderOpen size={14} />
                  </button>
                  {studio5000.projectL5X && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => updateStudio5000(prev => ({ ...prev, projectL5X: null }))}
                      disabled={!project}
                      title="Clear project file"
                      style={{ flexShrink: 0, padding: '0 8px', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  )}
                </div>
                {studio5000.projectL5X && (
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileCode size={12} />
                    {studio5000.projectL5X.fileName}
                  </div>
                )}
                {/* Hidden file input for project L5X */}
                <input
                  ref={studio5000ProjectFileRef}
                  type="file"
                  accept=".L5X,.l5x"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      updateStudio5000(prev => ({
                        ...prev,
                        projectL5X: { fileName: file.name, content: ev.target.result },
                      }));
                      toast.success(`Project file "${file.name}" loaded`);
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>AOI File Mapping</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Associate an Add-On Instruction L5X file with each template. Used when exporting to Rockwell Automation Studio 5000.
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, gap: 6, flexShrink: 0 }}
                  onClick={() => setTemplateListKey(k => k + 1)}
                  disabled={!project}
                  title="Refresh template list"
                >
                  <RotateCw size={13} /> Refresh
                </button>
              </div>

              {/* Hidden file input for AOI browsing */}
              <input
                ref={studio5000FileRef}
                type="file"
                accept=".L5X,.l5x"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file || studio5000PendingTemplateId == null) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const content = ev.target.result;
                    // Parse AOI name from XML
                    let aoiName = file.name.replace(/\.l5x$/i, '');
                    try {
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(content, 'application/xml');
                      const def = doc.querySelector('AddOnInstructionDefinition');
                      if (def) aoiName = def.getAttribute('Name') || aoiName;
                    } catch (_) {}
                    updateStudio5000(prev => ({
                      ...prev,
                      templateAOIs: {
                        ...prev.templateAOIs,
                        [studio5000PendingTemplateId]: { fileName: file.name, aoiName, content },
                      },
                    }));
                    toast.success(`AOI "${aoiName}" linked to template`);
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                  setStudio5000PendingTemplateId(null);
                }}
              />

              {/* Template table */}
              <div key={templateListKey} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Template</th>
                      <th>AOI File</th>
                      <th>AOI Name</th>
                      <th style={{ width: 90 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project && (project.templates || []).length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: 12 }}>
                          No templates defined — create templates in Assets first
                        </td>
                      </tr>
                    )}
                    {!project && (
                      <tr>
                        <td colSpan={4} style={{ color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: 12 }}>
                          Open a project to see templates
                        </td>
                      </tr>
                    )}
                    {(project?.templates || []).map(t => {
                      const aoi = studio5000.templateAOIs?.[t.id];
                      return (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 500, fontSize: 13 }}>{t.name}</td>
                          <td style={{ fontSize: 12, color: aoi ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
                            {aoi?.fileName || 'Not configured'}
                          </td>
                          <td style={{ fontSize: 12, color: aoi ? 'var(--accent)' : 'var(--text-disabled)' }}>
                            {aoi?.aoiName || '—'}
                          </td>
                          <td>
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              disabled={!project}
                              onClick={() => {
                                setStudio5000PendingTemplateId(t.id);
                                studio5000FileRef.current?.click();
                              }}
                            >
                              {aoi ? 'Change' : 'Browse…'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  id="enableStudio5000"
                  checked={studio5000.enableMenuItems || false}
                  onChange={e => updateStudio5000(prev => ({ ...prev, enableMenuItems: e.target.checked }))}
                  disabled={!project}
                />
                <label htmlFor="enableStudio5000" className="text-sm text-text-primary cursor-pointer">
                  Enable Studio 5000 Menu Items
                </label>
              </div>
              {studio5000.enableMenuItems && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8, paddingLeft: 22 }}>
                  Adds "Export to Studio 5000" to the template right-click menu in Assets. Requires an AOI file to be configured for the template.
                </div>
              )}
            </div>
          )}

          {/* Control Expert tab */}
          {activeTab === 'controlExpert' && (
            <div className="flex flex-col gap-4">
              {!project && (
                <div className="p-3 rounded-md text-sm text-yellow-400" style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.2)' }}>
                  Open a project to configure Control Expert settings
                </div>
              )}

              {/* Project XDB File Location */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Project File Location</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Select a Schneider Control Expert Derived Function Block definition file (.XDB). When Control Expert
                  menu items are enabled, this unlocks an "Import from Control Expert" option in the Assets view to pull
                  FB types and instances directly from your project.
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={controlExpert.projectXDBFile?.fileName || ''}
                    placeholder="No XDB file selected"
                    readOnly
                    disabled={!project}
                    style={{ flex: 1, fontSize: 12, cursor: 'default' }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={() => ceProjectXDBFileRef.current?.click()}
                    disabled={!project}
                    title="Browse for Control Expert XDB file"
                    style={{ flexShrink: 0, padding: '0 10px' }}
                  >
                    <FolderOpen size={14} />
                  </button>
                  {controlExpert.projectXDBFile && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => updateControlExpert(prev => ({ ...prev, projectXDBFile: null }))}
                      disabled={!project}
                      title="Clear XDB file"
                      style={{ flexShrink: 0, padding: '0 8px', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  )}
                </div>
                {controlExpert.projectXDBFile && (
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={12} />
                    {controlExpert.projectXDBFile.fileName}
                    {controlExpert.projectXDBFile.fbTypeName && (
                      <span style={{ color: 'var(--text-muted)' }}>· FB type: <strong style={{ color: 'var(--text-primary)' }}>{controlExpert.projectXDBFile.fbTypeName}</strong></span>
                    )}
                  </div>
                )}
                {/* Hidden file input for XDB project file */}
                <input
                  ref={ceProjectXDBFileRef}
                  type="file"
                  accept=".XDB,.xdb"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const content = ev.target.result;
                      let fbTypeName = file.name.replace(/\.xdb$/i, '');
                      let fbVersion = '1.0';
                      try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(content, 'application/xml');
                        const fbSource = doc.querySelector('FBSource');
                        if (fbSource) {
                          fbTypeName = fbSource.getAttribute('nameOfFBType') || fbTypeName;
                          fbVersion = fbSource.getAttribute('version') || '1.0';
                        }
                      } catch (_) {}
                      updateControlExpert(prev => ({
                        ...prev,
                        projectXDBFile: { fileName: file.name, fbTypeName, fbVersion, content },
                      }));
                      toast.success(`XDB file "${file.name}" loaded (FB type: ${fbTypeName})`);
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>FB File Mapping</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Associate a Function Block XDB file with each template. Used when exporting to Schneider Control Expert.
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, gap: 6, flexShrink: 0 }}
                  onClick={() => setCeTemplateListKey(k => k + 1)}
                  disabled={!project}
                  title="Refresh template list"
                >
                  <RotateCw size={13} /> Refresh
                </button>
              </div>

              {/* Hidden file input for per-template XDB browsing */}
              <input
                ref={ceXDBFileRef}
                type="file"
                accept=".XDB,.xdb"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file || cePendingTemplateId == null) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const content = ev.target.result;
                    let fbTypeName = file.name.replace(/\.xdb$/i, '');
                    let fbVersion = '1.0';
                    try {
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(content, 'application/xml');
                      const fbSource = doc.querySelector('FBSource');
                      if (fbSource) {
                        fbTypeName = fbSource.getAttribute('nameOfFBType') || fbTypeName;
                        fbVersion = fbSource.getAttribute('version') || '1.0';
                      }
                    } catch (_) {}
                    updateControlExpert(prev => ({
                      ...prev,
                      templateFBs: {
                        ...prev.templateFBs,
                        [cePendingTemplateId]: { fileName: file.name, fbTypeName, fbVersion, content },
                      },
                    }));
                    toast.success(`FB "${fbTypeName}" linked to template`);
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                  setCePendingTemplateId(null);
                }}
              />

              {/* Template table */}
              <div key={ceTemplateListKey} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Template</th>
                      <th>XDB File</th>
                      <th>FB Type</th>
                      <th style={{ width: 90 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project && (project.templates || []).length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: 12 }}>
                          No templates defined — create templates in Assets first
                        </td>
                      </tr>
                    )}
                    {!project && (
                      <tr>
                        <td colSpan={4} style={{ color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: 12 }}>
                          Open a project to see templates
                        </td>
                      </tr>
                    )}
                    {(project?.templates || []).map(t => {
                      const fb = controlExpert.templateFBs?.[t.id];
                      return (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 500, fontSize: 13 }}>{t.name}</td>
                          <td style={{ fontSize: 12, color: fb ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
                            {fb?.fileName || 'Not configured'}
                          </td>
                          <td style={{ fontSize: 12, color: fb ? 'var(--accent)' : 'var(--text-disabled)' }}>
                            {fb?.fbTypeName || '—'}
                          </td>
                          <td>
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              disabled={!project}
                              onClick={() => {
                                setCePendingTemplateId(t.id);
                                ceXDBFileRef.current?.click();
                              }}
                            >
                              {fb ? 'Change' : 'Browse…'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  id="enableControlExpert"
                  checked={controlExpert.enableMenuItems || false}
                  onChange={e => updateControlExpert(prev => ({ ...prev, enableMenuItems: e.target.checked }))}
                  disabled={!project}
                />
                <label htmlFor="enableControlExpert" className="text-sm text-text-primary cursor-pointer">
                  Enable Control Expert Menu Items
                </label>
              </div>
              {controlExpert.enableMenuItems && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8, paddingLeft: 22 }}>
                  Adds "Export to Control Expert" to the template right-click menu in Assets. Requires an XDB file to be configured for the template.
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

