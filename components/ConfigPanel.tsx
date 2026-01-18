import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { GameConfig } from '../types';
import { Database, CheckCircle2, RefreshCw, PlayCircle, History, FileText, Activity } from 'lucide-react';

interface ConfigPanelProps {
  resumeModelName?: string | null;
  onClearResume?: () => void;
}

const DEFAULT_CONFIG: GameConfig = {
  initial_player_balance: 200000.0,
  bet_amount: 100,
  counter_fee: 50,
  win_payout: 200,
  counter_win_payout: 250,
  dealer_stand: 17,
  total_timesteps: 1000000,
  max_balance_ref: 2000.0,
  refill_penalty: -500.0,
};

// 🟢 แก้ไข: ใช้ export default โดยตรงเพื่อแก้ SyntaxError
export default function ConfigPanel({ resumeModelName, onClearResume }: ConfigPanelProps) {
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [formConfig, setFormConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchLatestConfig(true); }, []);

  const fetchLatestConfig = async (syncForm: boolean = false) => {
    setLoading(true);
    try {
      const { data } = await supabase.from('game_configs').select('*').order('id', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setActiveConfig(data);
        if (syncForm) setFormConfig(data);
      }
    } finally { setLoading(false); }
  };

  const handleReload = async () => {
    setLoading(true);
    try {
      const { id, created_at, ...newVersionData } = formConfig as any;
      const { data, error } = await supabase.from('game_configs').insert([newVersionData]).select().single();
      if (error) throw error;
      await supabase.from('system_commands').insert([{ 
        command: 'RELOAD_CONFIG', 
        payload: { config_id: data.id, config: data }, 
        processed: false 
      }]);
      setActiveConfig(data);
      setMessage({ type: 'success', text: `v${data.id} Reloaded & Deployed` });
    } catch (err: any) { setMessage({ type: 'error', text: err.message }); }
    finally { setLoading(false); }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      if (onClearResume) onClearResume();
      const { id, created_at, ...newVersionData } = formConfig as any;
      const { data, error } = await supabase.from('game_configs').insert([newVersionData]).select().single();
      if (error) throw error;
      await supabase.from('system_commands').insert([{ 
        command: 'START_TRAINING', 
        payload: { resume: false, config_id: data.id, config: data }, 
        processed: false 
      }]);
      setActiveConfig(data);
      setMessage({ type: 'success', text: `v${data.id} Fresh Session Started` });
    } catch (err: any) { setMessage({ type: 'error', text: err.message }); }
    finally { setLoading(false); }
  };

  const copyWorkerScript = () => {
    const url = import.meta.env?.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
    const key = import.meta.env?.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
    
    // 🐍 โค้ดชุดนี้คือ "เครื่องยนต์" ที่จะไปรันใน Colab
    const pythonCode = `# QuantumWaste AI - Evolutionary Worker
import os, time, json
try:
    from supabase import create_client
except:
    os.system("pip install supabase gymnasium -q")
    from supabase import create_client

URL = "${url}"
KEY = "${key}"
supabase = create_client(URL, KEY)

# ค่านี่จะเปลี่ยนตามที่คุณตั้งใน Workbench ทันที
CFG = ${JSON.stringify(formConfig, null, 2)}
CONFIG_ID = "${activeConfig?.id || 'NEW'}"

print(f"📡 Worker Connected | Config: {CONFIG_ID}")

# Loop รอรับคำสั่งจาก Gateway (ปุ่ม Reload/Start ใน UI)
while True:
    res = supabase.from('system_commands').select('*').eq('processed', False).order('created_at', {'ascending': False}).limit(1).execute()
    if res.data:
        cmd = res.data[0]
        print(f"📥 Command Received: {cmd['command']}")
        # ตรงนี้คือส่วนที่คุณจะรัน Logic การเทรนจริงๆ
        supabase.from('system_commands').update({'processed': True}).eq('id', cmd['id']).execute()
    time.sleep(5)
`;
    navigator.clipboard.writeText(pythonCode);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  return (
    <div className="bg-[#1e293b] rounded-lg overflow-hidden border border-gray-700">
      <div className="grid grid-cols-2">
        <button onClick={handleReload} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] border-r border-white/10 transition-all">
          <History className="w-4 h-4" /> RELOAD CONFIG
        </button>
        <button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] transition-all">
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
                {/* 🔴 แก้ไข: ใช้ created_at และ ?. เพื่อกัน TypeError */}
                <p className="text-[8px] font-mono text-gray-500 mt-1 uppercase">ACTIVE ID: <span className="text-blue-300">v{activeConfig?.id || '---'}</span></p>
                <p className="text-[7px] font-mono text-gray-600">{activeConfig?.created_at ? new Date(activeConfig.created_at).toLocaleString() : 'WAITING FOR DATA...'}</p>
              </div>
            </div>
            <button onClick={() => fetchLatestConfig(true)} className="p-2 hover:bg-white/5 rounded transition-all text-blue-400">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {/* Mini Dashboard 6 cells */}
          <div className="grid grid-cols-6 gap-2">
            {[ {l:'BET', v:activeConfig?.bet_amount}, {l:'STAND', v:activeConfig?.dealer_stand}, {l:'WIN', v:activeConfig?.win_payout}, {l:'FEE', v:activeConfig?.counter_fee}, {l:'REF', v:activeConfig?.max_balance_ref}, {l:'STEP', v:activeConfig?.total_timesteps ? (activeConfig.total_timesteps/1000).toFixed(0)+'k' : '--'} ].map((s,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 p-2 text-center rounded">
                <p className="text-[7px] font-black text-gray-600 uppercase mb-1">{s.l}</p>
                <p className="text-[10px] font-mono text-blue-300">{s.v ?? 0}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Workbench */}
        <div className="grid grid-cols-3 gap-3">
          {Object.keys(DEFAULT_CONFIG).map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="text-[7px] font-black text-gray-500 uppercase tracking-tighter">{k.replace(/_/g,' ')}</label>
              <input 
                type="number" 
                value={(formConfig as any)[k]} 
                onChange={(e) => setFormConfig({...formConfig, [k]: parseFloat(e.target.value) || 0})}
                className="bg-gray-900 border border-gray-800 rounded px-2 py-2 text-[11px] text-white font-mono focus:border-blue-500 outline-none"
              />
            </div>
          ))}
        </div>

        <button onClick={copyWorkerScript} className="w-full flex items-center justify-center gap-2 text-[9px] font-black py-3 rounded bg-gray-900 border border-gray-800 text-blue-400 uppercase tracking-widest hover:border-blue-500 transition-all">
          {copying ? <CheckCircle2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
          {copying ? 'COPIED PYTHON WORKER' : 'BOOTSTRAP TO COLAB'}
        </button>

        {message && (
          <div className={`p-2.5 rounded text-[10px] font-black uppercase flex items-center gap-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
            <Activity className="w-3 h-3" /> {message.text}
          </div>
        )}
      </div>
    </div>
  );
}