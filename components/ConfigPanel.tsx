import React, { useCallback, useMemo } from 'react';
import { Database, RefreshCw, PlayCircle, History, FileText, Activity, CheckCircle2 } from 'lucide-react';
import { useConfigPanelState } from '../hooks/useConfigPanelState';
import { generatePythonWorker } from '../config.utils';
import { DEFAULT_CONFIG } from '../config.types';

// Importing from the local UI atoms barrel
import { ConfigInput, ConfigStatItem } from './components/index';

interface ConfigPanelProps {
  resumeModelName?: string | null;
  onClearResume?: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ resumeModelName, onClearResume }) => {
  const {
    activeConfig,
    formConfig,
    loading,
    copying,
    setCopying,
    message,
    fetchLatestConfig,
    handleReload,
    handleStart,
    setFormValue
  } = useConfigPanelState(onClearResume);

  const copyWorkerScript = useCallback(() => {
    const pythonCode = generatePythonWorker(formConfig, activeConfig?.id);
    navigator.clipboard.writeText(pythonCode);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }, [formConfig, activeConfig, setCopying]);

  const statCells = useMemo(() => [
    { label: 'BET', value: activeConfig?.bet_amount },
    { label: 'STAND', value: activeConfig?.dealer_stand },
    { label: 'WIN', value: activeConfig?.win_payout },
    { label: 'FEE', value: activeConfig?.counter_fee },
    { label: 'REF', value: activeConfig?.max_balance_ref },
    { label: 'STEP', value: activeConfig?.total_timesteps ? (activeConfig.total_timesteps/1000).toFixed(0)+'k' : '--' }
  ], [activeConfig]);

  return (
    <div className="bg-[#1e293b] rounded-lg overflow-hidden border border-gray-700 shadow-xl">
      <div className="grid grid-cols-2">
        <button 
          onClick={handleReload} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] border-r border-white/10 transition-all"
        >
          <History className="w-4 h-4" /> RELOAD CONFIG
        </button>
        <button 
          onClick={handleStart} 
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] transition-all"
        >
          <PlayCircle className="w-4 h-4" /> START NEW SESSION
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-[#0f172a] border border-blue-500/20 rounded p-4 shadow-inner">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-3">
              <Database className="w-4 h-4 text-blue-400 mt-1" />
              <div>
                <h2 className="text-[11px] font-black text-blue-400 uppercase tracking-widest">SYSTEM GATEWAY</h2>
                <p className="text-[8px] font-mono text-gray-500 mt-1 uppercase">ACTIVE ID: <span className="text-blue-300">v{activeConfig?.id || '---'}</span></p>
                <p className="text-[7px] font-mono text-gray-600">{activeConfig?.created_at ? new Date(activeConfig.created_at).toLocaleString() : 'WAITING FOR DATA...'}</p>
              </div>
            </div>
            <button onClick={() => fetchLatestConfig(true)} className="p-2 hover:bg-white/5 rounded transition-all text-blue-400">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {statCells.map((s, i) => (
              <ConfigStatItem key={i} label={s.label} value={s.value} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {Object.keys(DEFAULT_CONFIG).map((k) => (
            <ConfigInput 
              key={k} 
              label={k.replace(/_/g,' ')} 
              value={(formConfig as any)[k]} 
              onChange={(val) => setFormValue(k, val)} 
            />
          ))}
        </div>

        <button 
          onClick={copyWorkerScript} 
          className="w-full flex items-center justify-center gap-2 text-[9px] font-black py-3 rounded bg-gray-900 border border-gray-800 text-blue-400 uppercase tracking-widest hover:border-blue-500 transition-all group"
        >
          {copying ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />}
          {copying ? 'COPIED PYTHON WORKER' : 'BOOTSTRAP TO COLAB'}
        </button>

        {message && (
          <div className={`p-2.5 rounded text-[10px] font-black uppercase flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
            <Activity className="w-3 h-3" /> {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ConfigPanel);