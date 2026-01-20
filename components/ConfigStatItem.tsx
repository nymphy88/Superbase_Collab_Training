
import React from 'react';

interface ConfigStatItemProps {
  label: string;
  value: string | number;
}

const ConfigStatItem: React.FC<ConfigStatItemProps> = React.memo(({ label, value }) => {
  return (
    <div className="bg-gray-900 border border-gray-800 p-2 text-center rounded">
      <p className="text-[7px] font-black text-gray-600 uppercase mb-1">{label}</p>
      <p className="text-[10px] font-mono text-blue-300">{value ?? 0}</p>
    </div>
  );
});

export default ConfigStatItem;
