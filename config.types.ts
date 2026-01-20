import { GameConfig } from './types';

export const DEFAULT_CONFIG: GameConfig = {
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