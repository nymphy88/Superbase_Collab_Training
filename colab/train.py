
# QuantumWaste AI - Evolutionary Training Worker v9.0
# This script handles real-time signals and graceful termination.

import os
import time
import threading
import subprocess
import traceback
import numpy as np
import gymnasium as gym
from gymnasium import spaces
from datetime import datetime

# --- STEP 1: Dependency Management ---
def install_dependencies():
    required = ["supabase", "stable-baselines3", "shimmy", "gymnasium", "flask", "flask-cors"]
    try:
        installed = subprocess.check_output(["pip", "freeze"]).decode("utf-8")
        for lib in required:
            if lib not in installed:
                print(f"📦 Installing {lib}...")
                subprocess.run(["pip", "install", lib, "-q"], check=True)
    except Exception as e:
        print(f"⚠️ Dependency check failed: {e}")

install_dependencies()

# --- STEP 2: Imports & Initialization ---
from flask import Flask, request, jsonify
from flask_cors import CORS
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from supabase import create_client

# Supabase Credentials
URL = "https://besukzaogasvsefpmsce.supabase.co"
KEY = "sb_publishable_YuQcGRwxs8XHkLY3ibimLA_q7x6_oRv" 
supabase = create_client(URL, KEY)

# Global control flags
training_flags = {"stop": False, "active": False, "config_id": None}

# --- STEP 3: Flask Control Server ---
app = Flask(__name__)
CORS(app)

@app.route('/start', methods=['POST'])
def handle_start():
    data = request.json
    config_id = data.get('config_id')
    print(f"\n📡 [SIGNAL] Start Triggered: {config_id}")
    training_flags['active'] = True
    training_flags['stop'] = False
    training_flags['config_id'] = config_id
    return jsonify({"status": "starting"}), 200

@app.route('/stop', methods=['POST'])
def handle_stop():
    print(f"\n🛑 [SIGNAL] Stop Triggered")
    training_flags['stop'] = True
    return jsonify({"status": "stopping"}), 200

@app.route('/status', methods=['GET'])
def handle_status():
    return jsonify(training_flags), 200

def run_server():
    print("🛰️ Control interface active on port 5000...")
    app.run(port=5000, host='0.0.0.0', debug=False, use_reloader=False)

# --- STEP 4: Environment Definition ---
class BlackjackDiceEnv(gym.Env):
    def __init__(self, config):
        super(BlackjackDiceEnv, self).__init__()
        self.config = config or {}
        self.action_space = spaces.Discrete(3)
        self.observation_space = spaces.Box(
            low=np.array([0, 0, 0]), 
            high=np.array([31, 31, 10000000]), 
            dtype=np.float32
        )
        self.reset_stats()

    def _get_cfg(self, key, default):
        val = self.config.get(key)
        return val if val is not None else default

    def reset_stats(self):
        self.player_money = float(self._get_cfg('initial_player_balance', 200000.0))
        self.house_profit = 0.0
        self.refill_count = 0
        self.steps = 0
        self.wins = 0
        self.counter_hits = 0

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.player_hand = np.random.randint(2, 12)
        self.dealer_hand = np.random.randint(2, 12)
        obs = np.array([self.player_hand, self.dealer_hand, self.player_money], dtype=np.float32)
        return obs, {}

    def step(self, action):
        self.steps += 1
        reward = 0.0
        terminated = False
        
        bet = float(self._get_cfg('bet_amount', 100.0))
        win_payout = float(self._get_cfg('win_payout', 200.0))
        counter_fee = float(self._get_cfg('counter_fee', 50.0))
        dealer_stand = int(self._get_cfg('dealer_stand', 17))
        refill_penalty = float(self._get_cfg('refill_penalty', -500.0))
        
        if action == 1: # Hit
            self.player_hand += np.random.randint(1, 7)
        elif action == 2: # Use Counter
            self.player_money -= counter_fee
            self.counter_hits += 1
            
        if self.player_hand > 21:
            reward = -bet
            self.player_money -= bet
            self.house_profit += bet
            terminated = True
        elif action == 0: # Stand
            while self.dealer_hand < dealer_stand:
                self.dealer_hand += np.random.randint(1, 7)
            
            if self.dealer_hand > 21 or self.player_hand > self.dealer_hand:
                reward = win_payout
                self.player_money += win_payout
                self.house_profit -= win_payout
                self.wins += 1
            else:
                reward = -bet
                self.player_money -= bet
                self.house_profit += bet
            terminated = True

        if self.player_money < bet:
            self.player_money = float(self._get_cfg('initial_player_balance', 200000.0))
            reward += refill_penalty
            self.refill_count += 1

        obs = np.array([self.player_hand, self.dealer_hand, self.player_money], dtype=np.float32)
        return obs, float(reward), terminated, False, {}

# --- STEP 5: Training Logic ---
class DashboardCallback(BaseCallback):
    def __init__(self, env, verbose=0):
        super(DashboardCallback, self).__init__(verbose)
        self.env_ref = env
        self.last_db_check = 0

    def _on_step(self) -> bool:
        # Check stop signal from Flask
        if training_flags['stop']:
            print("⚠️ [STOP] Signal received via Flask. Terminating loop...")
            return False
            
        # Periodic database check (every 500 steps)
        if self.num_timesteps - self.last_db_check > 500:
            self.last_db_check = self.num_timesteps
            try:
                res = supabase.table("system_commands")\
                    .select("*")\
                    .eq("processed", False)\
                    .eq("command", "STOP_TRAINING")\
                    .order("id", desc=True)\
                    .limit(1)\
                    .execute()
                if res.data:
                    print("🛑 [STOP] Signal found in Database. Cleaning up...")
                    supabase.table("system_commands").update({"processed": True}).eq("id", res.data[0]['id']).execute()
                    return False
            except:
                pass

        if self.num_timesteps % 200 == 0:
            self._sync_to_dashboard()
        return True

    def _sync_to_dashboard(self):
        env = self.env_ref
        wr = (env.wins / max(1, env.steps)) * 100
        cu = (env.counter_hits / max(1, env.steps)) * 100
        data = {
            "step": int(self.num_timesteps),
            "house_profit": float(env.house_profit),
            "player_money": float(env.player_money),
            "win_rate": float(wr),
            "counter_usage": float(cu),
            "refill_count": int(env.refill_count)
        }
        try:
            supabase.table("training_logs").insert(data).execute()
        except:
            pass

def run_training_cycle(config_id):
    try:
        print(f"🔍 Loading Context: v{config_id}")
        res = supabase.table("game_configs").select("*").eq("id", config_id).single().execute()
        config = res.data
        if not config: return

        env = BlackjackDiceEnv(config)
        model = PPO("MlpPolicy", env, verbose=0)
        callback = DashboardCallback(env)
        
        total_steps = int(config.get('total_timesteps') or 1000000)
        print(f"🚀 Training Active...")
        model.learn(total_timesteps=total_steps, callback=callback)
        print(f"✅ Training Session Ended.")
    except Exception as e:
        print(f"❌ Failure: {e}")
        traceback.print_exc()
    finally:
        training_flags['active'] = False
        training_flags['stop'] = False

# --- MAIN LOOP ---
if __name__ == "__main__":
    print("\n--- QUANTUMWASTE AI v9.0 INITIALIZED ---")
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()
    
    while True:
        try:
            if training_flags['active'] and training_flags['config_id']:
                cfg_id = training_flags['config_id']
                training_flags['config_id'] = None 
                run_training_cycle(cfg_id)
            
            # Polling for new training tasks
            res = supabase.table("system_commands")\
                .select("*")\
                .eq("processed", False)\
                .eq("command", "START_TRAINING")\
                .order("id", desc=True)\
                .limit(1)\
                .execute()
            
            if res.data:
                cmd = res.data[0]
                config_id = cmd.get('payload', {}).get('config_id')
                supabase.table("system_commands").update({"processed": True}).eq("id", cmd['id']).execute()
                run_training_cycle(config_id)
                
        except Exception as e:
            print(f"🚨 Loop Error: {e}")
        
        time.sleep(5)
