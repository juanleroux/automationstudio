import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, GitBranch, Search, X,
  MousePointer, Link2, ZoomIn, ZoomOut, Maximize,
  ChevronDown, ArrowRight,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import NoProjectOpen from '../shared/NoProjectOpen';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_W = 164;
const STEP_H = 54;
const PANEL_W = 268;

const STEP_TYPES = [
  { value: 'normal',   label: 'Normal',   fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95' },
  { value: 'initial',  label: 'Initial',  fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a' },
  { value: 'running',  label: 'Running',  fill: '#dcfce7', stroke: '#16a34a', text: '#14532d' },
  { value: 'stopping', label: 'Stopping', fill: '#fef9c3', stroke: '#d97706', text: '#78350f' },
  { value: 'fault',    label: 'Fault',    fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' },
];
function stepStyle(type) { return STEP_TYPES.find(t => t.value === type) ?? STEP_TYPES[0]; }

function nextId(items) {
  if (!items?.length) return 1;
  return Math.max(...items.map(x => x.id ?? 0)) + 1;
}

// Auto-place steps that lack x/y — vertical column, 120px apart
function withPositions(steps) {
  let autoY = 60;
  return steps.map((s, i) => {
    if (s.x != null && s.y != null) return s;
    const placed = { ...s, x: 80, y: autoY };
    autoY += 120;
    return placed;
  });
}

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function stepCenter(step) {
  return { x: step.x + STEP_W / 2, y: step.y + STEP_H / 2 };
}
function stepBottom(step) { return { x: step.x + STEP_W / 2, y: step.y + STEP_H }; }
function stepTop(step)    { return { x: step.x + STEP_W / 2, y: step.y }; }

function TransitionArrow({ t, fromStep, toStep, selected, previewing, onPointerDown }) {
  if (!fromStep || !toStep) return null;
  const isSelf = t.fromStepId === t.toStepId;
  const dashed  = t.style === 'dashed';
  const color   = selected ? 'var(--accent, #6366f1)' : dashed ? '#dc2626' : '#6366f1';
  const dashArr = dashed ? '6,4' : undefined;

  let d;
  if (isSelf) {
    const cx = fromStep.x + STEP_W;
    const cy = fromStep.y + STEP_H / 2;
    d = `M${cx},${cy - 10} C${cx+65},${cy-30} ${cx+65},${cy+30} ${cx},${cy + 10}`;
  } else {
    const fx = fromStep.x + STEP_W / 2;
    const fy = fromStep.y + STEP_H;
    const tx = toStep.x + STEP_W / 2;
    const ty = toStep.y;
    const dy = ty - fy;
    const cpx = Math.abs(tx - fx) > 20 ? (fx + tx) / 2 : fx;
    d = `M${fx},${fy} C${fx},${fy + Math.abs(dy)*0.4} ${tx},${ty - Math.abs(dy)*0.4} ${tx},${ty}`;
  }

  const markerId = selected ? 'arr-sel' : dashed ? 'arr-dash' : 'arr';

  return (
    <g onPointerDown={onPointerDown} style={{ cursor: 'pointer' }}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      <path d={d} fill="none" stroke={color} strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={dashArr} markerEnd={`url(#${markerId})`} />
      {t.label && (() => {
        if (isSelf) {
          return <text x={fromStep.x + STEP_W + 50} y={fromStep.y + STEP_H / 2 + 4} fontSize={10} fill={color}>{t.label}</text>;
        }
        const mx = (fromStep.x + toStep.x) / 2 + STEP_W / 2 + 8;
        const my = (fromStep.y + toStep.y) / 2 + STEP_H / 2;
        return <text x={mx} y={my} fontSize={10} fill={color}>{t.label}</text>;
      })()}
      {t.condition && (() => {
        const mx = (fromStep.x + toStep.x) / 2 + STEP_W / 2;
        const my = (fromStep.y + toStep.y) / 2 + STEP_H / 2 - 10;
        return (
          <text x={mx} y={my} textAnchor="middle" fontSize={9} fill="#6b7280"
            style={{ fontStyle: 'italic' }}>
            {t.condition.length > 22 ? t.condition.slice(0, 20) + '…' : t.condition}
          </text>
        );
      })()}
    </g>
  );
}

function StepNode({ step, selected, isConnectSource, tool, onPointerDown }) {
  const sty   = stepStyle(step.type);
  const isConnMode = tool === 'connect';

  return (
    <g transform={`translate(${step.x},${step.y})`}
       onPointerDown={onPointerDown}
       style={{ cursor: isConnMode ? 'crosshair' : 'grab' }}>
      {(selected || isConnectSource) && (
        <rect x={-4} y={-4} width={STEP_W + 8} height={STEP_H + 8} rx={9}
          fill="none"
          stroke={isConnectSource ? '#f59e0b' : 'var(--accent, #6366f1)'}
          strokeWidth={2}
          strokeDasharray={isConnectSource ? '5 3' : 'none'} />
      )}
      <rect x={0} y={0} width={STEP_W} height={STEP_H} rx={6}
        fill={sty.fill} stroke={sty.stroke} strokeWidth={1.5} />
      {/* Step # badge */}
      <rect x={0} y={0} width={STEP_W} height={18} rx={6} fill={sty.stroke} />
      <rect x={0} y={12} width={STEP_W} height={6} fill={sty.stroke} />
      <text x={STEP_W / 2} y={13} textAnchor="middle" dominantBaseline="middle"
        fontSize={10} fontWeight={700} fill="white" style={{ userSelect: 'none' }}>
        Step {step.number}
      </text>
      {/* Name */}
      <text x={STEP_W / 2} y={36} textAnchor="middle" dominantBaseline="middle"
        fontSize={12} fill={sty.text} style={{ userSelect: 'none' }}>
        {step.name.length > 18 ? step.name.slice(0, 17) + '…' : step.name}
      </text>
    </g>
  );
}

// ─── Sequence Canvas ──────────────────────────────────────────────────────────

function SequenceCanvas({ sequence, onUpdateSequence }) {
  const toast = useToast();
  const [tool, setTool]               = useState('select'); // 'select' | 'connect'
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [selectedTransId, setSelectedTransId] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [previewPt, setPreviewPt]     = useState(null);
  const [zoom, setZoom]               = useState(1);
  const [pan, setPan]                 = useState({ x: 40, y: 40 });
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [confirmDelStep, setConfirmDelStep] = useState(null);
  const [confirmDelTrans, setConfirmDelTrans] = useState(null);

  const svgRef   = useRef(null);
  const dragRef  = useRef(null);
  const panRef   = useRef(null);
  const addBtnRef = useRef(null);

  const steps       = withPositions(sequence.steps || []);
  const transitions = sequence.transitions || [];

  const selectedStep  = steps.find(s => s.id === selectedStepId) ?? null;
  const selectedTrans = transitions.find(t => t.id === selectedTransId) ?? null;
  const panelOpen     = !!(selectedStep || selectedTrans);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const updateSteps = (fn) => onUpdateSequence(seq => ({
    ...seq, steps: typeof fn === 'function' ? fn(seq.steps || []) : fn,
  }));
  const updateTransitions = (fn) => onUpdateSequence(seq => ({
    ...seq, transitions: typeof fn === 'function' ? fn(seq.transitions || []) : fn,
  }));

  const svgPt = useCallback((clientX, clientY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top  - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // ── Tool handlers ─────────────────────────────────────────────────────────

  const addStep = (type = 'normal') => {
    const existing = steps;
    const maxY = existing.length ? Math.max(...existing.map(s => s.y)) : -40;
    const newStep = {
      id: nextId(sequence.steps || []),
      number: existing.length ? Math.max(...existing.map(s => s.number)) + 1000 : 0,
      name: 'NEW',
      type,
      description: '',
      x: 80,
      y: maxY + 120,
    };
    updateSteps(s => [...s, newStep]);
    setSelectedStepId(newStep.id);
    setSelectedTransId(null);
    setAddMenuOpen(false);
  };

  const deleteStep = (id) => {
    updateSteps(s => s.filter(x => x.id !== id));
    updateTransitions(t => t.filter(x => x.fromStepId !== id && x.toStepId !== id));
    if (selectedStepId === id) setSelectedStepId(null);
    setConfirmDelStep(null);
    toast.success('Step deleted');
  };

  const deleteTransition = (id) => {
    updateTransitions(t => t.filter(x => x.id !== id));
    if (selectedTransId === id) setSelectedTransId(null);
    setConfirmDelTrans(null);
    toast.success('Transition deleted');
  };

  const createTransition = (fromId, toId) => {
    const newT = {
      id: nextId(sequence.transitions || []),
      fromStepId: fromId,
      toStepId: toId,
      condition: '',
      label: '',
      style: 'solid',
    };
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
    // Select + start drag
    setSelectedStepId(stepId);
    setSelectedTransId(null);
    const step = steps.find(s => s.id === stepId);
    dragRef.current = {
      stepId,
      startX: e.clientX,
      startY: e.clientY,
      origX: step?.x ?? 0,
      origY: step?.y ?? 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [tool, connectFrom, steps]);

  const handleTransPointerDown = useCallback((e, transId) => {
    e.stopPropagation();
    if (tool === 'connect') return;
    setSelectedTransId(transId);
    setSelectedStepId(null);
  }, [tool]);

  const handleBgPointerDown = useCallback((e) => {
    if (e.target !== svgRef.current && !e.target.hasAttribute('data-bg')) return;
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
      setPan({
        x: panRef.current.origPan.x + (e.clientX - panRef.current.startX),
        y: panRef.current.origPan.y + (e.clientY - panRef.current.startY),
      });
    } else if (connectFrom) {
      setPreviewPt(svgPt(e.clientX, e.clientY));
    }
  }, [zoom, connectFrom, svgPt]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    panRef.current  = null;
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.91;
    setZoom(z => Math.max(0.2, Math.min(3, z * delta)));
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const resetView = () => { setZoom(1); setPan({ x: 40, y: 40 }); };

  // Close add menu on outside click
  useEffect(() => {
    if (!addMenuOpen) return;
    const close = (e) => { if (!addBtnRef.current?.contains(e.target)) setAddMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [addMenuOpen]);

  // ── Property panel live update helpers ────────────────────────────────────

  const updateStepField = (field, value) => {
    updateSteps(ss => ss.map(s => s.id === selectedStepId ? { ...s, [field]: value } : s));
  };
  const updateTransField = (field, value) => {
    updateTransitions(tt => tt.map(t => t.id === selectedTransId ? { ...t, [field]: value } : t));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const previewFromStep = connectFrom ? steps.find(s => s.id === connectFrom) : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {confirmDelStep && (
        <ConfirmDialog title="Delete Step"
          message={`Delete step "${steps.find(s => s.id === confirmDelStep)?.name}"? All its transitions will also be removed.`}
          danger onConfirm={() => deleteStep(confirmDelStep)} onCancel={() => setConfirmDelStep(null)} />
      )}
      {confirmDelTrans && (
        <ConfirmDialog title="Delete Transition" message="Delete this transition?" danger
          onConfirm={() => deleteTransition(confirmDelTrans)} onCancel={() => setConfirmDelTrans(null)} />
      )}

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-main)', flexShrink: 0,
      }}>
        {/* Mode */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 6, padding: 2, gap: 1 }}>
          {[
            { id: 'select',  Icon: MousePointer, title: 'Select & Move (S)' },
            { id: 'connect', Icon: Link2,        title: 'Connect Steps (C)' },
          ].map(({ id, Icon, title }) => (
            <button key={id} title={title}
              onClick={() => { setTool(id); setConnectFrom(null); setPreviewPt(null); }}
              style={{
                padding: '4px 8px', border: 'none', cursor: 'pointer', borderRadius: 5,
                background: tool === id ? 'var(--accent, #6366f1)' : 'transparent',
                color: tool === id ? 'white' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
              }}>
              <Icon size={13} />{id === 'select' ? 'Select' : 'Connect'}
            </button>
          ))}
        </div>

        {/* Add step */}
        <div ref={addBtnRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAddMenuOpen(o => !o)}
            className="btn btn-secondary"
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={13} /> Add Step <ChevronDown size={11} />
          </button>
          {addMenuOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
              background: 'var(--bg-main)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              overflow: 'hidden', minWidth: 150,
            }}>
              {STEP_TYPES.map(t => (
                <button key={t.value} onClick={() => addStep(t.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: 'var(--text-primary)', textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: t.stroke, flexShrink: 0 }} />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        {/* Delete */}
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, color: '#e55353', display: 'flex', alignItems: 'center', gap: 4,
            opacity: (selectedStep || selectedTrans) ? 1 : 0.35 }}
          disabled={!selectedStep && !selectedTrans}
          onClick={() => {
            if (selectedStep)  setConfirmDelStep(selectedStepId);
            if (selectedTrans) setConfirmDelTrans(selectedTransId);
          }}>
          <Trash2 size={13} /> Delete
        </button>

        <div style={{ flex: 1 }} />

        {/* Connect hint */}
        {tool === 'connect' && (
          <span style={{ fontSize: 11, color: connectFrom ? '#f59e0b' : 'var(--text-muted)', marginRight: 8 }}>
            {connectFrom
              ? `Click target step to connect from "${steps.find(s => s.id === connectFrom)?.name}"`
              : 'Click a step to start a connection'}
          </span>
        )}

        {/* Zoom */}
        <button className="btn btn-ghost btn-icon" title="Zoom out" onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}><ZoomOut size={13} /></button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button className="btn btn-ghost btn-icon" title="Zoom in" onClick={() => setZoom(z => Math.min(3, z + 0.15))}><ZoomIn size={13} /></button>
        <button className="btn btn-ghost btn-icon" title="Reset view" onClick={resetView}><Maximize size={13} /></button>
      </div>

      {/* ── Canvas + right panel ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <svg
            ref={svgRef}
            width="100%" height="100%"
            style={{ display: 'block', background: 'var(--bg-surface)', cursor: tool === 'connect' ? 'crosshair' : 'default' }}
            onPointerDown={handleBgPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            data-bg
          >
            <defs>
              <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#6366f1" />
              </marker>
              <marker id="arr-sel" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="var(--accent, #6366f1)" />
              </marker>
              <marker id="arr-dash" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#dc2626" />
              </marker>
              <marker id="arr-prev" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b" />
              </marker>
              {/* Dot grid */}
              <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"
                patternTransform={`translate(${pan.x % 20},${pan.y % 20}) scale(${zoom})`}>
                <circle cx="10" cy="10" r="0.8" fill="var(--border)" opacity="0.6" />
              </pattern>
            </defs>

            {/* Background grid */}
            <rect width="100%" height="100%" fill="url(#dots)" style={{ pointerEvents: 'none' }} />

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Transitions (rendered behind steps) */}
              {transitions.map(t => {
                const from = steps.find(s => s.id === t.fromStepId);
                const to   = steps.find(s => s.id === t.toStepId);
                return (
                  <TransitionArrow key={t.id} t={t} fromStep={from} toStep={to}
                    selected={t.id === selectedTransId}
                    onPointerDown={e => handleTransPointerDown(e, t.id)} />
                );
              })}

              {/* Preview line while connecting */}
              {connectFrom && previewPt && previewFromStep && (() => {
                const fx = previewFromStep.x + STEP_W / 2;
                const fy = previewFromStep.y + STEP_H;
                const dy = previewPt.y - fy;
                const d = `M${fx},${fy} C${fx},${fy + Math.abs(dy)*0.4} ${previewPt.x},${previewPt.y - Math.abs(dy)*0.4} ${previewPt.x},${previewPt.y}`;
                return (
                  <path d={d} fill="none" stroke="#f59e0b" strokeWidth={1.5}
                    strokeDasharray="6 3" markerEnd="url(#arr-prev)"
                    style={{ pointerEvents: 'none' }} />
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

            {/* Empty state */}
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
          <div style={{
            width: PANEL_W, borderLeft: '1px solid var(--border)',
            background: 'var(--bg-main)', display: 'flex', flexDirection: 'column',
            flexShrink: 0, overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedStep ? 'Step Properties' : 'Transition'}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => { setSelectedStepId(null); setSelectedTransId(null); }}>
                <X size={13} />
              </button>
            </div>

            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── Step properties ── */}
              {selectedStep && (
                <>
                  {/* Type badge row */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {STEP_TYPES.map(t => {
                      const active = selectedStep.type === t.value;
                      return (
                        <button key={t.value}
                          onClick={() => updateStepField('type', t.value)}
                          style={{
                            padding: '3px 10px', borderRadius: 12, border: `1px solid ${t.stroke}`,
                            background: active ? t.fill : 'transparent',
                            color: active ? t.text : 'var(--text-muted)',
                            fontSize: 11, fontWeight: active ? 700 : 400, cursor: 'pointer',
                          }}>{t.label}</button>
                      );
                    })}
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Step Number</label>
                    <input type="number" className="form-input"
                      value={selectedStep.number}
                      onChange={e => updateStepField('number', Number(e.target.value))}
                      style={{ fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Name</label>
                    <input type="text" className="form-input"
                      value={selectedStep.name}
                      onChange={e => updateStepField('name', e.target.value)}
                      style={{ fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
                    <textarea className="form-input"
                      value={selectedStep.description}
                      onChange={e => updateStepField('description', e.target.value)}
                      rows={3} style={{ fontSize: 12, resize: 'vertical' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Incoming: {transitions.filter(t => t.toStepId === selectedStepId).length} transition(s)
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Outgoing: {transitions.filter(t => t.fromStepId === selectedStepId).length} transition(s)
                    </span>
                  </div>

                  <button
                    className="btn" style={{ fontSize: 12, color: '#e55353', background: 'rgba(229,83,83,0.08)', border: '1px solid rgba(229,83,83,0.3)' }}
                    onClick={() => setConfirmDelStep(selectedStepId)}>
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
                      {[...steps].sort((a,b) => a.number - b.number).map(s =>
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
                      {[...steps].sort((a,b) => a.number - b.number).map(s =>
                        <option key={s.id} value={s.id}>{s.number}: {s.name}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Condition</label>
                    <input type="text" className="form-input"
                      value={selectedTrans.condition}
                      onChange={e => updateTransField('condition', e.target.value)}
                      placeholder="e.g. Stop Command or Complete?"
                      style={{ fontSize: 12 }} />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Label</label>
                    <input type="text" className="form-input"
                      value={selectedTrans.label}
                      onChange={e => updateTransField('label', e.target.value)}
                      placeholder="Yes / No / custom"
                      style={{ fontSize: 12 }} />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Style</label>
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

                  <button
                    className="btn" style={{ fontSize: 12, color: '#e55353', background: 'rgba(229,83,83,0.08)', border: '1px solid rgba(229,83,83,0.3)', marginTop: 4 }}
                    onClick={() => setConfirmDelTrans(selectedTransId)}>
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

  const [selectedId, setSelectedId]   = useState(null);
  const [filter, setFilter]           = useState('');
  const [renameId, setRenameId]       = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showNewModal, setShowNewModal]   = useState(false);
  const [newName, setNewName] = useState('');

  if (!project) return <NoProjectOpen />;

  const sequences = project.sequences || [];
  const filtered  = filter.trim()
    ? sequences.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()))
    : sequences;
  const selected  = sequences.find(s => s.id === selectedId) ?? null;

  const updateSequences = (updater) => {
    updateProject(p => ({ ...p, sequences: typeof updater === 'function' ? updater(p.sequences || []) : updater }));
  };

  const updateSelectedSequence = (updater) => {
    updateSequences(seqs => seqs.map(s => s.id === selectedId
      ? (typeof updater === 'function' ? updater(s) : { ...s, ...updater })
      : s
    ));
  };

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

  const deleteSequence = (id) => {
    updateSequences(s => s.filter(x => x.id !== id));
    if (selectedId === id) setSelectedId(null);
    setConfirmDelete(null);
    toast.success('Sequence deleted');
  };

  const renameSequence = (id) => {
    if (!renameDraft.trim()) { setRenameId(null); return; }
    updateSequences(s => s.map(x => x.id === id ? { ...x, name: renameDraft.trim() } : x));
    setRenameId(null);
  };

  const newModal = showNewModal && (
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
  );

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {newModal}
      {confirmDelete && (
        <ConfirmDialog title="Delete Sequence"
          message={`Delete "${sequences.find(s => s.id === confirmDelete)?.name}"? This cannot be undone.`}
          danger onConfirm={() => deleteSequence(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}

      {/* ── Left: Sequence list ── */}
      <div style={{ width: 220, borderRight: '1px solid var(--border)', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
              placeholder="Filter…"
              style={{ paddingLeft: 26, width: '100%', fontSize: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px 5px 26px' }} />
            {filter && <button onClick={() => setFilter('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={12} /></button>}
          </div>
        </div>

        {/* List */}
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
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer',
                  background: isSelected ? 'var(--accent-subtle, rgba(99,102,241,0.1))' : 'transparent',
                  borderLeft: `3px solid ${isSelected ? 'var(--accent, #6366f1)' : 'transparent'}`,
                }}
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

        {/* Add button */}
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
        <SequenceCanvas
          key={selected.id}
          sequence={selected}
          onUpdateSequence={updateSelectedSequence}
        />
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
