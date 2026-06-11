import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────
const REPULSION   = 3500;
const SPRING_K    = 0.05;
const DAMPING     = 0.78;
const GRAVITY     = 0.006;
const SPRING_LENS = { 'tpl-inst': 90, 'inst-area': 120, 'area-area': 100 };

const TEMPLATE_PALETTE = [
  '#4d9eff','#4dcc8a','#e06c75','#c678dd',
  '#56b6c2','#d19a66','#e5c07b','#61afef',
  '#98c379','#e8a23a',
];

function nodeRadius(type, connCount = 0) {
  if (type === 'template') return 9 + Math.min(Math.sqrt(connCount) * 1.5, 8);
  if (type === 'area')     return 8 + Math.min(Math.sqrt(connCount) * 1, 5);
  return 5;
}

// ── GraphView ─────────────────────────────────────────────────────────────────
export default function GraphView({ templates, areas }) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const simRef       = useRef(null);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef      = useRef(null);
  const hoverIdRef   = useRef(null);
  const animRef      = useRef(null);

  const [size, setSize]       = useState({ w: 800, h: 600 });
  const [tooltip, setTooltip] = useState(null);
  const [cursor, setCursor]   = useState('grab');

  // ── Build static graph ───────────────────────────────────────────────────
  const { initNodes, initEdges } = useMemo(() => {
    const initNodes = [];
    const initEdges = [];

    // Template colour map
    const tColor = {};
    templates.forEach((t, i) => { tColor[t.id] = TEMPLATE_PALETTE[i % TEMPLATE_PALETTE.length]; });

    // Count connections per node for sizing
    const connCount = {};
    const bump = (id) => { connCount[id] = (connCount[id] || 0) + 1; };

    // Template nodes – inner cluster
    templates.forEach((t, i) => {
      const ang = (i / Math.max(1, templates.length)) * Math.PI * 2;
      initNodes.push({
        id: `t_${t.id}`, type: 'template', label: t.name,
        x: Math.cos(ang) * 70 + (Math.random() - 0.5) * 20,
        y: Math.sin(ang) * 70 + (Math.random() - 0.5) * 20,
        vx: 0, vy: 0, pinned: false,
        color: tColor[t.id],
        meta: { instances: t.instances?.length || 0, attributes: t.attributes?.length || 0 },
      });
    });

    // Instance nodes – mid ring
    let iIdx = 0;
    const totalInst = templates.reduce((s, t) => s + (t.instances?.length || 0), 0);
    templates.forEach(t => {
      (t.instances || []).forEach(inst => {
        const ang = (iIdx++ / Math.max(1, totalInst)) * Math.PI * 2;
        const r = 190 + (Math.random() - 0.5) * 60;
        initNodes.push({
          id: `i_${inst.id}`, type: 'instance', label: inst.name,
          x: Math.cos(ang) * r, y: Math.sin(ang) * r,
          vx: 0, vy: 0, pinned: false,
          color: tColor[t.id],
          isFlagged: inst.isFlagged,
          meta: { template: t.name, areaId: inst.areaId },
        });
        initEdges.push({ from: `t_${t.id}`, to: `i_${inst.id}`, kind: 'tpl-inst' });
        bump(`t_${t.id}`); bump(`i_${inst.id}`);
      });
    });

    // Area nodes – outer ring
    areas.forEach((a, i) => {
      const ang = (i / Math.max(1, areas.length)) * Math.PI * 2;
      const r = 320 + (Math.random() - 0.5) * 40;
      initNodes.push({
        id: `a_${a.id}`, type: 'area', label: a.name,
        x: Math.cos(ang) * r, y: Math.sin(ang) * r,
        vx: 0, vy: 0, pinned: false,
        color: '#e8a23a',
        meta: {},
      });
    });

    // Instance → Area edges
    templates.forEach(t => {
      (t.instances || []).forEach(inst => {
        if (inst.areaId && inst.areaId !== 0) {
          initEdges.push({ from: `i_${inst.id}`, to: `a_${inst.areaId}`, kind: 'inst-area' });
          bump(`i_${inst.id}`); bump(`a_${inst.areaId}`);
        }
      });
    });

    // Area → parent area edges
    areas.forEach(a => {
      if (a.parentId) {
        initEdges.push({ from: `a_${a.id}`, to: `a_${a.parentId}`, kind: 'area-area' });
        bump(`a_${a.id}`); bump(`a_${a.parentId}`);
      }
    });

    // Stamp connection-based radii
    initNodes.forEach(n => {
      n.r = nodeRadius(n.type, connCount[n.id] || 0);
    });

    return { initNodes, initEdges };
  }, [templates, areas]);

  // ── Init simulation when graph changes ────────────────────────────────────
  useEffect(() => {
    const nodes   = initNodes.map(n => ({ ...n }));
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
    simRef.current = { nodes, edges: initEdges, nodeMap };
  }, [initNodes, initEdges]);

  // ── Container resize ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize({ w: Math.max(200, width), h: Math.max(200, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Animation loop (simulation + render) ──────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simRef.current) return;
    const ctx = canvas.getContext('2d');

    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    const BG         = dark ? '#161616' : '#f0f0f0';
    const EDGE_DIM   = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    const EDGE_LIT   = dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';
    const LABEL_COL  = dark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.72)';
    const LEGEND_BG  = dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)';
    const LEGEND_TXT = dark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)';
    const HINT_COL   = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)';

    const { w, h } = size;
    const cx = w / 2, cy = h / 2;

    function step() {
      const { nodes, edges, nodeMap } = simRef.current;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx*dx + dy*dy || 0.0001;
          let d  = Math.sqrt(d2);
          const minD = a.r + b.r + 18;
          if (d < minD) { dx = dx / d * minD; dy = dy / d * minD; d = minD; d2 = d*d; }
          const f = REPULSION / d2;
          const fx = dx / d * f, fy = dy / d * f;
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
        const len = SPRING_LENS[kind] || 130;
        const f  = SPRING_K * (d - len);
        const fx = dx / d * f, fy = dy / d * f;
        if (!a.pinned) { a.vx += fx; a.vy += fy; }
        if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
      }

      // Gravity + damping + integrate
      for (const n of nodes) {
        if (n.pinned) continue;
        n.vx = (n.vx - n.x * GRAVITY) * DAMPING;
        n.vy = (n.vy - n.y * GRAVITY) * DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    function render() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      const { x: tx, y: ty, scale: sc } = transformRef.current;
      ctx.save();
      ctx.translate(cx + tx, cy + ty);
      ctx.scale(sc, sc);

      const { nodes, edges, nodeMap } = simRef.current;
      const hov = hoverIdRef.current;

      // Edges
      for (const { from, to } of edges) {
        const a = nodeMap[from], b = nodeMap[to];
        if (!a || !b) continue;
        const lit = hov === from || hov === to;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = lit ? EDGE_LIT : EDGE_DIM;
        ctx.lineWidth   = (lit ? 1.4 : 0.7) / sc;
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const isHov = hov === n.id;

        // Glow
        if (isHov || n.isFlagged) {
          const gr = ctx.createRadialGradient(n.x, n.y, n.r * 0.5, n.x, n.y, n.r * 3.5);
          gr.addColorStop(0, n.isFlagged ? 'rgba(229,83,83,0.35)' : `${n.color}44`);
          gr.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = gr;
          ctx.fill();
        }

        // Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = isHov ? 1 : 0.82;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Flagged ring
        if (n.isFlagged) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 2.5 / sc, 0, Math.PI * 2);
          ctx.strokeStyle = '#e55353';
          ctx.lineWidth = 1.8 / sc;
          ctx.stroke();
        }

        // Label (always for template/area, only when zoomed in for instances)
        const showLabel = n.type !== 'instance' || sc > 0.65;
        if (showLabel) {
          const fs = Math.max(10, Math.min(13, 12 / sc));
          ctx.font = `${fs}px system-ui,sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = LABEL_COL;
          ctx.fillText(n.label, n.x, n.y + n.r + 13 / sc);
        }
      }

      ctx.restore();

      // Legend (screen-space)
      const legend = [
        { color: TEMPLATE_PALETTE[0], label: 'Template' },
        { color: '#888888',           label: 'Instance'  },
        { color: '#e8a23a',           label: 'Area'      },
      ];
      ctx.save();
      const lx = 14, ly = h - 14 - legend.length * 22 - 10;
      ctx.fillStyle = LEGEND_BG;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx - 6, ly - 6, 106, legend.length * 22 + 14, 7);
      else ctx.rect(lx - 6, ly - 6, 106, legend.length * 22 + 14);
      ctx.fill();
      legend.forEach(({ color, label }, i) => {
        ctx.beginPath();
        ctx.arc(lx + 5, ly + i * 22 + 5, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.font = '11px system-ui,sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = LEGEND_TXT;
        ctx.fillText(label, lx + 16, ly + i * 22 + 9.5);
      });
      ctx.restore();

      // Hint
      ctx.font = '10px system-ui,sans-serif';
      ctx.fillStyle = HINT_COL;
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
  }, [size, initNodes, initEdges]);

  // ── Coordinate helpers ────────────────────────────────────────────────────
  const toSim = useCallback((ex, ey) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const { x: tx, y: ty, scale } = transformRef.current;
    return [
      (ex - rect.left  - size.w / 2 - tx) / scale,
      (ey - rect.top   - size.h / 2 - ty) / scale,
    ];
  }, [size]);

  const nodeAt = useCallback((sx, sy) => {
    if (!simRef.current) return null;
    for (const n of simRef.current.nodes) {
      const dx = n.x - sx, dy = n.y - sy;
      if (dx*dx + dy*dy <= (n.r + 4) * (n.r + 4)) return n;
    }
    return null;
  }, []);

  // ── Mouse handlers ────────────────────────────────────────────────────────
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
    } else if (newId && n && tooltip) {
      const rect = canvasRef.current.getBoundingClientRect();
      setTooltip(t => t ? { ...t, x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 8 } : null);
    }

    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'node') {
      d.n.x = sx - d.ox; d.n.y = sy - d.oy;
      d.n.vx = 0;        d.n.vy = 0;
    } else {
      transformRef.current.x = d.ox + (e.clientX - d.sx);
      transformRef.current.y = d.oy + (e.clientY - d.sy);
    }
  }, [toSim, nodeAt, tooltip]);

  const onMouseUp = useCallback(() => {
    if (dragRef.current?.kind === 'node') dragRef.current.n.pinned = false;
    dragRef.current = null;
    setCursor('grab');
  }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    const t = transformRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - size.w / 2;
    const my = e.clientY - rect.top  - size.h / 2;
    t.x = mx + (t.x - mx) * factor;
    t.y = my + (t.y - my) * factor;
    t.scale = Math.max(0.15, Math.min(5, t.scale * factor));
  }, [size]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // Empty state
  if (!templates.length && !areas.length) {
    return (
      <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <span style={{ color: 'var(--text-disabled)', fontSize: 14 }}>No data — add templates and areas to see the graph.</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
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
          {tooltip.n.isFlagged && (
            <div style={{ color: '#e55353', fontSize: 11, marginTop: 2 }}>⚠ Flagged</div>
          )}
        </div>
      )}
    </div>
  );
}
