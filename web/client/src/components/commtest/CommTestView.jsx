import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle, XCircle, Loader, ChevronRight, ChevronDown,
  Plus, Trash2, RefreshCw, Circle,
} from 'lucide-react';
import {
  connectOpc, browseOpc, readOpc, disconnectOpc,
  connectMqtt, mqttMessages, disconnectMqtt,
  connectModbus, readModbus, disconnectModbus,
} from '../../api/client';

// ─── Shared ───────────────────────────────────────────────────────────────────

function StatusDot({ connected, connecting }) {
  if (connecting) return <Loader size={13} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />;
  return <Circle size={10} fill={connected ? '#22c55e' : '#6b7280'} style={{ color: connected ? '#22c55e' : '#6b7280', flexShrink: 0 }} />;
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{children}</span>
      {right && <span>{right}</span>}
    </div>
  );
}

function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(229,83,83,0.08)', borderBottom: '1px solid rgba(229,83,83,0.25)', fontSize: 12, color: '#e55353', flexShrink: 0 }}>
      <XCircle size={13} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{error}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e55353', padding: 0 }}>✕</button>}
    </div>
  );
}

function IconBtn({ icon: Icon, title, onClick, disabled, style }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: disabled ? 'var(--text-disabled)' : 'var(--text-muted)',
        padding: 4, borderRadius: 4, ...style,
      }}
    >
      <Icon size={14} />
    </button>
  );
}

const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString() : '';
const fmtVal = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// ─── OPC UA tab ───────────────────────────────────────────────────────────────

function OpcTree({ sessionId, onAddMonitor }) {
  const [tree, setTree]       = useState([{ nodeId: 'RootFolder', displayName: 'Root', hasChildren: true, isVariable: false, expanded: false, children: null }]);
  const [loading, setLoading] = useState(null); // nodeId being loaded

  const toggle = async (path, node) => {
    if (!node.hasChildren) return;
    if (node.expanded) {
      setTree(prev => collapse(prev, path));
      return;
    }
    setLoading(node.nodeId);
    try {
      const r = await browseOpc({ sessionId, nodeId: node.nodeId });
      setTree(prev => expand(prev, path, r.success ? r.nodes : []));
    } catch {}
    setLoading(null);
  };

  const collapse = (nodes, [idx, ...rest]) =>
    nodes.map((n, i) => i !== idx ? n : rest.length ? { ...n, children: collapse(n.children, rest) } : { ...n, expanded: false });

  const expand = (nodes, [idx, ...rest], children) =>
    nodes.map((n, i) => i !== idx ? n : rest.length ? { ...n, children: expand(n.children, rest, children) } : { ...n, expanded: true, children });

  const renderNodes = (nodes, path = []) => nodes.map((node, i) => {
    const myPath = [...path, i];
    const depth = path.length;
    return (
      <div key={node.nodeId}>
        <div
          style={{ display: 'flex', alignItems: 'center', padding: `3px 12px 3px ${12 + depth * 16}px`, gap: 4, cursor: node.hasChildren ? 'pointer' : 'default' }}
          onClick={() => toggle(myPath, node)}
        >
          <span style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
            {node.hasChildren
              ? (node.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
              : <span style={{ width: 12 }} />}
          </span>
          {loading === node.nodeId
            ? <Loader size={11} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)', flexShrink: 0 }} />
            : <Circle size={8} fill={node.isVariable ? 'var(--accent)' : 'transparent'} style={{ color: 'var(--border)', flexShrink: 0 }} />}
          <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.displayName || node.browseName}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-disabled)', marginRight: 4, flexShrink: 0 }}>{node.nodeId}</span>
          {node.isVariable && (
            <button
              title="Add to monitored items"
              onClick={e => { e.stopPropagation(); onAddMonitor(node); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--accent)' }}
            >
              <Plus size={12} />
            </button>
          )}
        </div>
        {node.expanded && node.children && renderNodes(node.children, myPath)}
      </div>
    );
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', fontSize: 12 }}>
      {renderNodes(tree)}
    </div>
  );
}

function OpcTab() {
  const [host, setHost]         = useState('');
  const [port, setPort]         = useState('4840');
  const [path, setPath]         = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [sessionId, setSessionId]   = useState(null);
  const [error, setError]           = useState(null);
  const [monitored, setMonitored]   = useState([]); // [{ nodeId, displayName, value, statusCode, timestamp }]
  const [polling, setPolling]       = useState(false);
  const pollRef = useRef(null);

  const connected = !!sessionId;

  const connect = async () => {
    setConnecting(true); setError(null);
    try {
      const r = await connectOpc({ host: host.trim(), port, endpointPath: path.trim(), username, password });
      if (r.success) setSessionId(r.sessionId);
      else setError(r.error);
    } catch (e) { setError(e.message); }
    setConnecting(false);
  };

  const disconnect = async () => {
    if (sessionId) { try { await disconnectOpc({ sessionId }); } catch {} }
    setSessionId(null); setMonitored([]); clearInterval(pollRef.current); setPolling(false);
  };

  const addMonitor = (node) => {
    setMonitored(prev => prev.find(m => m.nodeId === node.nodeId)
      ? prev
      : [...prev, { nodeId: node.nodeId, displayName: node.displayName, value: null, statusCode: null, timestamp: null }]);
  };

  const refreshValues = useCallback(async () => {
    if (!sessionId || monitored.length === 0) return;
    try {
      const r = await readOpc({ sessionId, nodeIds: monitored.map(m => m.nodeId) });
      if (r.success) {
        setMonitored(prev => prev.map((m, i) => ({ ...m, ...(r.values[i] || {}) })));
      }
    } catch {}
  }, [sessionId, monitored]);

  useEffect(() => {
    if (polling && sessionId && monitored.length > 0) {
      pollRef.current = setInterval(refreshValues, 2000);
      return () => clearInterval(pollRef.current);
    }
    clearInterval(pollRef.current);
  }, [polling, sessionId, monitored.length, refreshValues]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Connection row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0, flexWrap: 'wrap' }}>
        <input className="input" style={{ width: 180 }} placeholder="Host / IP" value={host} onChange={e => setHost(e.target.value)} disabled={connected} />
        <input className="input" style={{ width: 72 }}  placeholder="Port"    value={port} onChange={e => setPort(e.target.value)} disabled={connected} />
        <input className="input" style={{ width: 140 }} placeholder="Endpoint path (optional)" value={path} onChange={e => setPath(e.target.value)} disabled={connected} />
        <input className="input" style={{ width: 100 }} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} disabled={connected} autoComplete="off" />
        <input className="input" style={{ width: 100 }} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={connected} autoComplete="off" />
        <button
          className={`btn ${connected ? 'btn-secondary' : 'btn-primary'}`}
          style={{ flexShrink: 0 }}
          onClick={connected ? disconnect : connect}
          disabled={connecting || (!connected && !host.trim())}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
        <StatusDot connected={connected} connecting={connecting} />
        {connected && <span style={{ fontSize: 11, color: '#22c55e' }}>Connected</span>}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {!connected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-disabled)', fontSize: 13 }}>
          Enter connection details and click Connect
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Browser */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <SectionLabel>Browser <span style={{ fontSize: 10, color: 'var(--text-disabled)', fontWeight: 400 }}>· Click ● to add variable to monitored items</span></SectionLabel>
            <OpcTree sessionId={sessionId} onAddMonitor={addMonitor} />
          </div>

          {/* Monitored items */}
          <div style={{ height: 220, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
            <SectionLabel right={
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button className={`btn btn-ghost`} style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setPolling(p => !p)}>
                  {polling ? '⏸ Pause' : '▶ Auto 2s'}
                </button>
                <IconBtn icon={RefreshCw} title="Refresh now" onClick={refreshValues} disabled={monitored.length === 0} />
                <IconBtn icon={Trash2}    title="Clear all"   onClick={() => setMonitored([])} disabled={monitored.length === 0} />
              </div>
            }>
              Monitored Items ({monitored.length})
            </SectionLabel>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {monitored.length === 0 ? (
                <div style={{ padding: '16px 14px', color: 'var(--text-disabled)', fontSize: 12 }}>Browse the tree above and click + to add items</div>
              ) : (
                <table className="data-table" style={{ fontSize: 11 }}>
                  <thead><tr><th>Node</th><th style={{ textAlign: 'right' }}>Value</th><th>Status</th><th>Time</th><th style={{ width: 28 }}></th></tr></thead>
                  <tbody>
                    {monitored.map(m => (
                      <tr key={m.nodeId}>
                        <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{m.displayName || m.nodeId}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>{fmtVal(m.value)}</td>
                        <td style={{ color: m.statusCode === 'Good' ? '#22c55e' : 'var(--text-muted)' }}>{m.statusCode || '—'}</td>
                        <td style={{ color: 'var(--text-disabled)' }}>{fmtTime(m.timestamp)}</td>
                        <td><IconBtn icon={Trash2} onClick={() => setMonitored(prev => prev.filter(x => x.nodeId !== m.nodeId))} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
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
  const [connecting, setConnecting] = useState(false);
  const [sessionId, setSessionId]   = useState(null);
  const [error, setError]           = useState(null);
  const [messages, setMessages]     = useState([]);
  const [filter, setFilter]         = useState('');
  const [topicCount, setTopicCount] = useState(0);
  const pollRef = useRef(null);

  const connected = !!sessionId;

  const connect = async () => {
    setConnecting(true); setError(null);
    try {
      const r = await connectMqtt({ host: host.trim(), port, clientId, username, password });
      if (r.success) { setSessionId(r.sessionId); setMessages([]); }
      else setError(r.error);
    } catch (e) { setError(e.message); }
    setConnecting(false);
  };

  const disconnect = async () => {
    clearInterval(pollRef.current);
    if (sessionId) { try { await disconnectMqtt({ sessionId }); } catch {} }
    setSessionId(null); setMessages([]);
  };

  const poll = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await mqttMessages({ sessionId, filter, limit: 100 });
      if (r.success) { setMessages(r.messages); setTopicCount(r.topicCount); }
    } catch {}
  }, [sessionId, filter]);

  useEffect(() => {
    if (!connected) return;
    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => clearInterval(pollRef.current);
  }, [connected, poll]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Connection row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0, flexWrap: 'wrap' }}>
        <input className="input" style={{ width: 180 }} placeholder="Broker Host / IP" value={host}     onChange={e => setHost(e.target.value)}     disabled={connected} />
        <input className="input" style={{ width: 72 }}  placeholder="Port"             value={port}     onChange={e => setPort(e.target.value)}     disabled={connected} />
        <input className="input" style={{ width: 130 }} placeholder="Client ID (opt)"  value={clientId} onChange={e => setClientId(e.target.value)} disabled={connected} />
        <input className="input" style={{ width: 100 }} placeholder="Username"         value={username} onChange={e => setUsername(e.target.value)} disabled={connected} autoComplete="off" />
        <input className="input" style={{ width: 100 }} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={connected} autoComplete="off" />
        <button
          className={`btn ${connected ? 'btn-secondary' : 'btn-primary'}`}
          style={{ flexShrink: 0 }}
          onClick={connected ? disconnect : connect}
          disabled={connecting || (!connected && !host.trim())}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
        <StatusDot connected={connected} connecting={connecting} />
        {connected && <span style={{ fontSize: 11, color: '#22c55e' }}>Connected · {topicCount} topics seen</span>}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {!connected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-disabled)', fontSize: 13 }}>
          Enter broker details and click Connect — subscribes to # (all topics)
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionLabel right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                className="input"
                style={{ width: 180, height: 24, fontSize: 11 }}
                placeholder="Filter by topic…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <IconBtn icon={Trash2} title="Clear messages" onClick={() => setMessages([])} />
            </div>
          }>
            Messages ({messages.length})
          </SectionLabel>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {messages.length === 0 ? (
              <div style={{ padding: '16px 14px', color: 'var(--text-disabled)', fontSize: 12 }}>Waiting for messages…</div>
            ) : (
              <table className="data-table" style={{ fontSize: 11 }}>
                <thead><tr><th>Topic</th><th>Payload</th><th>Timestamp</th></tr></thead>
                <tbody>
                  {messages.map((m, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{m.topic}</td>
                      <td style={{ fontFamily: 'monospace', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.payload}</td>
                      <td style={{ color: 'var(--text-disabled)', whiteSpace: 'nowrap' }}>{fmtTime(m.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modbus TCP tab ───────────────────────────────────────────────────────────

const FC_LABELS = { 1: 'FC01 — Read Coils', 2: 'FC02 — Read Discrete Inputs', 3: 'FC03 — Read Holding Registers', 4: 'FC04 — Read Input Registers' };

function ModbusTab() {
  const [host, setHost]     = useState('');
  const [port, setPort]     = useState('502');
  const [unitId, setUnitId] = useState('1');
  const [connecting, setConnecting] = useState(false);
  const [sessionId, setSessionId]   = useState(null);
  const [error, setError]           = useState(null);
  const [fc, setFc]         = useState('3');
  const [address, setAddr]  = useState('0');
  const [count, setCount]   = useState('10');
  const [values, setValues] = useState([]);
  const [reading, setReading]   = useState(false);
  const [polling, setPolling]   = useState(false);
  const pollRef = useRef(null);

  const connected = !!sessionId;

  const connect = async () => {
    setConnecting(true); setError(null);
    try {
      const r = await connectModbus({ host: host.trim(), port, unitId });
      if (r.success) setSessionId(r.sessionId);
      else setError(r.error);
    } catch (e) { setError(e.message); }
    setConnecting(false);
  };

  const disconnect = async () => {
    clearInterval(pollRef.current);
    if (sessionId) { try { await disconnectModbus({ sessionId }); } catch {} }
    setSessionId(null); setValues([]); setPolling(false);
  };

  const read = useCallback(async () => {
    if (!sessionId) return;
    setReading(true);
    try {
      const r = await readModbus({ sessionId, fc: parseInt(fc), address: parseInt(address), count: parseInt(count) });
      if (r.success) setValues(r.values);
      else setError(r.error);
    } catch (e) { setError(e.message); }
    setReading(false);
  }, [sessionId, fc, address, count]);

  useEffect(() => {
    if (polling && connected) {
      read();
      pollRef.current = setInterval(read, 2000);
      return () => clearInterval(pollRef.current);
    }
    clearInterval(pollRef.current);
  }, [polling, connected, read]);

  const isBool = fc === '1' || fc === '2';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Connection row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0, flexWrap: 'wrap' }}>
        <input className="input" style={{ width: 180 }} placeholder="Host / IP"  value={host}   onChange={e => setHost(e.target.value)}   disabled={connected} />
        <input className="input" style={{ width: 72 }}  placeholder="Port"       value={port}   onChange={e => setPort(e.target.value)}   disabled={connected} />
        <input className="input" style={{ width: 72 }}  placeholder="Unit ID"    value={unitId} onChange={e => setUnitId(e.target.value)} disabled={connected} />
        <button
          className={`btn ${connected ? 'btn-secondary' : 'btn-primary'}`}
          style={{ flexShrink: 0 }}
          onClick={connected ? disconnect : connect}
          disabled={connecting || (!connected && !host.trim())}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
        <StatusDot connected={connected} connecting={connecting} />
        {connected && <span style={{ fontSize: 11, color: '#22c55e' }}>Connected</span>}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {!connected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-disabled)', fontSize: 13 }}>
          Enter device details and click Connect
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Read controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0, flexWrap: 'wrap' }}>
            <select className="input" style={{ width: 220 }} value={fc} onChange={e => setFc(e.target.value)}>
              {Object.entries(FC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="input" style={{ width: 90 }} placeholder="Start addr" value={address} onChange={e => setAddr(e.target.value)} />
            <input className="input" style={{ width: 72 }} placeholder="Count"      value={count}   onChange={e => setCount(e.target.value)} />
            <button className="btn btn-primary" onClick={read} disabled={reading}>
              {reading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Read'}
            </button>
            <button
              className={`btn ${polling ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setPolling(p => !p)}
              style={{ fontSize: 12 }}
            >
              {polling ? '⏸ Pause 2s' : '▶ Auto 2s'}
            </button>
          </div>

          <SectionLabel>Register Values ({values.length})</SectionLabel>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {values.length === 0 ? (
              <div style={{ padding: '16px 14px', color: 'var(--text-disabled)', fontSize: 12 }}>Click Read to fetch register values</div>
            ) : (
              <table className="data-table" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Register</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                    {!isBool && <th style={{ textAlign: 'right' }}>Hex</th>}
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {values.map(v => (
                    <tr key={v.address}>
                      <td style={{ color: 'var(--text-muted)' }}>{v.address}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{fc === '3' || fc === '4' ? `4${String(v.address + 1).padStart(4, '0')}` : `${fc === '1' ? '0' : '1'}${String(v.address + 1).padStart(4, '0')}`}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>
                        {isBool ? (v.value ? 'ON' : 'OFF') : v.value}
                      </td>
                      {!isBool && <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>0x{v.value.toString(16).toUpperCase().padStart(4, '0')}</td>}
                      <td style={{ color: 'var(--text-disabled)' }}>{fmtTime(v.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'opc',    label: 'OPC UA',     component: OpcTab    },
  { id: 'mqtt',   label: 'MQTT',       component: MqttTab   },
  { id: 'modbus', label: 'Modbus TCP', component: ModbusTab },
];

export default function CommTestView() {
  const [activeTab, setActiveTab] = useState('opc');
  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-center flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab-item ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {ActiveComponent && <ActiveComponent />}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
