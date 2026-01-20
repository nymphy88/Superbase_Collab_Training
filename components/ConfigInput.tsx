
import React from 'react';

interface ConfigInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const ConfigInput: React.FC<ConfigInputProps> = React.memo(({ label, value, onChange }) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[7px] font-black text-gray-500 uppercase tracking-tighter">
        {label}
      </label>
      <input 
        type="number" 
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="bg-gray-900 border border-gray-800 rounded px-2 py-2 text-[11px] text-white font-mono focus:border-blue-500 outline-none"
      />
    </div>
  );
});

export default ConfigInput;
