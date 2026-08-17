import React, {
  useState, useRef, useEffect, useCallback, useId,
} from 'react';
import {
  Plus, Trash2, X, Link2, MousePointer, ChevronDown, Wifi, WifiOff, Loader, Printer,
  Cpu, Radio, Sliders, Box, Monitor, LayoutDashboard, Database, Building2,
  Server as ServerIcon, Laptop, Network, Shield, Activity,
  Settings as SettingsIcon, Plug, Cloud as CloudIcon, BarChart2, LayoutGrid,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { pingNode } from '../../api/client';
import ColorPicker from '../shared/ColorPicker';

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

const LINE_STYLES = [
  { id: 'auto',      label: 'Auto',      dash: null,       desc: 'From protocol' },
  { id: 'solid',     label: 'Solid',     dash: null,       desc: 'Solid line',    solid: true },
  { id: 'dashed',    label: 'Dashed',    dash: '8 4',      desc: 'Dashed' },
  { id: 'dotted',    label: 'Dotted',    dash: '2 4',      desc: 'Dotted' },
  { id: 'dash-dot',  label: 'Dash·dot',  dash: '8 2 2 2',  desc: 'Dash-dot' },
  { id: 'long-dash', label: 'Long dash', dash: '16 4',     desc: 'Long dash' },
];

const LINE_WIDTHS = [
  { id: 'auto', label: 'Auto', w: null },
  { id: '1',    label: 'Thin', w: 1   },
  { id: '2',    label: 'Std',  w: 2   },
  { id: '3',    label: 'Bold', w: 3   },
];

const DEFAULT_LEVEL_H = 130;
const MIN_LEVEL_H     = 80;
const MAX_LEVEL_H     = 300;
const LEVEL_H_STEP    = 20;
const LABEL_W = 90;
const NODE_W  = 84;
const NODE_H  = 52;
const SVG_W   = 4000;
const PANEL_W = 280;

function getDefaultLevelHeights() {
  return Object.fromEntries(LEVELS.map(lv => [lv.id, DEFAULT_LEVEL_H]));
}

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

  const protocolStyle = CONN_STYLE[conn.protocol] ?? { dash: null, w: 1.5 };
  let resolvedDash = protocolStyle.dash;
  if (conn.lineStyle && conn.lineStyle !== 'auto') {
    const ls = LINE_STYLES.find(s => s.id === conn.lineStyle);
    if (ls) resolvedDash = ls.dash; // null = solid for explicit styles
  }
  const resolvedW = conn.lineWidth ?? protocolStyle.w;
  const strokeW = selected ? Math.max(resolvedW, 2) : resolvedW;
  const dash    = selected ? null : resolvedDash;

  const label = conn.name || conn.protocol || null;

  // Stable, staggered animation params from connection id
  const seed      = (parseInt(conn.id.slice(-4), 36) % 1000) / 1000;
  const animDur   = (2.2 + seed * 1.6).toFixed(2);   // 2.2 – 3.8 s
  const animBegin = (seed * 2.4).toFixed(2);           // 0 – 2.4 s stagger

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
      {/* Travel bubble */}
      <circle r={3} fill="white" opacity={0} style={{ pointerEvents: 'none' }}>
        <animateMotion
          dur={`${animDur}s`}
          begin={`${animBegin}s`}
          repeatCount="indefinite"
          path={d}
          calcMode="spline"
          keyTimes="0;1"
          keySplines="0.42 0 0.58 1"
        />
        <animate
          attributeName="opacity"
          values="0;0.9;0.9;0"
          keyTimes="0;0.07;0.93;1"
          dur={`${animDur}s`}
          begin={`${animBegin}s`}
          repeatCount="indefinite"
        />
      </circle>
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
  const color     = node.color ?? NODE_TYPES[node.type]?.color ?? '#6b7280';
  const ringColor = isConnectFrom ? '#f59e0b' : selected ? 'var(--accent)' : 'transparent';
  const IconComp  = NODE_ICON[node.icon ?? node.type] ?? LayoutGrid;
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

function LevelBands({ levelHeights, onResize, lvlY, svgH }) {
  return (
    <>
      {LEVELS.map((lv, i) => {
        const y = lvlY(lv.id);
        const h = levelHeights[lv.id] ?? DEFAULT_LEVEL_H;
        const isLast = i === LEVELS.length - 1;
        const bgH = isLast ? 99999 : h;
        const canDecrease = h > MIN_LEVEL_H;
        const canIncrease = h < MAX_LEVEL_H;
        return (
          <g key={lv.id}>
            <rect x={0} y={y} width={SVG_W} height={bgH} fill={lv.bg} />
            <rect x={0} y={y} width={LABEL_W} height={h} fill={lv.color} />
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
            {/* −/+ row-height buttons */}
            <foreignObject x={4} y={y + h - 22} width={82} height={20}>
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                style={{ display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'center', height: '100%' }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onResize(lv.id, -LEVEL_H_STEP); }}
                  disabled={!canDecrease}
                  title="Decrease row height"
                  style={{
                    fontSize: 13, lineHeight: 1, padding: '1px 7px',
                    background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 3,
                    color: canDecrease ? 'white' : 'rgba(255,255,255,0.25)',
                    cursor: canDecrease ? 'pointer' : 'default',
                    fontWeight: 700,
                  }}
                >
                  −
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onResize(lv.id, +LEVEL_H_STEP); }}
                  disabled={!canIncrease}
                  title="Increase row height"
                  style={{
                    fontSize: 13, lineHeight: 1, padding: '1px 7px',
                    background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 3,
                    color: canIncrease ? 'white' : 'rgba(255,255,255,0.25)',
                    cursor: canIncrease ? 'pointer' : 'default',
                    fontWeight: 700,
                  }}
                >
                  +
                </button>
              </div>
            </foreignObject>
            <line
              x1={0} y1={y + h}
              x2={SVG_W} y2={y + h}
              stroke="rgba(120,120,120,0.15)"
              strokeWidth={1}
            />
            <text
              x={SVG_W - 12} y={y + h - 10}
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

  // Per-level row heights — persisted in topology
  const levelHeights = (topology.levelHeights && Object.keys(topology.levelHeights).length === 6)
    ? topology.levelHeights
    : getDefaultLevelHeights();

  // Compute SVG total height and per-level Y helpers from current heights
  const svgH = LEVELS.reduce((s, lv) => s + (levelHeights[lv.id] ?? DEFAULT_LEVEL_H), 0);

  function lvlY(levelId) {
    let y = 0;
    for (let id = 5; id > levelId; id--) y += levelHeights[id] ?? DEFAULT_LEVEL_H;
    return y;
  }

  function lvlToLevel(y) {
    let accum = 0;
    for (let id = 5; id >= 0; id--) {
      const h = levelHeights[id] ?? DEFAULT_LEVEL_H;
      if (y < accum + h) return id;
      accum += h;
    }
    return 0;
  }

  // Store in a ref so callbacks can access current values without needing them as deps
  const dynamicRef = useRef({ svgH, lvlY, lvlToLevel, levelHeights });
  dynamicRef.current = { svgH, lvlY, lvlToLevel, levelHeights };

  const [tool, setTool]           = useState('select');
  // Multi-select: set of selected node ids; separate state for selected connection
  const [selectedNodeIds, setSelectedNodeIds] = useState(() => new Set());
  const [selectedConnId, setSelectedConnId]   = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [zoom, setZoom]           = useState(1);
  const [pan, setPan]             = useState({ x: 0, y: 0 });
  const [previewPt, setPreviewPt] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pingState, setPingState] = useState({ status: 'idle', rtt: null, message: '' });
  const [contextMenu, setContextMenu] = useState(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen]   = useState(false);

  const svgRef         = useRef(null);
  const addBtnRef      = useRef(null);
  const dragRef        = useRef(null);
  const panRef         = useRef(null);
  const colorSwatchRef = useRef(null);

  // Derived selection helpers
  const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id));
  const selectedNode  = selectedNodeIds.size === 1 ? (selectedNodes[0] ?? null) : null;
  const selectedConn  = selectedConnId ? (connections.find(c => c.id === selectedConnId) ?? null) : null;
  const multiSelected = selectedNodeIds.size >= 2;
  const anySelected   = selectedNodeIds.size > 0 || !!selectedConnId;
  const panelOpen     = !!(selectedNode || selectedConn);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setSelectedConnId(null);
  }, []);

  useEffect(() => {
    setPingState({ status: 'idle', rtt: null, message: '' });
    setColorPickerOpen(false);
    setIconPickerOpen(false);
  }, [selectedNode?.id]);

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

  const handlePrint = useCallback(() => {
    if (!project) return;
    const { lvlY: _lvlY, levelHeights: _lh, svgH: _svgH } = dynamicRef.current;

    // Bounding box: always show all 6 levels; width = rightmost node + margin
    const maxNodeX = nodes.length > 0
      ? Math.max(...nodes.map(n => n.x + NODE_W)) + 60
      : LABEL_W + 700;
    const vW = Math.max(maxNodeX, LABEL_W + 400);
    const vH = _svgH;

    // ── Level bands ─────────────────────────────────────────────
    const bandsHtml = LEVELS.map(lv => {
      const y = _lvlY(lv.id);
      const h = _lh[lv.id] ?? DEFAULT_LEVEL_H;
      const t = lv.title.length > 13 ? lv.title.slice(0, 12) + '…' : lv.title;
      return `<rect x="0" y="${y}" width="${vW}" height="${h}" fill="${lv.bg}"/>
<rect x="0" y="${y}" width="${LABEL_W}" height="${h}" fill="${lv.color}"/>
<text x="${LABEL_W / 2}" y="${y + 22}" text-anchor="middle" font-size="10" font-weight="700" fill="rgba(255,255,255,0.95)">${lv.label}</text>
<text x="${LABEL_W / 2}" y="${y + 36}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.7)">${t}</text>
<line x1="0" y1="${y + h}" x2="${vW}" y2="${y + h}" stroke="rgba(120,120,120,0.2)" stroke-width="1"/>
<text x="${vW - 10}" y="${y + h - 10}" text-anchor="end" font-size="8" fill="rgba(120,120,120,0.45)">${lv.desc}</text>`;
    }).join('\n');

    // ── Connections ─────────────────────────────────────────────
    const connsHtml = connections.map(conn => {
      const from = nodes.find(n => n.id === conn.fromId);
      const to   = nodes.find(n => n.id === conn.toId);
      if (!from || !to) return '';
      const fcx = from.x + NODE_W / 2, fcy = from.y + NODE_H / 2;
      const tcx = to.x   + NODE_W / 2, tcy = to.y   + NODE_H / 2;
      const dx  = tcx - fcx, dy = tcy - fcy;
      const d   = `M${fcx},${fcy} C${fcx + dx * 0.4},${fcy} ${tcx - dx * 0.4},${tcy} ${tcx},${tcy}`;
      const cs  = CONN_STYLE[conn.protocol] ?? { dash: null, w: 1.5 };
      let printDash = cs.dash;
      if (conn.lineStyle && conn.lineStyle !== 'auto') {
        const ls = LINE_STYLES.find(s => s.id === conn.lineStyle);
        if (ls) printDash = ls.dash;
      }
      const printW = conn.lineWidth ?? cs.w;
      const lbl = (conn.name || conn.protocol || '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
      const da  = printDash ? ` stroke-dasharray="${printDash}"` : '';
      const midX = fcx + dx * 0.5, midY = fcy + dy * 0.5;
      return `<path d="${d}" fill="none" stroke="#666" stroke-width="${printW}" stroke-opacity="0.8"${da} marker-end="url(#pr-arrow)"/>
${lbl ? `<text x="${midX}" y="${midY - 6}" text-anchor="middle" font-size="8" fill="#666">${lbl}</text>` : ''}`;
    }).join('\n');

    // ── Nodes ────────────────────────────────────────────────────
    const nodesHtml = nodes.map(node => {
      const color   = node.color ?? NODE_TYPES[node.type]?.color ?? '#6b7280';
      const iconKey = node.icon ?? node.type ?? 'Custom';
      const name    = (node.name.length > 11 ? node.name.slice(0, 10) + '…' : node.name)
        .replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
      return `<g transform="translate(${node.x},${node.y})">
  <rect x="0" y="0" width="${NODE_W}" height="${NODE_H}" rx="5" fill="${color}" fill-opacity="0.9"/>
  <text x="${NODE_W / 2}" y="22" text-anchor="middle" font-size="12" font-weight="700" fill="white">${abbrev(iconKey)}</text>
  <text x="${NODE_W / 2}" y="40" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.9)">${name}</text>
</g>`;
    }).join('\n');

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vW} ${vH}" width="100%" height="100%" preserveAspectRatio="xMidYMin meet" style="display:block;font-family:system-ui,sans-serif">
  <defs>
    <marker id="pr-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#666" fill-opacity="0.8"/>
    </marker>
  </defs>
  ${bandsHtml}
  ${connsHtml}
  ${nodesHtml}
</svg>`;

    const title = project.name
      ? `Topology — ${project.name.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))}`
      : 'ISA-95 Topology';
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    const win = window.open('', '_blank');
    if (!win) { alert('Allow pop-ups to print.'); return; }
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:landscape;margin:8mm}
  html{height:100%}
  body{
    height:100%;
    overflow:hidden;
    display:flex;
    flex-direction:column;
    font-family:system-ui,sans-serif;
    background:#fff;
  }
  .hdr{
    flex-shrink:0;
    display:flex;align-items:baseline;gap:10px;
    padding-bottom:3px;
    border-bottom:1px solid #e0e0e0;
    margin-bottom:4px;
  }
  h1{font-size:11px;font-weight:600;color:#222}
  .sub{font-size:9px;color:#aaa}
  .wrap{flex:1;min-height:0;display:flex}
  svg{flex:1;min-width:0;min-height:0}
</style>
</head><body>
<div class="hdr"><h1>${title}</h1><span class="sub">ISA-95 Network Topology · ${dateStr}</span></div>
<div class="wrap">${svgStr}</div>
<script>window.addEventListener('load',function(){window.print();setTimeout(function(){window.close()},600)});<\/script>
</body></html>`);
    win.document.close();
  }, [project, nodes, connections]);

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
    if (selectedNodeIds.size > 0) {
      const ids = selectedNodeIds;
      updateTopology(t => ({
        ...t,
        nodes: t.nodes.filter(n => !ids.has(n.id)),
        connections: t.connections.filter(c => !ids.has(c.fromId) && !ids.has(c.toId)),
      }));
      setSelectedNodeIds(new Set());
    } else if (selectedConnId) {
      const id = selectedConnId;
      updateTopology(t => ({ ...t, connections: t.connections.filter(c => c.id !== id) }));
      setSelectedConnId(null);
    }
  }, [selectedNodeIds, selectedConnId, updateTopology]);

  const handleLevelResize = useCallback((levelId, delta) => {
    updateTopology(t => {
      const heights = t.levelHeights ?? getDefaultLevelHeights();
      const current = heights[levelId] ?? DEFAULT_LEVEL_H;
      const next = Math.min(MAX_LEVEL_H, Math.max(MIN_LEVEL_H, current + delta));
      return { ...t, levelHeights: { ...heights, [levelId]: next } };
    });
  }, [updateTopology]);

  const alignNodes = useCallback((direction) => {
    if (selectedNodeIds.size < 2) return;
    const sel = nodes.filter(n => selectedNodeIds.has(n.id));
    const minX = Math.min(...sel.map(s => s.x));
    const maxX = Math.max(...sel.map(s => s.x + NODE_W));
    const minY = Math.min(...sel.map(s => s.y));
    const maxY = Math.max(...sel.map(s => s.y + NODE_H));
    const cX = (minX + maxX) / 2 - NODE_W / 2;
    const cY = (minY + maxY) / 2 - NODE_H / 2;
    const targetX = direction === 'left' ? minX : direction === 'right' ? maxX - NODE_W : direction === 'centerH' ? cX : null;
    const targetY = direction === 'top' ? minY : direction === 'bottom' ? maxY - NODE_H : direction === 'centerV' ? cY : null;
    updateTopology(t => ({
      ...t,
      nodes: t.nodes.map(n => {
        if (!selectedNodeIds.has(n.id)) return n;
        return {
          ...n,
          ...(targetX !== null ? { x: targetX } : {}),
          ...(targetY !== null ? { y: targetY } : {}),
        };
      }),
    }));
  }, [selectedNodeIds, nodes, updateTopology]);

  const addNode = useCallback((type, atWorldX, atWorldY) => {
    if (!project) return;
    const { lvlY: _lvlY, lvlToLevel: _lvlToLevel, svgH: _svgH, levelHeights: _lh } = dynamicRef.current;
    const cfg = NODE_TYPES[type];
    let x, y, lvl;
    if (atWorldX !== undefined && atWorldY !== undefined) {
      x   = Math.max(LABEL_W, Math.min(SVG_W - NODE_W, atWorldX - NODE_W / 2));
      y   = Math.max(0, Math.min(_svgH - NODE_H, atWorldY - NODE_H / 2));
      lvl = _lvlToLevel(atWorldY);
    } else {
      lvl = cfg.defaultLevel;
      const sameLevelCount = nodes.filter(n => n.level === lvl).length;
      x = LABEL_W + 20 + sameLevelCount * (NODE_W + 12);
      const lh = _lh[lvl] ?? DEFAULT_LEVEL_H;
      y = _lvlY(lvl) + (lh - NODE_H) / 2;
    }
    const newNode = {
      id: uid(), type, level: lvl, name: type,
      icon: type, color: null,
      description: '', ipAddress: '', vendor: '', model: '', notes: '', x, y,
    };
    updateTopology(t => ({ ...t, nodes: [...(t.nodes ?? []), newNode] }));
    setSelectedNodeIds(new Set([newNode.id]));
    setSelectedConnId(null);
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
      clearSelection();
      if (tool === 'connect') {
        setConnectFrom(null);
        setPreviewPt(null);
      }
    }
    panRef.current = null;
  }, [tool, clearSelection]);

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
        setSelectedConnId(newConn.id);
        setSelectedNodeIds(new Set());
        setConnectFrom(null);
        setPreviewPt(null);
        setTool('select');
      }
      return;
    }

    // Shift+click: toggle this node in/out of selection without starting a drag
    if (e.shiftKey) {
      setSelectedNodeIds(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
      setSelectedConnId(null);
      return;
    }

    // If clicking a node that's part of an existing multi-selection, drag all selected nodes
    const isInMultiSelect = selectedNodeIds.has(nodeId) && selectedNodeIds.size > 1;
    if (!isInMultiSelect) {
      setSelectedNodeIds(new Set([nodeId]));
      setSelectedConnId(null);
    }

    // Build start positions for all nodes being dragged
    const nodesToDrag = isInMultiSelect ? [...selectedNodeIds] : [nodeId];
    const nodeStartPositions = {};
    for (const id of nodesToDrag) {
      const n = nodes.find(nd => nd.id === id);
      if (n) nodeStartPositions[id] = { x: n.x, y: n.y };
    }

    dragRef.current = {
      nodeStartPositions,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [tool, connectFrom, nodes, svgToWorld, updateTopology, selectedNodeIds]);

  const handleNodePointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    const dx = (e.clientX - dragRef.current.startClientX) / zoom;
    const dy = (e.clientY - dragRef.current.startClientY) / zoom;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
    if (!dragRef.current.moved) return;

    const { svgH: _svgH, lvlToLevel: _lvlToLevel } = dynamicRef.current;
    const startPositions = dragRef.current.nodeStartPositions;

    updateTopology(t => ({
      ...t,
      nodes: t.nodes.map(n => {
        const start = startPositions[n.id];
        if (!start) return n;
        const clampedX = Math.max(LABEL_W, Math.min(SVG_W - NODE_W, start.x + dx));
        const clampedY = Math.max(0, Math.min(_svgH - NODE_H, start.y + dy));
        return { ...n, x: clampedX, y: clampedY, level: _lvlToLevel(clampedY + NODE_H / 2) };
      }),
    }));
  }, [zoom, updateTopology]);

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
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [deleteSelected, tool, clearSelection]);

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
      if (!e.target.closest?.('[data-icon-picker]'))  setIconPickerOpen(false);
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

        {toolbarBtn(false, <><Trash2 size={14} /> Delete</>, deleteSelected, 'Delete selected', !anySelected, true)}

        {/* Alignment controls — visible when 2+ nodes are selected */}
        {multiSelected && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>Align:</span>
            {toolbarBtn(false, <AlignLeft size={14} />, () => alignNodes('left'), 'Align left edges')}
            {toolbarBtn(false, <AlignCenter size={14} />, () => alignNodes('centerH'), 'Center horizontally')}
            {toolbarBtn(false, <AlignRight size={14} />, () => alignNodes('right'), 'Align right edges')}
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
            {toolbarBtn(false,
              <AlignLeft size={14} style={{ transform: 'rotate(-90deg)' }} />,
              () => alignNodes('top'), 'Align top edges')}
            {toolbarBtn(false,
              <AlignCenter size={14} style={{ transform: 'rotate(-90deg)' }} />,
              () => alignNodes('centerV'), 'Center vertically')}
            {toolbarBtn(false,
              <AlignRight size={14} style={{ transform: 'rotate(-90deg)' }} />,
              () => alignNodes('bottom'), 'Align bottom edges')}
          </>
        )}

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 42, textAlign: 'right' }}>
          {Math.round(zoom * 100)}%
        </span>
        {toolbarBtn(false, '+', () => setZoom(z => Math.min(4, z * 1.15)), 'Zoom in')}
        {toolbarBtn(false, '−', () => setZoom(z => Math.max(0.15, z / 1.15)), 'Zoom out')}
        {toolbarBtn(false, 'Reset', () => { setZoom(1); setPan({ x: 0, y: 0 }); }, 'Reset view')}
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        {toolbarBtn(false, <><Printer size={14} /> Print</>, handlePrint, 'Print / Save as PDF', !project)}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* SVG Canvas */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{ display: 'block', background: 'var(--bg-main)', cursor: panRef.current?.moved ? 'grabbing' : tool === 'connect' ? 'crosshair' : 'default' }}
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
              <LevelBands
                levelHeights={levelHeights}
                onResize={handleLevelResize}
                lvlY={lvlY}
                svgH={svgH}
              />

              {/* Connections */}
              {connections.map(conn => (
                <ConnectionPath
                  key={conn.id}
                  conn={conn}
                  nodes={nodes}
                  selected={selectedConnId === conn.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (e.button !== 0) return;
                    setSelectedConnId(conn.id);
                    setSelectedNodeIds(new Set());
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
                  selected={selectedNodeIds.has(node.id)}
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
                onClick={clearSelection}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {selectedNode && (() => {
                const nodeColor   = selectedNode.color ?? NODE_TYPES[selectedNode.type]?.color ?? '#6b7280';
                const nodeIconKey = selectedNode.icon ?? selectedNode.type ?? 'Custom';
                const NodeIconComp = NODE_ICON[nodeIconKey] ?? LayoutGrid;
                return (
                <>
                  {/* Icon picker */}
                  <PropField label="Icon">
                    <button
                      data-icon-picker="toggle"
                      onClick={() => setIconPickerOpen(o => !o)}
                      style={{
                        ...inputStyle,
                        display: 'flex', alignItems: 'center', gap: 6,
                        cursor: 'pointer', background: nodeColor,
                        color: 'white', fontWeight: 600,
                        border: '1px solid transparent',
                      }}
                    >
                      <NodeIconComp size={14} strokeWidth={2} />
                      <span style={{ flex: 1, textAlign: 'left' }}>{nodeIconKey}</span>
                      <ChevronDown size={12} />
                    </button>
                    {iconPickerOpen && (
                      <div
                        data-icon-picker="grid"
                        style={{
                          marginTop: 4,
                          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3,
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border)',
                          borderRadius: 6, padding: 6,
                          maxHeight: 220, overflowY: 'auto',
                        }}
                      >
                        {Object.entries(NODE_ICON).map(([key, Ic]) => (
                          <button
                            key={key}
                            title={key}
                            onClick={() => { updateNode(selectedNode.id, { icon: key }); setIconPickerOpen(false); }}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                              padding: '6px 2px', borderRadius: 5,
                              background: nodeIconKey === key ? 'var(--accent-bg)' : 'transparent',
                              border: nodeIconKey === key ? '1px solid var(--accent)' : '1px solid transparent',
                              cursor: 'pointer',
                              color: nodeIconKey === key ? 'var(--accent)' : 'var(--text-muted)',
                            }}
                            onMouseEnter={e => { if (nodeIconKey !== key) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                            onMouseLeave={e => { if (nodeIconKey !== key) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <Ic size={15} strokeWidth={2} />
                            <span style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.1, wordBreak: 'break-word' }}>{key}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </PropField>

                  {/* Colour picker */}
                  <PropField label="Colour">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        ref={colorSwatchRef}
                        onClick={() => setColorPickerOpen(o => !o)}
                        title="Pick colour"
                        style={{
                          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                          background: nodeColor,
                          border: '2px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', flex: 1 }}>
                        {nodeColor}
                      </span>
                      {selectedNode.color && (
                        <button
                          onClick={() => updateNode(selectedNode.id, { color: null })}
                          title="Reset to default"
                          style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 4,
                            background: 'transparent', border: '1px solid var(--border)',
                            color: 'var(--text-muted)', cursor: 'pointer',
                          }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    {colorPickerOpen && (
                      <ColorPicker
                        value={nodeColor}
                        onChange={hex => updateNode(selectedNode.id, { color: hex })}
                        anchorRef={colorSwatchRef}
                        onClose={() => setColorPickerOpen(false)}
                      />
                    )}
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
                        const { lvlY: _lvlY, levelHeights: _lh } = dynamicRef.current;
                        const lh = _lh[lvl] ?? DEFAULT_LEVEL_H;
                        const y = _lvlY(lvl) + (lh - NODE_H) / 2;
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
                );
              })()}

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
                    <PropField label="Line Style">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {LINE_STYLES.map(ls => {
                          const active = (selectedConn.lineStyle ?? 'auto') === ls.id;
                          // For preview: 'solid' and 'auto' with null dash both show solid,
                          // but 'auto' also shows the protocol pattern
                          const previewDash = ls.id === 'auto'
                            ? (CONN_STYLE[selectedConn.protocol]?.dash ?? null)
                            : ls.dash;
                          return (
                            <button
                              key={ls.id}
                              title={ls.desc}
                              onClick={() => updateConnection(selectedConn.id, { lineStyle: ls.id === 'auto' ? null : ls.id })}
                              style={{
                                padding: '5px 6px', borderRadius: 5, cursor: 'pointer',
                                border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                                background: active ? 'var(--accent-bg)' : 'var(--bg-main)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                minWidth: 46, flex: 1,
                              }}
                            >
                              <svg width={38} height={10} style={{ display: 'block', overflow: 'visible' }}>
                                <line
                                  x1={2} y1={5} x2={36} y2={5}
                                  stroke={active ? 'var(--accent)' : 'var(--text-muted)'}
                                  strokeWidth={1.5}
                                  strokeDasharray={previewDash ?? undefined}
                                />
                              </svg>
                              <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {ls.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </PropField>
                    <PropField label="Line Width">
                      <div style={{ display: 'flex', gap: 4 }}>
                        {LINE_WIDTHS.map(lw => {
                          const active = (selectedConn.lineWidth ?? null) === lw.w;
                          const previewW = lw.w ?? 1.5;
                          return (
                            <button
                              key={lw.id}
                              title={lw.label}
                              onClick={() => updateConnection(selectedConn.id, { lineWidth: lw.w })}
                              style={{
                                flex: 1, padding: '5px 4px', borderRadius: 5, cursor: 'pointer',
                                border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                                background: active ? 'var(--accent-bg)' : 'var(--bg-main)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                              }}
                            >
                              <svg width={28} height={12} style={{ display: 'block' }}>
                                <line
                                  x1={2} y1={6} x2={26} y2={6}
                                  stroke={active ? 'var(--accent)' : 'var(--text-muted)'}
                                  strokeWidth={previewW}
                                />
                              </svg>
                              <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                                {lw.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
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
