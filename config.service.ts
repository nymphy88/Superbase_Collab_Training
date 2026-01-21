
import { supabase } from './supabaseClient';
import { GameConfig } from './types';

export const configService = {
  async checkTunnelStatus(): Promise<{ exists: boolean; url?: string }> {
    try {
      const { data, error } = await supabase
        .from('tunnels')
        .select('url')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return { exists: !!data, url: data?.url };
    } catch (e) {
      console.error("Failed to check tunnel status", e);
      return { exists: false };
    }
  },

  async getLatestTunnelUrl(): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('tunnels')
        .select('url')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return data?.url || null;
    } catch (e) {
      return null;
    }
  },

  async fetchLatest() {
    return await supabase
      .from('game_configs')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
  },

  async deployNewConfig(formConfig: GameConfig) {
    const payload: any = {
      initial_player_balance: formConfig.initial_player_balance,
      bet_amount: formConfig.bet_amount,
      counter_fee: formConfig.counter_fee,
      win_payout: formConfig.win_payout,
      counter_win_payout: formConfig.counter_win_payout,
      dealer_stand: formConfig.dealer_stand,
      total_timesteps: formConfig.total_timesteps,
      max_balance_ref: formConfig.max_balance_ref,
      refill_penalty: formConfig.refill_penalty
    };

    const { data, error } = await supabase
      .from('game_configs')
      .insert([payload])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateConfig(id: number, formConfig: GameConfig) {
    const payload: any = {
      initial_player_balance: formConfig.initial_player_balance,
      bet_amount: formConfig.bet_amount,
      counter_fee: formConfig.counter_fee,
      win_payout: formConfig.win_payout,
      counter_win_payout: formConfig.counter_win_payout,
      dealer_stand: formConfig.dealer_stand,
      total_timesteps: formConfig.total_timesteps,
      max_balance_ref: formConfig.max_balance_ref,
      refill_penalty: formConfig.refill_penalty
    };

    const { data, error } = await supabase
      .from('game_configs')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async sendCommand(command: string, payload: any) {
    const { error } = await supabase
      .from('system_commands')
      .insert([{ command, payload, processed: false }]);
    
    if (error) throw error;
  },

  async stopTraining() {
    const { error } = await supabase
      .from('system_commands')
      .insert([{ command: 'STOP_TRAINING', payload: { timestamp: new Date().toISOString() }, processed: false }]);
    if (error) throw error;
  },

  async triggerNgrok(endpoint: string, payload: any) {
    const activeUrl = await this.getLatestTunnelUrl();
    
    if (!activeUrl) {
      throw new Error('ENGINE_UNLINKED');
    }
    
    try {
      const baseUrl = activeUrl.endsWith('/') ? activeUrl.slice(0, -1) : activeUrl;
      const targetUrl = `${baseUrl}${endpoint}`; 
      
      console.log(`📡 Attempting direct link to: ${targetUrl}`);
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true' 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }
      return await response.json();
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
        throw new Error('NETWORK_ERROR: Engine server is offline or CORS is blocked.');
      }
      throw e;
    }
  }
};
