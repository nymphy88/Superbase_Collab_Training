import React from 'react';

interface ConfigDropdownProps {
  label: string;
  value: string | number;
  options: { label: string; value: string | number }[];
  onChange: (val: any) => void;
}

const ConfigDropdown: React.FC<ConfigDropdownProps> = React.memo(({ label, value, options, onChange }) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[7px] font-black text-gray-500 uppercase tracking-tighter">{label}</label>
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-900 border border-gray-800 rounded px-2 py-2 text-[11px] text-white font-mono focus:border-blue-500 outline-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
});

export default ConfigDropdown;