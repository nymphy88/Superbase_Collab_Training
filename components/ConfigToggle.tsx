
import React from 'react';

interface ConfigToggleProps {
  label: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
}

const ConfigToggle: React.FC<ConfigToggleProps> = React.memo(({ label, enabled, onToggle }) => {
  return (
    <div className="flex items-center justify-between p-2 bg-gray-900 border border-gray-800 rounded">
      <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter">{label}</span>
      <button 
        onClick={() => onToggle(!enabled)}
        className={`w-8 h-4 rounded-full relative transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-700'}`}
      >
        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${enabled ? 'left-4.5' : 'left-0.5'}`} />
      </button>
    </div>
  );
});

export default ConfigToggle;
