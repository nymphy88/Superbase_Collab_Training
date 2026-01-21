
import React, { useCallback, useMemo, useState } from 'react';
import { Database, RefreshCw, PlayCircle, History, FileText, Activity, CheckCircle2, Link, Link2Off, Copy, ExternalLink, Globe, StopCircle } from 'lucide-react';
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
    ngrokUrl,
    isEngineOnline,
    message,
    fetchLatestConfig,
    handleReload,
    handleStart,
    handleStop,
    setFormValue
  } = useConfigPanelState(onClearResume);

  const [urlCopying, setUrlCopying] = useState(false);

  const copyWorkerScript = useCallback(() => {
    const pythonCode = generatePythonWorker(formConfig, activeConfig?.id);
    navigator.clipboard.writeText(pythonCode);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }, [formConfig, activeConfig, setCopying]);

  const copyNgrokUrl = useCallback(() => {
    if (ngrokUrl) {
      navigator.clipboard.writeText(ngrokUrl);
      setUrlCopying(true);
      setTimeout(() => setUrlCopying(false), 2000);
    }
  }, [ngrokUrl]);

  const statCells = useMemo(() => [
    { label: 'BET', value: activeConfig?.bet_amount },
    { label: 'STAND', value: activeConfig?.dealer_stand },
    { label: 'WIN', value: activeConfig?.win_payout },
    { label: 'FEE', value: activeConfig?.counter_fee },
    { label: 'REF', value: activeConfig?.max_balance_ref },
    { label: 'STEP', value: activeConfig?.total_timesteps ? (activeConfig.total_timesteps/1000).toFixed(0)+'k' : '--' }
  ], [activeConfig]);

  const inputKeys = useMemo(() => {
    return Object.keys(DEFAULT_CONFIG).filter(k => k !== 'NGROK_URL' && k !== 'id' && k !== 'created_at');
  }, []);

  return (
    <div className="bg-[#1e293b] rounded-lg overflow-hidden border border-gray-700 shadow-xl">
      <div className="grid grid-cols-3">
        <button 
          onClick={handleReload} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] border-r border-white/10 transition-all"
        >
          <History className="w-4 h-4" /> RELOAD
        </button>
        <button 
          onClick={handleStart} 
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] border-r border-white/10 transition-all"
        >
          <PlayCircle className="w-4 h-4" /> START
        </button>
        <button 
          onClick={handleStop} 
          disabled={loading}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] transition-all"
        >
          <StopCircle className="w-4 h-4" /> STOP TRAINING
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-[#0f172a] border border-blue-500/20 rounded p-4 shadow-inner">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-3">
              <div className="relative">
                <Database className="w-4 h-4 text-blue-400 mt-1" />
                <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-gray-900 ${isEngineOnline === 'checking' ? 'bg-yellow-500' : isEngineOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-black text-blue-400 uppercase tracking-widest">SYSTEM GATEWAY</h2>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase border ${
                    isEngineOnline === 'checking' ? 'text-yellow-500 border-yellow-500/30' : 
                    isEngineOnline ? 'text-green-500 border-green-500/30' : 
                    'text-red-500 border-red-500/30'
                  }`}>
                    {isEngineOnline === 'checking' ? 'CHECKING...' : isEngineOnline ? 'ENGINE LINKED' : 'UNLINKED'}
                  </span>
                </div>
                <p className="text-[8px] font-mono text-gray-500 mt-1 uppercase">ACTIVE ID: <span className="text-blue-300">v{activeConfig?.id || '---'}</span></p>
                <p className="text-[7px] font-mono text-gray-600">{activeConfig?.created_at ? new Date(activeConfig.created_at).toLocaleString() : 'WAITING FOR DATA...'}</p>
              </div>
            </div>
            <button onClick={() => fetchLatestConfig(true)} className="p-2 hover:bg-white/5 rounded transition-all text-blue-400">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* NGROK URL DISPLAY */}
          {ngrokUrl && (
            <div className="mb-4 bg-gray-900/50 border border-gray-800 rounded-md p-2 flex items-center justify-between group transition-all hover:border-blue-500/30">
              <div className="flex items-center gap-2 overflow-hidden">
                <Globe className="w-3 h-3 text-blue-400 flex-shrink-0" />
                <span className="text-[10px] font-mono text-gray-400 truncate tracking-tight">{ngrokUrl}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button 
                  onClick={copyNgrokUrl}
                  className={`p-1.5 rounded transition-all ${urlCopying ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500 hover:text-white'}`}
                  title="Copy Tunnel URL"
                >
                  {urlCopying ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
                <a 
                  href={ngrokUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-1.5 bg-gray-800 text-gray-500 hover:text-white rounded transition-all"
                  title="Open Tunnel"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          <div className="grid grid-cols-6 gap-2">
            {statCells.map((s, i) => (
              <ConfigStatItem key={i} label={s.label} value={s.value} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {inputKeys.map((k) => (
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
            {message.type === 'success' ? <Link className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />} 
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ConfigPanel);
