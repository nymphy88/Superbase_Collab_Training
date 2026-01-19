
import React from 'react';

export interface GameConfig {
  id?: number;
  created_at?: string;
  initial_player_balance: number;
  bet_amount: number;
  counter_fee: number;
  win_payout: number;
  counter_win_payout: number;
  dealer_stand: number;
  total_timesteps: number;
  max_balance_ref?: number;
  refill_penalty?: number;
}

export interface TrainingLog {
  id: number;
  created_at: string;
  step: number;
  house_profit: number;
  player_money: number;
  win_rate: number;
  counter_usage: number;
  refill_count: number;
}

export interface SystemCommand {
  id?: number;
  created_at?: string;
  command: string;
  payload?: any;
  processed: boolean;
}

export interface ModelFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: any;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export interface DiagnosticLog {
  timestamp: string;
  type: 'INFO' | 'CMD' | 'DATA' | 'ERROR' | 'SUCCESS';
  message: string;
  payload?: any;
}

export interface ConnectionStatus {
  supabase: 'ONLINE' | 'OFFLINE' | 'PENDING';
  realtime: 'CONNECTED' | 'DISCONNECTED' | 'JOINING';
  storage: 'READY' | 'ERROR' | 'CHECKING';
  tables: 'SYNCED' | 'ERROR' | 'CHECKING';
}
