
import React from 'react';
import { StatCardProps } from '../types';

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color = "text-white" }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg flex items-center justify-between h-full w-full group hover:border-blue-500/50 transition-all duration-300 grid-card-header cursor-grab active:cursor-grabbing select-none relative overflow-hidden">
      <div className="min-w-0 pointer-events-none z-10">
        <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest truncate">{title}</p>
        <h3 className={`text-xl lg:text-2xl font-black mt-1 truncate ${color} tracking-tight`}>{value}</h3>
      </div>
      <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700 group-hover:bg-blue-900/10 group-hover:border-blue-500/30 transition-colors flex-shrink-0 pointer-events-none z-10">
        {icon}
      </div>
      {/* Decorative background element for hover effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
    </div>
  );
};

export default StatCard;
