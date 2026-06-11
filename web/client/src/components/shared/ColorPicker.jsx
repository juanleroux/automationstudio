import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Color math ────────────────────────────────────────────────────────────────
function hsvToRgb(h, s, v) {
  const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  return [f(5), f(3), f(1)].map(x => Math.round(x * 255));
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = d === 0 ? 0
    : max === r ? ((g - b) / d + 6) % 6 * 60
    : max === g ? ((b - r) / d + 2) * 60
    :             ((r - g) / d + 4) * 60;
  return [h, max === 0 ? 0 : d / max, max];
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
}

// ── ColorPicker ───────────────────────────────────────────────────────────────
const PICKER_W = 216;
const PICKER_H = 296; // approximate height for positioning

export default function ColorPicker({ value, onChange, anchorRef, onClose }) {
  const initHsv = () => {
    const [r, g, b] = hexToRgb(value || '#888888');
    return rgbToHsv(r, g, b);
  };

  const [hsv, setHsv]         = useState(initHsv);
  const [hexInput, setHexInput] = useState((value || '#888888').toLowerCase());
  const [pos, setPos]         = useState({ top: 0, left: 0 });

  const pickerRef   = useRef(null);
  const sbRef       = useRef(null);
  const hueRef      = useRef(null);
  const lastEmitted = useRef(value);

  // Sync when parent resets value externally
  useEffect(() => {
    if (value && value !== lastEmitted.current) {
      const [r, g, b] = hexToRgb(value);
      setHsv(rgbToHsv(r, g, b));
      setHexInput(value.toLowerCase());
      lastEmitted.current = value;
    }
  }, [value]);

  // Position picker next to the anchor dot
  useEffect(() => {
    if (!anchorRef?.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    let left = r.right + 10;
    let top  = r.top - 8;
    if (left + PICKER_W > window.innerWidth  - 8) left = r.left - PICKER_W - 10;
    if (top  + PICKER_H > window.innerHeight - 8) top  = window.innerHeight - PICKER_H - 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchorRef]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target) &&
        anchorRef?.current && !anchorRef.current.contains(e.target)
      ) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  // Emit color whenever HSV changes
  useEffect(() => {
    const hex = rgbToHex(...hsvToRgb(...hsv));
    setHexInput(hex);
    lastEmitted.current = hex;
    onChange(hex);
  }, [hsv]); // eslint-disable-line

  const [h, s, v] = hsv;
  const hueHex = rgbToHex(...hsvToRgb(h, 1, 1));

  // Drag helpers
  const makeDragger = useCallback((onMove) => (e) => {
    e.preventDefault();
    onMove(e);
    const move = (ev) => onMove(ev);
    const up   = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }, []);

  const handleSB = makeDragger((ev) => {
    const rect = sbRef.current.getBoundingClientRect();
    const sx = Math.max(0, Math.min(1, (ev.clientX - rect.left)  / rect.width));
    const sy = Math.max(0, Math.min(1, (ev.clientY - rect.top)   / rect.height));
    setHsv([h, sx, 1 - sy]);
  });

  const handleHue = makeDragger((ev) => {
    const rect = hueRef.current.getBoundingClientRect();
    const hx = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    setHsv([hx * 360, s, v]);
  });

  const handleHexInput = (raw) => {
    setHexInput(raw);
    const clean = raw.startsWith('#') ? raw : '#' + raw;
    if (/^#[0-9a-f]{6}$/i.test(clean)) {
      const [r, g, b] = hexToRgb(clean);
      setHsv(rgbToHsv(r, g, b));
    }
  };

  return (
    <div
      ref={pickerRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 10000,
        width: PICKER_W,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        padding: 12,
        userSelect: 'none',
      }}
    >
      {/* Saturation / Brightness square */}
      <div
        ref={sbRef}
        onMouseDown={handleSB}
        style={{
          position: 'relative',
          height: 148,
          borderRadius: 6,
          overflow: 'hidden',
          cursor: 'crosshair',
          marginBottom: 10,
          background: hueHex,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #fff, transparent)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, #000)' }} />
        {/* Crosshair cursor */}
        <div style={{
          position: 'absolute',
          left: `${s * 100}%`, top: `${(1 - v) * 100}%`,
          width: 12, height: 12, borderRadius: '50%',
          border: '2px solid #fff',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        onMouseDown={handleHue}
        style={{
          position: 'relative',
          height: 13,
          borderRadius: 7,
          cursor: 'pointer',
          marginBottom: 12,
          background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
        }}
      >
        <div style={{
          position: 'absolute',
          left: `${(h / 360) * 100}%`, top: '50%',
          width: 17, height: 17, borderRadius: '50%',
          border: '2px solid #fff',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
          background: hueHex,
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Preview + hex input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 6, flexShrink: 0,
          background: rgbToHex(...hsvToRgb(h, s, v)),
          border: '1px solid var(--border)',
        }} />
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
            fontSize: 13, color: 'var(--text-disabled)', pointerEvents: 'none',
          }}>#</span>
          <input
            className="input"
            value={hexInput.replace(/^#/, '')}
            onChange={e => handleHexInput('#' + e.target.value)}
            spellCheck={false}
            maxLength={6}
            style={{ paddingLeft: 22, fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}
          />
        </div>
      </div>
    </div>
  );
}
