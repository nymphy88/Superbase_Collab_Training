
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { GameConfig } from '../types';
import { Save, Loader2, RotateCcw, Database, AlertCircle, FileText, ClipboardCheck, Square, XCircle, Info } from 'lucide-react';

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
      text: isSchemaError ? `${context}: Schema Mismatch` : context,
      details: errorMsg,
      isSchemaError
    });
  };

  const fetchLatestConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_configs')
        .select('*')
        .order('created_at', { ascending: false })
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
    if (!confirm('Stop training and save model immediately?')) return;
    setStopping(true);
    setMessage(null);
    try {
      const { error } = await supabase.from('system_commands').insert([
        { command: 'STOP_TRAINING', processed: false }
      ]);
      if (error) {
        handleDbError(error, 'Stop Command Failed');
      } else {
        setMessage({ type: 'success', text: 'Stop command sent! Saving model now...' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Stop failed', details: err.message });
    } finally {
      setStopping(false);
    }
  };

  const generateColabScript = () => {
    const url = 'https://besukzaogasvsefpmsce.supabase.co';
    const key = 'sb_publishable_YuQcGRwxs8XHkLY3ibimLA_q7x6_oRv'; 
    // Dynamically set RESUME_MODEL based on resumeModelName prop
    const resumeModel = resumeModelName ? `'${resumeModelName}'` : 'None';

    return `
# Blackjack Dice V8.6 (The Counter Logic) - Colab Worker
# Generated with Prefix: ddmm_hhmm, Mode: ${resumeModelName ? 'Resume' : 'New Train'}
# Target Model: ${resumeModelName || 'Fresh Start'}

!pip install supabase gymnasium stable-baselines3 shimmy -q

import os
import time
import numpy as np
import gymnasium as gym
from gymnasium import spaces
from supabase import create_client, Client
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback

# --- CONFIG ---
URL = "${url}"
KEY = "${key}"
RESUME_MODEL = ${resumeModel}
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
        
        # Apply Counter Fee if chosen
        if action == 2:
             self.current_balance -= float(self.cfg['counter_fee'])
             info['counter_triggered'] = True

        if action == 1: # Hit
            self.player_sum += self._roll(2)
            if self.player_sum > 21: return self._end_game(-float(self.cfg['bet_amount']), info)
        elif action == 2: # Counter
            if self.player_sum >= 15:
                self.counter_enabled = True
                return self._dealer_turn(info)
            else: return self._end_game(-float(self.cfg['bet_amount']), info)
        elif action == 0: # Stay
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

class TrainingCallback(BaseCallback):
    def __init__(self, check_freq=500):
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
        
        self.total_profit -= reward
        if reward > 0: self.wins += 1
        if info.get('counter_triggered'): self.counter_uses += 1
        if info.get('refilled'): self.total_refills += 1
        self.games += 1

        if self.n_calls % self.check_freq == 0:
            self._log_to_supabase()
            self._check_commands()
        return True

    def _log_to_supabase(self):
        try:
            supabase.table("training_logs").insert({
                "step": self.n_calls,
                "house_profit": float(self.total_profit),
                "player_money": float(self.training_env.get_attr('current_balance')[0]),
                "win_rate": float((self.wins/self.games)*100 if self.games>0 else 0),
                "counter_usage": float((self.counter_uses/self.games)*100 if self.games>0 else 0),
                "refill_count": int(self.total_refills)
            }).execute()
        except: pass

    def _check_commands(self):
        try:
            res = supabase.table("system_commands").select("*").eq("processed", False).execute()
            for cmd in res.data:
                if cmd['command'] == 'STOP_TRAINING':
                    print("Stopping signal received...")
                    save_and_upload(self.model, "stop_manual")
                    supabase.table("system_commands").update({"processed": True}).eq("id", cmd['id']).execute()
                    os._exit(0)
                elif cmd['command'] == 'SAVE_MODEL':
                    save_and_upload(self.model, "snapshot")
                    supabase.table("system_commands").update({"processed": True}).eq("id", cmd['id']).execute()
        except: pass

def save_and_upload(model, reason):
    prefix = time.strftime("%d%m_%H%M")
    filename = f"{prefix}_{reason}.zip"
    model.save(filename)
    try:
        with open(filename, "rb") as f:
            supabase.storage.from_("models").upload(filename, f)
        print(f"Model saved and uploaded: {filename}")
    except Exception as e:
        print(f"Upload failed: {e}")

def train():
    print("Fetching latest game config...")
    cfg_res = supabase.table("game_configs").select("*").order("created_at", desc=True).limit(1).execute()
    if not cfg_res.data:
        print("No config found! Please save one in the web app.")
        return
    cfg = cfg_res.data[0]
    
    env = BlackjackDiceEnvV86(cfg)
    
    if RESUME_MODEL != "None":
        print(f"Downloading model for resume: {RESUME_MODEL}...")
        try:
            with open("resume_model.zip", "wb") as f:
                res = supabase.storage.from_("models").download(RESUME_MODEL)
                f.write(res)
            model = PPO.load("resume_model.zip", env=env)
            print("Model loaded successfully.")
        except Exception as e:
            print(f"Failed to load model: {e}. Starting fresh.")
            model = PPO("MlpPolicy", env, verbose=1)
    else:
        print("Starting fresh training session.")
        model = PPO("MlpPolicy", env, verbose=1)

    try:
        print(f"Training for {cfg['total_timesteps']} timesteps...")
        model.learn(total_timesteps=int(cfg['total_timesteps']), callback=TrainingCallback())
        save_and_upload(model, "final_complete")
    except KeyboardInterrupt:
        save_and_upload(model, "interrupt")
    except Exception as e:
        print(f"Training error: {e}")
        save_and_upload(model, "crash_save")

if __name__ == "__main__":
    train()
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
        handleDbError(error, 'Save Failed');
      } else {
        setMessage({ type: 'success', text: 'Config updated and pushed to Supabase!' });
        fetchLatestConfig();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Network Error', details: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            V8.6 Control Panel
          </h2>
          {resumeModelName && (
            <div className="mt-2 flex items-center gap-2 bg-blue-900/40 border border-blue-500/50 px-3 py-1.5 rounded-full text-blue-200 text-xs shadow-lg animate-pulse">
              <RotateCcw className="w-3 h-3" />
              Resuming from: <strong>{resumeModelName}</strong>
              <button onClick={onClearResume} className="hover:text-white ml-1 bg-blue-700/50 p-0.5 rounded-full transition-colors">
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          )}
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
            {copying ? 'COPIED!' : 'COPY SCRIPT'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Timesteps</label>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Counter Fee</label>
            <input type="number" name="counter_fee" value={config.counter_fee} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Win Payout</label>
            <input type="number" name="win_payout" value={config.win_payout} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Counter Bonus</label>
            <input type="number" name="counter_win_payout" value={config.counter_win_payout} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
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
            
            {message.isSchemaError && (
              <div className="mt-2 p-3 bg-gray-900/60 rounded border border-gray-700/50 text-xs">
                <div className="flex items-center gap-2 text-blue-400 font-bold mb-1">
                  <Info className="w-3 h-3" />
                  Troubleshooting Suggestion
                </div>
                <p className="text-gray-300">
                  It looks like your Supabase table schema doesn't match the application's requirements. 
                  Please go to the <strong>Supabase SQL Editor</strong> and ensure the <code>game_configs</code> 
                  table has all required columns.
                </p>
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-blue-900/20">
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
          {resumeModelName ? 'Update Config & Resume Model' : 'Save Config & Start Training'}
        </button>
      </form>
    </div>
  );
};

export default ConfigPanel;
