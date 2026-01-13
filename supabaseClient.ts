
import { createClient } from '@supabase/supabase-js';

// แทนที่ค่าเหล่านี้ด้วยค่าจาก Supabase Dashboard ของคุณ
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://besukzaogasvsefpmsce.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_YuQcGRwxs8XHkLY3ibimLA_q7x6_oRv';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
