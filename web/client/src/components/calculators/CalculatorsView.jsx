import React, { useState, useMemo } from 'react';

// ─── Number formatter ─────────────────────────────────────────────────────────
function fmt(v, sig = 5) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e6 || abs < 1e-3) return v.toExponential(3);
  return parseFloat(v.toPrecision(sig)).toString();
}

// ─── Slider component ─────────────────────────────────────────────────────────
function Slider({ min, max, value, onChange, minLabel, maxLabel }) {
  const clamped = isNaN(value) ? min : Math.min(max, Math.max(min, value));
  const pct = max !== min ? ((clamped - min) / (max - min)) * 100 : 0;
  const step = max !== min ? (max - min) / 500 : 1;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        {/* Track background */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4,
          background: 'var(--border)', borderRadius: 2,
        }} />
        {/* Filled portion */}
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 4,
          background: 'var(--accent)', borderRadius: 2, pointerEvents: 'none',
        }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamped}
          onChange={e => onChange(e.target.value)}
          style={{
            position: 'absolute', left: 0, right: 0, width: '100%',
            appearance: 'none', WebkitAppearance: 'none',
            background: 'transparent', cursor: 'pointer', height: 20, margin: 0,
            accentColor: 'var(--accent)',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>{minLabel ?? min}</span>
        <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>{maxLabel ?? max}</span>
      </div>
    </div>
  );
}

// ─── 4-20mA Scaling Calculator ────────────────────────────────────────────────
function MA420Calculator() {
  const [mAMin, setMAMin]   = useState('4');
  const [mAMax, setMAMax]   = useState('20');
  const [euMin, setEUMin]   = useState('0');
  const [euMax, setEUMax]   = useState('100');
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

  const fwdEU  = valid && !isNaN(mA) ? mAToEU(mA)    : null;
  const fwdPct = valid && !isNaN(mA) ? mAToPct(mA)   : null;
  const revMA  = valid && !isNaN(eu) ? euToMA(eu)     : null;
  const revPct = valid && !isNaN(eu) ? mAToPct(revMA) : null;

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
      <SectionLabel>Configuration</SectionLabel>
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
      <SectionLabel>Converter</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>

        {/* Signal → EU */}
        <div style={panelStyle}>
          <div style={labelStyle}>Signal → Engineering Value</div>
          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
            <input
              className="input"
              style={{ width: 100 }}
              value={mAInput}
              onChange={e => setMAInput(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>mA</span>
          </div>
          {valid && (
            <Slider
              min={s0} max={s1}
              value={mA}
              onChange={setMAInput}
              minLabel={`${s0} mA`}
              maxLabel={`${s1} mA`}
            />
          )}
          <div style={{ marginTop: 14 }}>
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
        </div>

        {/* EU → Signal */}
        <div style={panelStyle}>
          <div style={labelStyle}>Engineering Value → Signal</div>
          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
            <input
              className="input"
              style={{ width: 100 }}
              value={euInput}
              onChange={e => setEUInput(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{unitLabel}</span>
          </div>
          {valid && (
            <Slider
              min={e0} max={e1}
              value={eu}
              onChange={setEUInput}
              minLabel={`${e0} ${unitLabel}`}
              maxLabel={`${e1} ${unitLabel}`}
            />
          )}
          <div style={{ marginTop: 14 }}>
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
      </div>

      {/* Reference Table */}
      {valid && (
        <>
          <SectionLabel>Reference Table</SectionLabel>
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

const TEMP_UNITS = [
  { id: '°C', toK: v => v + 273.15,         fromK: v => v - 273.15 },
  { id: '°F', toK: v => (v + 459.67) * 5/9, fromK: v => v * 9/5 - 459.67 },
  { id: 'K',  toK: v => v,                   fromK: v => v },
  { id: '°R', toK: v => v * 5/9,             fromK: v => v * 9/5 },
];

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
      { id: 'inH₂O',  f: 249.089 },
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
      { id: 'g',        f: 1e-3 },
      { id: 'kg',       f: 1 },
      { id: 't',        f: 1e3 },
      { id: 'lb',       f: 0.453592 },
      { id: 'oz',       f: 0.0283495 },
      { id: 'ton(US)',   f: 907.185 },
    ],
  },
};

const CATEGORY_ORDER = ['temperature', 'pressure', 'flow', 'length', 'mass'];

// Sensible slider defaults per category (in the first unit of that category)
const SLIDER_DEFAULTS = {
  temperature: { min: '-40', max: '200' },
  pressure:    { min: '0',   max: '1000000' },
  flow:        { min: '0',   max: '1' },
  length:      { min: '0',   max: '100' },
  mass:        { min: '0',   max: '1000' },
};

function UnitConverter() {
  const [category, setCategory]   = useState('temperature');
  const [inputVal, setInputVal]   = useState('100');
  const [fromUnit, setFromUnit]   = useState('°C');
  const [sliderMin, setSliderMin] = useState(SLIDER_DEFAULTS.temperature.min);
  const [sliderMax, setSliderMax] = useState(SLIDER_DEFAULTS.temperature.max);

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    const defaults = SLIDER_DEFAULTS[cat];
    setSliderMin(defaults.min);
    setSliderMax(defaults.max);
    setFromUnit(cat === 'temperature' ? '°C' : LINEAR_CATEGORIES[cat].units[0].id);
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
    }
    const cat = LINEAR_CATEGORIES[category];
    const src = cat.units.find(u => u.id === fromUnit);
    if (!src) return [];
    const base = v * src.f;
    return cat.units.map(u => ({ unit: u.id, value: base / u.f }));
  }, [category, fromUnit, inputVal]);

  const sMin = parseFloat(sliderMin);
  const sMax = parseFloat(sliderMax);
  const sliderValid = !isNaN(sMin) && !isNaN(sMax) && sMax > sMin;
  const catLabel = category === 'temperature' ? 'Temperature' : LINEAR_CATEGORIES[category].label;

  return (
    <div style={{ padding: 28, maxWidth: 560 }}>

      {/* Category */}
      <SectionLabel>Category</SectionLabel>
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

      {/* Input + slider */}
      <SectionLabel>Input</SectionLabel>
      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
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

        {sliderValid && (
          <Slider
            min={sMin} max={sMax}
            value={parseFloat(inputVal)}
            onChange={setInputVal}
          />
        )}

        {/* Slider range controls */}
        <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Slider range:</span>
          <input
            className="input"
            style={{ width: 80 }}
            value={sliderMin}
            onChange={e => setSliderMin(e.target.value)}
            placeholder="min"
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
          <input
            className="input"
            style={{ width: 80 }}
            value={sliderMax}
            onChange={e => setSliderMax(e.target.value)}
            placeholder="max"
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fromUnit}</span>
        </div>
      </div>

      {/* Results table */}
      {results.length > 0 && (
        <>
          <SectionLabel>{catLabel} Conversions</SectionLabel>
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
                  style={r.unit === fromUnit
                    ? { background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }
                    : {}}
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

// ─── Reduced Level (RL) Calculator ───────────────────────────────────────────
function RLCalculator() {
  const [sigMin,   setSigMin]   = useState('4');
  const [sigMax,   setSigMax]   = useState('20');
  const [lrv,      setLrv]      = useState('95.000');
  const [urv,      setUrv]      = useState('100.000');
  const [unit,     setUnit]     = useState('m');
  const [sigInput, setSigInput] = useState('12');
  const [rlInput,  setRlInput]  = useState('');

  const cfg = useMemo(() => {
    const s0  = parseFloat(sigMin);
    const s1  = parseFloat(sigMax);
    const rl0 = parseFloat(lrv);
    const rl1 = parseFloat(urv);
    const valid = !isNaN(s0) && !isNaN(s1) && s1 !== s0 && !isNaN(rl0) && !isNaN(rl1);
    return { s0, s1, rl0, rl1, valid };
  }, [sigMin, sigMax, lrv, urv]);

  const { s0, s1, rl0, rl1, valid } = cfg;

  function sigToRL(sig) { return rl0 + ((sig - s0) / (s1 - s0)) * (rl1 - rl0); }
  function rlToSig(rl)  { return s0  + ((rl  - rl0) / (rl1 - rl0)) * (s1 - s0); }
  function sigToPct(sig) { return ((sig - s0) / (s1 - s0)) * 100; }

  const sig    = parseFloat(sigInput);
  const rl     = parseFloat(rlInput);
  const fwdRL  = valid && !isNaN(sig)  ? sigToRL(sig)     : null;
  const fwdPct = valid && !isNaN(sig)  ? sigToPct(sig)    : null;
  const revSig = valid && !isNaN(rl)   ? rlToSig(rl)      : null;
  const revPct = valid && !isNaN(rl)   ? sigToPct(revSig) : null;

  const steps = valid
    ? [0, 25, 50, 75, 100].map(pct => ({
        pct,
        sigVal: s0  + (pct / 100) * (s1  - s0),
        rlVal:  rl0 + (pct / 100) * (rl1 - rl0),
      }))
    : [];

  const unitLabel = unit.trim() || 'RL';

  return (
    <div style={{ padding: 28, maxWidth: 720 }}>

      <SectionLabel>Transmitter Configuration</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={panelStyle}>
          <div style={labelStyle}>Signal Range</div>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 72 }} value={sigMin} onChange={e => setSigMin(e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
            <input className="input" style={{ width: 72 }} value={sigMax} onChange={e => setSigMax(e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>mA</span>
          </div>
        </div>
        <div style={panelStyle}>
          <div style={labelStyle}>RL Range (LRV → URV)</div>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 90 }} value={lrv} onChange={e => setLrv(e.target.value)} placeholder="LRV" />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
            <input className="input" style={{ width: 90 }} value={urv} onChange={e => setUrv(e.target.value)} placeholder="URV" />
            <input className="input" style={{ width: 64 }} placeholder="unit" value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {/* Signal → RL */}
        <div style={panelStyle}>
          <div style={labelStyle}>Signal → Reduced Level</div>
          <div className="flex items-center gap-2 mb-3">
            <input
              className="input"
              style={{ width: 90 }}
              value={sigInput}
              onChange={e => setSigInput(e.target.value)}
              placeholder="mA"
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>mA</span>
          </div>
          {valid && !isNaN(sig) ? (
            <>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>
                {fmt(fwdRL)} {unitLabel}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {fmt(fwdPct)}% of span
              </div>
              <Slider
                min={s0} max={s1} value={sig}
                onChange={v => setSigInput(String(parseFloat(v).toFixed(3)))}
                minLabel={`${s0} mA`} maxLabel={`${s1} mA`}
              />
            </>
          ) : (
            <div style={{ color: 'var(--text-disabled)', fontSize: 13 }}>—</div>
          )}
        </div>

        {/* RL → Signal */}
        <div style={panelStyle}>
          <div style={labelStyle}>Reduced Level → Signal</div>
          <div className="flex items-center gap-2 mb-3">
            <input
              className="input"
              style={{ width: 90 }}
              value={rlInput}
              onChange={e => setRlInput(e.target.value)}
              placeholder={unitLabel}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{unitLabel}</span>
          </div>
          {valid && !isNaN(rl) ? (
            <>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>
                {fmt(revSig)} mA
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {fmt(revPct)}% of span
              </div>
              <Slider
                min={rl0} max={rl1} value={rl}
                onChange={v => setRlInput(String(parseFloat(v).toFixed(3)))}
                minLabel={`${rl0} ${unitLabel}`} maxLabel={`${rl1} ${unitLabel}`}
              />
            </>
          ) : (
            <div style={{ color: 'var(--text-disabled)', fontSize: 13 }}>—</div>
          )}
        </div>
      </div>

      {/* Reference table */}
      {steps.length > 0 && (
        <>
          <SectionLabel>Reference Table</SectionLabel>
          <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Span (%)</th>
                  <th>Signal (mA)</th>
                  <th>Reduced Level ({unitLabel})</th>
                </tr>
              </thead>
              <tbody>
                {steps.map(({ pct, sigVal, rlVal }) => (
                  <tr key={pct}>
                    <td style={{ color: 'var(--text-muted)' }}>{pct}%</td>
                    <td>{fmt(sigVal)} mA</td>
                    <td style={{ fontWeight: 600 }}>{fmt(rlVal)} {unitLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}


function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

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
const thStyle = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '5px 12px',
  fontSize: 13,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-subtle)',
};

// ─── Project Estimator ────────────────────────────────────────────────────────
const DEFAULT_IO = [
  { id: 'di',    label: 'Digital Inputs',         plc: 15, scada: 10, mes: 10 },
  { id: 'do',    label: 'Digital Outputs',         plc: 15, scada: 10, mes: 10 },
  { id: 'ai',    label: 'Analogue Inputs',         plc: 20, scada: 15, mes: 10 },
  { id: 'ao',    label: 'Analogue Outputs',        plc: 20, scada: 15, mes: 10 },
  { id: 'vsd',   label: 'VSDs on Comms',           plc: 30, scada: 20, mes: 10 },
  { id: 'field', label: 'Field Devices on Comms',  plc: 30, scada: 20, mes: 10 },
  { id: 'pid',   label: 'PID Loops',               plc: 45, scada: 25, mes: 10 },
  { id: 'seq',   label: 'Sequences',               plc: 60, scada: 30, mes: 10 },
];

const SYS_LABELS = { plc: 'PLC', scada: 'SCADA', mes: 'MES' };
const SYS_COLORS = { plc: '#4d9eff', scada: '#4dcc8a', mes: '#e8a23a' };

function ProjectEstimator() {
  const [rows, setRows]           = useState(DEFAULT_IO.map(r => ({ ...r, qty: '' })));
  const [systems, setSystems]     = useState({ plc: true, scada: true, mes: false });
  const [hourlyRate, setHourlyRate] = useState('150');
  const [contingency, setContingency] = useState('20');
  const [currency, setCurrency]   = useState('$');

  const setRow = (id, field, value) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const activeSystems = Object.keys(systems).filter(k => systems[k]);

  const totals = useMemo(() => {
    const bySystem = { plc: 0, scada: 0, mes: 0 };
    const byRow = rows.map(row => {
      const qty = parseFloat(row.qty) || 0;
      let rowTotal = 0;
      const sysTotal = {};
      for (const sys of ['plc', 'scada', 'mes']) {
        const mins = systems[sys] ? qty * (parseFloat(row[sys]) || 0) : 0;
        sysTotal[sys] = mins;
        bySystem[sys] += mins;
        rowTotal += mins;
      }
      return { ...sysTotal, total: rowTotal };
    });
    const totalMins = bySystem.plc + bySystem.scada + bySystem.mes;
    const totalHrs = totalMins / 60;
    const cont = parseFloat(contingency) || 0;
    const totalWithCont = totalHrs * (1 + cont / 100);
    const rate = parseFloat(hourlyRate) || 0;
    const cost = totalWithCont * rate;
    return { bySystem, byRow, totalHrs, totalWithCont, cost };
  }, [rows, systems, contingency, hourlyRate]);

  const fmtHrs = (mins) => {
    if (!mins) return '—';
    const h = mins / 60;
    return h < 1 ? `${Math.round(mins)}m` : `${h.toFixed(1)}h`;
  };

  const fmtCost = (n) => {
    if (!isFinite(n) || n === 0) return '—';
    return currency + n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 920 }}>
      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        Development Estimation
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Estimate development effort and cost based on I/O count and system scope.
      </div>

      {/* Config */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-start' }}>
        <div style={panelStyle}>
          <div style={labelStyle}>System Scope</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(SYS_LABELS).map(([key, label]) => {
              const on = systems[key];
              return (
                <button
                  key={key}
                  onClick={() => setSystems(p => ({ ...p, [key]: !p[key] }))}
                  style={{
                    padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: `2px solid ${on ? SYS_COLORS[key] : 'var(--border)'}`,
                    background: on ? `${SYS_COLORS[key]}22` : 'transparent',
                    color: on ? SYS_COLORS[key] : 'var(--text-disabled)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ ...panelStyle, display: 'flex', gap: 20, alignItems: 'flex-end' }}>
          <div>
            <div style={labelStyle}>Currency</div>
            <input className="input" style={{ width: 52 }} value={currency} onChange={e => setCurrency(e.target.value)} maxLength={3} />
          </div>
          <div>
            <div style={labelStyle}>Hourly Rate</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{currency}</span>
              <input className="input" style={{ width: 90 }} value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
            </div>
          </div>
          <div>
            <div style={labelStyle}>Contingency</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input className="input" style={{ width: 70 }} value={contingency} onChange={e => setContingency(e.target.value)} />
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>%</span>
            </div>
          </div>
        </div>
      </div>

      {/* I/O Table */}
      <div style={{ ...panelStyle, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)' }}>
              <th style={thStyle}>I/O Type</th>
              <th style={{ ...thStyle, width: 72, textAlign: 'center' }}>Qty</th>
              {activeSystems.includes('plc')   && <th style={{ ...thStyle, width: 110, textAlign: 'center', color: SYS_COLORS.plc   }}>PLC (min/pt)</th>}
              {activeSystems.includes('scada') && <th style={{ ...thStyle, width: 120, textAlign: 'center', color: SYS_COLORS.scada }}>SCADA (min/pt)</th>}
              {activeSystems.includes('mes')   && <th style={{ ...thStyle, width: 110, textAlign: 'center', color: SYS_COLORS.mes   }}>MES (min/pt)</th>}
              <th style={{ ...thStyle, width: 90, textAlign: 'right', paddingRight: 16 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rt = totals.byRow[i];
              const hasQty = parseFloat(row.qty) > 0;
              return (
                <tr key={row.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                  <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-primary)' }}>{row.label}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      style={{ width: 60, textAlign: 'center', padding: '3px 6px' }}
                      value={row.qty}
                      onChange={e => setRow(row.id, 'qty', e.target.value)}
                      placeholder="0"
                    />
                  </td>
                  {activeSystems.includes('plc') && (
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        style={{ width: 64, textAlign: 'center', padding: '3px 6px' }}
                        value={row.plc}
                        onChange={e => setRow(row.id, 'plc', e.target.value)}
                      />
                    </td>
                  )}
                  {activeSystems.includes('scada') && (
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        style={{ width: 64, textAlign: 'center', padding: '3px 6px' }}
                        value={row.scada}
                        onChange={e => setRow(row.id, 'scada', e.target.value)}
                      />
                    </td>
                  )}
                  {activeSystems.includes('mes') && (
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        style={{ width: 64, textAlign: 'center', padding: '3px 6px' }}
                        value={row.mes}
                        onChange={e => setRow(row.id, 'mes', e.target.value)}
                      />
                    </td>
                  )}
                  <td style={{
                    ...tdStyle, textAlign: 'right', paddingRight: 16,
                    fontWeight: hasQty ? 600 : 400,
                    color: hasQty ? 'var(--text-primary)' : 'var(--text-disabled)',
                  }}>
                    {fmtHrs(rt.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-system summary cards */}
      {activeSystems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activeSystems.length}, 1fr)`, gap: 12, marginBottom: 14 }}>
          {activeSystems.map(sys => (
            <div key={sys} style={{ ...panelStyle, borderTop: `3px solid ${SYS_COLORS[sys]}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: SYS_COLORS[sys], marginBottom: 6 }}>
                {SYS_LABELS[sys]}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                {(totals.bySystem[sys] / 60).toFixed(1)}h
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {totals.bySystem[sys].toFixed(0)} minutes
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grand total */}
      <div style={{ ...panelStyle, display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={labelStyle}>Base Total</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>
            {totals.totalHrs.toFixed(1)}h
          </div>
        </div>
        {parseFloat(contingency) > 0 && (
          <>
            <div style={{ color: 'var(--border)', fontSize: 22 }}>+</div>
            <div>
              <div style={labelStyle}>Contingency ({contingency}%)</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-muted)' }}>
                {(totals.totalWithCont - totals.totalHrs).toFixed(1)}h
              </div>
            </div>
            <div style={{ color: 'var(--border)', fontSize: 22 }}>=</div>
            <div>
              <div style={labelStyle}>Total Incl. Contingency</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>
                {totals.totalWithCont.toFixed(1)}h
              </div>
            </div>
          </>
        )}
        {parseFloat(hourlyRate) > 0 && totals.cost > 0 && (
          <>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: 'right' }}>
              <div style={labelStyle}>Estimated Cost</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--accent)' }}>
                {fmtCost(totals.cost)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                @ {currency}{parseFloat(hourlyRate || 0).toFixed(2)}/hr
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Calculator registry ──────────────────────────────────────────────────────
const CALCULATORS = [
  { id: 'ma420',     label: '4-20mA Scaling',     desc: 'Signal range converter',              component: MA420Calculator  },
  { id: 'rl',        label: 'Reduced Level',       desc: '4-20mA signal to RL elevation',       component: RLCalculator     },
  { id: 'unit',      label: 'Unit Conversion',     desc: 'Engineering unit converter',          component: UnitConverter    },
  { id: 'estimator', label: 'Project Estimator',   desc: 'Time effort & cost estimate',  component: ProjectEstimator },
];

// ─── Main view ────────────────────────────────────────────────────────────────
export default function CalculatorsView() {
  const [activeCalc, setActiveCalc] = useState(CALCULATORS[0].id);
  const active = CALCULATORS.find(c => c.id === activeCalc);
  const ActiveComponent = active?.component;

  return (
    <div className="flex h-full">
      <div style={{
        width: 210, flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
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
                padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                background: isActive ? 'var(--bg-active, rgba(59,130,246,0.08))' : 'transparent',
                borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: 'var(--text-primary)' }}>
                {c.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-main)' }}>
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}
