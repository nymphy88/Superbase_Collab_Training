# QuantumWaste AI - Blackjack Dice Training Worker v8.6
import os
import time
import gymnasium as gym
from gymnasium import spaces
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from supabase import create_client

# 1. เชื่อมต่อ Supabase
URL = "https://besukzaogasvsefpmsce.supabase.co"
KEY = "sb_publishable_YuQcGRwxs8XHkLY3ibimLA_q7x6_oRv" # Replace with Service Role Key in production Colab
supabase = create_client(URL, KEY)

class DashboardCallback(BaseCallback):
    """
    SB3 Callback for real-time telemetry syncing and command listening.
    """
    def __init__(self, env, verbose=0):
        super(DashboardCallback, self).__init__(verbose)
        self.training_env_ref = env
        self.last_sync_step = 0
        self.sync_freq = 100
        self.should_stop = False

    def _on_step(self) -> bool:
        # Check commands every 10 steps to save bandwidth
        if self.num_timesteps % 10 == 0:
            self._check_remote_commands()
            if self.should_stop:
                print("🛑 STOP command received from Dashboard.")
                return False

        # Sync telemetry every sync_freq steps
        if self.num_timesteps - self.last_sync_step >= self.sync_freq:
            self._sync_telemetry()
            self.last_sync_step = self.num_timesteps
        
        return True

    def _sync_telemetry(self):
        env = self.training_env_ref
        win_rate = (env.wins / max(1, env.steps)) * 100
        counter_usage = (env.counter_hits / max(1, env.steps)) * 100
        
        data = {
            "step": self.num_timesteps,
            "house_profit": float(env.house_profit),
            "player_money": float(env.player_money),
            "win_rate": float(win_rate),
            "counter_usage": float(counter_usage),
            "refill_count": int(env.refill_count)
        }
        try:
            supabase.table("training_logs").insert(data).execute()
        except Exception as e:
            print(f"⚠️ Telemetry Sync Error: {e}")

    def _check_remote_commands(self):
        try:
            res = supabase.table("system_commands")\
                .select("*")\
                .eq("processed", False)\
                .order("id", desc=True)\
                .limit(1)\
                .execute()
            
            if res.data:
                cmd_item = res.data[0]
                cmd = cmd_item.get('command')
                
                if cmd == 'STOP_TRAINING':
                    self.should_stop = True
                elif cmd == 'SAVE_MODEL':
                    # Handle save model manually here or just acknowledge
                    print("💾 Dashboard requested model save...")
                
                # Mark as processed
                supabase.table("system_commands")\
                    .update({"processed": True})\
                    .eq("id", cmd_item['id'])\
                    .execute()
        except Exception as e:
            print(f"⚠️ Command Check Error: {e}")

class BlackjackDiceEnv(gym.Env):
    def __init__(self, config):
        super(BlackjackDiceEnv, self).__init__()
        self.config = config
        self.action_space = spaces.Discrete(3)
        self.observation_space = spaces.Box(
            low=np.array([0, 0, 0]), 
            high=np.array([31, 31, 10000]), 
            dtype=np.float32
        )
        self.reset_env()

    def reset_env(self):
        self.player_money = self.config.get('initial_player_balance', 1000.0)
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
        reward = 0
        terminated = False
        bet = self.config.get('bet_amount', 10.0)
        
        if action == 1: # Hit
            self.player_hand += np.random.randint(1, 7)
        elif action == 2: # Counter
            self.player_money -= self.config.get('counter_fee', 5.0)
            self.counter_hits += 1
            
        if self.player_hand > 21:
            reward = -bet
            self.player_money -= bet
            self.house_profit += bet
            terminated = True
        elif action == 0: # Stay
            while self.dealer_hand < self.config.get('dealer_stand', 17):
                self.dealer_hand += np.random.randint(1, 7)
            
            if self.dealer_hand > 21 or self.player_hand > self.dealer_hand:
                reward = self.config.get('win_payout', 10.0)
                self.player_money += reward
                self.house_profit -= reward
                self.wins += 1
            else:
                reward = -bet
                self.player_money -= bet
                self.house_profit += bet
            terminated = True

        if self.player_money < bet:
            self.player_money = self.config.get('max_balance_ref', 2000.0)
            reward += self.config.get('refill_penalty', -50.0)
            self.refill_count += 1

        obs = np.array([self.player_hand, self.dealer_hand, self.player_money], dtype=np.float32)
        return obs, reward, terminated, False, {}

def start_training(config_id, model_name=None):
    try:
        res = supabase.table("game_configs").select("*").eq("id", config_id).single().execute()
        config = res.data
        if not config:
            print(f"❌ Config ID {config_id} not found.")
            return

        env = BlackjackDiceEnv(config)
        
        if model_name:
            print(f"🔄 Resuming from {model_name}...")
            # model = PPO.load(model_name, env=env)
            model = PPO("MlpPolicy", env, verbose=1)
        else:
            model = PPO("MlpPolicy", env, verbose=1)
        
        callback = DashboardCallback(env)
        print("🚀 Training Started...")
        model.learn(total_timesteps=config.get('total_timesteps', 1000000), callback=callback)
        print("🏁 Training Finished.")
        
    except Exception as e:
        print(f"🔥 Critical Training Error: {e}")

if __name__ == "__main__":
    print("🛰️ AI Worker Standby. Monitoring Dashboard commands...")
    while True:
        try:
            res = supabase.table("system_commands")\
                .select("*")\
                .eq("processed", False)\
                .eq("command", "START_TRAINING")\
                .order("id", desc=True)\
                .limit(1)\
                .execute()
            
            if res.data:
                cmd = res.data[0]
                payload = cmd.get('payload', {})
                config_id = payload.get('config_id')
                model_name = payload.get('model_name')
                
                # Mark command as processed immediately
                supabase.table("system_commands")\
                    .update({"processed": True})\
                    .eq("id", cmd['id'])\
                    .execute()
                
                if config_id:
                    start_training(config_id, model_name)
                    
            time.sleep(5)
        except KeyboardInterrupt:
            print("👋 Worker shutdown.")
            break
        except Exception as e:
            print(f"⚠️ Main Loop Error: {e}")
            time.sleep(10)
