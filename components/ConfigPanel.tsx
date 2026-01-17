
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { GameConfig } from '../types';
import { Save, Loader2, RotateCcw, Database, AlertCircle, FileText, ClipboardCheck, Square, XCircle, Info, Sparkles, Terminal, ShieldCheck, ChevronDown, ChevronUp, RefreshCw, Zap, CheckCircle2, Clock } from 'lucide-react';

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
  const [showSqlSetup, setShowSqlSetup] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; details?: string; isSchemaError?: boolean } | null>(null);

  useEffect(() => {
    fetchLatestConfig(true);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events so we see Inserts and Updates
          schema: 'public',
          table: 'game_configs'
        },
        (payload) => {
          console.log('Real-time Config Sync:', payload.new);
          setActiveConfig(payload.new as GameConfig);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDbError = (error: any, context: string) => {
    const errorMsg = error.message || 'Unknown database error';
    const isSchemaError = errorMsg.toLowerCase().includes('column') || 
                         errorMsg.toLowerCase().includes('relation') || 
                         error.code === '42P01' || 
                         error.code === '42703';

    setMessage({
      type: 'error',
      text: isSchemaError ? `${context}: Schema Error` : context,
      details: isSchemaError ? `Required column missing in Supabase. Details: ${errorMsg}` : errorMsg,
      isSchemaError
    });
  };

  const fetchLatestConfig = async (syncForm: boolean = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_configs')
        .select('*')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        handleDbError(error, 'Fetch Failed');
      } else if (data) {
        setActiveConfig(data);
        if (syncForm) {
          setFormConfig(data);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Connection Error', details: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('system_commands')
        .insert([{ command: 'STOP_TRAINING', processed: false }]);
      
      if (error) {
        handleDbError(error, 'Broadcast Failed');
      } else {
        setMessage({ 
          type: 'success', 
          text: 'Stop Command Broadcasted!', 
          details: 'Worker in Colab will detect this command, save the model, and stop properly.' 
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Operation failed', details: err.message });
    } finally {
      setStopping(false);
    }
  };

  const generateColabScript = () => {
    const url = 'https://besukzaogasvsefpmsce.supabase.co';
    const key = 'sb_publishable_YuQcGRwxs8XHkLY3ibimLA_q7x6_oRv'; 
    const resumeModelValue = resumeModelName ? `'${resumeModelName}'` : "None";

    return `
# ===================================================================
# BLACKJACK DICE V8.9 (RELOAD SUPPORT) - SUPABASE WORKER SCRIPT
# ===================================================================

!pip install supabase gymnasium stable-baselines3 shimmy -q

import os, time, numpy as np
import gymnasium as gym
from gymnasium import spaces
from supabase import create_client, Client
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback

URL = "${url}"
KEY = "${key}"
RESUME_FROM = ${resumeModelValue}

supabase: Client = create_client(URL, KEY)

class BlackjackDiceEnvV89(gym.Env):
    def __init__(self, config):
        super().__init__()
        self.cfg = config
        self.action_space = spaces.Discrete(3) 
        self.observation_space = spaces.Box(low=0, high=1000000, shape=(4,), dtype=np.float32)
        self.current_balance = float(self.cfg['initial_player_balance'])
        self.reset()

    def update_config(self, new_config):
        print(f"\\n[SYNC] Updating Environment Parameters...")
        self.cfg = new_config
        print(f"       New Bet: {self.cfg['bet_amount']}, New Stand: {self.cfg['dealer_stand']}")

    def _roll(self, count=1):
        return sum(np.random.randint(1, 7) for _ in range(count))

    def _get_obs(self):
        max_bal = float(self.cfg.get('max_balance_ref', 2000.0))
        norm_balance = self.current_balance / max_bal
        return np.array([
            float(self.player_sum) / 30.0,
            float(self.dealer_visible) / 6.0,
            float(self.counter_available),
            float(norm_balance)
        ], dtype=np.float32)

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.player_sum = self._roll(4)
        self.dealer_dice = [self._roll(1), self._roll(1)]
        self.dealer_visible = self.dealer_dice[0]
        self.dealer_sum = sum(self.dealer_dice)
        self.counter_enabled = False
        self.counter_available = 1.0
        return self._get_obs(), {}

    def step(self, action):
        info = {'counter_triggered': False, 'refilled': False, 'money_change': 0.0}
        if action == 2:
            if self.player_sum >= 15 and self.counter_available > 0:
                fee = float(self.cfg.get('counter_fee', 0))
                self.current_balance -= fee
                info['money_change'] -= fee
                self.counter_enabled = True
                self.counter_available = 0
                info['counter_triggered'] = True
                obs, reward, done, trunc, info = self._dealer_turn(info)
                return obs, (reward - fee), done, trunc, info
            else:
                return self._get_obs(), -1.0, True, False, info
        if action == 1:
            self.player_sum += self._roll(2)
            if self.player_sum > 21: 
                return self._end_game(-float(self.cfg['bet_amount']), info)
        elif action == 0:
            return self._dealer_turn(info)
        return self._get_obs(), 0.0, False, False, info

    def _dealer_turn(self, info):
        while self.dealer_sum < self.cfg['dealer_stand']:
            self.dealer_sum += self._roll(1)
        if self.dealer_sum > 21 or self.player_sum > self.dealer_sum:
            return self._end_game(float(self.cfg['win_payout']), info)
        if self.counter_enabled:
            new_sum = self.player_sum + self._roll(1)
            if new_sum == 21: 
                payout = float(self.cfg.get('counter_win_payout') or self.cfg.get('counter_payout') or 350.0)
                return self._end_game(payout, info)
            elif self.dealer_sum > 21 or new_sum > self.dealer_sum: 
                return self._end_game(10.0, info)
            else: 
                return self._end_game(-(float(self.cfg['bet_amount']) * 1.5), info)
        return self._end_game(-float(self.cfg['bet_amount']), info)

    def _end_game(self, reward, info):
        money_gain_loss = float(reward)
        self.current_balance += money_gain_loss
        if 'money_change' not in info: info['money_change'] = 0.0
        info['money_change'] += money_gain_loss
        final_reward = money_gain_loss
        if self.current_balance < float(self.cfg['bet_amount']):
            self.current_balance = float(self.cfg['initial_player_balance'])
            info['refilled'] = True
            final_reward += float(self.cfg.get('refill_penalty', -50.0))
        return self._get_obs(), final_reward, True, False, info

class TrainingMonitor(BaseCallback):
    def __init__(self, check_freq=200):
        super().__init__()
        self.check_freq = check_freq
        self.total_profit = 0.0
        self.wins = 0
        self.games = 0
        self.counter_uses = 0
        self.total_refills = 0

    def _on_step(self) -> bool:
        if self.n_calls % self.check_freq == 0:
            self._push_telemetry()
            return self._listen_for_commands()
        return True

    def _push_telemetry(self):
        try:
            current_balance = self.training_env.get_attr('current_balance')[0]
            supabase.table("training_logs").insert({
                "step": self.num_timesteps,
                "house_profit": float(self.total_profit), 
                "player_money": float(current_balance),    
                "win_rate": float((self.wins/self.games)*100 if self.games>0 else 0),
                "counter_usage": float((self.counter_uses/self.games)*100 if self.games>0 else 0),
                "refill_count": int(self.total_refills)
            }).execute()
        except Exception: pass

    def _listen_for_commands(self) -> bool:
        try:
            res = supabase.table("system_commands").select("*").eq("processed", False).order("id", desc=False).execute()
            for cmd in res.data:
                action = cmd['command']
                cmd_id = cmd['id']
                print(f"\\n[!] COMMAND DETECTED: {action}")
                supabase.table("system_commands").update({"processed": True}).eq("id", cmd_id).execute()
                if action == 'STOP_TRAINING':
                    print("[SHUTDOWN] Saving and stopping...")
                    save_and_upload(self.model, "manual_stop")
                    return False 
                elif action == 'RELOAD_CONFIG':
                    cfg_res = supabase.table("game_configs").select("*").order("id", desc=True).limit(1).execute()
                    if cfg_res.data:
                        self.training_env.env_method("update_config", cfg_res.data[0])
            return True 
        except Exception as e:
            print(f"Listener Error: {e}")
            return True

def save_and_upload(model, suffix):
    fname = f"model_{time.strftime('%H%M')}_{suffix}.zip"
    model.save(fname)
    try:
        with open(fname, "rb") as f:
            supabase.storage.from_("models").upload(fname, f)
    except Exception: pass

def start_training():
    res = supabase.table("game_configs").select("*").order("id", desc=True).limit(1).execute()
    if not res.data: return
    cfg = res.data[0]
    env = BlackjackDiceEnvV89(cfg)
    model = PPO("MlpPolicy", env, verbose=0)
    print(f"[RUNNING] Training started with ID #{cfg['id']}")
    model.learn(total_timesteps=int(cfg['total_timesteps']), callback=TrainingMonitor())
    save_and_upload(model, "completed")

if __name__ == "__main__":
    start_training()
`.trim();
  };

  const handleCopyCode = () => {
    setCopying(true);
    navigator.clipboard.writeText(generateColabScript());
    setTimeout(() => setCopying(false), 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormConfig({ ...formConfig, [e.target.name]: parseFloat(e.target.value) || 0 });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    
    try {
      // 1. USE UPSERT INSTEAD OF INSERT
      // This will update the row if the ID exists in formConfig
      const { data, error } = await supabase
        .from('game_configs')
        .upsert(formConfig)
        .select()
        .single();

      if (error) {
        handleDbError(error, 'Sync Failed');
      } else {
        // 2. SEND RELOAD COMMAND TO WORKER
        await supabase.from('system_commands').insert([
          { command: 'RELOAD_CONFIG', processed: false }
        ]);

        if (data) {
          setFormConfig(data);
          setActiveConfig(data);
        }
        
        setMessage({ 
          type: 'success', 
          text: `Config #${data?.id || 'Updated'} - Changes applied live to running worker!` 
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Network error', details: err.message });
    }
    setLoading(false);
  };

  const resetToDefaults = () => {
    setFormConfig({ ...DEFAULT_CONFIG, id: formConfig.id }); // Keep ID so we update the same record
    setMessage({ type: 'success', text: 'Factory Defaults loaded (Hit Apply to save)' });
  };

  const syncWithActive = () => {
    if (activeConfig) {
      setFormConfig(activeConfig);
      setMessage({ type: 'success', text: 'Form synced with Latest Live state' });
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            Parameters Workbench
          </h2>
          <p className="text-[10px] text-gray-500 font-medium mt-1 uppercase tracking-wider">Modify active training logic or prepare new version</p>
        </div>
        <div className="flex gap-2">
          <button 
            type="button" onClick={handleStop} disabled={stopping}
            className="flex items-center gap-1.5 text-[10px] font-bold py-1.5 px-3 rounded bg-red-900/40 border border-red-700 text-red-400 hover:bg-red-900 transition-all disabled:opacity-50"
          >
            {stopping ? <Loader2 className="animate-spin w-3 h-3" /> : <Square className="w-3 h-3 fill-current" />}
            {stopping ? 'STOPPING...' : 'STOP & SAVE'}
          </button>
          <button 
            type="button" onClick={handleCopyCode}
            className={`flex items-center gap-1.5 text-[10px] font-bold py-1.5 px-3 rounded border transition-all ${copying ? 'bg-green-600 border-green-500 text-white shadow-green-900/20 shadow-lg' : 'bg-gray-900 border-gray-700 text-blue-400 hover:border-blue-500'}`}
          >
            {copying ? <ClipboardCheck className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
            {copying ? 'COPIED!' : 'GET WORKER'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Training Steps', name: 'total_timesteps', value: formConfig.total_timesteps },
            { label: 'Initial Balance', name: 'initial_player_balance', value: formConfig.initial_player_balance },
            { label: 'Bet Amount', name: 'bet_amount', value: formConfig.bet_amount },
            { label: 'Dealer Stand', name: 'dealer_stand', value: formConfig.dealer_stand },
            { label: 'Win Payout', name: 'win_payout', value: formConfig.win_payout },
            { label: 'Counter Fee', name: 'counter_fee', value: formConfig.counter_fee },
            { label: 'Counter Payout', name: 'counter_win_payout', value: formConfig.counter_win_payout },
            { label: 'Max Bal Ref', name: 'max_balance_ref', value: formConfig.max_balance_ref },
            { label: 'Refill Penalty', name: 'refill_penalty', value: formConfig.refill_penalty },
          ].map((field) => (
            <div key={field.name} className="space-y-1 group">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{field.label}</label>
                {activeConfig && (activeConfig as any)[field.name] === field.value && (
                  <span className="text-[8px] text-green-400 font-bold flex items-center gap-0.5 animate-in fade-in zoom-in">
                    <CheckCircle2 className="w-2 h-2" /> LIVE
                  </span>
                )}
              </div>
              <input 
                type="number" 
                name={field.name} 
                value={field.value} 
                onChange={handleChange} 
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none group-hover:border-gray-500 transition-colors" 
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button 
            type="button" 
            onClick={syncWithActive}
            className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold py-2.5 rounded bg-gray-700 hover:bg-gray-600 text-white transition-all border border-gray-600 shadow-lg"
          >
            <RefreshCw className="w-3 h-3" />
            DISCARD EDITS & SYNC
          </button>
          <button 
            type="button" 
            onClick={resetToDefaults}
            className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold py-2.5 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-all border border-gray-700 shadow-lg"
          >
            <RotateCcw className="w-3 h-3" />
            RESET TO FACTORY
          </button>
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          className="w-full flex justify-center items-center gap-2 text-white font-black py-4 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 border-t border-blue-400/20 mt-4"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
          {formConfig.id ? 'SAVE & BROADCAST CHANGES' : 'CREATE INITIAL CONFIG'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-700">
        <div className="bg-black/40 border border-blue-900/40 rounded-xl p-4 flex flex-col gap-4 shadow-inner relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600/50"></div>
          
          <div className="flex items-center justify-between border-b border-blue-900/20 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
                <Zap className="w-4 h-4 text-blue-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  Active Database State
                  <span className="flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
                </h3>
                <p className="text-[9px] text-gray-500 font-mono mt-0.5 uppercase">
                  Record ID: <span className="text-gray-300">#{activeConfig?.id || '---'}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest hidden sm:inline">Real-time Connection: Active</span>
              <button 
                onClick={() => fetchLatestConfig(false)}
                className="flex items-center gap-2 text-[10px] font-bold text-gray-400 hover:text-blue-400 transition-colors bg-gray-900/50 px-3 py-1.5 rounded border border-gray-700"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                SYNC UI
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'BET', val: activeConfig?.bet_amount },
              { label: 'STAND', val: activeConfig?.dealer_stand },
              { label: 'WIN PAY', val: activeConfig?.win_payout },
              { label: 'FEE', val: activeConfig?.counter_fee },
              { label: 'REF BAL', val: activeConfig?.max_balance_ref },
              { label: 'STEPS', val: activeConfig?.total_timesteps ? `${(activeConfig.total_timesteps / 1000).toFixed(0)}k` : '---' }
            ].map((stat, i) => (
              <div key={i} className="bg-gray-950/40 p-2 rounded border border-gray-800/50 flex flex-col items-center transition-all group-hover:border-blue-900/40">
                <span className="block text-[8px] uppercase font-bold text-gray-600 tracking-tighter">{stat.label}</span>
                <span className="block text-[11px] font-mono font-bold text-blue-300 tabular-nums">{stat.val ?? '---'}</span>
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between text-[9px] text-gray-500 font-mono italic">
            <span className="flex items-center gap-2">
              <Clock className="w-2.5 h-2.5" />
              Last DB Update: {activeConfig?.created_at ? new Date(activeConfig.created_at).toLocaleTimeString() : '---'}
            </span>
            <span className="text-blue-900 font-bold uppercase tracking-widest opacity-40">Stable-Baselines3 V8.9 Context</span>
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-4 p-4 rounded-lg border flex flex-col gap-2 animate-in fade-in zoom-in duration-200 bg-gray-900/50 border-blue-500/20 shadow-lg">
          <div className="flex items-start gap-3">
            <div className={`p-1 rounded-full ${message.type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <AlertCircle className={`w-4 h-4 ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <div className="flex-1">
              <p className={`text-xs font-bold ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>{message.text}</p>
              {message.details && <p className="text-[10px] mt-1 font-mono text-gray-500 break-all">{message.details}</p>}
            </div>
            <button onClick={() => setMessage(null)} className="text-gray-600 hover:text-white transition-colors"><XCircle className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
                {resumeModelName ? (
                  <div className="flex-1 md:flex-none flex items-center justify-between md:justify-start gap-2 bg-blue-900/40 border border-blue-500/50 px-3 py-2 rounded-lg text-blue-200 text-xs shadow-lg">
                    <div className="flex items-center gap-2">
                        <RotateCcw className="w-3 h-3" />
                        <span className="truncate max-w-[150px] md:max-w-xs">Resume: <strong>{resumeModelName}</strong></span>
                    </div>
                    <button onClick={onClearResume} className="hover:text-white bg-blue-700/50 p-1 rounded-full transition-colors" title="Clear Resume Mode">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 md:flex-none flex items-center gap-2 bg-green-900/40 border border-green-500/50 px-3 py-2 rounded-lg text-green-200 text-xs shadow-lg">
                    <Sparkles className="w-3 h-3" />
                    Fresh Start Mode
                  </div>
                )}
                
                <button 
                  onClick={onClearResume}
                  className="whitespace-nowrap flex items-center gap-1.5 bg-purple-900/50 border border-purple-700 px-3 py-2 rounded-lg text-purple-300 text-xs hover:border-purple-500 hover:text-purple-200 transition-all font-semibold"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Session
                </button>
            </div>

            <button 
              onClick={() => setShowSqlSetup(!showSqlSetup)}
              className={`w-full md:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all border ${showSqlSetup ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-900/50 border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400'}`}
            >
              <Terminal className="w-3 h-3" />
              Environment Info
              {showSqlSetup ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
