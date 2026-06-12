import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────
const REPULSION        = 1600;
const REPULSION_CUTOFF = 160;   // skip pairs beyond this — prevents cluster mass ejecting far nodes
const SPRING_K         = 0.10;
const DAMPING          = 0.80;
const GRAVITY          = 0.001; // very low — springs maintain hierarchy; gravity only corrals orphans
const MAX_VEL          = 8;
const GOLDEN           = 2.39996; // golden angle (rad) for spiral instance placement
const SPRING_LENS = {
  'project-tpl': 130,
  'tpl-inst':     65,
};

const TEMPLATE_PALETTE = [
  '#4d9eff','#4dcc8a','#e06c75','#c678dd',
  '#56b6c2','#d19a66','#e5c07b','#61afef',
  '#98c379','#e8a23a',
];

const PROJECT_COLOR = '#a78bfa'; // distinctive purple — visible in both themes

function nodeRadius(type, connCount = 0) {
  if (type === 'project')  return 16;
  if (type === 'template') return 10 + Math.min(Math.sqrt(connCount) * 1.4, 8);
  if (type === 'area')     return  7 + Math.min(Math.sqrt(connCount) * 0.9, 5);
  return 5;
}

// ── GraphView ─────────────────────────────────────────────────────────────────
export default function GraphView({ templates, areas, counts, projectName }) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const simRef       = useRef(null);
  const sizeRef      = useRef({ w: 0, h: 0 });
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef      = useRef(null);
  const hoverIdRef   = useRef(null);
  const animRef      = useRef(null);
  const themeRef     = useRef('dark');
  const countsRef    = useRef(counts);
  const projectNameRef = useRef(projectName);

  const [tooltip, setTooltip] = useState(null);
  const [cursor, setCursor]   = useState('grab');

  useEffect(() => { countsRef.current = counts; },      [counts]);
  useEffect(() => { projectNameRef.current = projectName; }, [projectName]);

  // ── Filter active nodes ───────────────────────────────────────────────────
  const activeTemplates = useMemo(
    () => templates.filter(t => (t.instances?.length || 0) > 0),
    [templates],
  );

  // ── Build initial layout ──────────────────────────────────────────────────
  const { initNodes, initEdges } = useMemo(() => {
    const initNodes = [];
    const initEdges = [];
    const tColor    = {};
    activeTemplates.forEach((t, i) => {
      tColor[t.id] = TEMPLATE_PALETTE[i % TEMPLATE_PALETTE.length];
    });
    const connCount = {};
    const bump = id => { connCount[id] = (connCount[id] || 0) + 1; };

    // ── Project node — pinned at origin ──────────────────────────────────
    initNodes.push({
      id: 'project', type: 'project',
      label: projectName || 'Project',
      x: 0, y: 0, vx: 0, vy: 0,
      pinned: true,
      color: PROJECT_COLOR,
      meta: {},
    });

    // ── Templates on inner ring ───────────────────────────────────────────
    const tCount = Math.max(1, activeTemplates.length);
    activeTemplates.forEach((t, i) => {
      const tAng = (i / tCount) * Math.PI * 2;
      const tx   = Math.cos(tAng) * SPRING_LENS['project-tpl'];
      const ty   = Math.sin(tAng) * SPRING_LENS['project-tpl'];

      initNodes.push({
        id: `t_${t.id}`, type: 'template', label: t.name,
        x: tx + (Math.random() - 0.5) * 10,
        y: ty + (Math.random() - 0.5) * 10,
        vx: 0, vy: 0, pinned: false, color: tColor[t.id],
        meta: { instances: t.instances?.length || 0, attributes: t.attributes?.length || 0 },
      });

      initEdges.push({ from: 'project', to: `t_${t.id}`, kind: 'project-tpl' });
      bump('project'); bump(`t_${t.id}`);

      // ── Instances in a golden-angle spiral around their template ─────
      const insts = t.instances || [];
      insts.forEach((inst, j) => {
        const spiralR   = 20 + Math.sqrt(j + 1) * 13;
        const spiralAng = j * GOLDEN;
        initNodes.push({
          id: `i_${inst.id}`, type: 'instance', label: inst.name,
          x: tx + Math.cos(spiralAng) * spiralR,
          y: ty + Math.sin(spiralAng) * spiralR,
          vx: 0, vy: 0, pinned: false, color: tColor[t.id],
          isFlagged: inst.isFlagged,
          meta: { template: t.name, areaId: inst.areaId },
        });
        initEdges.push({ from: `t_${t.id}`, to: `i_${inst.id}`, kind: 'tpl-inst' });
        bump(`t_${t.id}`); bump(`i_${inst.id}`);
      });
    });

    initNodes.forEach(n => { n.r = nodeRadius(n.type, connCount[n.id] || 0); });
    return { initNodes, initEdges };
  }, [activeTemplates, projectName]);

  // ── Reinit simulation when graph topology changes ─────────────────────────
  useEffect(() => {
    const nodes   = initNodes.map(n => ({ ...n }));
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
    simRef.current = { nodes, edges: initEdges, nodeMap };
    transformRef.current = { x: 0, y: 0, scale: 1 };
  }, [initNodes, initEdges]);

  // ── Resize ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = (w, h) => {
      w = Math.max(200, w); h = Math.max(200, h);
      sizeRef.current = { w, h };
      if (canvasRef.current) {
        canvasRef.current.width  = w;
        canvasRef.current.height = h;
      }
    };
    const rect = el.getBoundingClientRect();
    update(rect.width, rect.height);
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      update(width, height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Theme tracking ────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      themeRef.current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // ── Animation loop — starts once on mount ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function step() {
      const sim = simRef.current;
      if (!sim) return;
      const { nodes, edges, nodeMap } = sim;
      const { w, h } = sizeRef.current;
      const br = Math.max(200, Math.min(w, h) * 0.44);

      // Repulsion (with cutoff)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx*dx + dy*dy || 0.01;
          let d  = Math.sqrt(d2);
          if (d > REPULSION_CUTOFF) continue;
          const minD = a.r + b.r + 14;
          if (d < minD) { dx = dx/d*minD; dy = dy/d*minD; d = minD; d2 = d*d; }
          const f = REPULSION / d2;
          const fx = dx/d*f, fy = dy/d*f;
          if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
          if (!b.pinned) { b.vx += fx; b.vy += fy; }
        }
      }

      // Spring attraction
      for (const { from, to, kind } of edges) {
        const a = nodeMap[from], b = nodeMap[to];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.sqrt(dx*dx + dy*dy) || 0.001;
        const f  = SPRING_K * (d - (SPRING_LENS[kind] || 100));
        const fx = dx/d*f, fy = dy/d*f;
        if (!a.pinned) { a.vx += fx; a.vy += fy; }
        if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
      }

      // Gravity + soft boundary + damping + integrate
      for (const n of nodes) {
        if (n.pinned) continue;
        n.vx -= n.x * GRAVITY;
        n.vy -= n.y * GRAVITY;
        const dist = Math.sqrt(n.x*n.x + n.y*n.y);
        if (dist > br) {
          const excess = dist - br;
          n.vx -= (n.x / dist) * excess * 0.07;
          n.vy -= (n.y / dist) * excess * 0.07;
        }
        n.vx *= DAMPING; n.vy *= DAMPING;
        const spd = Math.sqrt(n.vx*n.vx + n.vy*n.vy);
        if (spd > MAX_VEL) { n.vx = n.vx/spd*MAX_VEL; n.vy = n.vy/spd*MAX_VEL; }
        n.x += n.vx; n.y += n.vy;
      }
    }

    function render() {
      const sim = simRef.current;
      const { w, h } = sizeRef.current;
      if (!w || !h) return;

      const dark     = themeRef.current !== 'light';
      const BG       = dark ? '#161616' : '#f0f0f0';
      const EDGE_DIM = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.10)';
      const EDGE_LIT = dark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)';
      const LABEL    = dark ? 'rgba(255,255,255,0.75)'  : 'rgba(0,0,0,0.75)';
      const LEG_BG   = dark ? 'rgba(0,0,0,0.55)'        : 'rgba(255,255,255,0.80)';
      const LEG_TXT  = dark ? 'rgba(255,255,255,0.72)'  : 'rgba(0,0,0,0.72)';
      const HINT     = dark ? 'rgba(255,255,255,0.20)'  : 'rgba(0,0,0,0.22)';

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      if (!sim) return;
      const { nodes, edges, nodeMap } = sim;
      const hov = hoverIdRef.current;
      const { x: tx, y: ty, scale: sc } = transformRef.current;
      const cx = w / 2, cy = h / 2;

      ctx.save();
      ctx.translate(cx + tx, cy + ty);
      ctx.scale(sc, sc);

      // Edges
      for (const { from, to, kind } of edges) {
        const a = nodeMap[from], b = nodeMap[to];
        if (!a || !b) continue;
        const lit = hov === from || hov === to;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        if (kind === 'project-tpl') {
          ctx.strokeStyle = lit ? PROJECT_COLOR + 'cc' : PROJECT_COLOR + '55';
          ctx.lineWidth   = (lit ? 1.8 : 1.2) / sc;
        } else if (kind === 'tpl-inst') {
          ctx.strokeStyle = lit ? a.color + 'cc' : a.color + '44';
          ctx.lineWidth   = (lit ? 1.4 : 0.9) / sc;
        } else {
          ctx.strokeStyle = lit ? EDGE_LIT : EDGE_DIM;
          ctx.lineWidth   = (lit ? 1.2 : 0.6) / sc;
        }
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const isHov = hov === n.id;
        const isProj = n.type === 'project';

        // Halo
        if (isHov || n.isFlagged || isProj) {
          const haloR = n.r * (isProj ? 2.8 : 3.5);
          const gr = ctx.createRadialGradient(n.x, n.y, n.r * 0.4, n.x, n.y, haloR);
          gr.addColorStop(0, n.isFlagged ? 'rgba(229,83,83,0.35)' : `${n.color}${isProj ? '33' : '44'}`);
          gr.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
          ctx.fillStyle = gr;
          ctx.fill();
        }

        // Fill
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = isHov || isProj ? 1 : 0.88;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Project ring
        if (isProj) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 3/sc, 0, Math.PI * 2);
          ctx.strokeStyle = PROJECT_COLOR + '88';
          ctx.lineWidth = 2 / sc;
          ctx.stroke();
        }

        // Flagged ring
        if (n.isFlagged) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 2.5/sc, 0, Math.PI * 2);
          ctx.strokeStyle = '#e55353';
          ctx.lineWidth = 1.8 / sc;
          ctx.stroke();
        }

        // Labels
        const showLabel = isProj || n.type === 'template' || (n.type !== 'instance') || sc > 0.65;
        if (showLabel) {
          const fSize = isProj
            ? Math.max(11, Math.min(14, 13/sc))
            : Math.max(10, Math.min(13, 12/sc));
          ctx.font = `${isProj ? 600 : 400} ${fSize}px system-ui,sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = LABEL;
          ctx.fillText(n.label, n.x, n.y + n.r + 13/sc);
        }
      }
      ctx.restore();

      // Legend
      const c = countsRef.current;
      const legendItems = [
        { color: PROJECT_COLOR,        label: 'Project',   count: undefined },
        { color: TEMPLATE_PALETTE[0],  label: 'Templates', count: c?.templateCount },
        { color: '#888888',            label: 'Instances', count: c?.instanceCount },
      ];
      const LX = 14, LY_BOT = h - 14;
      const ROW_H = 22, PAD = 10, ITEM_W = 144;
      const boxH = legendItems.length * ROW_H + PAD * 2;
      const boxY = LY_BOT - boxH;

      ctx.save();
      ctx.fillStyle = LEG_BG;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(LX - 6, boxY - 2, ITEM_W, boxH + 4, 7);
      else ctx.rect(LX - 6, boxY - 2, ITEM_W, boxH + 4);
      ctx.fill();

      legendItems.forEach(({ color, label, count }, i) => {
        const y = boxY + PAD + i * ROW_H + 6;
        ctx.beginPath();
        ctx.arc(LX + 5, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.font = '11px system-ui,sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = LEG_TXT;
        ctx.fillText(label, LX + 16, y + 4);
        if (count !== undefined) {
          ctx.font = 'bold 11px system-ui,sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(count, LX + ITEM_W - 12, y + 4);
        }
      });
      ctx.restore();

      ctx.font = '10px system-ui,sans-serif';
      ctx.fillStyle = HINT;
      ctx.textAlign = 'right';
      ctx.fillText('Scroll to zoom · Drag to pan · Drag node to reposition', w - 12, h - 10);
    }

    function tick() {
      step();
      render();
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // ── Input helpers ─────────────────────────────────────────────────────────
  const toSim = useCallback((ex, ey) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    const { x: tx, y: ty, scale } = transformRef.current;
    return [(ex - rect.left - w/2 - tx) / scale, (ey - rect.top - h/2 - ty) / scale];
  }, []);

  const nodeAt = useCallback((sx, sy) => {
    if (!simRef.current) return null;
    for (const n of simRef.current.nodes) {
      const dx = n.x - sx, dy = n.y - sy;
      if (dx*dx + dy*dy <= (n.r + 5) * (n.r + 5)) return n;
    }
    return null;
  }, []);

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const [sx, sy] = toSim(e.clientX, e.clientY);
    const n = nodeAt(sx, sy);
    if (n && !n.pinned) {
      n.pinned = true;
      dragRef.current = { kind: 'node', n, ox: sx - n.x, oy: sy - n.y };
    } else if (!n) {
      const { x, y } = transformRef.current;
      dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: x, oy: y };
    }
    setCursor('grabbing');
  }, [toSim, nodeAt]);

  const onMouseMove = useCallback((e) => {
    const [sx, sy] = toSim(e.clientX, e.clientY);
    const n = nodeAt(sx, sy);
    const newId = n?.id ?? null;
    if (newId !== hoverIdRef.current) {
      hoverIdRef.current = newId;
      if (newId && n) {
        const rect = canvasRef.current.getBoundingClientRect();
        setTooltip({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 8, n });
      } else {
        setTooltip(null);
      }
    } else if (newId && n) {
      const rect = canvasRef.current.getBoundingClientRect();
      setTooltip(t => t ? { ...t, x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 8 } : null);
    }
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'node') {
      d.n.x = sx - d.ox; d.n.y = sy - d.oy;
      d.n.vx = 0; d.n.vy = 0;
    } else {
      transformRef.current.x = d.ox + (e.clientX - d.sx);
      transformRef.current.y = d.oy + (e.clientY - d.sy);
    }
  }, [toSim, nodeAt]);

  const onMouseUp = useCallback(() => {
    if (dragRef.current?.kind === 'node') dragRef.current.n.pinned = false;
    dragRef.current = null;
    setCursor('grab');
  }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    const t = transformRef.current;
    const { w, h } = sizeRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - w/2;
    const my = e.clientY - rect.top  - h/2;
    t.x = mx + (t.x - mx) * factor;
    t.y = my + (t.y - my) * factor;
    t.scale = Math.max(0.15, Math.min(5, t.scale * factor));
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  if (!activeTemplates.length) {
    return (
      <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-disabled)', fontSize: 14 }}>No active templates — add templates with instances to see the graph.</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x, top: tooltip.y,
          pointerEvents: 'none', zIndex: 20,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 7, padding: '7px 11px',
          boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
          fontSize: 12, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{tooltip.n.label}</div>
          <div style={{ color: 'var(--text-muted)', textTransform: 'capitalize', fontSize: 11 }}>{tooltip.n.type}</div>
          {tooltip.n.type === 'project' && (
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {counts?.templateCount} templates · {counts?.instanceCount} instances
            </div>
          )}
          {tooltip.n.meta?.instances !== undefined && (
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {tooltip.n.meta.instances} instances · {tooltip.n.meta.attributes} attributes
            </div>
          )}
          {tooltip.n.meta?.template && (
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{tooltip.n.meta.template}</div>
          )}
          {tooltip.n.isFlagged && <div style={{ color: '#e55353', fontSize: 11, marginTop: 2 }}>⚠ Flagged</div>}
        </div>
      )}
    </div>
  );
}
