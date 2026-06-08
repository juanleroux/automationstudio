import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Building2, Zap, SlidersHorizontal, Sun, Moon } from 'lucide-react';
import Modal from '../shared/Modal';
import { useProject } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../shared/Toast';
import { loadConfig, saveConfig, testIgnitionConnection } from '../../api/client';

export default function SettingsModal({ onClose }) {
  const { project, updateProject } = useProject();
  const { theme, setTheme } = useTheme();
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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

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
        updateProject({ ...project, engineering });
      }
      if (config) {
        await saveConfig(config);
      }
      toast.success('Settings saved');
      onClose();
    } catch (err) {
      const detail = err.response?.data?.error || err.message;
      toast.error('Failed to save: ' + detail);
    } finally {
      setSaving(false);
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
    { id: 'company', label: 'Company', icon: Building2 },
  ];

  return (
    <Modal
      title="Settings"
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </>
      }
    >
      {/* Tab bar */}
      <div className="tab-bar mb-4" style={{ margin: '-20px -20px 16px', paddingLeft: 4 }}>
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

      {/* General tab */}
      {activeTab === 'general' && (
        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Appearance</label>
            <div className="flex gap-3">
              {[
                { value: 'dark', label: 'Dark', Icon: Moon },
                { value: 'light', label: 'Light', Icon: Sun },
              ].map(({ value, label, Icon }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg transition-all"
                    style={{
                      flex: 1,
                      border: active ? '2px solid var(--accent)' : '2px solid var(--border)',
                      background: active ? 'var(--accent-bg)' : 'var(--bg-card)',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={22} />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                );
              })}
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

          {/* Test connection */}
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
    </Modal>
  );
}
