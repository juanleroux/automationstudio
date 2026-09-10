import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, GitBranch, Search, X,
  MousePointer, Link2, ZoomIn, ZoomOut, Maximize, ArrowRight,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import NoProjectOpen from '../shared/NoProjectOpen';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_W  = 164;
const STEP_H  = 54;
const PANEL_W = 272;

const PRESET_COLORS = [
  '#7c3aed', '#2563eb', '#0891b2', '#16a34a',
  '#d97706', '#dc2626', '#db2777', '#374151',
  '#9333ea', '#0d9488',
];

// Backward-compat: old steps with `type` field get a default colour
const TYPE_TO_COLOR = {
  normal: '#7c3aed', initial: '#2563eb', running: '#16a34a',
  stopping: '#d97706', fault: '#dc2626',
};

function resolveColor(step) {
  return step.color || TYPE_TO_COLOR[step.type] || '#7c3aed';
}

function nextId(items) {
  if (!items?.length) return 1;
  return Math.max(...items.map(x => x.id ?? 0)) + 1;
}

function withPositions(steps) {
  let autoY = 60;
  return steps.map(s => {
    if (s.x != null && s.y != null) return s;
    const placed = { ...s, x: 80, y: autoY };
    autoY += 120;
    return placed;
  });
}

// ─── SFC transition line with horizontal bar ──────────────────────────────────
//
// Forward  (target below source): straight/L-routed path with a short horizontal
//          bar at ~45% of the way down — matching IEC 61131-3 SFC notation.
// Backward / self-loop:           bezier arc with a bar marker overlaid.

function TransitionLine({ t, fromStep, toStep, selected, onPointerDown }) {
  if (!fromStep || !toStep) return null;

  const isSelf    = t.fromStepId === t.toStepId;
  const lineColor = selected ? '#6366f1' : '#374151';
  const barColor  = selected ? '#6366f1' : '#111827';
  const BAR_HW    = 14;   // half-width of the bar (total = 28px)
  const BAR_THICK = 3;
  const markId    = selected ? 'arr-sel' : 'arr-def';

  // ── Self-loop ────────────────────────────────────────────────────────────
  if (isSelf) {
    const cx   = fromStep.x + STEP_W;
    const cy   = fromStep.y + STEP_H / 2;
    const d    = `M${cx},${cy - 10} C${cx+65},${cy-35} ${cx+65},${cy+35} ${cx},${cy + 10}`;
    const barX = cx + 66;
    const barY = cy;
    return (
      <g onPointerDown={onPointerDown} style={{ cursor: 'pointer' }}>
        <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
        <path d={d} fill="none" stroke={lineColor} strokeWidth={1.5} markerEnd={`url(#${markId})`} />
        {/* Bar */}
        <line x1={barX - BAR_HW} y1={barY} x2={barX + BAR_HW} y2={barY}
          stroke={barColor} strokeWidth={BAR_THICK} />
        {(t.condition || t.label) && (
          <text x={barX + BAR_HW + 5} y={barY + 4} fontSize={10} fill={lineColor}>
            {t.condition || t.label}
          </text>
        )}
      </g>
    );
  }

  const fx = fromStep.x + STEP_W / 2;
  const fy = fromStep.y + STEP_H;
  const tx = toStep.x + STEP_W / 2;
  const ty = toStep.y;

  const forward = ty > fy + 8;

  // ── Backward arc ─────────────────────────────────────────────────────────
  if (!forward) {
    const railX = Math.min(fromStep.x, toStep.x) - 44;
    const d = [
      `M${fx},${fy}`,
      `L${fx},${fy + 20}`,
      `L${railX},${fy + 20}`,
      `L${railX},${ty - 20}`,
      `L${tx},${ty - 20}`,
      `L${tx},${ty}`,
    ].join(' ');
    const barX = railX;
    const barY = (fy + 20 + ty - 20) / 2;
    return (
      <g onPointerDown={onPointerDown} style={{ cursor: 'pointer' }}>
        <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
        <path d={d} fill="none" stroke={lineColor} strokeWidth={1.5} markerEnd={`url(#${markId})`} />
        <line x1={barX - BAR_HW} y1={barY} x2={barX + BAR_HW} y2={barY}
          stroke={barColor} strokeWidth={BAR_THICK} />
        {(t.condition || t.label) && (
          <text x={barX + BAR_HW + 5} y={barY + 4} fontSize={10} fill={lineColor}>
            {t.condition || t.label}
          </text>
        )}
      </g>
    );
  }

  // ── Forward SFC path ──────────────────────────────────────────────────────
  // Bar placed at 45% of the vertical drop, on the source column x.
  const barY = fy + (ty - fy) * 0.45;
  const barX = fx; // stays on the source column

  // Path: source → bar → (route to target column if needed) → target
  let d;
  if (Math.abs(fx - tx) < 4) {
    // Straight vertical — no horizontal jog needed
    d = `M${fx},${fy} L${fx},${barY} L${tx},${barY} L${tx},${ty}`;
  } else {
    // L-shape: go down to barY on source x, jog horizontal, then down to target
    d = `M${fx},${fy} L${fx},${barY} L${tx},${barY} L${tx},${ty}`;
  }

  const textX = barX + BAR_HW + 5;
  const textY = barY;

  return (
    <g onPointerDown={onPointerDown} style={{ cursor: 'pointer' }}>
      {/* Wide invisible hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      {/* Visible path */}
      <path d={d} fill="none" stroke={lineColor} strokeWidth={1.5}
        markerEnd={`url(#${markId})`} />
      {/* Transition bar (the SFC horizontal bar) */}
      <line x1={barX - BAR_HW} y1={barY} x2={barX + BAR_HW} y2={barY}
        stroke={barColor} strokeWidth={BAR_THICK} />
      {/* Condition text */}
      {t.condition && (
        <text x={textX} y={textY - 1} fontSize={10} fill={lineColor} dominantBaseline="auto">
          {t.condition.length > 24 ? t.condition.slice(0, 22) + '…' : t.condition}
        </text>
      )}
      {/* Label (below condition if both) */}
      {t.label && (
        <text x={textX} y={textY + (t.condition ? 12 : 4)} fontSize={10} fill="#6b7280"
          style={{ fontStyle: 'italic' }}>
          {t.label}
        </text>
      )}
    </g>
  );
}

// ─── Step node ────────────────────────────────────────────────────────────────

function StepNode({ step, selected, isConnectSource, tool, onPointerDown }) {
  const color  = resolveColor(step);
  const fillBg = color + '20'; // ~12% opacity tint
  return (
    <g transform={`translate(${step.x},${step.y})`}
       onPointerDown={onPointerDown}
       style={{ cursor: tool === 'connect' ? 'crosshair' : 'grab' }}>
      {(selected || isConnectSource) && (
        <rect x={-4} y={-4} width={STEP_W + 8} height={STEP_H + 8} rx={9} fill="none"
          stroke={isConnectSource ? '#f59e0b' : '#6366f1'} strokeWidth={2}
          strokeDasharray={isConnectSource ? '5 3' : 'none'} />
      )}
      <rect x={0} y={0} width={STEP_W} height={STEP_H} rx={6} fill={fillBg} stroke={color} strokeWidth={1.5} />
      {/* Colour badge strip at top */}
      <rect x={0} y={0} width={STEP_W} height={18} rx={6} fill={color} />
      <rect x={0} y={12} width={STEP_W} height={6} fill={color} />
      <text x={STEP_W / 2} y={13} textAnchor="middle" dominantBaseline="middle"
        fontSize={10} fontWeight={700} fill="white" style={{ userSelect: 'none' }}>
        Step {step.number}
      </text>
      {/* Name */}
      <text x={STEP_W / 2} y={37} textAnchor="middle" dominantBaseline="middle"
        fontSize={12} fill={color} style={{ userSelect: 'none' }}>
        {step.name.length > 18 ? step.name.slice(0, 17) + '…' : step.name}
      </text>
    </g>
  );
}

// ─── Color picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {PRESET_COLORS.map(c => (
          <button key={c} onClick={() => onChange(c)}
            title={c}
            style={{
              width: 22, height: 22, borderRadius: 4, background: c, border: 'none', cursor: 'pointer',
              outline: value === c ? '2px solid var(--text-primary)' : '2px solid transparent',
              outlineOffset: 2,
            }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="color" value={value || '#7c3aed'} onChange={e => onChange(e.target.value)}
          style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: 4 }} />
        <input type="text" className="form-input" value={value || '#7c3aed'}
          onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value); }}
          style={{ fontSize: 12, flex: 1, fontFamily: 'monospace' }} />
      </div>
    </div>
  );
}

// ─── Sequence Canvas ──────────────────────────────────────────────────────────

function SequenceCanvas({ sequence, onUpdateSequence }) {
  const toast = useToast();
  const [tool, setTool]                     = useState('select');
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [selectedTransId, setSelectedTransId] = useState(null);
  const [connectFrom, setConnectFrom]       = useState(null);
  const [previewPt, setPreviewPt]           = useState(null);
  const [zoom, setZoom]                     = useState(1);
  const [pan, setPan]                       = useState({ x: 60, y: 40 });
  const [confirmDelStep, setConfirmDelStep]   = useState(null);
  const [confirmDelTrans, setConfirmDelTrans] = useState(null);

  const svgRef  = useRef(null);
  const dragRef = useRef(null);
  const panRef  = useRef(null);

  const steps       = withPositions(sequence.steps || []);
  const transitions = sequence.transitions || [];

  const selectedStep  = steps.find(s => s.id === selectedStepId) ?? null;
  const selectedTrans = transitions.find(t => t.id === selectedTransId) ?? null;
  const panelOpen     = !!(selectedStep || selectedTrans);

  // ── Data mutators ─────────────────────────────────────────────────────────

  const updateSteps = fn =>
    onUpdateSequence(seq => ({ ...seq, steps: typeof fn === 'function' ? fn(seq.steps || []) : fn }));
  const updateTransitions = fn =>
    onUpdateSequence(seq => ({ ...seq, transitions: typeof fn === 'function' ? fn(seq.transitions || []) : fn }));

  const svgPt = useCallback((clientX, clientY) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (clientX - r.left - pan.x) / zoom, y: (clientY - r.top - pan.y) / zoom };
  }, [pan, zoom]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const addStep = () => {
    const existing = steps;
    const maxY     = existing.length ? Math.max(...existing.map(s => s.y)) : -60;
    const newStep  = {
      id: nextId(sequence.steps || []),
      number: existing.length ? Math.max(...existing.map(s => s.number)) + 1000 : 0,
      name: 'NEW',
      color: '#7c3aed',
      description: '',
      x: 80,
      y: maxY + 120,
    };
    updateSteps(s => [...s, newStep]);
    setSelectedStepId(newStep.id);
    setSelectedTransId(null);
  };

  const deleteStep = id => {
    updateSteps(s => s.filter(x => x.id !== id));
    updateTransitions(t => t.filter(x => x.fromStepId !== id && x.toStepId !== id));
    if (selectedStepId === id) setSelectedStepId(null);
    setConfirmDelStep(null);
    toast.success('Step deleted');
  };

  const deleteTransition = id => {
    updateTransitions(t => t.filter(x => x.id !== id));
    if (selectedTransId === id) setSelectedTransId(null);
    setConfirmDelTrans(null);
    toast.success('Transition deleted');
  };

  const createTransition = (fromId, toId) => {
    const newT = { id: nextId(sequence.transitions || []), fromStepId: fromId, toStepId: toId, condition: '', label: '', style: 'solid' };
    updateTransitions(t => [...t, newT]);
    setSelectedTransId(newT.id);
    setSelectedStepId(null);
    toast.success('Transition created');
  };

  // ── Pointer events ────────────────────────────────────────────────────────

  const handleStepPointerDown = useCallback((e, stepId) => {
    e.stopPropagation();
    if (tool === 'connect') {
      if (!connectFrom) {
        setConnectFrom(stepId);
        setSelectedStepId(null);
        setSelectedTransId(null);
      } else {
        createTransition(connectFrom, stepId);
        setConnectFrom(null);
        setPreviewPt(null);
      }
      return;
    }
    setSelectedStepId(stepId);
    setSelectedTransId(null);
    const step = steps.find(s => s.id === stepId);
    dragRef.current = { stepId, startX: e.clientX, startY: e.clientY, origX: step?.x ?? 0, origY: step?.y ?? 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [tool, connectFrom, steps]);

  const handleTransPointerDown = useCallback((e, transId) => {
    e.stopPropagation();
    if (tool === 'connect') return;
    setSelectedTransId(transId);
    setSelectedStepId(null);
  }, [tool]);

  const handleBgPointerDown = useCallback((e) => {
    if (!e.target.hasAttribute('data-bg') && e.target !== svgRef.current) return;
    setSelectedStepId(null);
    setSelectedTransId(null);
    if (connectFrom) { setConnectFrom(null); setPreviewPt(null); return; }
    panRef.current = { startX: e.clientX, startY: e.clientY, origPan: { ...pan } };
    e.currentTarget?.setPointerCapture?.(e.pointerId);
  }, [pan, connectFrom]);

  const handlePointerMove = useCallback((e) => {
    if (dragRef.current) {
      const dx = (e.clientX - dragRef.current.startX) / zoom;
      const dy = (e.clientY - dragRef.current.startY) / zoom;
      const nx = Math.max(0, dragRef.current.origX + dx);
      const ny = Math.max(0, dragRef.current.origY + dy);
      updateSteps(ss => ss.map(s => s.id === dragRef.current.stepId ? { ...s, x: nx, y: ny } : s));
    } else if (panRef.current) {
      setPan({ x: panRef.current.origPan.x + (e.clientX - panRef.current.startX), y: panRef.current.origPan.y + (e.clientY - panRef.current.startY) });
    } else if (connectFrom) {
      setPreviewPt(svgPt(e.clientX, e.clientY));
    }
  }, [zoom, connectFrom, svgPt]);

  const handlePointerUp = useCallback(() => { dragRef.current = null; panRef.current = null; }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.max(0.2, Math.min(3, z * (e.deltaY < 0 ? 1.1 : 0.91))));
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const resetView = () => { setZoom(1); setPan({ x: 60, y: 40 }); };

  // ── Property updaters ─────────────────────────────────────────────────────

  const updateStepField  = (f, v) => updateSteps(ss => ss.map(s => s.id === selectedStepId  ? { ...s, [f]: v } : s));
  const updateTransField = (f, v) => updateTransitions(tt => tt.map(t => t.id === selectedTransId ? { ...t, [f]: v } : t));

  // ── Render ────────────────────────────────────────────────────────────────

  const previewFrom = connectFrom ? steps.find(s => s.id === connectFrom) : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {confirmDelStep && (
        <ConfirmDialog title="Delete Step"
          message={`Delete step "${steps.find(s => s.id === confirmDelStep)?.name}"? Its transitions will also be removed.`}
          danger onConfirm={() => deleteStep(confirmDelStep)} onCancel={() => setConfirmDelStep(null)} />
      )}
      {confirmDelTrans && (
        <ConfirmDialog title="Delete Transition" message="Delete this transition?" danger
          onConfirm={() => deleteTransition(confirmDelTrans)} onCancel={() => setConfirmDelTrans(null)} />
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg-main)', flexShrink: 0 }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 6, padding: 2, gap: 1 }}>
          {[{ id: 'select', Icon: MousePointer, label: 'Select' }, { id: 'connect', Icon: Link2, label: 'Connect' }].map(({ id, Icon, label }) => (
            <button key={id} onClick={() => { setTool(id); setConnectFrom(null); setPreviewPt(null); }}
              style={{
                padding: '4px 8px', border: 'none', cursor: 'pointer', borderRadius: 5, fontSize: 12,
                background: tool === id ? 'var(--accent, #6366f1)' : 'transparent',
                color: tool === id ? 'white' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        <button className="btn btn-secondary" onClick={addStep}
          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={13} /> Add Step
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />

        <button className="btn btn-ghost" disabled={!selectedStep && !selectedTrans}
          style={{ fontSize: 12, color: '#e55353', display: 'flex', alignItems: 'center', gap: 4, opacity: (selectedStep || selectedTrans) ? 1 : 0.35 }}
          onClick={() => { if (selectedStep) setConfirmDelStep(selectedStepId); if (selectedTrans) setConfirmDelTrans(selectedTransId); }}>
          <Trash2 size={13} /> Delete
        </button>

        <div style={{ flex: 1 }} />

        {tool === 'connect' && (
          <span style={{ fontSize: 11, color: connectFrom ? '#f59e0b' : 'var(--text-muted)', marginRight: 8 }}>
            {connectFrom ? `Click target step — connecting from "${steps.find(s => s.id === connectFrom)?.name}"` : 'Click a step to start a connection'}
          </span>
        )}

        <button className="btn btn-ghost btn-icon" title="Zoom out" onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}><ZoomOut size={13} /></button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button className="btn btn-ghost btn-icon" title="Zoom in"  onClick={() => setZoom(z => Math.min(3, z + 0.15))}><ZoomIn size={13} /></button>
        <button className="btn btn-ghost btn-icon" title="Reset view" onClick={resetView}><Maximize size={13} /></button>
      </div>

      {/* ── Canvas + right panel ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <svg ref={svgRef} width="100%" height="100%"
            style={{ display: 'block', background: 'var(--bg-surface)', cursor: tool === 'connect' ? 'crosshair' : 'default' }}
            onPointerDown={handleBgPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            data-bg>
            <defs>
              <marker id="arr-def" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#374151" />
              </marker>
              <marker id="arr-sel" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#6366f1" />
              </marker>
              <marker id="arr-prev" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b" />
              </marker>
              <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"
                patternTransform={`translate(${pan.x % 20},${pan.y % 20}) scale(${zoom})`}>
                <circle cx="10" cy="10" r="0.8" fill="var(--border)" opacity="0.6" />
              </pattern>
            </defs>

            <rect width="100%" height="100%" fill="url(#dots)" style={{ pointerEvents: 'none' }} />

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Transitions behind steps */}
              {transitions.map(t => {
                const from = steps.find(s => s.id === t.fromStepId);
                const to   = steps.find(s => s.id === t.toStepId);
                return (
                  <TransitionLine key={t.id} t={t} fromStep={from} toStep={to}
                    selected={t.id === selectedTransId}
                    onPointerDown={e => handleTransPointerDown(e, t.id)} />
                );
              })}

              {/* Live preview line while connecting */}
              {connectFrom && previewPt && previewFrom && (() => {
                const fx = previewFrom.x + STEP_W / 2;
                const fy = previewFrom.y + STEP_H;
                const dy = previewPt.y - fy;
                const d  = `M${fx},${fy} C${fx},${fy + Math.abs(dy) * 0.4} ${previewPt.x},${previewPt.y - Math.abs(dy) * 0.4} ${previewPt.x},${previewPt.y}`;
                return (
                  <path d={d} fill="none" stroke="#f59e0b" strokeWidth={1.5}
                    strokeDasharray="6 3" markerEnd="url(#arr-prev)" style={{ pointerEvents: 'none' }} />
                );
              })()}

              {/* Steps */}
              {steps.map(step => (
                <StepNode key={step.id} step={step}
                  selected={step.id === selectedStepId}
                  isConnectSource={step.id === connectFrom}
                  tool={tool}
                  onPointerDown={e => handleStepPointerDown(e, step.id)} />
              ))}
            </g>

            {steps.length === 0 && (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
                fontSize={13} fill="var(--text-muted)" style={{ pointerEvents: 'none' }}>
                Click "Add Step" to start building your sequence
              </text>
            )}
          </svg>
        </div>

        {/* ── Right: Properties panel ── */}
        {panelOpen && (
          <div style={{ width: PANEL_W, borderLeft: '1px solid var(--border)', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedStep ? 'Step Properties' : 'Transition'}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => { setSelectedStepId(null); setSelectedTransId(null); }}>
                <X size={13} />
              </button>
            </div>

            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── Step properties ── */}
              {selectedStep && (
                <>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Step Number</label>
                    <input type="number" className="form-input" value={selectedStep.number}
                      onChange={e => updateStepField('number', Number(e.target.value))}
                      style={{ fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Name</label>
                    <input type="text" className="form-input" value={selectedStep.name}
                      onChange={e => updateStepField('name', e.target.value)}
                      style={{ fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
                    <textarea className="form-input" value={selectedStep.description}
                      onChange={e => updateStepField('description', e.target.value)}
                      rows={3} style={{ fontSize: 12, resize: 'vertical' }} />
                  </div>

                  {/* Appearance */}
                  <div style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Appearance</label>
                    <ColorPicker value={resolveColor(selectedStep)} onChange={v => updateStepField('color', v)} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Incoming: {transitions.filter(t => t.toStepId === selectedStepId).length} transition(s)</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Outgoing: {transitions.filter(t => t.fromStepId === selectedStepId).length} transition(s)</span>
                  </div>

                  <button className="btn" onClick={() => setConfirmDelStep(selectedStepId)}
                    style={{ fontSize: 12, color: '#e55353', background: 'rgba(229,83,83,0.08)', border: '1px solid rgba(229,83,83,0.3)' }}>
                    <Trash2 size={12} style={{ marginRight: 4 }} /> Delete Step
                  </button>
                </>
              )}

              {/* ── Transition properties ── */}
              {selectedTrans && (
                <>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>From</label>
                    <select className="form-input" value={selectedTrans.fromStepId ?? ''}
                      onChange={e => updateTransField('fromStepId', Number(e.target.value))}
                      style={{ fontSize: 12 }}>
                      {[...steps].sort((a, b) => a.number - b.number).map(s =>
                        <option key={s.id} value={s.id}>{s.number}: {s.name}</option>
                      )}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <ArrowRight size={16} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>To</label>
                    <select className="form-input" value={selectedTrans.toStepId ?? ''}
                      onChange={e => updateTransField('toStepId', Number(e.target.value))}
                      style={{ fontSize: 12 }}>
                      {[...steps].sort((a, b) => a.number - b.number).map(s =>
                        <option key={s.id} value={s.id}>{s.number}: {s.name}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Condition</label>
                    <input type="text" className="form-input" value={selectedTrans.condition}
                      onChange={e => updateTransField('condition', e.target.value)}
                      placeholder="e.g. Stop Command" style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Label</label>
                    <input type="text" className="form-input" value={selectedTrans.label}
                      onChange={e => updateTransField('label', e.target.value)}
                      placeholder="Yes / No / custom" style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Style</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[{ v: 'solid', l: 'Normal' }, { v: 'dashed', l: 'Off-Normal' }].map(({ v, l }) => (
                        <button key={v} onClick={() => updateTransField('style', v)}
                          style={{
                            flex: 1, padding: '5px 0', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                            border: `1px solid ${selectedTrans.style === v ? (v === 'dashed' ? '#dc2626' : '#6366f1') : 'var(--border)'}`,
                            background: selectedTrans.style === v ? (v === 'dashed' ? 'rgba(220,38,38,0.08)' : 'rgba(99,102,241,0.08)') : 'transparent',
                            color: selectedTrans.style === v ? (v === 'dashed' ? '#dc2626' : '#6366f1') : 'var(--text-muted)',
                            fontWeight: selectedTrans.style === v ? 600 : 400,
                          }}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <button className="btn" onClick={() => setConfirmDelTrans(selectedTransId)}
                    style={{ fontSize: 12, color: '#e55353', background: 'rgba(229,83,83,0.08)', border: '1px solid rgba(229,83,83,0.3)', marginTop: 4 }}>
                    <Trash2 size={12} style={{ marginRight: 4 }} /> Delete Transition
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function SequencesView() {
  const { project, updateProject } = useProject();
  const toast = useToast();

  const [selectedId, setSelectedId]     = useState(null);
  const [filter, setFilter]             = useState('');
  const [renameId, setRenameId]         = useState(null);
  const [renameDraft, setRenameDraft]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName]           = useState('');

  if (!project) return <NoProjectOpen />;

  const sequences = project.sequences || [];
  const filtered  = filter.trim() ? sequences.filter(s => s.name.toLowerCase().includes(filter.toLowerCase())) : sequences;
  const selected  = sequences.find(s => s.id === selectedId) ?? null;

  const updateSequences = upd =>
    updateProject(p => ({ ...p, sequences: typeof upd === 'function' ? upd(p.sequences || []) : upd }));

  const updateSelectedSequence = upd =>
    updateSequences(seqs => seqs.map(s => s.id === selectedId
      ? (typeof upd === 'function' ? upd(s) : { ...s, ...upd }) : s
    ));

  const addSequence = () => {
    if (!newName.trim()) return;
    const id  = nextId(sequences);
    const seq = { id, name: newName.trim(), description: '', steps: [], transitions: [] };
    updateSequences(s => [...s, seq]);
    setSelectedId(id);
    setShowNewModal(false);
    setNewName('');
    toast.success(`Sequence "${seq.name}" created`);
  };

  const deleteSequence = id => {
    updateSequences(s => s.filter(x => x.id !== id));
    if (selectedId === id) setSelectedId(null);
    setConfirmDelete(null);
    toast.success('Sequence deleted');
  };

  const renameSequence = id => {
    if (!renameDraft.trim()) { setRenameId(null); return; }
    updateSequences(s => s.map(x => x.id === id ? { ...x, name: renameDraft.trim() } : x));
    setRenameId(null);
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* New sequence modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
             onClick={() => setShowNewModal(false)}>
          <div style={{ background: 'var(--bg-main)', borderRadius: 10, padding: 24, width: 380, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
               onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>New Sequence</h3>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Name *</label>
            <input type="text" className="form-input" value={newName} autoFocus
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSequence(); if (e.key === 'Escape') setShowNewModal(false); }}
              placeholder="e.g. Main Process Sequence"
              style={{ width: '100%', marginBottom: 20 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addSequence} disabled={!newName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog title="Delete Sequence"
          message={`Delete "${sequences.find(s => s.id === confirmDelete)?.name}"? This cannot be undone.`}
          danger onConfirm={() => deleteSequence(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}

      {/* ── Left: Sequence list ── */}
      <div style={{ width: 220, borderRight: '1px solid var(--border)', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
              style={{ paddingLeft: 26, width: '100%', fontSize: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px 5px 26px' }} />
            {filter && (
              <button onClick={() => setFilter('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              {filter ? 'No matches' : 'No sequences yet'}
            </div>
          )}
          {filtered.map(seq => {
            const isSelected = seq.id === selectedId;
            const isRenaming = renameId === seq.id;
            return (
              <div key={seq.id} onClick={() => setSelectedId(seq.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', background: isSelected ? 'var(--accent-subtle, rgba(99,102,241,0.1))' : 'transparent', borderLeft: `3px solid ${isSelected ? 'var(--accent, #6366f1)' : 'transparent'}` }}
                className="tree-node">
                <GitBranch size={14} style={{ flexShrink: 0, color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }} />
                {isRenaming ? (
                  <input type="text" value={renameDraft} autoFocus
                    onClick={e => e.stopPropagation()}
                    onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameSequence(seq.id); if (e.key === 'Escape') setRenameId(null); }}
                    onBlur={() => renameSequence(seq.id)}
                    style={{ flex: 1, fontSize: 12, background: 'var(--bg-surface)', border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 4px' }} />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seq.name}
                  </span>
                )}
                {!isRenaming && (
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-icon" title="Rename" style={{ padding: 2, opacity: 0.6 }}
                      onClick={e => { e.stopPropagation(); setRenameId(seq.id); setRenameDraft(seq.name); }}>
                      <Edit2 size={11} />
                    </button>
                    <button className="btn btn-ghost btn-icon" title="Delete" style={{ padding: 2, color: '#e55353', opacity: 0.7 }}
                      onClick={e => { e.stopPropagation(); setConfirmDelete(seq.id); }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <button className="btn btn-secondary"
            style={{ width: '100%', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            onClick={() => { setNewName(''); setShowNewModal(true); }}>
            <Plus size={13} /> New Sequence
          </button>
        </div>
      </div>

      {/* ── Right: Canvas ── */}
      {selected ? (
        <SequenceCanvas key={selected.id} sequence={selected} onUpdateSequence={updateSelectedSequence} />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
          <GitBranch size={48} style={{ opacity: 0.12 }} />
          <span style={{ fontSize: 14 }}>Select a sequence or create a new one</span>
          <button className="btn btn-secondary"
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => { setNewName(''); setShowNewModal(true); }}>
            <Plus size={13} /> New Sequence
          </button>
        </div>
      )}
    </div>
  );
}
