import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────
const REPULSION        = 1800;
const REPULSION_CUTOFF = 180;   // skip pairs beyond this distance — prevents cluster mass from ejecting far nodes
const SPRING_K         = 0.10;
const DAMPING          = 0.80;
const GRAVITY          = 0.005;
const MAX_VEL          = 8;
const SPRING_LENS      = { 'tpl-inst': 65, 'inst-area': 100, 'area-area': 90 };

const TEMPLATE_PALETTE = [
  '#4d9eff','#4dcc8a','#e06c75','#c678dd',
  '#56b6c2','#d19a66','#e5c07b','#61afef',
  '#98c379','#e8a23a',
];

function nodeRadius(type, connCount = 0) {
  if (type === 'template') return 10 + Math.min(Math.sqrt(connCount) * 1.5, 8);
  if (type === 'area')     return 8  + Math.min(Math.sqrt(connCount) * 1.0, 5);
  return 5;
}

// ── GraphView ─────────────────────────────────────────────────────────────────
export default function GraphView({ templates, areas, counts }) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const simRef       = useRef(null);
  const sizeRef      = useRef({ w: 0, h: 0 });
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef      = useRef(null);
  const hoverIdRef   = useRef(null);
  const animRef      = useRef(null);
  const themeRef     = useRef('dark');
  const countsRef    = useRef(counts);   // keep legend counts current without restarting loop

  const [tooltip, setTooltip] = useState(null);
  const [cursor, setCursor]   = useState('grab');

  // Update countsRef whenever counts prop changes
  useEffect(() => { countsRef.current = counts; }, [counts]);

  // ── Filter active nodes only ──────────────────────────────────────────────
  const { activeTemplates, activeAreas } = useMemo(() => {
    const allInst = templates.flatMap(t => t.instances || []);
    const activeTemplates = templates.filter(t => (t.instances?.length || 0) > 0);
    const activeAreaIds   = new Set(allInst.map(i => i.areaId).filter(Boolean));
    const activeAreas     = areas.filter(a => activeAreaIds.has(a.id));
    return { activeTemplates, activeAreas };
  }, [templates, areas]);

  // ── Build initial graph layout ────────────────────────────────────────────
  // Instances are fanned around their template's angle so clusters are clear
  const { initNodes, initEdges } = useMemo(() => {
    const initNodes = [];
    const initEdges = [];
    const tColor    = {};
    activeTemplates.forEach((t, i) => {
      tColor[t.id] = TEMPLATE_PALETTE[i % TEMPLATE_PALETTE.length];
    });

    const connCount = {};
    const bump = id => { connCount[id] = (connCount[id] || 0) + 1; };

    const tCount = Math.max(1, activeTemplates.length);

    const GOLDEN = 2.39996;   // golden angle in radians

    activeTemplates.forEach((t, i) => {
      const tAng = (i / tCount) * Math.PI * 2;
      const tR   = tCount === 1 ? 0 : 110;
      const tx   = Math.cos(tAng) * tR;
      const ty   = Math.sin(tAng) * tR;

      initNodes.push({
        id: `t_${t.id}`, type: 'template', label: t.name,
        x: tx + (Math.random() - 0.5) * 8,
        y: ty + (Math.random() - 0.5) * 8,
        vx: 0, vy: 0, pinned: false, color: tColor[t.id],
        meta: { instances: t.instances?.length || 0, attributes: t.attributes?.length || 0 },
      });

      // Instances placed in a golden-angle spiral centred on the template —
      // regardless of instance count they start close to their owner.
      const insts = t.instances || [];
      insts.forEach((inst, j) => {
        const spiralR   = 22 + Math.sqrt(j + 1) * 14;
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

    // Areas — outer ring
    const activeAreaSet = new Set(activeAreas.map(a => a.id));
    activeAreas.forEach((a, i) => {
      const ang = (i / Math.max(1, activeAreas.length)) * Math.PI * 2;
      initNodes.push({
        id: `a_${a.id}`, type: 'area', label: a.name,
        x: Math.cos(ang) * 280 + (Math.random() - 0.5) * 20,
        y: Math.sin(ang) * 280 + (Math.random() - 0.5) * 20,
        vx: 0, vy: 0, pinned: false, color: '#e8a23a', meta: {},
      });
    });

    // Instance → Area edges
    activeTemplates.forEach(t => {
      (t.instances || []).forEach(inst => {
        if (inst.areaId && activeAreaSet.has(inst.areaId)) {
          initEdges.push({ from: `i_${inst.id}`, to: `a_${inst.areaId}`, kind: 'inst-area' });
          bump(`i_${inst.id}`); bump(`a_${inst.areaId}`);
        }
      });
    });

    // Area → parent area (only if parent is also active)
    activeAreas.forEach(a => {
      if (a.parentId && activeAreaSet.has(a.parentId)) {
        initEdges.push({ from: `a_${a.id}`, to: `a_${a.parentId}`, kind: 'area-area' });
        bump(`a_${a.id}`); bump(`a_${a.parentId}`);
      }
    });

    initNodes.forEach(n => { n.r = nodeRadius(n.type, connCount[n.id] || 0); });
    return { initNodes, initEdges };
  }, [activeTemplates, activeAreas]);

  // ── Reinit simulation when graph data changes ─────────────────────────────
  useEffect(() => {
    const nodes   = initNodes.map(n => ({ ...n }));
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
    simRef.current = { nodes, edges: initEdges, nodeMap };
    // Reset pan/zoom when graph topology changes
    transformRef.current = { x: 0, y: 0, scale: 1 };
  }, [initNodes, initEdges]);

  // ── Resize: update canvas attrs + sizeRef directly (no React state) ───────
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

  // ── Track theme changes ───────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      themeRef.current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // ── Animation loop — starts once on mount, never restarts ────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function step() {
      const sim = simRef.current;
      if (!sim) return;
      const { nodes, edges, nodeMap } = sim;
      const { w, h } = sizeRef.current;
      // Soft boundary: keep nodes inside ~38% of the smaller canvas dimension
      const br = Math.max(150, Math.min(w, h) * 0.38);

      // Repulsion — only applied within cutoff distance so the central cluster
      // cannot "eject" nodes that are already far away.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx*dx + dy*dy || 0.01;
          let d  = Math.sqrt(d2);
          if (d > REPULSION_CUTOFF) continue;
          const minD = a.r + b.r + 16;
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
        // Center gravity
        n.vx -= n.x * GRAVITY;
        n.vy -= n.y * GRAVITY;
        // Soft boundary: push back if too far from center
        const dist = Math.sqrt(n.x*n.x + n.y*n.y);
        if (dist > br) {
          const excess = dist - br;
          n.vx -= (n.x / dist) * excess * 0.06;
          n.vy -= (n.y / dist) * excess * 0.06;
        }
        // Damping
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        // Velocity clamp
        const spd = Math.sqrt(n.vx*n.vx + n.vy*n.vy);
        if (spd > MAX_VEL) { n.vx = n.vx/spd*MAX_VEL; n.vy = n.vy/spd*MAX_VEL; }
        // Integrate
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    function render() {
      const sim = simRef.current;
      const { w, h } = sizeRef.current;
      if (!w || !h) return;

      const dark    = themeRef.current !== 'light';
      const BG      = dark ? '#161616' : '#f0f0f0';
      const EDGE_DIM = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.10)';
      const EDGE_LIT = dark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)';
      const LABEL   = dark ? 'rgba(255,255,255,0.75)'  : 'rgba(0,0,0,0.75)';
      const LEG_BG  = dark ? 'rgba(0,0,0,0.55)'        : 'rgba(255,255,255,0.80)';
      const LEG_TXT = dark ? 'rgba(255,255,255,0.72)'  : 'rgba(0,0,0,0.72)';
      const HINT    = dark ? 'rgba(255,255,255,0.20)'  : 'rgba(0,0,0,0.22)';

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

      // Edges — template-instance edges drawn thicker/brighter
      for (const { from, to, kind } of edges) {
        const a = nodeMap[from], b = nodeMap[to];
        if (!a || !b) continue;
        const lit = hov === from || hov === to;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        if (kind === 'tpl-inst') {
          ctx.strokeStyle = lit ? a.color + 'cc' : a.color + '44';
          ctx.lineWidth   = (lit ? 1.6 : 1.0) / sc;
        } else {
          ctx.strokeStyle = lit ? EDGE_LIT : EDGE_DIM;
          ctx.lineWidth   = (lit ? 1.2 : 0.6) / sc;
        }
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const isHov = hov === n.id;
        if (isHov || n.isFlagged) {
          const gr = ctx.createRadialGradient(n.x, n.y, n.r * 0.4, n.x, n.y, n.r * 3.5);
          gr.addColorStop(0, n.isFlagged ? 'rgba(229,83,83,0.35)' : `${n.color}44`);
          gr.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = gr;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = isHov ? 1 : 0.88;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (n.isFlagged) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 2.5/sc, 0, Math.PI * 2);
          ctx.strokeStyle = '#e55353';
          ctx.lineWidth = 1.8 / sc;
          ctx.stroke();
        }
        if (n.type !== 'instance' || sc > 0.65) {
          const fSize = Math.max(10, Math.min(13, 12/sc));
          ctx.font = `${fSize}px system-ui,sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = LABEL;
          ctx.fillText(n.label, n.x, n.y + n.r + 13/sc);
        }
      }
      ctx.restore();

      // Legend (screen space) — reads countsRef so values stay current
      const c = countsRef.current;
      const legendItems = [
        { color: TEMPLATE_PALETTE[0], label: 'Templates', count: c?.templateCount },
        { color: '#888888',           label: 'Instances',  count: c?.instanceCount },
        { color: '#e8a23a',           label: 'Areas',      count: c?.areaCount     },
      ];
      const LX = 14, LY_BOT = h - 14;
      const ROW_H = 22, PAD = 10, ITEM_W = 144;
      const boxH = legendItems.length * ROW_H + PAD * 2;
      const boxY = LY_BOT - boxH;

      ctx.save();
      ctx.fillStyle = LEG_BG;
      ctx.beginPath();
      const rx = LX - 6, ry = boxY - 2, rw = ITEM_W, rh = boxH + 4;
      if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, 7);
      else ctx.rect(rx, ry, rw, rh);
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
  }, []); // empty deps — loop starts once, never restarts

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
    if (n) {
      n.pinned = true;
      dragRef.current = { kind: 'node', n, ox: sx - n.x, oy: sy - n.y };
    } else {
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
          {tooltip.n.meta?.instances !== undefined && (
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{tooltip.n.meta.instances} instances · {tooltip.n.meta.attributes} attributes</div>
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
