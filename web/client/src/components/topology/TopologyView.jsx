import React, {
  useState, useRef, useEffect, useCallback, useId,
} from 'react';
import {
  Plus, Trash2, X, Link2, MousePointer, ChevronDown, Wifi, WifiOff, Loader, Printer,
  Cpu, Radio, Sliders, Box, Monitor, LayoutDashboard, Database, Building2,
  Server as ServerIcon, Laptop, Network, Shield, Activity,
  Settings as SettingsIcon, Plug, Cloud as CloudIcon, BarChart2, LayoutGrid,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { pingNode } from '../../api/client';

const LEVELS = [
  { id: 5, label: 'Level 5', title: 'Cloud / Enterprise',    desc: 'Enterprise Information Network',       color: '#1e3a5f', bg: 'rgba(30,58,95,0.07)'   },
  { id: 4, label: 'Level 4', title: 'ERP, APO, Logistics',   desc: 'Business Process Information Network', color: '#15803d', bg: 'rgba(21,128,61,0.07)'   },
  { id: 3, label: 'Level 3', title: 'MES, LIMS, WMS, CMMS',  desc: 'Operations Information Network',       color: '#b45309', bg: 'rgba(180,83,9,0.07)'    },
  { id: 2, label: 'Level 2', title: 'HMI, SCADA, Batch',     desc: 'Automation Information Network',       color: '#b91c1c', bg: 'rgba(185,28,28,0.07)'   },
  { id: 1, label: 'Level 1', title: 'PLC, RTU, DCS, PAC',    desc: 'Automation Networks',                  color: '#6d28d9', bg: 'rgba(109,40,217,0.07)'  },
  { id: 0, label: 'Level 0', title: 'I/O Link, DeviceNet',   desc: 'Discrete & Process Device Networks',   color: '#0369a1', bg: 'rgba(3,105,161,0.07)'   },
];

const NODE_TYPES = {
  PLC:         { color: '#7c3aed', defaultLevel: 1 },
  RTU:         { color: '#2563eb', defaultLevel: 1 },
  DCS:         { color: '#0891b2', defaultLevel: 1 },
  PAC:         { color: '#059669', defaultLevel: 1 },
  HMI:         { color: '#ea580c', defaultLevel: 2 },
  SCADA:       { color: '#dc2626', defaultLevel: 2 },
  Historian:   { color: '#9333ea', defaultLevel: 2 },
  MES:         { color: '#d97706', defaultLevel: 3 },
  Server:      { color: '#475569', defaultLevel: 3 },
  Workstation: { color: '#64748b', defaultLevel: 3 },
  Switch:      { color: '#52525b', defaultLevel: 1 },
  Firewall:    { color: '#b45309', defaultLevel: 2 },
  Sensor:      { color: '#0284c7', defaultLevel: 0 },
  Actuator:    { color: '#16a34a', defaultLevel: 0 },
  'I/O Card':  { color: '#0e7490', defaultLevel: 0 },
  Cloud:       { color: '#334155', defaultLevel: 5 },
  ERP:         { color: '#166534', defaultLevel: 4 },
  Custom:      { color: '#6b7280', defaultLevel: 2 },
};

const NODE_ICON = {
  PLC:         Cpu,
  RTU:         Radio,
  DCS:         Sliders,
  PAC:         Box,
  HMI:         Monitor,
  SCADA:       LayoutDashboard,
  Historian:   Database,
  MES:         Building2,
  Server:      ServerIcon,
  Workstation: Laptop,
  Switch:      Network,
  Firewall:    Shield,
  Sensor:      Activity,
  Actuator:    SettingsIcon,
  'I/O Card':  Plug,
  Cloud:       CloudIcon,
  ERP:         BarChart2,
  Custom:      LayoutGrid,
};

const CONNECTION_TYPES = [
  'Ethernet', 'Ethernet/IP', 'Profinet', 'Profibus', 'Modbus TCP', 'Modbus Serial',
  'Modbus RTU', 'Fieldbus', 'Foundation Fieldbus', 'ASi (AS-Interface)', 'OPC UA',
  'OPC DA', 'MQTT', 'HART', 'DeviceNet', 'DNP3', 'IEC 61850',
  'Wireless HART', 'ISA100 Wireless', 'Serial (RS-232/485)', 'Custom',
];

// stroke-dasharray and width per connection type (undefined = solid)
const CONN_STYLE = {
  'Ethernet':              { dash: null,          w: 2   },
  'Ethernet/IP':           { dash: null,          w: 2   },
  'Profinet':              { dash: '8 3',         w: 2   },
  'Profibus':              { dash: '8 3',         w: 1.5 },
  'Modbus TCP':            { dash: '5 4',         w: 1.5 },
  'Modbus Serial':         { dash: '4 2 1 2',     w: 1.5 },
  'Modbus RTU':            { dash: '4 2 1 2',     w: 1.5 },
  'Fieldbus':              { dash: '6 3',         w: 1.5 },
  'Foundation Fieldbus':   { dash: '6 3',         w: 2   },
  'ASi (AS-Interface)':    { dash: '2 3',         w: 1.5 },
  'OPC UA':                { dash: '10 4',        w: 2   },
  'OPC DA':                { dash: '10 4',        w: 1.5 },
  'MQTT':                  { dash: '3 4',         w: 1.5 },
  'HART':                  { dash: '1 4',         w: 1.5 },
  'DeviceNet':             { dash: '5 2',         w: 1.5 },
  'DNP3':                  { dash: '7 3',         w: 1.5 },
  'IEC 61850':             { dash: '12 3',        w: 2   },
  'Wireless HART':         { dash: '1 5 6 5',     w: 1.5 },
  'ISA100 Wireless':       { dash: '1 5 9 5',     w: 1.5 },
  'Serial (RS-232/485)':   { dash: '2 5',         w: 1.5 },
  'Custom':                { dash: '3 3 1 3',     w: 1.5 },
};

const LEVEL_H = 130;
const LABEL_W = 90;
const NODE_W  = 84;
const NODE_H  = 52;
const SVG_W   = 4000;
const SVG_H   = LEVEL_H * 6;
const PANEL_W = 280;

function levelY(levelId) { return (5 - levelId) * LEVEL_H; }
function yToLevel(y) { return 5 - Math.min(5, Math.max(0, Math.floor(y / LEVEL_H))); }
function nodeCenter(node) { return { x: node.x + NODE_W / 2, y: node.y + NODE_H / 2 }; }
function uid() { return Math.random().toString(36).slice(2, 10); }

function abbrev(type) {
  if (!type) return '?';
  if (type === 'Workstation') return 'WS';
  if (type === 'Historian')   return 'HIST';
  if (type === 'I/O Card')    return 'I/O';
  if (type === 'Firewall')    return 'FW';
  if (type === 'Actuator')    return 'ACT';
  if (type === 'Custom')      return 'CUST';
  return type.slice(0, 6).toUpperCase();
}

function ConnectionPath({ conn, nodes, selected, onPointerDown }) {
  const from = nodes.find(n => n.id === conn.fromId);
  const to   = nodes.find(n => n.id === conn.toId);
  if (!from || !to) return null;

  const fc = nodeCenter(from);
  const tc = nodeCenter(to);
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  const cx1 = fc.x + dx * 0.4;
  const cy1 = fc.y;
  const cx2 = tc.x - dx * 0.4;
  const cy2 = tc.y;
  const d = `M${fc.x},${fc.y} C${cx1},${cy1} ${cx2},${cy2} ${tc.x},${tc.y}`;

  const midX = fc.x + dx * 0.5;
  const midY = fc.y + dy * 0.5;

  const style = CONN_STYLE[conn.protocol] ?? { dash: null, w: 1.5 };
  const strokeW = selected ? Math.max(style.w, 2) : style.w;
  const dash    = selected ? null : style.dash;

  const label = conn.name || conn.protocol || null;

  return (
    <g data-conn={conn.id} onPointerDown={onPointerDown} style={{ cursor: 'pointer' }}>
      {/* wide transparent hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      <path
        d={d}
        fill="none"
        stroke={selected ? 'var(--accent)' : 'var(--text-muted)'}
        strokeWidth={strokeW}
        strokeOpacity={selected ? 1 : 0.75}
        strokeDasharray={dash ?? undefined}
        markerEnd={`url(#arrow${selected ? '-sel' : ''})`}
      />
      {label && (
        <text
          x={midX}
          y={midY - 7}
          textAnchor="middle"
          fontSize={9}
          fill={selected ? 'var(--accent)' : 'var(--text-muted)'}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

function NodeShape({ node, selected, connecting, isConnectFrom, onPointerDown }) {
  const color     = NODE_TYPES[node.type]?.color ?? '#6b7280';
  const ringColor = isConnectFrom ? '#f59e0b' : selected ? 'var(--accent)' : 'transparent';
  const IconComp  = NODE_ICON[node.type] ?? LayoutGrid;
  const iconX     = (NODE_W - 20) / 2;

  return (
    <g
      data-node={node.id}
      transform={`translate(${node.x},${node.y})`}
      onPointerDown={onPointerDown}
      style={{ cursor: connecting ? 'crosshair' : 'grab' }}
    >
      {(selected || isConnectFrom) && (
        <rect
          x={-3} y={-3}
          width={NODE_W + 6} height={NODE_H + 6}
          rx={7} ry={7}
          fill="none"
          stroke={ringColor}
          strokeWidth={2}
          strokeDasharray={isConnectFrom ? '4 2' : 'none'}
        />
      )}
      <rect
        x={0} y={0}
        width={NODE_W} height={NODE_H}
        rx={5} ry={5}
        fill={color}
        fillOpacity={0.85}
      />
      {/* Node type icon */}
      <foreignObject x={iconX} y={5} width={20} height={22} style={{ pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 22 }}>
          <IconComp size={16} color="white" strokeWidth={2} />
        </div>
      </foreignObject>
      {/* Node name */}
      <text
        x={NODE_W / 2} y={43}
        textAnchor="middle"
        fontSize={9}
        fill="rgba(255,255,255,0.9)"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.name.length > 11 ? node.name.slice(0, 10) + '…' : node.name}
      </text>
    </g>
  );
}

function LevelBands() {
  return (
    <>
      {LEVELS.map(lv => {
        const y = levelY(lv.id);
        return (
          <g key={lv.id}>
            <rect x={0} y={y} width={SVG_W} height={LEVEL_H} fill={lv.bg} />
            <rect x={0} y={y} width={LABEL_W} height={LEVEL_H} fill={lv.color} />
            <text
              x={LABEL_W / 2} y={y + 22}
              textAnchor="middle"
              fontSize={10}
              fontWeight="700"
              fill="rgba(255,255,255,0.95)"
              style={{ userSelect: 'none' }}
            >
              {lv.label}
            </text>
            <text
              x={LABEL_W / 2} y={y + 36}
              textAnchor="middle"
              fontSize={8}
              fill="rgba(255,255,255,0.7)"
              style={{ userSelect: 'none' }}
            >
              {lv.title.length > 13 ? lv.title.slice(0, 12) + '…' : lv.title}
            </text>
            <line
              x1={0} y1={y + LEVEL_H}
              x2={SVG_W} y2={y + LEVEL_H}
              stroke="rgba(120,120,120,0.15)"
              strokeWidth={1}
            />
            <text
              x={SVG_W - 12} y={y + LEVEL_H - 10}
              textAnchor="end"
              fontSize={9}
              fill="rgba(120,120,120,0.4)"
              style={{ userSelect: 'none' }}
            >
              {lv.desc}
            </text>
          </g>
        );
      })}
    </>
  );
}

function PropField({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function TopologyView() {
  const { project, updateProject } = useProject();
  const topology = project?.topology ?? { nodes: [], connections: [] };
  const nodes      = topology.nodes       ?? [];
  const connections = topology.connections ?? [];

  const [tool, setTool]           = useState('select');
  const [selected, setSelected]   = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [zoom, setZoom]           = useState(1);
  const [pan, setPan]             = useState({ x: 0, y: 0 });
  const [previewPt, setPreviewPt] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pingState, setPingState] = useState({ status: 'idle', rtt: null, message: '' });
  const [contextMenu, setContextMenu] = useState(null);

  const svgRef      = useRef(null);
  const addBtnRef   = useRef(null);
  const dragRef     = useRef(null);
  const panRef      = useRef(null);

  const selectedNode = selected?.type === 'node' ? nodes.find(n => n.id === selected.id) : null;
  const selectedConn = selected?.type === 'conn' ? connections.find(c => c.id === selected.id) : null;
  const panelOpen    = !!(selectedNode || selectedConn);

  useEffect(() => {
    setPingState({ status: 'idle', rtt: null, message: '' });
  }, [selected?.id]);

  const handlePing = useCallback(async () => {
    if (!selectedNode?.ipAddress) return;
    setPingState({ status: 'pinging', rtt: null, message: '' });
    try {
      const result = await pingNode({ host: selectedNode.ipAddress, port: 80 });
      setPingState({
        status: result.alive ? 'alive' : 'dead',
        rtt: result.rtt,
        message: result.message,
      });
    } catch (err) {
      setPingState({ status: 'dead', rtt: null, message: err.message ?? 'Request failed' });
    }
  }, [selectedNode?.ipAddress]);

  const updateTopology = useCallback((updater) => {
    if (!project) return;
    updateProject(prev => ({
      ...prev,
      topology: typeof updater === 'function' ? updater(prev.topology ?? { nodes: [], connections: [] }) : updater,
    }));
  }, [project, updateProject]);

  const updateNode = useCallback((id, patch) => {
    updateTopology(t => ({
      ...t,
      nodes: t.nodes.map(n => n.id === id ? { ...n, ...patch } : n),
    }));
  }, [updateTopology]);

  const updateConnection = useCallback((id, patch) => {
    updateTopology(t => ({
      ...t,
      connections: t.connections.map(c => c.id === id ? { ...c, ...patch } : c),
    }));
  }, [updateTopology]);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    if (selected.type === 'node') {
      updateTopology(t => ({
        nodes: t.nodes.filter(n => n.id !== selected.id),
        connections: t.connections.filter(c => c.fromId !== selected.id && c.toId !== selected.id),
      }));
    } else {
      updateTopology(t => ({
        ...t,
        connections: t.connections.filter(c => c.id !== selected.id),
      }));
    }
    setSelected(null);
  }, [selected, updateTopology]);

  const addNode = useCallback((type, atWorldX, atWorldY) => {
    if (!project) return;
    const cfg = NODE_TYPES[type];
    let x, y, lvl;
    if (atWorldX !== undefined && atWorldY !== undefined) {
      x   = Math.max(LABEL_W, Math.min(SVG_W - NODE_W, atWorldX - NODE_W / 2));
      y   = Math.max(0, Math.min(SVG_H - NODE_H, atWorldY - NODE_H / 2));
      lvl = yToLevel(atWorldY);
    } else {
      lvl = cfg.defaultLevel;
      const sameLevelCount = nodes.filter(n => n.level === lvl).length;
      x = LABEL_W + 20 + sameLevelCount * (NODE_W + 12);
      y = levelY(lvl) + (LEVEL_H - NODE_H) / 2;
    }
    const newNode = {
      id: uid(), type, level: lvl, name: type,
      description: '', ipAddress: '', vendor: '', model: '', notes: '', x, y,
    };
    updateTopology(t => ({ ...t, nodes: [...(t.nodes ?? []), newNode] }));
    setSelected({ type: 'node', id: newNode.id });
    setAddMenuOpen(false);
    setContextMenu(null);
  }, [project, nodes, updateTopology]);

  const svgToWorld = useCallback((clientX, clientY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top  - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const handleSvgPointerDown = useCallback((e) => {
    if (e.target !== svgRef.current && (e.target.closest('[data-node]') || e.target.closest('[data-conn]'))) return;
    if (e.button !== 0) return;
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan]);

  const handleSvgPointerMove = useCallback((e) => {
    if (tool === 'connect' && connectFrom) {
      setPreviewPt(svgToWorld(e.clientX, e.clientY));
    }
    if (!panRef.current) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panRef.current.moved = true;
    if (panRef.current.moved) {
      setPan({ x: panRef.current.panX + dx, y: panRef.current.panY + dy });
    }
  }, [tool, connectFrom, svgToWorld]);

  const handleSvgPointerUp = useCallback((e) => {
    if (panRef.current && !panRef.current.moved) {
      setSelected(null);
      if (tool === 'connect') {
        setConnectFrom(null);
        setPreviewPt(null);
      }
    }
    panRef.current = null;
  }, [tool]);

  const handleSvgWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setZoom(z => {
      const nz = Math.min(4, Math.max(0.15, z * factor));
      setPan(p => ({
        x: mx - (mx - p.x) * (nz / z),
        y: my - (my - p.y) * (nz / z),
      }));
      return nz;
    });
  }, []);

  const handleNodePointerDown = useCallback((e, nodeId) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    if (tool === 'connect') {
      if (!connectFrom) {
        setConnectFrom(nodeId);
        setPreviewPt(svgToWorld(e.clientX, e.clientY));
      } else if (connectFrom !== nodeId) {
        const newConn = {
          id: uid(),
          fromId: connectFrom,
          toId: nodeId,
          name: '',
          protocol: '',
          description: '',
          notes: '',
        };
        updateTopology(t => ({ ...t, connections: [...(t.connections ?? []), newConn] }));
        setSelected({ type: 'conn', id: newConn.id });
        setConnectFrom(null);
        setPreviewPt(null);
        setTool('select');
      }
      return;
    }

    setSelected({ type: 'node', id: nodeId });
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    dragRef.current = {
      nodeId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [tool, connectFrom, nodes, svgToWorld, updateTopology]);

  const handleNodePointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    const dx = (e.clientX - dragRef.current.startClientX) / zoom;
    const dy = (e.clientY - dragRef.current.startClientY) / zoom;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
    if (!dragRef.current.moved) return;

    const rawX = dragRef.current.startNodeX + dx;
    const rawY = dragRef.current.startNodeY + dy;
    const clampedX = Math.max(LABEL_W, Math.min(SVG_W - NODE_W, rawX));
    const clampedY = Math.max(0, Math.min(SVG_H - NODE_H, rawY));
    const newLevel = yToLevel(clampedY + NODE_H / 2);

    updateNode(dragRef.current.nodeId, { x: clampedX, y: clampedY, level: newLevel });
  }, [zoom, updateNode]);

  const handleNodePointerUp = useCallback((e) => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape') {
        setConnectFrom(null);
        setPreviewPt(null);
        if (tool === 'connect') setTool('select');
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [deleteSelected, tool]);

  const handleSvgContextMenu = useCallback((e) => {
    e.preventDefault();
    if (!project) return;
    if (e.target !== svgRef.current && (e.target.closest('[data-node]') || e.target.closest('[data-conn]'))) return;
    const rect = svgRef.current?.getBoundingClientRect();
    const worldPt = svgToWorld(e.clientX, e.clientY);
    setContextMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      worldX: worldPt.x,
      worldY: worldPt.y,
    });
  }, [project, svgToWorld]);

  useEffect(() => {
    const dismiss = (e) => {
      setAddMenuOpen(false);
      if (!e.target.closest?.('[data-context-menu]')) setContextMenu(null);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleSvgWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleSvgWheel);
  }, [handleSvgWheel]);

  const fromNode = connectFrom ? nodes.find(n => n.id === connectFrom) : null;
  const fromCenter = fromNode ? nodeCenter(fromNode) : null;

  const toolbarBtn = (active, children, onClick, title, disabled = false, red = false) => (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', borderRadius: 4, border: 'none',
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: red && !disabled ? '#ef4444' : active ? 'var(--accent)' : disabled ? 'var(--text-disabled)' : 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        outline: active ? '1px solid var(--accent)' : 'none',
      }}
    >
      {children}
    </button>
  );

  const inputStyle = {
    width: '100%',
    padding: '4px 7px',
    background: 'var(--bg-main)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 12,
    boxSizing: 'border-box',
  };

  return (
    <div data-topology-canvas="1" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '4px 8px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginRight: 8 }}>Topology</span>

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        {toolbarBtn(tool === 'select', <><MousePointer size={14} /> Select</>, () => setTool('select'), 'Select', false, false)}
        {toolbarBtn(
          tool === 'connect',
          <><Link2 size={14} /> Connect{tool === 'connect' && connectFrom ? ' (click target)' : ''}</>,
          () => { setTool(t => t === 'connect' ? 'select' : 'connect'); setConnectFrom(null); setPreviewPt(null); },
          'Connect nodes',
        )}

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        <div ref={addBtnRef} style={{ position: 'relative' }}>
          {toolbarBtn(false, <><Plus size={14} /> Add Node <ChevronDown size={12} /></>, () => setAddMenuOpen(o => !o), 'Add node', !project)}
          {addMenuOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 4,
              minWidth: 260,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            }}>
              {Object.entries(NODE_TYPES).map(([type, cfg]) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 8px', borderRadius: 4,
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', fontSize: 11,
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: cfg.color, flexShrink: 0,
                  }} />
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        {toolbarBtn(false, <><Trash2 size={14} /> Delete</>, deleteSelected, 'Delete selected', !selected, true)}

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 42, textAlign: 'right' }}>
          {Math.round(zoom * 100)}%
        </span>
        {toolbarBtn(false, '+', () => setZoom(z => Math.min(4, z * 1.15)), 'Zoom in')}
        {toolbarBtn(false, '−', () => setZoom(z => Math.max(0.15, z / 1.15)), 'Zoom out')}
        {toolbarBtn(false, 'Reset', () => { setZoom(1); setPan({ x: 0, y: 0 }); }, 'Reset view')}
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        {toolbarBtn(false, <><Printer size={14} /> Print</>, () => window.print(), 'Print / Save as PDF')}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* SVG Canvas */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{ display: 'block', cursor: panRef.current?.moved ? 'grabbing' : tool === 'connect' ? 'crosshair' : 'default' }}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={(e) => { handleSvgPointerMove(e); handleNodePointerMove(e); }}
            onPointerUp={(e) => { handleSvgPointerUp(e); handleNodePointerUp(e); }}
            onContextMenu={handleSvgContextMenu}
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="var(--text-muted)" fillOpacity={0.7} />
              </marker>
              <marker id="arrow-sel" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="var(--accent)" />
              </marker>
            </defs>

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              <LevelBands />

              {/* Connections */}
              {connections.map(conn => (
                <ConnectionPath
                  key={conn.id}
                  conn={conn}
                  nodes={nodes}
                  selected={selected?.type === 'conn' && selected.id === conn.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (e.button !== 0) return;
                    setSelected({ type: 'conn', id: conn.id });
                  }}
                />
              ))}

              {/* Preview line */}
              {tool === 'connect' && connectFrom && fromCenter && previewPt && (
                <line
                  x1={fromCenter.x} y1={fromCenter.y}
                  x2={previewPt.x}  y2={previewPt.y}
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  strokeOpacity={0.8}
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* Nodes */}
              {nodes.map(node => (
                <NodeShape
                  key={node.id}
                  node={node}
                  selected={selected?.type === 'node' && selected.id === node.id}
                  connecting={tool === 'connect'}
                  isConnectFrom={connectFrom === node.id}
                  onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                />
              ))}
            </g>
          </svg>

          {!project && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Open or create a project to use the Topology view.</span>
            </div>
          )}

          {/* Right-click context menu */}
          {contextMenu && (
            <div
              data-context-menu="1"
              style={{
                position: 'absolute',
                left: Math.min(contextMenu.x, (svgRef.current?.clientWidth ?? 600) - 270),
                top:  Math.min(contextMenu.y, (svgRef.current?.clientHeight ?? 400) - 360),
                zIndex: 200,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: 8,
                boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
                minWidth: 260,
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, padding: '2px 6px 6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Add Node
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                {Object.entries(NODE_TYPES).map(([type, cfg]) => {
                  const Icon = NODE_ICON[type] ?? LayoutGrid;
                  return (
                    <button
                      key={type}
                      onClick={() => addNode(type, contextMenu.worldX, contextMenu.worldY)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 7px', borderRadius: 4,
                        background: 'transparent', border: 'none',
                        cursor: 'pointer', fontSize: 11,
                        color: 'var(--text-primary)', textAlign: 'left',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: cfg.color, flexShrink: 0, display: 'flex' }}>
                        <Icon size={13} strokeWidth={2} />
                      </span>
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Properties panel */}
        {panelOpen && (
          <div style={{
            width: PANEL_W,
            flexShrink: 0,
            background: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                {selectedNode ? 'Node Properties' : 'Connection'}
              </span>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {selectedNode && (
                <>
                  <PropField label="Type">
                    <select
                      value={selectedNode.type}
                      onChange={e => updateNode(selectedNode.id, { type: e.target.value })}
                      style={inputStyle}
                    >
                      {Object.keys(NODE_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </PropField>
                  <PropField label="Name">
                    <input
                      type="text"
                      value={selectedNode.name}
                      onChange={e => updateNode(selectedNode.id, { name: e.target.value })}
                      style={inputStyle}
                    />
                  </PropField>
                  <PropField label="Level">
                    <select
                      value={selectedNode.level}
                      onChange={e => {
                        const lvl = Number(e.target.value);
                        const y = levelY(lvl) + (LEVEL_H - NODE_H) / 2;
                        updateNode(selectedNode.id, { level: lvl, y });
                      }}
                      style={inputStyle}
                    >
                      {LEVELS.map(lv => (
                        <option key={lv.id} value={lv.id}>{lv.label} – {lv.title}</option>
                      ))}
                    </select>
                  </PropField>
                  <PropField label="Description">
                    <textarea
                      rows={2}
                      value={selectedNode.description}
                      onChange={e => updateNode(selectedNode.id, { description: e.target.value })}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </PropField>
                  <PropField label="IP Address">
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        type="text"
                        value={selectedNode.ipAddress}
                        onChange={e => { updateNode(selectedNode.id, { ipAddress: e.target.value }); setPingState({ status: 'idle', rtt: null, message: '' }); }}
                        style={{ ...inputStyle, flex: 1 }}
                        placeholder="e.g. 192.168.1.10"
                      />
                      <button
                        onClick={handlePing}
                        disabled={!selectedNode.ipAddress || pingState.status === 'pinging'}
                        title="Ping host"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '4px 7px', borderRadius: 4, flexShrink: 0,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-main)',
                          color: !selectedNode.ipAddress ? 'var(--text-disabled)' : 'var(--text-muted)',
                          cursor: !selectedNode.ipAddress || pingState.status === 'pinging' ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                        }}
                      >
                        {pingState.status === 'pinging' ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Wifi size={13} />}
                      </button>
                    </div>
                    {pingState.status !== 'idle' && pingState.status !== 'pinging' && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        marginTop: 5, fontSize: 11,
                        color: pingState.status === 'alive' ? '#22c55e' : '#ef4444',
                      }}>
                        {pingState.status === 'alive'
                          ? <Wifi size={12} />
                          : <WifiOff size={12} />
                        }
                        <span>{pingState.message}</span>
                      </div>
                    )}
                  </PropField>
                  <PropField label="Vendor">
                    <input
                      type="text"
                      value={selectedNode.vendor}
                      onChange={e => updateNode(selectedNode.id, { vendor: e.target.value })}
                      style={inputStyle}
                    />
                  </PropField>
                  <PropField label="Model">
                    <input
                      type="text"
                      value={selectedNode.model}
                      onChange={e => updateNode(selectedNode.id, { model: e.target.value })}
                      style={inputStyle}
                    />
                  </PropField>
                  <PropField label="Notes">
                    <textarea
                      rows={3}
                      value={selectedNode.notes}
                      onChange={e => updateNode(selectedNode.id, { notes: e.target.value })}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </PropField>
                  <button
                    className="btn"
                    onClick={() => { deleteSelected(); }}
                    style={{
                      marginTop: 4, width: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.3)',
                      padding: '6px 0', borderRadius: 4,
                      cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <Trash2 size={13} /> Delete Node
                  </button>
                </>
              )}

              {selectedConn && (() => {
                const fromN = nodes.find(n => n.id === selectedConn.fromId);
                const toN   = nodes.find(n => n.id === selectedConn.toId);
                return (
                  <>
                    <PropField label="From → To">
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', padding: '3px 0' }}>
                        {fromN?.name ?? '(unknown)'} → {toN?.name ?? '(unknown)'}
                      </div>
                    </PropField>
                    <PropField label="Name">
                      <input
                        type="text"
                        value={selectedConn.name}
                        onChange={e => updateConnection(selectedConn.id, { name: e.target.value })}
                        style={inputStyle}
                      />
                    </PropField>
                    <PropField label="Type">
                      <select
                        value={selectedConn.protocol}
                        onChange={e => updateConnection(selectedConn.id, { protocol: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">— none —</option>
                        {CONNECTION_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </PropField>
                    <PropField label="Description">
                      <textarea
                        rows={2}
                        value={selectedConn.description}
                        onChange={e => updateConnection(selectedConn.id, { description: e.target.value })}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    </PropField>
                    <PropField label="Notes">
                      <textarea
                        rows={3}
                        value={selectedConn.notes}
                        onChange={e => updateConnection(selectedConn.id, { notes: e.target.value })}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    </PropField>
                    <button
                      className="btn"
                      onClick={() => { deleteSelected(); }}
                      style={{
                        marginTop: 4, width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        background: 'rgba(239,68,68,0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.3)',
                        padding: '6px 0', borderRadius: 4,
                        cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      <Trash2 size={13} /> Delete Connection
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
