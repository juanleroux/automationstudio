import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, GitBranch, Search, X,
  MousePointer, Link2, ZoomIn, ZoomOut, Maximize, ArrowRight,
  AlignLeft, AlignCenter, AlignRight,
  Grid3x3, Magnet,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import NoProjectOpen from '../shared/NoProjectOpen';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_W    = 164;
const STEP_H    = 54;
const PANEL_W   = 272;
const GRID_SIZE = 20;

const PRESET_COLORS = [
  '#7c3aed','#2563eb','#0891b2','#16a34a',
  '#d97706','#dc2626','#db2777','#374151',
  '#9333ea','#0d9488',
];
const TYPE_TO_COLOR = { normal:'#7c3aed', initial:'#2563eb', running:'#16a34a', stopping:'#d97706', fault:'#dc2626' };

function resolveColor(step) { return step.color || TYPE_TO_COLOR[step.type] || '#7c3aed'; }
function nextId(items) { return items?.length ? Math.max(...items.map(x => x.id ?? 0)) + 1 : 1; }
function snap(v) { return Math.round(v / GRID_SIZE) * GRID_SIZE; }

function withPositions(steps) {
  let autoY = 60;
  return steps.map(s => {
    if (s.x != null && s.y != null) return s;
    const p = { ...s, x: 80, y: autoY }; autoY += 120; return p;
  });
}

// ─── Inline SVG icons for alignment ──────────────────────────────────────────

const AlignTopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <rect x="1" y="0" width="12" height="1.5" rx="0.5" />
    <rect x="2"  y="2" width="4" height="7" rx="1" opacity="0.8" />
    <rect x="8" y="2" width="4" height="5" rx="1" opacity="0.8" />
  </svg>
);
const AlignMidVIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <rect x="1" y="6.25" width="12" height="1.5" rx="0.5" />
    <rect x="2" y="2" width="4" height="10" rx="1" opacity="0.8" />
    <rect x="8" y="3.5" width="4" height="7" rx="1" opacity="0.8" />
  </svg>
);
const AlignBotIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <rect x="1" y="12.5" width="12" height="1.5" rx="0.5" />
    <rect x="2" y="5" width="4" height="7.5" rx="1" opacity="0.8" />
    <rect x="8" y="7" width="4" height="5.5" rx="1" opacity="0.8" />
  </svg>
);
const DistHIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <rect x="0" y="2" width="1.5" height="10" rx="0.5" />
    <rect x="12.5" y="2" width="1.5" height="10" rx="0.5" />
    <rect x="5" y="3" width="4" height="8" rx="1" opacity="0.8" />
  </svg>
);
const DistVIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <rect x="2" y="0" width="10" height="1.5" rx="0.5" />
    <rect x="2" y="12.5" width="10" height="1.5" rx="0.5" />
    <rect x="3" y="5" width="8" height="4" rx="1" opacity="0.8" />
  </svg>
);

// ─── SFC Transition line ──────────────────────────────────────────────────────

function TransitionLine({ t, fromStep, toStep, selected, onPointerDown }) {
  if (!fromStep || !toStep) return null;
  const isSelf    = t.fromStepId === t.toStepId;
  const lineColor = selected ? '#6366f1' : '#374151';
  const barColor  = selected ? '#6366f1' : '#111827';
  const BAR_HW    = 14;
  const BAR_THICK = 3;
  const markId    = selected ? 'arr-sel' : 'arr-def';

  if (isSelf) {
    const cx = fromStep.x + STEP_W;
    const cy = fromStep.y + STEP_H / 2;
    const d  = `M${cx},${cy-10} C${cx+65},${cy-35} ${cx+65},${cy+35} ${cx},${cy+10}`;
    return (
      <g onPointerDown={onPointerDown} style={{ cursor: 'pointer' }}>
        <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
        <path d={d} fill="none" stroke={lineColor} strokeWidth={1.5} markerEnd={`url(#${markId})`} />
        <line x1={cx+66-BAR_HW} y1={cy} x2={cx+66+BAR_HW} y2={cy} stroke={barColor} strokeWidth={BAR_THICK} />
        {(t.condition || t.label) && <text x={cx+66+BAR_HW+5} y={cy+4} fontSize={10} fill={lineColor}>{t.condition || t.label}</text>}
      </g>
    );
  }

  const fx = fromStep.x + STEP_W / 2;
  const fy = fromStep.y + STEP_H;
  const tx = toStep.x + STEP_W / 2;
  const ty = toStep.y;
  const forward = ty > fy + 8;

  if (!forward) {
    const railX = Math.min(fromStep.x, toStep.x) - 44;
    const d = `M${fx},${fy} L${fx},${fy+20} L${railX},${fy+20} L${railX},${ty-20} L${tx},${ty-20} L${tx},${ty}`;
    const bx = railX; const by = (fy+20 + ty-20) / 2;
    return (
      <g onPointerDown={onPointerDown} style={{ cursor: 'pointer' }}>
        <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
        <path d={d} fill="none" stroke={lineColor} strokeWidth={1.5} markerEnd={`url(#${markId})`} />
        <line x1={bx-BAR_HW} y1={by} x2={bx+BAR_HW} y2={by} stroke={barColor} strokeWidth={BAR_THICK} />
        {(t.condition || t.label) && <text x={bx+BAR_HW+5} y={by+4} fontSize={10} fill={lineColor}>{t.condition || t.label}</text>}
      </g>
    );
  }

  const barY = fy + (ty - fy) * 0.45;
  const d = `M${fx},${fy} L${fx},${barY} L${tx},${barY} L${tx},${ty}`;
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: 'pointer' }}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      <path d={d} fill="none" stroke={lineColor} strokeWidth={1.5} markerEnd={`url(#${markId})`} />
      <line x1={fx-BAR_HW} y1={barY} x2={fx+BAR_HW} y2={barY} stroke={barColor} strokeWidth={BAR_THICK} />
      {t.condition && <text x={fx+BAR_HW+5} y={barY-1} fontSize={10} fill={lineColor} dominantBaseline="auto">{t.condition.length > 24 ? t.condition.slice(0,22)+'…' : t.condition}</text>}
      {t.label    && <text x={fx+BAR_HW+5} y={barY+(t.condition?12:4)} fontSize={10} fill="#6b7280" style={{fontStyle:'italic'}}>{t.label}</text>}
    </g>
  );
}

// ─── Step node ────────────────────────────────────────────────────────────────

function StepNode({ step, selected, isConnectSource, tool, onPointerDown }) {
  const color  = resolveColor(step);
  const fillBg = color + '20';
  return (
    <g transform={`translate(${step.x},${step.y})`} onPointerDown={onPointerDown}
       style={{ cursor: tool === 'connect' ? 'crosshair' : 'grab' }}>
      {(selected || isConnectSource) && (
        <rect x={-4} y={-4} width={STEP_W+8} height={STEP_H+8} rx={9} fill="none"
          stroke={isConnectSource ? '#f59e0b' : '#6366f1'} strokeWidth={selected ? 2 : 1.5}
          strokeDasharray={isConnectSource ? '5 3' : 'none'} />
      )}
      <rect x={0} y={0} width={STEP_W} height={STEP_H} rx={6} fill={fillBg} stroke={color} strokeWidth={1.5} />
      <rect x={0} y={0} width={STEP_W} height={18} rx={6} fill={color} />
      <rect x={0} y={12} width={STEP_W} height={6} fill={color} />
      <text x={STEP_W/2} y={13} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} fill="white" style={{userSelect:'none'}}>
        Step {step.number}
      </text>
      <text x={STEP_W/2} y={37} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill={color} style={{userSelect:'none'}}>
        {step.name.length > 18 ? step.name.slice(0,17)+'…' : step.name}
      </text>
    </g>
  );
}

// ─── Color picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {PRESET_COLORS.map(c => (
          <button key={c} onClick={() => onChange(c)} title={c}
            style={{ width:22, height:22, borderRadius:4, background:c, border:'none', cursor:'pointer',
              outline: value===c ? '2px solid var(--text-primary)' : '2px solid transparent', outlineOffset:2 }} />
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input type="color" value={value||'#7c3aed'} onChange={e=>onChange(e.target.value)}
          style={{ width:28, height:28, border:'none', background:'none', cursor:'pointer', padding:0, borderRadius:4 }} />
        <input type="text" className="form-input" value={value||'#7c3aed'}
          onChange={e=>{ if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value); }}
          style={{ fontSize:12, flex:1, fontFamily:'monospace' }} />
      </div>
    </div>
  );
}

// ─── Toolbar icon button ──────────────────────────────────────────────────────

function IconBtn({ title, onClick, active, danger, disabled, children }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      style={{
        padding:'4px 6px', border:'none', cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius:5, display:'flex', alignItems:'center', gap:3, fontSize:11,
        background: active ? 'var(--accent,#6366f1)' : 'transparent',
        color: disabled ? 'var(--text-disabled)' : active ? 'white' : danger ? '#e55353' : 'var(--text-muted)',
        opacity: disabled ? 0.38 : 1,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e=>{ if(!disabled && !active) e.currentTarget.style.background='var(--bg-surface)'; }}
      onMouseLeave={e=>{ if(!active) e.currentTarget.style.background='transparent'; }}
    >{children}</button>
  );
}

// ─── Sequence Canvas ──────────────────────────────────────────────────────────

function SequenceCanvas({ sequence, onUpdateSequence }) {
  const toast = useToast();

  const [tool, setTool]                       = useState('select');
  const [selectedStepIds, setSelectedStepIds] = useState([]);
  const [selectedTransId, setSelectedTransId] = useState(null);
  const [connectFrom, setConnectFrom]         = useState(null);
  const [previewPt, setPreviewPt]             = useState(null);
  const [zoom, setZoom]                       = useState(1);
  const [pan, setPan]                         = useState({ x: 60, y: 40 });
  const [showGrid, setShowGrid]               = useState(true);
  const [snapToGrid, setSnapToGrid]           = useState(false);
  const [rubberBand, setRubberBand]           = useState(null); // canvas-space rect {x1,y1,x2,y2}
  const [confirmDelSteps, setConfirmDelSteps] = useState(false);
  const [confirmDelTrans, setConfirmDelTrans] = useState(null);

  const svgRef    = useRef(null);
  const dragRef   = useRef(null);
  const panRef    = useRef(null);
  const rubberRef = useRef(null);

  const steps       = withPositions(sequence.steps || []);
  const transitions = sequence.transitions || [];

  const selectedSet      = new Set(selectedStepIds);
  const singleStep       = selectedStepIds.length === 1 ? steps.find(s => s.id === selectedStepIds[0]) : null;
  const selectedTrans    = transitions.find(t => t.id === selectedTransId) ?? null;
  const panelOpen        = !!(singleStep || selectedTrans);
  const multiSelected    = selectedStepIds.length >= 2;
  const hasSelection     = selectedStepIds.length >= 1;

  // ── Data mutators ─────────────────────────────────────────────────────────

  const updateSteps = fn =>
    onUpdateSequence(seq => ({ ...seq, steps: typeof fn === 'function' ? fn(seq.steps||[]) : fn }));
  const updateTransitions = fn =>
    onUpdateSequence(seq => ({ ...seq, transitions: typeof fn === 'function' ? fn(seq.transitions||[]) : fn }));

  const snapV = useCallback(v => snapToGrid ? snap(v) : v, [snapToGrid]);

  const svgPt = useCallback((cx, cy) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x:0, y:0 };
    return { x:(cx-r.left-pan.x)/zoom, y:(cy-r.top-pan.y)/zoom };
  }, [pan, zoom]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const addStep = () => {
    const maxY    = steps.length ? Math.max(...steps.map(s=>s.y)) : -60;
    const maxNum  = steps.length ? Math.max(...steps.map(s=>s.number)) : -1000;
    const newStep = { id:nextId(sequence.steps||[]), number:maxNum+1000, name:'NEW', color:'#7c3aed', description:'', x:snapV(80), y:snapV(maxY+120) };
    updateSteps(s=>[...s,newStep]);
    setSelectedStepIds([newStep.id]);
    setSelectedTransId(null);
  };

  const deleteSelectedSteps = () => {
    updateSteps(s=>s.filter(x=>!selectedSet.has(x.id)));
    updateTransitions(t=>t.filter(x=>!selectedSet.has(x.fromStepId)&&!selectedSet.has(x.toStepId)));
    setSelectedStepIds([]);
    setConfirmDelSteps(false);
    toast.success(selectedStepIds.length>1?`${selectedStepIds.length} steps deleted`:'Step deleted');
  };

  const deleteTransition = id => {
    updateTransitions(t=>t.filter(x=>x.id!==id));
    if(selectedTransId===id) setSelectedTransId(null);
    setConfirmDelTrans(null);
    toast.success('Transition deleted');
  };

  const createTransition = (fromId, toId) => {
    const newT = { id:nextId(sequence.transitions||[]), fromStepId:fromId, toStepId:toId, condition:'', label:'', style:'solid' };
    updateTransitions(t=>[...t,newT]);
    setSelectedTransId(newT.id);
    setSelectedStepIds([]);
    toast.success('Transition created');
  };

  // ── Align / Distribute ────────────────────────────────────────────────────

  const alignSteps = useCallback((mode) => {
    const sel = steps.filter(s=>selectedSet.has(s.id));
    if(sel.length < 2) return;
    let getFn;
    switch(mode) {
      case 'left':    { const v=Math.min(...sel.map(s=>s.x));       getFn=()=>({x:v}); break; }
      case 'centerH': { const v=sel.reduce((a,s)=>a+s.x+STEP_W/2,0)/sel.length; getFn=()=>({x:v-STEP_W/2}); break; }
      case 'right':   { const v=Math.max(...sel.map(s=>s.x+STEP_W)); getFn=()=>({x:v-STEP_W}); break; }
      case 'top':     { const v=Math.min(...sel.map(s=>s.y));       getFn=()=>({y:v}); break; }
      case 'middleV': { const v=sel.reduce((a,s)=>a+s.y+STEP_H/2,0)/sel.length; getFn=()=>({y:v-STEP_H/2}); break; }
      case 'bottom':  { const v=Math.max(...sel.map(s=>s.y+STEP_H)); getFn=()=>({y:v-STEP_H}); break; }
      default: return;
    }
    updateSteps(ss=>ss.map(s=>selectedSet.has(s.id)?{...s,...getFn(s)}:s));
  }, [steps, selectedSet]);

  const distributeSteps = useCallback((axis) => {
    const sel = [...steps.filter(s=>selectedSet.has(s.id))];
    if(sel.length < 3) return;
    if(axis==='h') {
      sel.sort((a,b)=>a.x-b.x);
      const minX=sel[0].x, maxX=sel[sel.length-1].x+STEP_W;
      const gap=(maxX-minX-sel.length*STEP_W)/(sel.length-1);
      let cx=minX;
      const positions=sel.map(s=>{const x=cx;cx+=STEP_W+gap;return{id:s.id,x};});
      updateSteps(ss=>ss.map(s=>{const p=positions.find(p=>p.id===s.id);return p?{...s,x:p.x}:s;}));
    } else {
      sel.sort((a,b)=>a.y-b.y);
      const minY=sel[0].y, maxY=sel[sel.length-1].y+STEP_H;
      const gap=(maxY-minY-sel.length*STEP_H)/(sel.length-1);
      let cy=minY;
      const positions=sel.map(s=>{const y=cy;cy+=STEP_H+gap;return{id:s.id,y};});
      updateSteps(ss=>ss.map(s=>{const p=positions.find(p=>p.id===s.id);return p?{...s,y:p.y}:s;}));
    }
  }, [steps, selectedSet]);

  // ── Pointer events ────────────────────────────────────────────────────────

  const handleStepPointerDown = useCallback((e, stepId) => {
    e.stopPropagation();

    if(tool==='connect') {
      if(!connectFrom) { setConnectFrom(stepId); setSelectedStepIds([]); setSelectedTransId(null); }
      else { createTransition(connectFrom,stepId); setConnectFrom(null); setPreviewPt(null); }
      return;
    }

    const inSel = selectedSet.has(stepId);

    if(e.shiftKey) {
      setSelectedStepIds(ids=>inSel?ids.filter(id=>id!==stepId):[...ids,stepId]);
      setSelectedTransId(null);
      return;
    }

    // Determine which steps will be dragged
    const dragIds   = inSel ? selectedStepIds : [stepId];
    const nextSelIds = inSel ? selectedStepIds : [stepId];
    if(!inSel) { setSelectedStepIds([stepId]); setSelectedTransId(null); }

    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origPositions: steps.filter(s=>dragIds.includes(s.id)).map(s=>({id:s.id,x:s.x,y:s.y})),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [tool, connectFrom, selectedStepIds, selectedSet, steps]);

  const handleTransPointerDown = useCallback((e, transId) => {
    e.stopPropagation();
    if(tool==='connect') return;
    setSelectedTransId(transId);
    setSelectedStepIds([]);
  }, [tool]);

  const handleBgPointerDown = useCallback((e) => {
    if(!e.target.hasAttribute('data-bg') && e.target!==svgRef.current) return;
    setSelectedTransId(null);
    if(connectFrom) { setConnectFrom(null); setPreviewPt(null); return; }

    if(e.shiftKey) {
      // Rubber-band selection
      const pt = svgPt(e.clientX, e.clientY);
      rubberRef.current = true;
      setRubberBand({ x1:pt.x, y1:pt.y, x2:pt.x, y2:pt.y });
      e.currentTarget?.setPointerCapture?.(e.pointerId);
      return;
    }

    // Clear selection + start pan
    setSelectedStepIds([]);
    panRef.current = { startX:e.clientX, startY:e.clientY, origPan:{...pan} };
    e.currentTarget?.setPointerCapture?.(e.pointerId);
  }, [pan, connectFrom, svgPt]);

  const handlePointerMove = useCallback((e) => {
    if(dragRef.current) {
      const dx=(e.clientX-dragRef.current.startX)/zoom;
      const dy=(e.clientY-dragRef.current.startY)/zoom;
      updateSteps(ss=>ss.map(s=>{
        const orig=dragRef.current.origPositions.find(p=>p.id===s.id);
        if(!orig) return s;
        return {...s, x:Math.max(0,snapV(orig.x+dx)), y:Math.max(0,snapV(orig.y+dy))};
      }));
    } else if(panRef.current) {
      setPan({ x:panRef.current.origPan.x+(e.clientX-panRef.current.startX), y:panRef.current.origPan.y+(e.clientY-panRef.current.startY) });
    } else if(rubberRef.current) {
      const pt = svgPt(e.clientX, e.clientY);
      setRubberBand(rb=>rb?{...rb,x2:pt.x,y2:pt.y}:null);
    } else if(connectFrom) {
      setPreviewPt(svgPt(e.clientX, e.clientY));
    }
  }, [zoom, connectFrom, svgPt, snapV]);

  const handlePointerUp = useCallback((e) => {
    if(rubberRef.current && rubberBand) {
      const rx1=Math.min(rubberBand.x1,rubberBand.x2), rx2=Math.max(rubberBand.x1,rubberBand.x2);
      const ry1=Math.min(rubberBand.y1,rubberBand.y2), ry2=Math.max(rubberBand.y1,rubberBand.y2);
      const hit=steps.filter(s=>s.x<rx2&&s.x+STEP_W>rx1&&s.y<ry2&&s.y+STEP_H>ry1).map(s=>s.id);
      if(hit.length) setSelectedStepIds(prev=>[...new Set([...prev,...hit])]);
    }
    dragRef.current  = null;
    panRef.current   = null;
    rubberRef.current = null;
    setRubberBand(null);
  }, [rubberBand, steps]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z=>Math.max(0.2,Math.min(3,z*(e.deltaY<0?1.1:0.91))));
  }, []);

  useEffect(() => {
    const el=svgRef.current; if(!el) return;
    el.addEventListener('wheel',handleWheel,{passive:false});
    return ()=>el.removeEventListener('wheel',handleWheel);
  }, [handleWheel]);

  // Keyboard: Ctrl+A select all, Delete key
  useEffect(() => {
    const onKey = (e) => {
      if(e.key==='a'&&(e.ctrlKey||e.metaKey)) {
        e.preventDefault();
        setSelectedStepIds(steps.map(s=>s.id));
        setSelectedTransId(null);
      }
      if((e.key==='Delete'||e.key==='Backspace')&&!(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')) {
        if(selectedStepIds.length) setConfirmDelSteps(true);
        else if(selectedTransId) setConfirmDelTrans(selectedTransId);
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  }, [steps, selectedStepIds, selectedTransId]);

  const resetView = () => { setZoom(1); setPan({x:60,y:40}); };

  const updateStepField  = (f,v) => updateSteps(ss=>ss.map(s=>s.id===selectedStepIds[0]?{...s,[f]:v}:s));
  const updateTransField = (f,v) => updateTransitions(tt=>tt.map(t=>t.id===selectedTransId?{...t,[f]:v}:t));

  const previewFrom = connectFrom ? steps.find(s=>s.id===connectFrom) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  const Divider = () => <div style={{width:1,height:20,background:'var(--border)',margin:'0 2px'}} />;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      {confirmDelSteps && (
        <ConfirmDialog title="Delete Steps"
          message={selectedStepIds.length>1?`Delete ${selectedStepIds.length} steps and their transitions?`:`Delete step "${steps.find(s=>s.id===selectedStepIds[0])?.name}" and its transitions?`}
          danger onConfirm={deleteSelectedSteps} onCancel={()=>setConfirmDelSteps(false)} />
      )}
      {confirmDelTrans && (
        <ConfirmDialog title="Delete Transition" message="Delete this transition?" danger
          onConfirm={()=>deleteTransition(confirmDelTrans)} onCancel={()=>setConfirmDelTrans(null)} />
      )}

      {/* ── Toolbar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:3, padding:'4px 8px', borderBottom:'1px solid var(--border)', background:'var(--bg-main)', flexShrink:0, flexWrap:'wrap' }}>

        {/* Mode */}
        <div style={{ display:'flex', background:'var(--bg-surface)', borderRadius:6, padding:2, gap:1 }}>
          {[{id:'select',Icon:MousePointer,label:'Select'},{id:'connect',Icon:Link2,label:'Connect'}].map(({id,Icon,label})=>(
            <button key={id} onClick={()=>{setTool(id);setConnectFrom(null);setPreviewPt(null);}}
              style={{ padding:'4px 8px', border:'none', cursor:'pointer', borderRadius:5, fontSize:12,
                background:tool===id?'var(--accent,#6366f1)':'transparent',
                color:tool===id?'white':'var(--text-muted)', display:'flex', alignItems:'center', gap:4 }}>
              <Icon size={13}/>{label}
            </button>
          ))}
        </div>

        <button className="btn btn-secondary" onClick={addStep}
          style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
          <Plus size={13}/> Add Step
        </button>

        <Divider/>

        {/* Delete selection */}
        <IconBtn title={`Delete selected (Del)`} danger disabled={!hasSelection&&!selectedTrans}
          onClick={()=>{ if(hasSelection) setConfirmDelSteps(true); else if(selectedTrans) setConfirmDelTrans(selectedTransId); }}>
          <Trash2 size={13}/> <span style={{fontSize:11}}>Delete</span>
        </IconBtn>

        {/* ── Align group — only when 2+ steps selected ── */}
        {multiSelected && (
          <>
            <Divider/>
            {/* Horizontal alignment */}
            <div style={{ display:'flex', gap:1, background:'var(--bg-surface)', borderRadius:6, padding:2 }}>
              <IconBtn title="Align left edges"      onClick={()=>alignSteps('left')}   ><AlignLeft size={13}/></IconBtn>
              <IconBtn title="Align horizontal centers" onClick={()=>alignSteps('centerH')}><AlignCenter size={13}/></IconBtn>
              <IconBtn title="Align right edges"     onClick={()=>alignSteps('right')}  ><AlignRight size={13}/></IconBtn>
            </div>
            {/* Vertical alignment */}
            <div style={{ display:'flex', gap:1, background:'var(--bg-surface)', borderRadius:6, padding:2 }}>
              <IconBtn title="Align top edges"        onClick={()=>alignSteps('top')}    ><AlignTopIcon /></IconBtn>
              <IconBtn title="Align vertical centers" onClick={()=>alignSteps('middleV')}><AlignMidVIcon /></IconBtn>
              <IconBtn title="Align bottom edges"     onClick={()=>alignSteps('bottom')} ><AlignBotIcon /></IconBtn>
            </div>
            {/* Distribute — only when 3+ selected */}
            {selectedStepIds.length >= 3 && (
              <div style={{ display:'flex', gap:1, background:'var(--bg-surface)', borderRadius:6, padding:2 }}>
                <IconBtn title="Distribute horizontally" onClick={()=>distributeSteps('h')}><DistHIcon /></IconBtn>
                <IconBtn title="Distribute vertically"   onClick={()=>distributeSteps('v')}><DistVIcon /></IconBtn>
              </div>
            )}
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{selectedStepIds.length} selected</span>
          </>
        )}

        <div style={{ flex:1 }}/>

        {/* Connect hint */}
        {tool==='connect' && (
          <span style={{ fontSize:11, color:connectFrom?'#f59e0b':'var(--text-muted)', marginRight:6 }}>
            {connectFrom?`Click target to connect from "${steps.find(s=>s.id===connectFrom)?.name}"`:'Click a step to start a connection'}
          </span>
        )}

        <Divider/>

        {/* Grid / Snap */}
        <IconBtn title={showGrid?'Hide grid':'Show grid'} active={showGrid}
          onClick={()=>setShowGrid(v=>!v)}>
          <Grid3x3 size={13}/>
        </IconBtn>
        <IconBtn title={snapToGrid?'Snap to grid: ON':'Snap to grid: OFF'} active={snapToGrid}
          onClick={()=>setSnapToGrid(v=>!v)}>
          <Magnet size={13}/>
          {snapToGrid && <span style={{fontSize:10}}>Snap</span>}
        </IconBtn>

        <Divider/>

        {/* Zoom */}
        <button className="btn btn-ghost btn-icon" title="Zoom out" onClick={()=>setZoom(z=>Math.max(0.2,z-0.15))}><ZoomOut size={13}/></button>
        <span style={{ fontSize:11, color:'var(--text-muted)', minWidth:38, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
        <button className="btn btn-ghost btn-icon" title="Zoom in"  onClick={()=>setZoom(z=>Math.min(3,z+0.15))}><ZoomIn size={13}/></button>
        <button className="btn btn-ghost btn-icon" title="Reset view" onClick={resetView}><Maximize size={13}/></button>
      </div>

      {/* ── Canvas + right panel ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
          <svg ref={svgRef} width="100%" height="100%"
            style={{ display:'block', background:'var(--bg-surface)', cursor: tool==='connect'?'crosshair':rubberRef.current?'crosshair':'default' }}
            onPointerDown={handleBgPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            data-bg>
            <defs>
              <marker id="arr-def" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#374151"/>
              </marker>
              <marker id="arr-sel" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#6366f1"/>
              </marker>
              <marker id="arr-prev" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b"/>
              </marker>
              {/* Dot grid — only rendered when showGrid true */}
              {showGrid && (
                <pattern id="dots" x="0" y="0" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${pan.x%(GRID_SIZE*zoom)},${pan.y%(GRID_SIZE*zoom)}) scale(${zoom})`}>
                  <circle cx={GRID_SIZE/2} cy={GRID_SIZE/2} r="0.8" fill="var(--border)" opacity="0.7"/>
                </pattern>
              )}
            </defs>

            {showGrid && <rect width="100%" height="100%" fill="url(#dots)" style={{pointerEvents:'none'}}/>}

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Grid lines (optional visual reference when snap on) */}
              {snapToGrid && showGrid && (() => {
                const svgEl = svgRef.current;
                if(!svgEl) return null;
                const {width,height} = svgEl.getBoundingClientRect();
                const w = width/zoom, h = height/zoom;
                const ox = -pan.x/zoom, oy = -pan.y/zoom;
                const lines = [];
                for(let x=Math.ceil(ox/GRID_SIZE)*GRID_SIZE; x<ox+w; x+=GRID_SIZE)
                  lines.push(<line key={`vg${x}`} x1={x} y1={oy} x2={x} y2={oy+h} stroke="var(--border)" strokeWidth={0.3} opacity={0.5} style={{pointerEvents:'none'}}/>);
                for(let y=Math.ceil(oy/GRID_SIZE)*GRID_SIZE; y<oy+h; y+=GRID_SIZE)
                  lines.push(<line key={`hg${y}`} x1={ox} y1={y} x2={ox+w} y2={y} stroke="var(--border)" strokeWidth={0.3} opacity={0.5} style={{pointerEvents:'none'}}/>);
                return lines;
              })()}

              {/* Transitions */}
              {transitions.map(t=>{
                const from=steps.find(s=>s.id===t.fromStepId);
                const to=steps.find(s=>s.id===t.toStepId);
                return <TransitionLine key={t.id} t={t} fromStep={from} toStep={to} selected={t.id===selectedTransId} onPointerDown={e=>handleTransPointerDown(e,t.id)}/>;
              })}

              {/* Connect preview */}
              {connectFrom&&previewPt&&previewFrom&&(()=>{
                const fx=previewFrom.x+STEP_W/2, fy=previewFrom.y+STEP_H;
                const dy=previewPt.y-fy;
                const d=`M${fx},${fy} C${fx},${fy+Math.abs(dy)*0.4} ${previewPt.x},${previewPt.y-Math.abs(dy)*0.4} ${previewPt.x},${previewPt.y}`;
                return <path d={d} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" markerEnd="url(#arr-prev)" style={{pointerEvents:'none'}}/>;
              })()}

              {/* Steps */}
              {steps.map(step=>(
                <StepNode key={step.id} step={step}
                  selected={selectedSet.has(step.id)}
                  isConnectSource={step.id===connectFrom}
                  tool={tool}
                  onPointerDown={e=>handleStepPointerDown(e,step.id)}/>
              ))}

              {/* Rubber-band selection rect */}
              {rubberBand && (
                <rect
                  x={Math.min(rubberBand.x1,rubberBand.x2)} y={Math.min(rubberBand.y1,rubberBand.y2)}
                  width={Math.abs(rubberBand.x2-rubberBand.x1)} height={Math.abs(rubberBand.y2-rubberBand.y1)}
                  fill="rgba(99,102,241,0.07)" stroke="#6366f1" strokeWidth={1/zoom} strokeDasharray={`${4/zoom} ${2/zoom}`}
                  style={{pointerEvents:'none'}}/>
              )}
            </g>

            {steps.length===0 && (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="var(--text-muted)" style={{pointerEvents:'none'}}>
                Click "Add Step" to start building your sequence
              </text>
            )}
          </svg>

          {/* Tip bar at bottom */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'2px 10px', fontSize:10, color:'var(--text-muted)', background:'var(--bg-main)', borderTop:'1px solid var(--border)', display:'flex', gap:16, pointerEvents:'none' }}>
            <span>Drag to pan · Scroll to zoom · Shift+click/drag to multi-select · Ctrl+A select all</span>
            {snapToGrid && <span style={{color:'#f59e0b'}}>⬛ Snap {GRID_SIZE}px</span>}
          </div>
        </div>

        {/* ── Right: Properties panel ── */}
        {panelOpen && (
          <div style={{ width:PANEL_W, borderLeft:'1px solid var(--border)', background:'var(--bg-main)', display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
                {singleStep ? 'Step Properties' : 'Transition'}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={()=>{setSelectedStepIds([]);setSelectedTransId(null);}}>
                <X size={13}/>
              </button>
            </div>

            <div style={{ padding:14, display:'flex', flexDirection:'column', gap:14 }}>

              {singleStep && (
                <>
                  <div>
                    <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Step Number</label>
                    <input type="number" className="form-input" value={singleStep.number}
                      onChange={e=>updateStepField('number',Number(e.target.value))} style={{fontSize:13}}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Name</label>
                    <input type="text" className="form-input" value={singleStep.name}
                      onChange={e=>updateStepField('name',e.target.value)} style={{fontSize:13}}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Description</label>
                    <textarea className="form-input" value={singleStep.description}
                      onChange={e=>updateStepField('description',e.target.value)} rows={3} style={{fontSize:12,resize:'vertical'}}/>
                  </div>

                  <div style={{ paddingTop:4, borderTop:'1px solid var(--border-subtle)' }}>
                    <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:8 }}>Appearance</label>
                    <ColorPicker value={resolveColor(singleStep)} onChange={v=>updateStepField('color',v)}/>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:4, paddingTop:4, borderTop:'1px solid var(--border-subtle)' }}>
                    <span style={{fontSize:11,color:'var(--text-muted)'}}>Incoming: {transitions.filter(t=>t.toStepId===selectedStepIds[0]).length} transition(s)</span>
                    <span style={{fontSize:11,color:'var(--text-muted)'}}>Outgoing: {transitions.filter(t=>t.fromStepId===selectedStepIds[0]).length} transition(s)</span>
                  </div>

                  <button className="btn" onClick={()=>setConfirmDelSteps(true)}
                    style={{fontSize:12,color:'#e55353',background:'rgba(229,83,83,0.08)',border:'1px solid rgba(229,83,83,0.3)'}}>
                    <Trash2 size={12} style={{marginRight:4}}/> Delete Step
                  </button>
                </>
              )}

              {selectedTrans && (
                <>
                  <div>
                    <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:4}}>From</label>
                    <select className="form-input" value={selectedTrans.fromStepId??''} style={{fontSize:12}}
                      onChange={e=>updateTransField('fromStepId',Number(e.target.value))}>
                      {[...steps].sort((a,b)=>a.number-b.number).map(s=><option key={s.id} value={s.id}>{s.number}: {s.name}</option>)}
                    </select>
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)'}}><ArrowRight size={16}/></div>
                  <div>
                    <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:4}}>To</label>
                    <select className="form-input" value={selectedTrans.toStepId??''} style={{fontSize:12}}
                      onChange={e=>updateTransField('toStepId',Number(e.target.value))}>
                      {[...steps].sort((a,b)=>a.number-b.number).map(s=><option key={s.id} value={s.id}>{s.number}: {s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:4}}>Condition</label>
                    <input type="text" className="form-input" value={selectedTrans.condition}
                      onChange={e=>updateTransField('condition',e.target.value)} placeholder="e.g. Stop Command" style={{fontSize:12}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:4}}>Label</label>
                    <input type="text" className="form-input" value={selectedTrans.label}
                      onChange={e=>updateTransField('label',e.target.value)} placeholder="Yes / No / custom" style={{fontSize:12}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:6}}>Style</label>
                    <div style={{display:'flex',gap:8}}>
                      {[{v:'solid',l:'Normal'},{v:'dashed',l:'Off-Normal'}].map(({v,l})=>(
                        <button key={v} onClick={()=>updateTransField('style',v)}
                          style={{ flex:1, padding:'5px 0', borderRadius:6, cursor:'pointer', fontSize:12,
                            border:`1px solid ${selectedTrans.style===v?(v==='dashed'?'#dc2626':'#6366f1'):'var(--border)'}`,
                            background:selectedTrans.style===v?(v==='dashed'?'rgba(220,38,38,0.08)':'rgba(99,102,241,0.08)'):'transparent',
                            color:selectedTrans.style===v?(v==='dashed'?'#dc2626':'#6366f1'):'var(--text-muted)',
                            fontWeight:selectedTrans.style===v?600:400 }}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <button className="btn" onClick={()=>setConfirmDelTrans(selectedTransId)}
                    style={{fontSize:12,color:'#e55353',background:'rgba(229,83,83,0.08)',border:'1px solid rgba(229,83,83,0.3)',marginTop:4}}>
                    <Trash2 size={12} style={{marginRight:4}}/> Delete Transition
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

  const [selectedId, setSelectedId]       = useState(null);
  const [filter, setFilter]               = useState('');
  const [renameId, setRenameId]           = useState(null);
  const [renameDraft, setRenameDraft]     = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showNewModal, setShowNewModal]   = useState(false);
  const [newName, setNewName]             = useState('');

  if(!project) return <NoProjectOpen/>;

  const sequences = project.sequences || [];
  const filtered  = filter.trim() ? sequences.filter(s=>s.name.toLowerCase().includes(filter.toLowerCase())) : sequences;
  const selected  = sequences.find(s=>s.id===selectedId) ?? null;

  const updateSequences = upd =>
    updateProject(p=>({...p,sequences:typeof upd==='function'?upd(p.sequences||[]):upd}));

  const updateSelectedSequence = upd =>
    updateSequences(seqs=>seqs.map(s=>s.id===selectedId?(typeof upd==='function'?upd(s):{...s,...upd}):s));

  const addSequence = () => {
    if(!newName.trim()) return;
    const id=nextId(sequences);
    const seq={id,name:newName.trim(),description:'',steps:[],transitions:[]};
    updateSequences(s=>[...s,seq]);
    setSelectedId(id);
    setShowNewModal(false);
    setNewName('');
    toast.success(`Sequence "${seq.name}" created`);
  };

  const deleteSequence = id => {
    updateSequences(s=>s.filter(x=>x.id!==id));
    if(selectedId===id) setSelectedId(null);
    setConfirmDelete(null);
    toast.success('Sequence deleted');
  };

  const renameSequence = id => {
    if(!renameDraft.trim()){setRenameId(null);return;}
    updateSequences(s=>s.map(x=>x.id===id?{...x,name:renameDraft.trim()}:x));
    setRenameId(null);
  };

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      {showNewModal && (
        <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center'}}
             onClick={()=>setShowNewModal(false)}>
          <div style={{background:'var(--bg-main)',borderRadius:10,padding:24,width:380,border:'1px solid var(--border)',boxShadow:'0 8px 32px rgba(0,0,0,0.3)'}}
               onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:15,fontWeight:700,marginBottom:16,color:'var(--text-primary)'}}>New Sequence</h3>
            <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:6}}>Name *</label>
            <input type="text" className="form-input" value={newName} autoFocus
              onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')addSequence();if(e.key==='Escape')setShowNewModal(false);}}
              placeholder="e.g. Main Process Sequence"
              style={{width:'100%',marginBottom:20}}/>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn btn-secondary" onClick={()=>setShowNewModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addSequence} disabled={!newName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog title="Delete Sequence"
          message={`Delete "${sequences.find(s=>s.id===confirmDelete)?.name}"? This cannot be undone.`}
          danger onConfirm={()=>deleteSequence(confirmDelete)} onCancel={()=>setConfirmDelete(null)}/>
      )}

      {/* ── Left: Sequence list ── */}
      <div style={{width:220,borderRight:'1px solid var(--border)',background:'var(--bg-main)',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'8px 10px',borderBottom:'1px solid var(--border-subtle)',flexShrink:0}}>
          <div style={{position:'relative'}}>
            <Search size={12} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}}/>
            <input type="text" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter…"
              style={{paddingLeft:26,width:'100%',fontSize:12,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px 5px 26px'}}/>
            {filter&&<button onClick={()=>setFilter('')} style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0}}><X size={12}/></button>}
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto'}}>
          {filtered.length===0&&<div style={{padding:16,fontSize:12,color:'var(--text-muted)',textAlign:'center'}}>{filter?'No matches':'No sequences yet'}</div>}
          {filtered.map(seq=>{
            const isSel=seq.id===selectedId, isRen=renameId===seq.id;
            return (
              <div key={seq.id} onClick={()=>setSelectedId(seq.id)} className="tree-node"
                style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',cursor:'pointer',background:isSel?'var(--accent-subtle,rgba(99,102,241,0.1))':'transparent',borderLeft:`3px solid ${isSel?'var(--accent,#6366f1)':'transparent'}`}}>
                <GitBranch size={14} style={{flexShrink:0,color:isSel?'var(--accent)':'var(--text-muted)'}}/>
                {isRen?(
                  <input type="text" value={renameDraft} autoFocus onClick={e=>e.stopPropagation()}
                    onChange={e=>setRenameDraft(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')renameSequence(seq.id);if(e.key==='Escape')setRenameId(null);}}
                    onBlur={()=>renameSequence(seq.id)}
                    style={{flex:1,fontSize:12,background:'var(--bg-surface)',border:'1px solid var(--accent)',borderRadius:4,padding:'1px 4px'}}/>
                ):(
                  <span style={{flex:1,fontSize:13,color:isSel?'var(--text-primary)':'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{seq.name}</span>
                )}
                {!isRen&&(
                  <div style={{display:'flex',gap:2,flexShrink:0}}>
                    <button className="btn btn-ghost btn-icon" title="Rename" style={{padding:2,opacity:0.6}} onClick={e=>{e.stopPropagation();setRenameId(seq.id);setRenameDraft(seq.name);}}><Edit2 size={11}/></button>
                    <button className="btn btn-ghost btn-icon" title="Delete" style={{padding:2,color:'#e55353',opacity:0.7}} onClick={e=>{e.stopPropagation();setConfirmDelete(seq.id);}}><Trash2 size={11}/></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{padding:'8px 10px',borderTop:'1px solid var(--border-subtle)',flexShrink:0}}>
          <button className="btn btn-secondary" style={{width:'100%',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}
            onClick={()=>{setNewName('');setShowNewModal(true);}}>
            <Plus size={13}/> New Sequence
          </button>
        </div>
      </div>

      {selected?(
        <SequenceCanvas key={selected.id} sequence={selected} onUpdateSequence={updateSelectedSequence}/>
      ):(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:'var(--text-muted)'}}>
          <GitBranch size={48} style={{opacity:0.12}}/>
          <span style={{fontSize:14}}>Select a sequence or create a new one</span>
          <button className="btn btn-secondary" style={{fontSize:12,display:'flex',alignItems:'center',gap:4}} onClick={()=>{setNewName('');setShowNewModal(true);}}>
            <Plus size={13}/> New Sequence
          </button>
        </div>
      )}
    </div>
  );
}
