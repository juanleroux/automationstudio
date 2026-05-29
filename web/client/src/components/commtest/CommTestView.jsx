import React, { useState } from 'react';
import { CheckCircle, XCircle, Loader, Network } from 'lucide-react';
import { testOpcConnection, testMqttConnection, testModbusConnection } from '../../api/client';

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>{children}</div>;
}

function ResultBanner({ result }) {
  if (!result) return null;

  if (result.testing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-main)', border: '1px solid var(--border)', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
        Testing connection…
      </div>
    );
  }

  const ok = result.success;
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 8, marginTop: 20, fontSize: 13,
      background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(229,83,83,0.08)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(229,83,83,0.3)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {ok
          ? <CheckCircle size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
          : <XCircle    size={15} style={{ color: '#e55353', flexShrink: 0 }} />}
        <span style={{ fontWeight: 600, color: ok ? '#22c55e' : '#e55353' }}>
          {ok ? 'Connected' : 'Failed'}
        </span>
        {result.responseTime != null && (
          <span style={{ marginLeft: 4, color: 'var(--text-muted)', fontWeight: 400 }}>
            · {result.responseTime} ms
          </span>
        )}
      </div>
      {(result.detail || result.error) && (
        <div style={{ marginTop: 6, color: 'var(--text-muted)', paddingLeft: 23, fontSize: 12 }}>
          {result.detail || result.error}
        </div>
      )}
      {result.endpoint && (
        <div style={{ marginTop: 3, color: 'var(--text-disabled)', paddingLeft: 23, fontSize: 11, fontFamily: 'monospace' }}>
          {result.endpoint}
        </div>
      )}
      {result.broker && (
        <div style={{ marginTop: 3, color: 'var(--text-disabled)', paddingLeft: 23, fontSize: 11, fontFamily: 'monospace' }}>
          {result.broker}
        </div>
      )}
    </div>
  );
}

// ─── OPC UA tab ───────────────────────────────────────────────────────────────
function OpcTab() {
  const [host, setHost]             = useState('');
  const [port, setPort]             = useState('4840');
  const [endpointPath, setEPPath]   = useState('');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [result, setResult]         = useState(null);

  const test = async () => {
    setResult({ testing: true });
    try {
      const r = await testOpcConnection({ host: host.trim(), port, endpointPath: endpointPath.trim(), username, password });
      setResult(r);
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error || err.message });
    }
  };

  return (
    <div style={formStyle}>
      <Row>
        <Field label="Host / IP Address" hint="Hostname or IP of the OPC UA server">
          <input className="input" style={{ width: 240 }} value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.100" />
        </Field>
        <Field label="Port">
          <input className="input" style={{ width: 90 }} value={port} onChange={e => setPort(e.target.value)} placeholder="4840" />
        </Field>
      </Row>
      <Field label="Endpoint Path (optional)" hint='e.g. /OPCUA/SimulationServer — leave blank for the root endpoint'>
        <input className="input" style={{ width: '100%' }} value={endpointPath} onChange={e => setEPPath(e.target.value)} placeholder="/OPCUA/Server" />
      </Field>
      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 14px', paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Authentication (optional)
        </div>
        <Row>
          <Field label="Username">
            <input className="input" style={{ width: 160 }} value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Password">
            <input className="input" style={{ width: 160 }} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" />
          </Field>
        </Row>
      </div>
      <button className="btn btn-primary" onClick={test} disabled={!host.trim() || result?.testing}>
        Test Connection
      </button>
      <ResultBanner result={result} />
    </div>
  );
}

// ─── MQTT tab ─────────────────────────────────────────────────────────────────
function MqttTab() {
  const [host, setHost]         = useState('');
  const [port, setPort]         = useState('1883');
  const [clientId, setClientId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult]     = useState(null);

  const test = async () => {
    setResult({ testing: true });
    try {
      const r = await testMqttConnection({ host: host.trim(), port, clientId: clientId.trim(), username, password });
      setResult(r);
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error || err.message });
    }
  };

  return (
    <div style={formStyle}>
      <Row>
        <Field label="Broker Host / IP" hint="Hostname or IP of the MQTT broker">
          <input className="input" style={{ width: 240 }} value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.100" />
        </Field>
        <Field label="Port">
          <input className="input" style={{ width: 90 }} value={port} onChange={e => setPort(e.target.value)} placeholder="1883" />
        </Field>
      </Row>
      <Field label="Client ID (optional)" hint="Leave blank to auto-generate">
        <input className="input" style={{ width: 260 }} value={clientId} onChange={e => setClientId(e.target.value)} placeholder="automation-studio-test" />
      </Field>
      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 14px', paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Authentication (optional)
        </div>
        <Row>
          <Field label="Username">
            <input className="input" style={{ width: 160 }} value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Password">
            <input className="input" style={{ width: 160 }} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" />
          </Field>
        </Row>
      </div>
      <button className="btn btn-primary" onClick={test} disabled={!host.trim() || result?.testing}>
        Test Connection
      </button>
      <ResultBanner result={result} />
    </div>
  );
}

// ─── Modbus TCP tab ───────────────────────────────────────────────────────────
function ModbusTab() {
  const [host, setHost]     = useState('');
  const [port, setPort]     = useState('502');
  const [unitId, setUnitId] = useState('1');
  const [result, setResult] = useState(null);

  const test = async () => {
    setResult({ testing: true });
    try {
      const r = await testModbusConnection({ host: host.trim(), port, unitId });
      setResult(r);
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error || err.message });
    }
  };

  return (
    <div style={formStyle}>
      <Row>
        <Field label="Host / IP Address" hint="Hostname or IP of the Modbus TCP device">
          <input className="input" style={{ width: 240 }} value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.100" />
        </Field>
        <Field label="Port">
          <input className="input" style={{ width: 90 }} value={port} onChange={e => setPort(e.target.value)} placeholder="502" />
        </Field>
        <Field label="Unit ID" hint="Slave ID">
          <input className="input" style={{ width: 80 }} value={unitId} onChange={e => setUnitId(e.target.value)} placeholder="1" />
        </Field>
      </Row>
      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-main)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        <strong style={{ color: 'var(--text-primary)' }}>Note:</strong> Sends a Read Holding Registers request (FC 03, address 0, qty 1).
        A Modbus exception response still confirms the device is reachable.
      </div>
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-primary" onClick={test} disabled={!host.trim() || result?.testing}>
          Test Connection
        </button>
      </div>
      <ResultBanner result={result} />
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const formStyle = { padding: 28, maxWidth: 580 };

const TABS = [
  { id: 'opc',    label: 'OPC UA',      component: OpcTab    },
  { id: 'mqtt',   label: 'MQTT',        component: MqttTab   },
  { id: 'modbus', label: 'Modbus TCP',  component: ModbusTab },
];

// ─── Main view ────────────────────────────────────────────────────────────────
export default function CommTestView() {
  const [activeTab, setActiveTab] = useState('opc');
  const active = TABS.find(t => t.id === activeTab);
  const ActiveComponent = active?.component;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-main)' }}>
        {ActiveComponent && <ActiveComponent />}
      </div>

      {/* Spin animation injected once */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
