import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Edit2, GitBranch, Search, X, ArrowRight } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import NoProjectOpen from '../shared/NoProjectOpen';

// ─── Constants & utilities ────────────────────────────────────────────────────

function nextId(items) {
  if (!items?.length) return 1;
  return Math.max(...items.map(x => x.id ?? 0)) + 1;
}

const STEP_TYPES = [
  { value: 'normal',   label: 'Normal',   fill: '#ede9fe', stroke: '#7c3aed' },
  { value: 'initial',  label: 'Initial',  fill: '#ede9fe', stroke: '#7c3aed' },
  { value: 'running',  label: 'Running',  fill: '#dcfce7', stroke: '#16a34a' },
  { value: 'stopping', label: 'Stopping', fill: '#fef9c3', stroke: '#d97706' },
  { value: 'fault',    label: 'Fault',    fill: '#fee2e2', stroke: '#dc2626' },
];

function stepTypeStyle(type) {
  return STEP_TYPES.find(t => t.value === type) ?? STEP_TYPES[0];
}

// ─── Diagram ──────────────────────────────────────────────────────────────────

const STEP_W    = 180;
const STEP_H    = 44;
const COL_CX    = 270;
const STEP_GAP  = 60;
const DIAM_R    = 38;
const LEFT_RAIL = COL_CX - STEP_W / 2 - 60;
const RIGHT_RAIL = COL_CX + STEP_W / 2 + 60;
const SVG_W     = COL_CX + STEP_W / 2 + 140;

function arrowTip(x, y, dir) {
  const s = 7;
  if (dir === 'down')  return `M${x - s/2},${y - s} L${x},${y} L${x + s/2},${y - s}`;
  if (dir === 'up')    return `M${x - s/2},${y + s} L${x},${y} L${x + s/2},${y + s}`;
  if (dir === 'right') return `M${x - s},${y - s/2} L${x},${y} L${x - s},${y + s/2}`;
  if (dir === 'left')  return `M${x + s},${y - s/2} L${x},${y} L${x + s},${y + s/2}`;
  return '';
}

function SequenceDiagram({ steps, transitions }) {
  if (!steps.length) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Add steps to see the diagram
      </div>
    );
  }

  const faultSteps  = [...steps].filter(s => s.type === 'fault').sort((a, b) => a.number - b.number);
  const normalSteps = [...steps].filter(s => s.type !== 'fault').sort((a, b) => a.number - b.number);

  // Build outgoing map
  const outgoing = {};
  steps.forEach(s => { outgoing[s.id] = []; });
  transitions.forEach(t => { if (outgoing[t.fromStepId]) outgoing[t.fromStepId].push(t); });

  // Layout
  let curY = 40;
  const stepPos  = {}; // id -> { topY, botY, cy, cx }
  const diamPos  = {}; // stepId -> { cy, cx } — only if step needs decision diamond

  normalSteps.forEach(step => {
    stepPos[step.id] = { topY: curY, botY: curY + STEP_H, cy: curY + STEP_H / 2, cx: COL_CX };
    curY += STEP_H;

    const outs = outgoing[step.id] || [];
    const needsDiamond = outs.length > 1 || (outs.length === 1 && outs[0].condition);
    if (needsDiamond) {
      const dcy = curY + STEP_GAP / 2 + DIAM_R;
      diamPos[step.id] = { cy: dcy, cx: COL_CX };
      curY = dcy + DIAM_R + STEP_GAP / 2;
    } else {
      curY += STEP_GAP;
    }
  });

  const faultZoneY = curY + 30;
  faultSteps.forEach((step, i) => {
    const fy = faultZoneY + i * (STEP_H + 20);
    stepPos[step.id] = { topY: fy, botY: fy + STEP_H, cy: fy + STEP_H / 2, cx: COL_CX };
  });

  const svgH = faultSteps.length
    ? faultZoneY + faultSteps.length * (STEP_H + 20) + 50
    : curY + 20;

  const allSteps = [...normalSteps, ...faultSteps];

  // Build transition render data
  const transRender = [];
  // Track how many fault/dashed transitions per side for offset
  let faultOffset = 0;
  let backOffset  = 0;

  transitions.forEach((t, idx) => {
    const from = stepPos[t.fromStepId];
    const to   = stepPos[t.toStepId];
    if (!from || !to) return;

    const dashed     = t.style === 'dashed';
    const strokeCol  = dashed ? '#dc2626' : '#6366f1';
    const dashArr    = dashed ? '5,4' : undefined;
    const hasDiam    = !!diamPos[t.fromStepId];
    const isSelf     = t.fromStepId === t.toStepId;
    const goesDown   = to.topY > from.botY;

    let path, tip, labelX, labelY;

    if (isSelf) {
      const sx = from.cx + STEP_W / 2;
      const sy = from.cy;
      path = `M${sx},${sy - 10} C${sx+55},${sy-25} ${sx+55},${sy+25} ${sx},${sy + 10}`;
      tip  = { x: sx, y: sy + 10, dir: 'left' };
      labelX = sx + 32; labelY = sy;
    } else if (dashed) {
      // Off-normal / fault → right rail
      const railX = RIGHT_RAIL + faultOffset * 12;
      faultOffset++;
      path = `M${from.cx + STEP_W/2},${from.cy} H${railX} V${to.cy} H${to.cx + STEP_W/2}`;
      tip  = { x: to.cx + STEP_W / 2, y: to.cy, dir: 'left' };
      labelX = railX + 4; labelY = (from.cy + to.cy) / 2;
    } else if (!goesDown && !hasDiam) {
      // Backward arc — left rail
      const railX = LEFT_RAIL - backOffset * 10;
      backOffset++;
      path = `M${from.cx - STEP_W/2},${from.cy} H${railX} V${to.cy} H${to.cx - STEP_W/2}`;
      tip  = { x: to.cx - STEP_W / 2, y: to.cy, dir: 'right' };
      labelX = railX - 42; labelY = (from.cy + to.cy) / 2;
    } else if (hasDiam) {
      // Transition exits from diamond
      const diam = diamPos[t.fromStepId];
      if (goesDown) {
        path = `M${diam.cx},${diam.cy + DIAM_R} L${to.cx},${to.topY}`;
        tip  = { x: to.cx, y: to.topY, dir: 'down' };
        labelX = diam.cx + 6;
        labelY = diam.cy + DIAM_R + (to.topY - diam.cy - DIAM_R) / 2;
      } else {
        // Loop back from diamond — left arc
        const railX = LEFT_RAIL - backOffset * 10;
        backOffset++;
        path = `M${diam.cx - DIAM_R},${diam.cy} H${railX} V${to.cy} H${to.cx - STEP_W/2}`;
        tip  = { x: to.cx - STEP_W / 2, y: to.cy, dir: 'right' };
        labelX = railX - 42; labelY = (diam.cy + to.cy) / 2;
      }
    } else {
      // Simple forward
      path = `M${from.cx},${from.botY} L${to.cx},${to.topY}`;
      tip  = { x: to.cx, y: to.topY, dir: 'down' };
      labelX = from.cx + 6; labelY = (from.botY + to.topY) / 2;
    }

    transRender.push({ t, path, tip, labelX, labelY, strokeCol, dashArr });
  });

  return (
    <div style={{ overflow: 'auto', height: '100%', padding: 16, background: 'var(--bg-surface)' }}>
      <svg width={SVG_W} height={svgH}>
        {/* Fault zone */}
        {faultSteps.length > 0 && (
          <>
            <rect x={10} y={faultZoneY - 18} width={SVG_W - 20}
              height={svgH - faultZoneY + 8} rx={8} fill="#fef9c3" opacity={0.8} />
            <text x={22} y={faultZoneY - 4} fontSize={10} fill="#92400e" fontStyle="italic">
              Off-Normal Path
            </text>
          </>
        )}

        {/* Step → diamond connectors */}
        {Object.entries(diamPos).map(([stepId, diam]) => {
          const s = stepPos[stepId];
          if (!s) return null;
          return (
            <g key={`dc-${stepId}`}>
              <line x1={s.cx} y1={s.botY} x2={diam.cx} y2={diam.cy - DIAM_R}
                stroke="#6366f1" strokeWidth={1.5} />
              <path d={arrowTip(diam.cx, diam.cy - DIAM_R, 'down')} fill="#6366f1" />
            </g>
          );
        })}

        {/* Transitions */}
        {transRender.map(({ t, path, tip, labelX, labelY, strokeCol, dashArr }, i) => (
          <g key={t.id ?? i}>
            <path d={path} stroke={strokeCol} strokeWidth={1.5} fill="none" strokeDasharray={dashArr} />
            {tip && <path d={arrowTip(tip.x, tip.y, tip.dir)} fill={strokeCol} stroke="none" />}
            {t.label && (
              <text x={labelX} y={labelY} fontSize={10} fill="#4b5563">{t.label}</text>
            )}
          </g>
        ))}

        {/* Decision diamonds */}
        {Object.entries(diamPos).map(([stepId, diam]) => {
          const outs = outgoing[stepId] || [];
          const condText = outs.find(t => t.condition)?.condition || '';
          const words = condText.split(' ');
          const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
          const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
          return (
            <g key={`d-${stepId}`}>
              <polygon
                points={`${diam.cx},${diam.cy - DIAM_R} ${diam.cx + DIAM_R},${diam.cy} ${diam.cx},${diam.cy + DIAM_R} ${diam.cx - DIAM_R},${diam.cy}`}
                fill="#dbeafe" stroke="#6366f1" strokeWidth={1.5}
              />
              {condText && (
                <>
                  <text x={diam.cx} y={diam.cy - 7} textAnchor="middle" dominantBaseline="middle"
                    fontSize={9} fill="#1e40af">{line1}</text>
                  {line2 && (
                    <text x={diam.cx} y={diam.cy + 6} textAnchor="middle" dominantBaseline="middle"
                      fontSize={9} fill="#1e40af">{line2}</text>
                  )}
                </>
              )}
            </g>
          );
        })}

        {/* Step boxes */}
        {allSteps.map(step => {
          const p = stepPos[step.id];
          if (!p) return null;
          const sty = stepTypeStyle(step.type);
          return (
            <g key={step.id}>
              <rect x={p.cx - STEP_W / 2} y={p.topY} width={STEP_W} height={STEP_H}
                rx={5} fill={sty.fill} stroke={sty.stroke} strokeWidth={1.5} />
              <text x={p.cx} y={p.topY + STEP_H / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={12} fontFamily="system-ui,sans-serif" fill="#1f2937">
                Step {step.number}: {step.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Steps editor ─────────────────────────────────────────────────────────────

function StepsEditor({ steps, onUpdate }) {
  const [editId, setEditId] = useState(null);
  const [draft, setDraft]   = useState({});

  const startEdit = (step) => { setEditId(step.id); setDraft({ ...step }); };
  const cancelEdit = () => { setEditId(null); setDraft({}); };

  const saveEdit = () => {
    const n = Number(draft.number);
    if (isNaN(n)) return;
    onUpdate(steps.map(s => s.id === editId ? { ...s, ...draft, number: n } : s));
    cancelEdit();
  };

  const addStep = () => {
    const usedNumbers = steps.map(s => s.number);
    const lastNum = usedNumbers.length ? Math.max(...usedNumbers) : 0;
    const newNum = lastNum < 1000 ? 1000 : lastNum + 1000;
    onUpdate([...steps, { id: nextId(steps), number: newNum, name: 'NEW', type: 'normal', description: '' }]);
  };

  const deleteStep = (id) => onUpdate(steps.filter(s => s.id !== id));

  const sorted = [...steps].sort((a, b) => a.number - b.number);

  return (
    <div className="flex flex-col h-full">
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              {['Step #', 'Name', 'Type', 'Description', ''].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(step => {
              const isEditing = editId === step.id;
              const sty = stepTypeStyle(step.type);
              return (
                <tr key={step.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onDoubleClick={() => !isEditing && startEdit(step)}>
                  {isEditing ? (
                    <>
                      <td style={{ padding: '4px 6px' }}>
                        <input type="number" className="form-input" value={draft.number}
                          onChange={e => setDraft(d => ({ ...d, number: e.target.value }))}
                          style={{ width: 80, fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input type="text" className="form-input" value={draft.name}
                          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                          style={{ fontSize: 12 }} autoFocus />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <select className="form-input" value={draft.type}
                          onChange={e => setDraft(d => ({ ...d, type: e.target.value }))}
                          style={{ fontSize: 12 }}>
                          {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input type="text" className="form-input" value={draft.description}
                          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                          style={{ fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-primary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={saveEdit}>Save</button>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px', marginLeft: 4 }} onClick={cancelEdit}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '6px 10px', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{step.number}</td>
                      <td style={{ padding: '6px 10px' }}>{step.name}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: sty.fill, color: sty.stroke, border: `1px solid ${sty.stroke}`, fontWeight: 600 }}>
                          {STEP_TYPES.find(t => t.value === step.type)?.label ?? step.type}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: 12 }}>{step.description}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-icon" title="Edit" onClick={() => startEdit(step)}><Edit2 size={13} /></button>
                        <button className="btn btn-ghost btn-icon" title="Delete" style={{ color: '#e55353' }} onClick={() => deleteStep(step.id)}><Trash2 size={13} /></button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {!sorted.length && (
              <tr><td colSpan={5} style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No steps yet — add one below</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <button className="btn btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }} onClick={addStep}>
          <Plus size={13} /> Add Step
        </button>
      </div>
    </div>
  );
}

// ─── Transitions editor ───────────────────────────────────────────────────────

function TransitionsEditor({ steps, transitions, onUpdate }) {
  const [editId, setEditId] = useState(null);
  const [draft, setDraft]   = useState({});

  const startEdit = (t) => { setEditId(t.id); setDraft({ ...t }); };
  const cancelEdit = () => { setEditId(null); setDraft({}); };

  const saveEdit = () => {
    onUpdate(transitions.map(t => t.id === editId ? { ...t, ...draft } : t));
    cancelEdit();
  };

  const addTransition = () => {
    if (steps.length < 1) return;
    const sorted = [...steps].sort((a, b) => a.number - b.number);
    onUpdate([...transitions, {
      id: nextId(transitions),
      fromStepId: sorted[0]?.id ?? null,
      toStepId: sorted[1]?.id ?? sorted[0]?.id ?? null,
      condition: '',
      label: '',
      style: 'solid',
    }]);
  };

  const deleteTransition = (id) => onUpdate(transitions.filter(t => t.id !== id));

  const stepLabel = (id) => {
    const s = steps.find(s => s.id === id);
    return s ? `${s.number}: ${s.name}` : '—';
  };

  const stepOptions = [...steps].sort((a, b) => a.number - b.number).map(s => (
    <option key={s.id} value={s.id}>{s.number}: {s.name}</option>
  ));

  return (
    <div className="flex flex-col h-full">
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              {['From', 'Condition', 'Label', 'To', 'Style', ''].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transitions.map(t => {
              const isEditing = editId === t.id;
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onDoubleClick={() => !isEditing && startEdit(t)}>
                  {isEditing ? (
                    <>
                      <td style={{ padding: '4px 6px' }}>
                        <select className="form-input" value={draft.fromStepId ?? ''}
                          onChange={e => setDraft(d => ({ ...d, fromStepId: Number(e.target.value) }))}
                          style={{ fontSize: 12 }}>{stepOptions}</select>
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input type="text" className="form-input" value={draft.condition ?? ''}
                          onChange={e => setDraft(d => ({ ...d, condition: e.target.value }))}
                          placeholder="e.g. Stop Command?" style={{ fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input type="text" className="form-input" value={draft.label ?? ''}
                          onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                          placeholder="Yes / No" style={{ fontSize: 12, width: 70 }} />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <select className="form-input" value={draft.toStepId ?? ''}
                          onChange={e => setDraft(d => ({ ...d, toStepId: Number(e.target.value) }))}
                          style={{ fontSize: 12 }}>{stepOptions}</select>
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <select className="form-input" value={draft.style ?? 'solid'}
                          onChange={e => setDraft(d => ({ ...d, style: e.target.value }))}
                          style={{ fontSize: 12 }}>
                          <option value="solid">Normal</option>
                          <option value="dashed">Off-Normal</option>
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-primary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={saveEdit}>Save</button>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px', marginLeft: 4 }} onClick={cancelEdit}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 12 }}>{stepLabel(t.fromStepId)}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: 12 }}>{t.condition || <span style={{ opacity: 0.4 }}>—</span>}</td>
                      <td style={{ padding: '6px 10px', fontSize: 12 }}>{t.label || <span style={{ opacity: 0.4 }}>—</span>}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{stepLabel(t.toStepId)}</span>
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 10,
                          background: t.style === 'dashed' ? '#fee2e2' : 'var(--bg-surface)',
                          color: t.style === 'dashed' ? '#dc2626' : 'var(--text-muted)',
                          border: `1px solid ${t.style === 'dashed' ? '#dc2626' : 'var(--border)'}`,
                        }}>
                          {t.style === 'dashed' ? 'Off-Normal' : 'Normal'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-icon" title="Edit" onClick={() => startEdit(t)}><Edit2 size={13} /></button>
                        <button className="btn btn-ghost btn-icon" title="Delete" style={{ color: '#e55353' }} onClick={() => deleteTransition(t.id)}><Trash2 size={13} /></button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {!transitions.length && (
              <tr><td colSpan={6} style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No transitions yet — add one below</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <button className="btn btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={addTransition} disabled={steps.length < 1}>
          <Plus size={13} /> Add Transition
        </button>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

const TABS = ['Steps', 'Transitions', 'Diagram'];

export default function SequencesView() {
  const { project, updateProject } = useProject();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('Steps');
  const [filter, setFilter] = useState('');
  const [renameId, setRenameId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');

  if (!project) return <NoProjectOpen />;

  const sequences = project.sequences || [];
  const filtered  = filter.trim()
    ? sequences.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()))
    : sequences;

  const selected = sequences.find(s => s.id === selectedId) ?? null;

  // ── CRUD helpers ────────────────────────────────────────────────────────────

  const updateSequences = useCallback((updater) => {
    updateProject(p => ({ ...p, sequences: typeof updater === 'function' ? updater(p.sequences || []) : updater }));
  }, [updateProject]);

  const addSequence = () => {
    if (!newName.trim()) return;
    const seqs = project.sequences || [];
    const id   = nextId(seqs);
    const seq  = { id, name: newName.trim(), description: '', steps: [], transitions: [] };
    updateSequences(s => [...s, seq]);
    setSelectedId(id);
    setShowNewModal(false);
    setNewName('');
    setTab('Steps');
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
    toast.success('Sequence renamed');
  };

  const updateSelectedSteps = (steps) => {
    updateSequences(s => s.map(x => x.id === selectedId ? { ...x, steps } : x));
  };

  const updateSelectedTransitions = (transitions) => {
    updateSequences(s => s.map(x => x.id === selectedId ? { ...x, transitions } : x));
  };

  // ── New sequence modal ──────────────────────────────────────────────────────

  const newModal = showNewModal && (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={() => setShowNewModal(false)}>
      <div style={{
        background: 'var(--bg-main)', borderRadius: 10, padding: 24, width: 380,
        border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>New Sequence</h3>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Name *</label>
        <input
          type="text" className="form-input" value={newName} autoFocus
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addSequence(); if (e.key === 'Escape') setShowNewModal(false); }}
          placeholder="e.g. Main Process Sequence"
          style={{ width: '100%', marginBottom: 20 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={addSequence} disabled={!newName.trim()}>Create</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {newModal}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Sequence"
          message={`Delete sequence "${sequences.find(s => s.id === confirmDelete)?.name}"? This cannot be undone.`}
          danger
          onConfirm={() => deleteSequence(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Sequence list ── */}
        <div className="flex flex-col flex-shrink-0" style={{
          width: 240, borderRight: '1px solid var(--border)', background: 'var(--bg-main)',
        }}>
          {/* Search */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text" value={filter} onChange={e => setFilter(e.target.value)}
                placeholder="Filter sequences…"
                style={{ paddingLeft: 26, paddingRight: filter ? 26 : 8, fontSize: 12, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px 5px 26px' }}
              />
              {filter && (
                <button onClick={() => setFilter('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                  <X size={12} />
                </button>
              )}
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
                <div
                  key={seq.id}
                  onClick={() => { setSelectedId(seq.id); setTab('Steps'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', cursor: 'pointer',
                    background: isSelected ? 'var(--accent-subtle, rgba(99,102,241,0.1))' : 'transparent',
                    borderLeft: `3px solid ${isSelected ? 'var(--accent, #6366f1)' : 'transparent'}`,
                  }}
                  className="tree-node"
                >
                  <GitBranch size={14} style={{ flexShrink: 0, color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }} />
                  {isRenaming ? (
                    <input
                      type="text" value={renameDraft} autoFocus
                      onClick={e => e.stopPropagation()}
                      onChange={e => setRenameDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameSequence(seq.id);
                        if (e.key === 'Escape') setRenameId(null);
                      }}
                      onBlur={() => renameSequence(seq.id)}
                      style={{ flex: 1, fontSize: 12, background: 'var(--bg-surface)', border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 4px' }}
                    />
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {seq.name}
                    </span>
                  )}
                  {!isRenaming && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-icon" title="Rename"
                        style={{ padding: 2, opacity: 0.6 }}
                        onClick={e => { e.stopPropagation(); setRenameId(seq.id); setRenameDraft(seq.name); }}
                      ><Edit2 size={11} /></button>
                      <button
                        className="btn btn-ghost btn-icon" title="Delete"
                        style={{ padding: 2, color: '#e55353', opacity: 0.7 }}
                        onClick={e => { e.stopPropagation(); setConfirmDelete(seq.id); }}
                      ><Trash2 size={11} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add button */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              onClick={() => { setNewName(''); setShowNewModal(true); }}
            >
              <Plus size={13} /> New Sequence
            </button>
          </div>
        </div>

        {/* ── Right: Editor ── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {!selected ? (
            <div className="flex items-center justify-center h-full" style={{ flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
              <GitBranch size={48} style={{ opacity: 0.15 }} />
              <span style={{ fontSize: 14 }}>Select a sequence or create a new one</span>
              <button className="btn btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => { setNewName(''); setShowNewModal(true); }}>
                <Plus size={13} /> New Sequence
              </button>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg-main)', flexShrink: 0, padding: '0 4px' }}>
                <div style={{ display: 'flex', flex: 1 }}>
                  {TABS.map(t => (
                    <button
                      key={t}
                      className={`tab-item ${tab === t ? 'active' : ''}`}
                      onClick={() => setTab(t)}
                    >{t}</button>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingRight: 12 }}>
                  {selected.steps.length} step{selected.steps.length !== 1 ? 's' : ''} · {selected.transitions.length} transition{selected.transitions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {tab === 'Steps' && (
                  <StepsEditor
                    steps={selected.steps}
                    onUpdate={updateSelectedSteps}
                  />
                )}
                {tab === 'Transitions' && (
                  <TransitionsEditor
                    steps={selected.steps}
                    transitions={selected.transitions}
                    onUpdate={updateSelectedTransitions}
                  />
                )}
                {tab === 'Diagram' && (
                  <SequenceDiagram
                    steps={selected.steps}
                    transitions={selected.transitions}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
