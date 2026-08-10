import React from 'react';

export const DATA_TYPES = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Bool' },
  { value: 2, label: 'Int8' },
  { value: 3, label: 'Int16' },
  { value: 4, label: 'Int32' },
  { value: 5, label: 'UInt8' },
  { value: 6, label: 'UInt16' },
  { value: 7, label: 'UInt32' },
  { value: 8, label: 'Float' },
  { value: 9, label: 'String' },
  { value: 10, label: 'Int4' },
];

export function dataTypeName(val) {
  const dt = DATA_TYPES.find(d => d.value === Number(val));
  return dt ? dt.label : 'None';
}

export default function DataTypeSelect({ value, onChange, disabled, style }) {
  return (
    <select
      value={value ?? 0}
      onChange={e => onChange(Number(e.target.value))}
      disabled={disabled}
      style={style}
    >
      {DATA_TYPES.map(dt => (
        <option key={dt.value} value={dt.value}>{dt.label}</option>
      ))}
    </select>
  );
}
