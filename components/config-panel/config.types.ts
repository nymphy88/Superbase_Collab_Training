import { GameConfig } from '../../types';

export interface ConfigPanelProps {
  NGROK_URL?: string; 
  resumeModelName?: string | null;
  onClearResume?: () => void;
}

export const DEFAULT_CONFIG: GameConfig = {
  NGROK_URL: "https://03541411956b.ngrok-free.app/",
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