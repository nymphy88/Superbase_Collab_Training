import { supabase } from './supabaseClient';
import { GameConfig } from './types';

export const configService = {
  async fetchLatest() {
    return await supabase
      .from('game_configs')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
  },

  async deployNewConfig(formConfig: GameConfig) {
    const { id, created_at, ...newVersionData } = formConfig as any;
    const { data, error } = await supabase
      .from('game_configs')
      .insert([newVersionData])
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
  }
};