import { GameConfig } from '../../types';

export const generatePythonWorker = (formConfig: GameConfig, activeConfigId: string | number | undefined) => {
  const url = process.env.REACT_APP_SUPABASE_URL || "https://besukzaogasvsefpmsce.supabase.co";
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY || "sb_publishable_YuQcGRwxs8XHkLY3ibimLA_q7x6_oRv";
  
  return `# QuantumWaste AI - Evolutionary Worker
import os, time, json
try:
    from supabase import create_client
except:
    os.system("pip install supabase gymnasium -q")
    from supabase import create_client

URL = "${url}"
KEY = "${key}"
supabase = create_client(URL, KEY)

# ค่านี่จะเปลี่ยนตามที่คุณตั้งใน Workbench ทันที
CFG = ${JSON.stringify(formConfig, null, 2)}
CONFIG_ID = "${activeConfigId || 'NEW'}"

print(f"📡 Worker Connected | Config: {CONFIG_ID}")

# Loop รอรับคำสั่งจาก Gateway (ปุ่ม Reload/Start ใน UI)
while True:
    res = supabase.from('system_commands').select('*').eq('processed', False).order('created_at', {'ascending': False}).limit(1).execute()
    if res.data:
        cmd = res.data[0]
        print(f"📥 Command Received: {cmd['command']}")
        supabase.from('system_commands').update({'processed': True}).eq('id', cmd['id']).execute()
    time.sleep(5)
`;
};