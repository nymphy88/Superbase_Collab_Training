
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { GameConfig } from '../types';
import { Save, Loader2, RotateCcw, Database, AlertCircle, FileText, ClipboardCheck, Square, XCircle, Info, Sparkles, Terminal, ShieldCheck } from 'lucide-react';

interface ConfigPanelProps {
  resumeModelName?: string | null;
  onClearResume?: () => void;
}

const DEFAULT_CONFIG: GameConfig = {
  initial_player_balance: 200000.0,
  bet_amount: 100.0,
  counter_fee: 50.0,
  win_payout: 200.0,
  counter_win_payout: 350.0,
  dealer_stand: 17,
  total_timesteps: 1000000,
};

const ConfigPanel: React.FC<ConfigPanelProps> = ({ resumeModelName, onClearResume }) => {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showSqlSetup, setShowSqlSetup] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; details?: string; isSchemaError?: boolean } | null>(null);

  useEffect(() => {
    fetchLatestConfig();
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

  const fetchLatestConfig = async () => {
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
        setConfig(data);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Connection Error', details: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!confirm('Broadcast STOP command? The trainer will save and shut down.')) return;
    setStopping(true);
    setMessage(null);
    try {
      const { error } = await supabase.from('system_commands').insert([
        { command: 'STOP_TRAINING', processed: false }
      ]);
      
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
# BLACKJACK DICE V8.6 - SUPABASE WORKER SCRIPT
# ===================================================================
# Features: Real-time logging, System commands, and Model Resumption
# ===================================================================

!pip install supabase gymnasium stable-baselines3 shimmy -q

import os, time, numpy as np
import gymnasium as gym
from gymnasium import spaces
from supabase import create_client, Client
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback

# --- SUPABASE CONFIG ---
URL = "${url}"
KEY = "${key}"
# RESUME_FROM determines if we start fresh or load an existing model
RESUME_FROM = ${resumeModelValue}

supabase: Client = create_client(URL, KEY)

class BlackjackDiceEnvV86(gym.Env):
    def __init__(self, config):
        super().__init__()
        self.cfg = config
        self.action_space = spaces.Discrete(3) 
        self.observation_space = spaces.Box(low=0, high=1000000, shape=(4,), dtype=np.float32)
        self.current_balance = float(self.cfg['initial_player_balance'])
        self.reset()

    def _roll(self, count=1):
        return sum(np.random.randint(1, 7) for _ in range(count))

    def _get_obs(self):
        return np.array([float(self.player_sum), float(self.dealer_visible), float(self.counter_available), float(self.current_balance)], dtype=np.float32)

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
        info = {'counter_triggered': False, 'refilled': False}
        if action == 2:
            if self.player_sum >= 15 and self.counter_available > 0:
                fee = float(self.cfg.get('counter_fee', 0))
                self.current_balance -= fee
                self.counter_enabled = True
                self.counter_available = 0
                info['counter_triggered'] = True
                obs, reward, done, trunc, info = self._dealer_turn(info)
                return obs, (reward - fee), done, trunc, info
            else:
                return self._get_obs(), -0.1, False, False, info
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
        else:
            if self.counter_enabled:
                new_sum = self.player_sum + self._roll(1)
                if new_sum == 21: return self._end_game(float(self.cfg['counter_win_payout']), info)
                elif self.dealer_sum > 21 or new_sum > self.dealer_sum: return self._end_game(10.0, info)
                else: return self._end_game(-(float(self.cfg['bet_amount']) * 1.5), info)
            return self._end_game(-float(self.cfg['bet_amount']), info)

    def _end_game(self, reward, info):
        self.current_balance += reward
        if self.current_balance < float(self.cfg['bet_amount']):
            self.current_balance = float(self.cfg['initial_player_balance'])
            info['refilled'] = True
        return self._get_obs(), float(reward), True, False, info

class TrainingMonitor(BaseCallback):
    def __init__(self, check_freq=200):
        super().__init__()
        self.check_freq = check_freq
        self.total_profit = 0
        self.wins = 0
        self.games = 0
        self.counter_uses = 0
        self.total_refills = 0

    def _on_step(self) -> bool:
        reward = self.locals['rewards'][0]
        info = self.locals['infos'][0]
        
        # Round reward to nearest integer before accumulating profit
        self.total_profit -= int(round(reward))
        
        if reward > 0: self.wins += 1
        if info.get('counter_triggered'): self.counter_uses += 1
        if info.get('refilled'): self.total_refills += 1
        self.games += 1

        if self.n_calls % self.check_freq == 0:
            self._push_telemetry()
            # If this returns False, training loop stops gracefully
            return self._listen_for_commands()
        return True

    def _push_telemetry(self):
        try:
            current_balance = self.training_env.get_attr('current_balance')[0]
            supabase.table("training_logs").insert({
                "step": self.n_calls,
                "house_profit": int(self.total_profit), # Send as INT
                "player_money": int(current_balance),
                "win_rate": float((self.wins/self.games)*100 if self.games>0 else 0),
                "counter_usage": float((self.counter_uses/self.games)*100 if self.games>0 else 0),
                "refill_count": int(self.total_refills)
            }).execute()
        except Exception: pass

    def _listen_for_commands(self) -> bool:
        try:
            # Fetch all unprocessed commands
            res = supabase.table("system_commands")\\
                .select("*")\\
                .eq("processed", False)\\
                .order("id", desc=False)\\
                .execute()
                
            for cmd in res.data:
                action = cmd['command']
                cmd_id = cmd['id']
                print(f"\\n[!] EXECUTING: {action}")
                
                # Mark as processed immediately
                supabase.table("system_commands").update({"processed": True}).eq("id", cmd_id).execute()

                if action == 'STOP_TRAINING':
                    print("[SHUTDOWN] Force stopping...")
                    save_and_upload(self.model, "manual_stop")
                    return False # Return False to stop Stable Baselines loop
                
                elif action == 'SAVE_MODEL':
                    save_and_upload(self.model, "snapshot")
            
            return True # Continue training
        except Exception as e:
            print(f"Listener Error: {e}")
            return True

def save_and_upload(model, suffix):
    fname = f"model_{time.strftime('%H%M')}_{suffix}.zip"
    model.save(fname)
    print(f"[*] Model saved locally as {fname}")
    try:
        with open(fname, "rb") as f:
            supabase.storage.from_("models").upload(fname, f)
        print(f"[SUCCESS] Model uploaded to Supabase Storage: {fname}")
    except Exception as e:
        print(f"[ERROR] Storage Upload Failed: {e}")

def start_training():
    # 1. Fetch latest config
    res = supabase.table("game_configs").select("*").order("id", desc=True).limit(1).execute()
    if not res.data:
        print("[ERROR] No configuration found. Save a config in the Control Center first.")
        return
    
    cfg = res.data[0]
    print(f"[*] Starting session with Config ID: {cfg['id']}")
    
    # 2. Setup Environment
    env = BlackjackDiceEnvV86(cfg)
    
    # 3. Handle Resumption Logic
    if RESUME_FROM and RESUME_FROM != "None":
        print(f"[*] Attempting to resume from Supabase: {RESUME_FROM}")
        try:
            model_data = supabase.storage.from_("models").download(RESUME_FROM)
            with open("resume_model.zip", "wb") as f:
                f.write(model_data)
            model = PPO.load("resume_model.zip", env=env)
            print("[SUCCESS] Model loaded successfully.")
        except Exception as e:
            print(f"[WARNING] Could not resume model ({e}). Starting fresh instead.")
            model = PPO("MlpPolicy", env, verbose=0)
    else:
        print("[*] Starting fresh training (Random Initialization)")
        model = PPO("MlpPolicy", env, verbose=0)
    
    # 4. Begin Learning Loop
    print(f"[RUNNING] Training for {cfg['total_timesteps']} steps...")
    model.learn(total_timesteps=int(cfg['total_timesteps']), callback=TrainingMonitor())
    
    # 5. Final Save
    save_and_upload(model, "completed")
    print("[DONE] Training complete.")

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
    setConfig({ ...config, [e.target.name]: parseFloat(e.target.value) || 0 });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { id, created_at, ...data } = config;
    try {
      const { error } = await supabase.from('game_configs').insert([data]);
      if (error) {
        handleDbError(error, 'Update Failed');
      } else {
        setMessage({ type: 'success', text: 'New configuration active!' });
        fetchLatestConfig();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Network error', details: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            V8.6 Training Engine
          </h2>
          <div className="flex gap-2 mt-2">
            {resumeModelName ? (
              <div className="flex items-center gap-2 bg-blue-900/40 border border-blue-500/50 px-3 py-1.5 rounded-full text-blue-200 text-xs shadow-lg animate-pulse">
                <RotateCcw className="w-3 h-3" />
                Resume Mode: <strong>{resumeModelName}</strong>
                <button onClick={onClearResume} className="hover:text-white ml-1 bg-blue-700/50 p-0.5 rounded-full transition-colors">
                  <XCircle className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-green-900/40 border border-green-500/50 px-3 py-1.5 rounded-full text-green-200 text-xs shadow-lg">
                <Sparkles className="w-3 h-3" />
                Fresh Start Mode
              </div>
            )}
            <button 
              onClick={() => setShowSqlSetup(!showSqlSetup)}
              className="flex items-center gap-1.5 bg-gray-900/50 border border-gray-700 px-3 py-1.5 rounded-full text-gray-400 text-xs hover:border-blue-500 hover:text-blue-400 transition-all"
            >
              <Terminal className="w-3 h-3" />
              Environment Info
            </button>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
            type="button" onClick={handleStop} disabled={stopping}
            className="flex items-center gap-1.5 text-[10px] font-bold py-1.5 px-3 rounded bg-red-900/40 border border-red-700 text-red-400 hover:bg-red-900 transition-all disabled:opacity-50"
          >
            {stopping ? <Loader2 className="animate-spin w-3 h-3" /> : <Square className="w-3 h-3 fill-current" />}
            STOP & SAVE
          </button>
           <button 
            type="button" onClick={handleCopyCode}
            className={`flex items-center gap-1.5 text-[10px] font-bold py-1.5 px-3 rounded border transition-all ${copying ? 'bg-green-600 border-green-500 text-white shadow-green-900/20 shadow-lg' : 'bg-gray-900 border-gray-700 text-blue-400 hover:border-blue-500'}`}
          >
            {copying ? <ClipboardCheck className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
            {copying ? 'SCRIPT COPIED!' : 'GET WORKER SCRIPT'}
          </button>
        </div>
      </div>

      {showSqlSetup && (
        <div className="mb-6 bg-gray-950 border border-blue-900/50 rounded-lg p-4 font-mono text-xs overflow-hidden group">
          <div className="flex justify-between items-center mb-2">
            <span className="text-blue-400 flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" />
              DATABASE SCHEMA REQUIREMENTS
            </span>
          </div>
          <div className="text-gray-400 space-y-1">
            <p><strong>game_configs:</strong> Needs id, initial_player_balance, bet_amount, dealer_stand, total_timesteps...</p>
            <p><strong>training_logs:</strong> Needs step, house_profit, player_money, win_rate, counter_usage...</p>
            <p><strong>system_commands:</strong> Needs id, command (text), processed (boolean)</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Training Steps</label>
            <input type="number" name="total_timesteps" value={config.total_timesteps} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Initial Balance</label>
            <input type="number" name="initial_player_balance" value={config.initial_player_balance} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Bet Amount</label>
            <input type="number" name="bet_amount" value={config.bet_amount} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Dealer Stand</label>
            <input type="number" name="dealer_stand" value={config.dealer_stand} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-lg border flex flex-col gap-2 ${message.type === 'success' ? 'bg-green-900/30 border-green-500/50 text-green-200' : 'bg-red-900/30 border-red-500/50 text-red-200'}`}>
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`} />
              <div className="flex-1">
                <p className="text-sm font-bold">{message.text}</p>
                {message.details && <p className="text-xs mt-1 font-mono opacity-80 break-all">{message.details}</p>}
              </div>
            </div>
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading} 
          className="w-full flex justify-center items-center gap-2 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg bg-blue-600 hover:bg-blue-500"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
          Apply Config & Update Workers
        </button>
      </form>
    </div>
  );
};

export default ConfigPanel;
