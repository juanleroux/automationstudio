import React, { useState, useMemo } from 'react';

// ─── Number formatter ────────────────────────────────────────────────────────
function fmt(v, sig = 5) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e6 || abs < 1e-3) return v.toExponential(3);
  return parseFloat(v.toPrecision(sig)).toString();
}

// ─── 4-20mA Scaling Calculator ───────────────────────────────────────────────
function MA420Calculator() {
  const [mAMin, setMAMin] = useState('4');
  const [mAMax, setMAMax] = useState('20');
  const [euMin, setEUMin] = useState('0');
  const [euMax, setEUMax] = useState('100');
  const [euUnit, setEUUnit] = useState('');
  const [mAInput, setMAInput] = useState('12');
  const [euInput, setEUInput] = useState('50');

  const cfg = useMemo(() => {
    const s0 = parseFloat(mAMin);
    const s1 = parseFloat(mAMax);
    const e0 = parseFloat(euMin);
    const e1 = parseFloat(euMax);
    const valid = !isNaN(s0) && !isNaN(s1) && s1 !== s0 && !isNaN(e0) && !isNaN(e1);
    return { s0, s1, e0, e1, valid };
  }, [mAMin, mAMax, euMin, euMax]);

  const { s0, s1, e0, e1, valid } = cfg;

  function mAToEU(mA) { return e0 + ((mA - s0) / (s1 - s0)) * (e1 - e0); }
  function euToMA(eu) { return s0 + ((eu - e0) / (e1 - e0)) * (s1 - s0); }
  function mAToPct(mA) { return ((mA - s0) / (s1 - s0)) * 100; }

  const mA = parseFloat(mAInput);
  const eu = parseFloat(euInput);

  const fwdEU   = valid && !isNaN(mA) ? mAToEU(mA)      : null;
  const fwdPct  = valid && !isNaN(mA) ? mAToPct(mA)     : null;
  const revMA   = valid && !isNaN(eu) ? euToMA(eu)       : null;
  const revPct  = valid && !isNaN(eu) ? mAToPct(revMA)   : null;

  const steps = valid
    ? [0, 25, 50, 75, 100].map(pct => ({
        pct,
        mAVal: s0 + (pct / 100) * (s1 - s0),
        euVal: e0 + (pct / 100) * (e1 - e0),
      }))
    : [];

  const unitLabel = euUnit.trim() || 'EU';

  return (
    <div style={{ padding: 28, maxWidth: 720 }}>

      {/* Configuration */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
        Configuration
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={panelStyle}>
          <div style={labelStyle}>Signal Range</div>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 72 }} value={mAMin} onChange={e => setMAMin(e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
            <input className="input" style={{ width: 72 }} value={mAMax} onChange={e => setMAMax(e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>mA</span>
          </div>
        </div>
        <div style={panelStyle}>
          <div style={labelStyle}>Process Range</div>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 72 }} value={euMin} onChange={e => setEUMin(e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
            <input className="input" style={{ width: 72 }} value={euMax} onChange={e => setEUMax(e.target.value)} />
            <input className="input" style={{ width: 80 }} placeholder="unit" value={euUnit} onChange={e => setEUUnit(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Converters */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
        Converter
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {/* Signal → EU */}
        <div style={panelStyle}>
          <div style={labelStyle}>Signal → Engineering Value</div>
          <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
            <input
              className="input"
              style={{ width: 100 }}
              value={mAInput}
              onChange={e => setMAInput(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>mA</span>
          </div>
          {fwdEU !== null ? (
            <>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                {fmt(fwdEU)}{' '}
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>{unitLabel}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                {fmt(fwdPct, 4)}% of span
              </div>
            </>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-disabled)' }}>Enter a value above</span>
          )}
        </div>

        {/* EU → Signal */}
        <div style={panelStyle}>
          <div style={labelStyle}>Engineering Value → Signal</div>
          <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
            <input
              className="input"
              style={{ width: 100 }}
              value={euInput}
              onChange={e => setEUInput(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{unitLabel}</span>
          </div>
          {revMA !== null ? (
            <>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                {fmt(revMA)}{' '}
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>mA</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                {fmt(revPct, 4)}% of span
              </div>
            </>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-disabled)' }}>Enter a value above</span>
          )}
        </div>
      </div>

      {/* Reference Table */}
      {valid && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
            Reference Table
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>% Span</th>
                <th style={{ textAlign: 'right' }}>Signal (mA)</th>
                <th style={{ textAlign: 'right' }}>
                  Engineering Value{euUnit.trim() ? ` (${euUnit.trim()})` : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {steps.map(row => (
                <tr key={row.pct}>
                  <td style={{ color: 'var(--text-muted)' }}>{row.pct}%</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmt(row.mAVal, 6)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmt(row.euVal, 6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ─── Unit Conversion Calculator ───────────────────────────────────────────────

// Temperature: base = Kelvin, non-linear conversions
const TEMP_UNITS = [
  { id: '°C',  toK: v => v + 273.15,          fromK: v => v - 273.15 },
  { id: '°F',  toK: v => (v + 459.67) * 5/9,  fromK: v => v * 9/5 - 459.67 },
  { id: 'K',   toK: v => v,                    fromK: v => v },
  { id: '°R',  toK: v => v * 5/9,              fromK: v => v * 9/5 },
];

// Linear conversion categories — factors convert TO the base unit (first in list)
const LINEAR_CATEGORIES = {
  pressure: {
    label: 'Pressure',
    units: [
      { id: 'Pa',     f: 1 },
      { id: 'kPa',    f: 1e3 },
      { id: 'MPa',    f: 1e6 },
      { id: 'bar',    f: 1e5 },
      { id: 'mbar',   f: 1e2 },
      { id: 'psi',    f: 6894.757 },
      { id: 'atm',    f: 101325 },
      { id: 'inH₂O', f: 249.089 },
      { id: 'mmHg',   f: 133.322 },
      { id: 'inHg',   f: 3386.39 },
    ],
  },
  flow: {
    label: 'Flow',
    units: [
      { id: 'm³/s',    f: 1 },
      { id: 'm³/h',    f: 1 / 3600 },
      { id: 'L/s',     f: 1e-3 },
      { id: 'L/min',   f: 1 / 60000 },
      { id: 'L/h',     f: 1 / 3.6e6 },
      { id: 'gal/min', f: 6.30902e-5 },
      { id: 'gal/h',   f: 1.05150e-6 },
      { id: 'ft³/min', f: 4.71947e-4 },
      { id: 'ft³/h',   f: 7.86579e-6 },
      { id: 'bbl/day', f: 1.84013e-6 },
    ],
  },
  length: {
    label: 'Length',
    units: [
      { id: 'mm', f: 1e-3 },
      { id: 'cm', f: 1e-2 },
      { id: 'm',  f: 1 },
      { id: 'km', f: 1e3 },
      { id: 'in', f: 0.0254 },
      { id: 'ft', f: 0.3048 },
      { id: 'yd', f: 0.9144 },
      { id: 'mi', f: 1609.344 },
    ],
  },
  mass: {
    label: 'Mass',
    units: [
      { id: 'g',       f: 1e-3 },
      { id: 'kg',      f: 1 },
      { id: 't',       f: 1e3 },
      { id: 'lb',      f: 0.453592 },
      { id: 'oz',      f: 0.0283495 },
      { id: 'ton(US)', f: 907.185 },
    ],
  },
};

const CATEGORY_ORDER = ['temperature', 'pressure', 'flow', 'length', 'mass'];

function UnitConverter() {
  const [category, setCategory] = useState('temperature');
  const [inputVal, setInputVal] = useState('100');
  const [fromUnit, setFromUnit] = useState('°C');

  // Reset from-unit when category changes
  const handleCategoryChange = (cat) => {
    setCategory(cat);
    if (cat === 'temperature') {
      setFromUnit('°C');
    } else {
      setFromUnit(LINEAR_CATEGORIES[cat].units[0].id);
    }
  };

  const units = category === 'temperature'
    ? TEMP_UNITS.map(u => u.id)
    : LINEAR_CATEGORIES[category].units.map(u => u.id);

  const results = useMemo(() => {
    const v = parseFloat(inputVal);
    if (isNaN(v)) return [];

    if (category === 'temperature') {
      const src = TEMP_UNITS.find(u => u.id === fromUnit);
      if (!src) return [];
      const kelvin = src.toK(v);
      return TEMP_UNITS.map(u => ({ unit: u.id, value: u.fromK(kelvin) }));
    } else {
      const cat = LINEAR_CATEGORIES[category];
      const src = cat.units.find(u => u.id === fromUnit);
      if (!src) return [];
      const base = v * src.f;
      return cat.units.map(u => ({ unit: u.id, value: base / u.f }));
    }
  }, [category, fromUnit, inputVal]);

  const catLabel = category === 'temperature' ? 'Temperature' : LINEAR_CATEGORIES[category].label;

  return (
    <div style={{ padding: 28, maxWidth: 560 }}>

      {/* Category tabs */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
        Category
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {CATEGORY_ORDER.map(cat => {
          const label = cat === 'temperature' ? 'Temperature' : LINEAR_CATEGORIES[cat].label;
          const active = category === cat;
          return (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--text-primary)',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
        Input
      </div>
      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <div className="flex items-center gap-3">
          <input
            className="input"
            style={{ width: 160, fontSize: 16, fontWeight: 600 }}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
          />
          <select
            className="input"
            style={{ width: 110 }}
            value={fromUnit}
            onChange={e => setFromUnit(e.target.value)}
          >
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
            {catLabel} Conversions
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr
                  key={r.unit}
                  style={r.unit === fromUnit ? { background: 'rgba(var(--accent-rgb, 59,130,246), 0.08)' } : {}}
                >
                  <td style={{ fontWeight: r.unit === fromUnit ? 600 : 400 }}>{r.unit}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: r.unit === fromUnit ? 600 : 400 }}>
                    {fmt(r.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const panelStyle = {
  background: 'var(--bg-main)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '16px 18px',
};
const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  marginBottom: 10,
};

// ─── Calculator registry ──────────────────────────────────────────────────────
const CALCULATORS = [
  {
    id: 'ma420',
    label: '4-20mA Scaling',
    desc: 'Signal & process range converter',
    component: MA420Calculator,
  },
  {
    id: 'unit',
    label: 'Unit Conversion',
    desc: 'Engineering units, pressure, temperature, flow',
    component: UnitConverter,
  },
];

// ─── Main view ────────────────────────────────────────────────────────────────
export default function CalculatorsView() {
  const [activeCalc, setActiveCalc] = useState(CALCULATORS[0].id);
  const active = CALCULATORS.find(c => c.id === activeCalc);
  const ActiveComponent = active?.component;

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <div style={{
        width: 210,
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
            Calculators
          </span>
        </div>
        {CALCULATORS.map(c => {
          const isActive = activeCalc === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCalc(c.id)}
              style={{
                padding: '10px 14px',
                textAlign: 'left',
                background: isActive ? 'var(--bg-active, rgba(59,130,246,0.08))' : 'transparent',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-primary)' }}>
                {c.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-main)' }}>
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}
