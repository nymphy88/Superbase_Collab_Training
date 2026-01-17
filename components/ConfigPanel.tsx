import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { GameConfig } from '../types';
import { Save, Loader2, Database, FileText, Square, XCircle, CheckCircle2, RefreshCw, Clock, Activity, PlayCircle } from 'lucide-react';

interface ConfigPanelProps {
  resumeModelName?: string | null;
  onClearResume?: () => void;
}

const DEFAULT_CONFIG: GameConfig = {
  initial_player_balance: 1000.0,
  bet_amount: 10.0,
  counter_fee: 5.0,
  win_payout: 10.0,
  counter_win_payout: 25.0,
  dealer_stand: 17,
  total_timesteps: 1000000,
  max_balance_ref: 2000.0,
  refill_penalty: -50.0,
};

const ConfigPanel: React.FC<ConfigPanelProps> = ({ resumeModelName, onClearResume }) => {
  const [activeConfig, setActiveConfig] = useState<GameConfig | null>(null);
  const [formConfig, setFormConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; details?: string } | null>(null);

  useEffect(() => {
    fetchLatestConfig(true);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('live-config-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_configs' },
        (payload) => {
          setActiveConfig(payload.new as GameConfig);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLatestConfig = async (syncForm: boolean = false) => {
    setLoading(true);
    try {
      const { data } = await supabase.from('game_configs').select('*').order('id', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setActiveConfig(data);
        if (syncForm) setFormConfig(data);
      }
    } catch (err) {} finally { setLoading(false); }
  };

  const handleStop = async () => {
    setStopping(true);
    setMessage(null);
    try {
      await supabase.from('system_commands').insert([{ command: 'STOP_TRAINING', processed: false }]);
      setMessage({ type: 'success', text: 'Emergency Stop Command Broadcasted!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Operation failed', details: err.message });
    } finally { setStopping(false); }
  };

  const handleStartNew = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // 1. Clear resume state
      if (onClearResume) onClearResume();
      
      // 2. Insert new config to mark a fresh starting point
      const { data, error } = await supabase.from('game_configs').insert([formConfig]).select().single();
      if (error) throw error;
      
      // 3. Broadcast start command
      await supabase.from('system_commands').insert([{ 
        command: 'START_TRAINING', 
        payload: { resume: false, config_id: data.id }, 
        processed: false 
      }]);
      
      setMessage({ type: 'success', text: 'New Training Session Initialized!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to start session', details: err.message });
    } finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.from('game_configs').upsert(formConfig).select().single();
      if (error) throw error;
      await supabase.from('system_commands').insert([{ command: 'RELOAD_CONFIG', processed: false }]);
      if (data) { setFormConfig(data); setActiveConfig(data); }
      setMessage({ type: 'success', text: `Config Updated Live to AI Worker!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Network error', details: err.message });
    } finally { setLoading(false); }
  };

  const formatSteps = (val: number) => {
    if (val >= 1000000) return `${(val/1000000).toFixed(0)}M`;
    if (val >= 1000) return `${(val/1000).toFixed(0)}k`;
    return val;
  };

  return (
    <div className="bg-[#1e293b] rounded-lg overflow-hidden shadow-2xl border border-gray-700 h-full">
      <div className="grid grid-cols-2">
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-[#2563eb] hover:bg-blue-500 text-white font-black py-3.5 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-[10px] border-r border-blue-400/20"
        >
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
          SAVE CONFIG
        </button>
        <button 
          onClick={handleStartNew}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-[10px]"
        >
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
          START NEW TRAINING
        </button>
      </div>

      <div className="p-4 space-y-5">
        <div className="bg-[#0f172a]/95 border border-blue-500/20 rounded p-4 relative">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-3">
              <div className="p-1.5 bg-blue-500/10 rounded border border-blue-500/20">
                <Database className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-black text-blue-400 uppercase tracking-widest">ACTIVE DATABASE STATE</h2>
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                </div>
                <p className="text-[8px] font-mono text-gray-500 mt-1 uppercase tracking-tight">
                  MODE: <span className={resumeModelName ? "text-yellow-400" : "text-emerald-400"}>
                    {resumeModelName ? `RESUMING ${resumeModelName}` : 'FRESH SESSION'}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-4">
               <button onClick={() => fetchLatestConfig()} className="bg-gray-800/50 p-2 rounded border border-gray-700 flex flex-col items-center justify-center hover:bg-gray-700 transition-colors">
                  <RefreshCw className={`w-3 h-3 text-gray-500 ${loading ? 'animate-spin text-blue-500' : ''}`} />
                  <span className="text-[7px] font-black text-gray-600 mt-1 uppercase tracking-tighter">SYNC</span>
               </button>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: 'BET', value: activeConfig?.bet_amount ?? 10 },
              { label: 'STAND', value: activeConfig?.dealer_stand ?? 17 },
              { label: 'WIN PAY', value: activeConfig?.win_payout ?? 10 },
              { label: 'FEE', value: activeConfig?.counter_fee ?? 5 },
              { label: 'REF BAL', value: activeConfig?.max_balance_ref ?? 2000 },
              { label: 'STEPS', value: activeConfig ? formatSteps(activeConfig.total_timesteps) : '1000k' },
            ].map((s, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded p-2 text-center group hover:border-blue-500/30 transition-all">
                <p className="text-[8px] font-black text-gray-600 uppercase mb-1.5 tracking-widest">{s.label}</p>
                <p className="text-[11px] font-mono font-black text-blue-300 tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-800/50">
            <p className="text-[8px] font-black text-gray-600 uppercase flex items-center gap-1.5">
              <Clock className="w-2.5 h-2.5" />
              Last Update: {activeConfig?.created_at ? new Date(activeConfig.created_at).toLocaleTimeString([], { hour12: false }) : '17:16:25'}
            </p>
            <div className="flex gap-3">
              <span className="text-[8px] font-black text-gray-700 uppercase tracking-[0.2em] font-mono">STABLE-BASELINE3</span>
              <span className="text-[8px] font-black text-gray-800 uppercase tracking-[0.2em] font-mono">ENGINE</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
             <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Parameter Workbench</span>
             <div className="h-px bg-gray-700 flex-1"></div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Bet Amount', name: 'bet_amount' },
              { label: 'Dealer Stand', name: 'dealer_stand' },
              { label: 'Win Payout', name: 'win_payout' },
              { label: 'Counter Fee', name: 'counter_fee' },
              { label: 'Counter Pay', name: 'counter_win_payout' },
              { label: 'Initial Bal', name: 'initial_player_balance' },
              { label: 'Max Balance', name: 'max_balance_ref' },
              { label: 'Refill Pen', name: 'refill_penalty' },
              { label: 'Total Steps', name: 'total_timesteps' },
            ].map((field) => (
              <div key={field.name} className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-gray-500 uppercase tracking-tighter truncate">{field.label}</label>
                <input 
                  type="number" 
                  value={(formConfig as any)[field.name]} 
                  onChange={(e) => setFormConfig({...formConfig, [field.name]: parseFloat(e.target.value) || 0})}
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-[10px] text-white focus:border-blue-500 outline-none transition-all font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={handleStop} disabled={stopping}
            className="flex-1 flex items-center justify-center gap-2 text-[9px] font-black py-2.5 rounded bg-red-900/10 border border-red-700/30 text-red-500 hover:bg-red-900/20 transition-all uppercase tracking-widest"
          >
            {stopping ? <Loader2 className="animate-spin w-3 h-3" /> : <Square className="w-3 h-3 fill-current" />}
            Emergency Stop
          </button>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(`# AI Worker Reload Command\nimport os\nprint("Signal Broadcasted")`);
              setCopying(true); setTimeout(() => setCopying(false), 2000);
            }} 
            className="flex-1 flex items-center justify-center gap-2 text-[9px] font-black py-2.5 rounded bg-gray-900 border border-gray-800 text-blue-400 hover:border-blue-500 transition-all uppercase tracking-widest"
          >
            {copying ? <CheckCircle2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
            Worker Script
          </button>
        </div>

        {message && (
          <div className={`bg-[#0f172a] border-l-4 ${message.type === 'success' ? 'border-green-500' : 'border-red-500'} p-2.5 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300`}>
             <div className={`${message.type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'} p-1 rounded-full`}>
               <Activity className={`w-3 h-3 ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`} />
             </div>
             <p className={`text-[9px] font-black ${message.type === 'success' ? 'text-green-400' : 'text-red-400'} uppercase tracking-tighter flex-1`}>{message.text}</p>
             <button onClick={() => setMessage(null)} className="text-gray-600 hover:text-white"><XCircle className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigPanel;
