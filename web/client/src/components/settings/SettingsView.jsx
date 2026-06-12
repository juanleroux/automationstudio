import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Building2, Zap, SlidersHorizontal, RotateCcw, Cpu, FolderOpen } from 'lucide-react';
import ColorPicker from '../shared/ColorPicker';
import { useProject } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../shared/Toast';
import { loadConfig, saveConfig, testIgnitionConnection, resetIgnitionPassword } from '../../api/client';

export default function SettingsView() {
  const { project, updateProject } = useProject();
  const { theme, setTheme, accentColor, setAccentColor, resetAccentColor } = useTheme();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const accentSwatchRef = useRef(null);
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('general');
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
  const [siemens, setSiemens] = useState(
    project?.siemens || {
      tiaVersion: 'V21',
      projectPath: '',
      openWithUI: false,
      enableSiemensMenuItems: true,
    }
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
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

  const handleResetPassword = async () => {
    setConfirmReset(false);
    setResetting(true);
    try {
      const result = await resetIgnitionPassword();
      toast.success(`Password reset complete (container: ${result.container})`);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    } finally {
      setResetting(false);
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
    { id: 'general', label: 'General', icon: SlidersHorizontal },
    { id: 'engineering', label: 'Ignition API', icon: Zap },
    { id: 'siemens', label: 'Siemens API', icon: Cpu },
    { id: 'company', label: 'Company', icon: Building2 },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-main)' }}>
      {/* Tab bar with Save button */}
      <div className="tab-bar" style={{ flexShrink: 0, paddingLeft: 4, paddingRight: 8, justifyContent: 'space-between' }}>
        <div className="flex">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab-item flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ height: 28, fontSize: 12, padding: '0 14px', alignSelf: 'center', marginBottom: 2 }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '24px 24px' }}>
        <div style={{ maxWidth: 520 }}>

          {/* General tab */}
          {activeTab === 'general' && (
            <div className="flex flex-col gap-6">

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
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.55 }}>
                        This will immediately reset the Ignition administrator account password to the factory default by
                        executing <code style={{ fontSize: 11, background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>gwcmd.sh -p</code> in
                        the running container. You will need to log back in to Ignition afterwards.
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setConfirmReset(false)}>Cancel</button>
                        <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={handleResetPassword}>Yes, reset password</button>
                      </div>
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
                Uses TIA Portal Openness — a direct .NET assembly call registered in the Windows GAC.
                No separate service is required. Access is controlled by Windows authentication
                inherited from the running process.
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
                <p className="text-xs text-text-muted mt-1">Full path to the TIA Portal project file on this machine</p>
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

          {/* Company tab */}
          {activeTab === 'company' && config && (
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
          )}
          {activeTab === 'company' && !config && (
            <div className="py-8 text-center text-text-muted text-sm">Loading...</div>
          )}

        </div>
      </div>
    </div>
  );
}
