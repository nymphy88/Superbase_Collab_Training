import React from 'react';
import { StatCardProps } from '../types';

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color = "text-white" }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-xs uppercase font-semibold tracking-wider">{title}</p>
        <h3 className={`text-2xl font-bold mt-1 ${color}`}>{value}</h3>
      </div>
      <div className="p-3 bg-gray-700 rounded-full opacity-80">
        {icon}
      </div>
    </div>
  );
};

export default StatCard;
