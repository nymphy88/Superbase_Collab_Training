
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { GameConfig } from '../types';
import { Save, Loader2, RotateCcw, Database, AlertCircle, FileText, ClipboardCheck, Square, XCircle, Info, Sparkles, Terminal, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

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
    // Removed window.confirm() to prevent sandbox blocking issues
    setStopping(true);
    setMessage(null);
    try {
      // STUDIO VERIFIED SNIPPET: Send STOP_TRAINING command
      const { error } = await supabase
        .from('system_commands')
        .insert([
          { 
            command: 'STOP_TRAINING', 
            processed: false 
          }
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
# BLACKJACK DICE V8.9 (RESUME FIX) - SUPABASE WORKER SCRIPT
# ===================================================================
# Features: Real-time logging, System commands, Model Resumption
# Fix: reset_num_timesteps=False on resume, Continuous Step Counting
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

class BlackjackDiceEnvV89(gym.Env):
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
        # Normalize balance (0-1) relative to max_balance_ref
        max_bal = float(self.cfg.get('max_balance_ref', 2000.0))
        norm_balance = self.current_balance / max_bal
        return np.array([
            float(self.player_sum) / 30.0,    # Normalized Player Sum (approx max 30)
            float(self.dealer_visible) / 6.0, # Normalized Dealer Visible
            float(self.counter_available),    # Counter Availability (0 or 1)
            float(norm_balance)               # Normalized Balance
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
        # Initialize info with money_change tracker (Real Money, not Reward)
        info = {'counter_triggered': False, 'refilled': False, 'money_change': 0.0}
        
        if action == 2:
            if self.player_sum >= 15 and self.counter_available > 0:
                fee = float(self.cfg.get('counter_fee', 0))
                self.current_balance -= fee
                # Track the fee as negative money flow
                info['money_change'] -= fee
                
                self.counter_enabled = True
                self.counter_available = 0
                info['counter_triggered'] = True
                
                obs, reward, done, trunc, info = self._dealer_turn(info)
                # Return reward (which includes game result) minus fee
                return obs, (reward - fee), done, trunc, info
            else:
                # Invalid move: No money change, just heavy penalty to learn
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
        
        # KEY FIX: Log the actual financial result BEFORE adding refill penalty
        # If we came from Action 2 (Counter), money_change might already have -fee
        if 'money_change' not in info: info['money_change'] = 0.0
        info['money_change'] += money_gain_loss

        final_reward = money_gain_loss

        if self.current_balance < float(self.cfg['bet_amount']):
            self.current_balance = float(self.cfg['initial_player_balance'])
            info['refilled'] = True
            # Refill penalty is purely for RL (Education), not Financial
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
        reward = self.locals['rewards'][0]
        info = self.locals['infos'][0]
        
        # KEY FIX: House Profit = -(Player Money Change)
        # We ignore the RL 'reward' (which has penalties) and look at 'money_change'
        player_money_change = info.get('money_change', 0.0)
        self.total_profit -= player_money_change 
        
        if reward > 0: self.wins += 1
        if info.get('counter_triggered'): self.counter_uses += 1
        if info.get('refilled'): self.total_refills += 1
        self.games += 1

        if self.n_calls % self.check_freq == 0:
            self._push_telemetry()
            return self._listen_for_commands()
        return True

    def _push_telemetry(self):
        try:
            current_balance = self.training_env.get_attr('current_balance')[0]
            # UPDATED: Use self.num_timesteps for continuous step counting when resuming
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
            res = supabase.table("system_commands")\\
                .select("*")\\
                .eq("processed", False)\\
                .order("id", desc=False)\\
                .execute()
                
            for cmd in res.data:
                action = cmd['command']
                cmd_id = cmd['id']
                print(f"\\n[!] EXECUTING: {action}")
                
                supabase.table("system_commands").update({"processed": True}).eq("id", cmd_id).execute()

                if action == 'STOP_TRAINING':
                    print("[SHUTDOWN] Force stopping...")
                    save_and_upload(self.model, "manual_stop")
                    return False 
                
                elif action == 'SAVE_MODEL':
                    save_and_upload(self.model, "snapshot")
            
            return True 
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
    res = supabase.table("game_configs").select("*").order("id", desc=True).limit(1).execute()
    if not res.data:
        print("[ERROR] No configuration found. Save a config in the Control Center first.")
        return
    
    cfg = res.data[0]
    print(f"[*] Starting session with Config ID: {cfg['id']}")
    
    env = BlackjackDiceEnvV89(cfg)
    
    reset_timesteps = True
    
    if RESUME_FROM and RESUME_FROM != "None":
        print(f"[*] Attempting to resume from Supabase: {RESUME_FROM}")
        try:
            model_data = supabase.storage.from_("models").download(RESUME_FROM)
            with open("resume_model.zip", "wb") as f:
                f.write(model_data)
            model = PPO.load("resume_model.zip", env=env)
            print("[SUCCESS] Model loaded successfully.")
            reset_timesteps = False
        except Exception as e:
            print(f"[WARNING] Could not resume model ({e}). Starting fresh instead.")
            model = PPO("MlpPolicy", env, verbose=0)
            reset_timesteps = True
    else:
        print("[*] Starting fresh training (Random Initialization)")
        model = PPO("MlpPolicy", env, verbose=0)
        reset_timesteps = True
    
    print(f"[RUNNING] Training for {cfg['total_timesteps']} steps...")
    # PASS reset_num_timesteps=reset_timesteps to control step counting logic
    model.learn(total_timesteps=int(cfg['total_timesteps']), callback=TrainingMonitor(), reset_num_timesteps=reset_timesteps)
    
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            V8.9 Training Engine
          </h2>
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
            {copying ? 'SCRIPT COPIED!' : 'GET WORKER SCRIPT'}
          </button>
        </div>
      </div>

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
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Win Payout</label>
            <input type="number" name="win_payout" value={config.win_payout} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Counter Fee</label>
            <input type="number" name="counter_fee" value={config.counter_fee} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Counter Payout</label>
            <input type="number" name="counter_win_payout" value={config.counter_win_payout} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Bal Ref</label>
            <input type="number" name="max_balance_ref" value={config.max_balance_ref || 2000} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Refill Penalty</label>
            <input type="number" name="refill_penalty" value={config.refill_penalty || -50} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
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

      {/* New Footer Section for Session Status and Info */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Session Status & Actions */}
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
                  Start New
                </button>
            </div>

            {/* Environment Info Toggle */}
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

      {showSqlSetup && (
        <div className="mt-4 bg-gray-950 border border-blue-900/50 rounded-lg p-4 font-mono text-xs overflow-hidden group space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-blue-400 flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" />
                DATABASE SCHEMA REQUIREMENTS
              </span>
            </div>
            <div className="text-gray-400 space-y-1">
              <p><strong>game_configs:</strong> Needs id, initial_player_balance, bet_amount, dealer_stand, total_timesteps...</p>
              <p className="text-blue-400"><strong>[New]</strong> max_balance_ref, refill_penalty, counter_fee, counter_win_payout</p>
              <p><strong>training_logs:</strong> Needs step, house_profit, player_money, win_rate, counter_usage...</p>
              <p><strong>system_commands:</strong> Needs id, command (text), processed (boolean)</p>
            </div>
          </div>
          
          <div className="pt-3 border-t border-gray-800/50">
             <span className="text-orange-400 flex items-center gap-2 mb-2 font-bold">
                <AlertCircle className="w-3 h-3" />
                FIX: SECURITY DEFINER WARNING
              </span>
              <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-orange-900/30">
                <code className="text-orange-200/70 truncate mr-2">ALTER FUNCTION public.system_commands_broadcast_trigger() SET search_path = public;</code>
                 <button 
                  onClick={() => {
                    navigator.clipboard.writeText("ALTER FUNCTION public.system_commands_broadcast_trigger() SET search_path = public;");
                    alert("SQL Copied!");
                  }}
                  className="text-orange-400 hover:text-white transition-colors"
                  title="Copy SQL Fix"
                >
                  <ClipboardCheck className="w-4 h-4" />
                </button>
              </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ConfigPanel;
