
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { TrainingLog } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, Activity, AlertTriangle, List, Wallet, GripVertical, RotateCcw, Bell } from 'lucide-react';
import StatCard from './StatCard';
import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);
// BUMP VERSION TO RESET LAYOUT FOR USER
const STORAGE_KEY = 'dashboard_layout_v2_stable';

const Dashboard: React.FC = () => {
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastCommand, setLastCommand] = useState<{ text: string; id: number } | null>(null);

  // Default Grid Layout
  const initialLayouts = {
    lg: [
      { i: 'stats-profit', x: 0, y: 0, w: 3, h: 2, static: false },
      { i: 'stats-winrate', x: 3, y: 0, w: 3, h: 2 },
      { i: 'stats-refills', x: 6, y: 0, w: 3, h: 2 },
      { i: 'stats-counter', x: 9, y: 0, w: 3, h: 2 },
      { i: 'chart-profit', x: 0, y: 2, w: 6, h: 7 },
      { i: 'chart-winrate', x: 6, y: 2, w: 6, h: 7 },
      { i: 'chart-player', x: 0, y: 9, w: 12, h: 7 },
      { i: 'table-logs', x: 0, y: 16, w: 12, h: 8 },
    ]
  };

  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialLayouts;
    } catch (e) {
      return initialLayouts;
    }
  });

  const onLayoutChange = useCallback((currentLayout: any, allLayouts: any) => {
    setLayouts(allLayouts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts));
  }, []);

  const resetLayout = () => {
    setLayouts(initialLayouts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialLayouts));
  };

  useEffect(() => {
    // 1. Fetch initial history
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('training_logs')
        .select('*')
        .order('id', { ascending: false })
        .limit(50);
      
      if (data) {
        setLogs(data.reverse());
      }
    };

    fetchInitial();

    // 2. Subscribe to logs (Table Changes)
    const logsChannel = supabase
      .channel('logs-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'training_logs' },
        (payload) => {
          const newLog = payload.new as TrainingLog;
          setLogs((prev) => {
            const updated = [...prev, newLog];
            if (updated.length > 50) return updated.slice(updated.length - 50);
            return updated;
          });
        }
      )
      .subscribe();

    // 3. Subscribe to System Command Broadcasts
    const commandChannel = supabase
      .channel('system_commands')
      .on('broadcast', { event: '*' }, (payload) => {
        console.log('Broadcast received:', payload);
        if (payload.payload?.command) {
          setLastCommand({ text: payload.payload.command, id: Date.now() });
          setTimeout(() => setLastCommand(null), 5000);
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(commandChannel);
    };
  }, []);

  const latest = logs.length > 0 ? logs[logs.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Activity className="text-green-400" />
          <h2 className="text-2xl font-bold">Live Monitoring</h2>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${isConnected ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-red-900/30 border-red-500 text-red-400'}`}>
              {isConnected ? 'Realtime Connected' : 'Connecting...'}
            </span>
            {lastCommand && (
              <div className="flex items-center gap-2 bg-blue-900/40 border border-blue-500 text-blue-300 text-[10px] px-3 py-0.5 rounded-full animate-bounce shadow-lg">
                <Bell className="w-3 h-3" />
                COMMAND SENT: {lastCommand.text}
              </div>
            )}
          </div>
        </div>
        <button 
          onClick={resetLayout}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Layout
        </button>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={30}
        draggableHandle=".grid-card-header"
        onLayoutChange={onLayoutChange}
      >
        {/* Stats Section */}
        <div key="stats-profit">
          <StatCard 
            title="House Profit" 
            value={latest ? Math.floor(latest.house_profit).toLocaleString() : '0'} 
            icon={<DollarSign className="text-yellow-400 w-5 h-5" />}
            color="text-yellow-400"
          />
        </div>
        <div key="stats-winrate">
          <StatCard 
            title="Win Rate" 
            value={latest ? `${latest.win_rate.toFixed(1)}%` : '0%'} 
            icon={<TrendingUp className="text-blue-400 w-5 h-5" />}
            color="text-blue-400"
          />
        </div>
        <div key="stats-refills">
          <StatCard 
            title="Refills" 
            value={latest ? latest.refill_count : 0} 
            icon={<AlertTriangle className="text-red-400 w-5 h-5" />}
            color="text-red-400"
          />
        </div>
        <div key="stats-counter">
          <StatCard 
            title="Counter Use" 
            value={latest ? `${latest.counter_usage.toFixed(1)}%` : '0%'} 
            icon={<Activity className="text-purple-400 w-5 h-5" />}
            color="text-purple-400"
          />
        </div>

        {/* Profit Chart */}
        <div key="chart-profit" className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg flex flex-col overflow-hidden">
          <div className="grid-card-header flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800/50">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <DollarSign className="w-3 h-3 text-yellow-500" />
              House Profit
            </h3>
            <GripVertical className="w-4 h-4 text-gray-600 hover:text-gray-400 transition-colors" />
          </div>
          <div className="flex-1 p-4 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="step" stroke="#9ca3af" tickFormatter={(val) => `${val/1000}k`} hide={false} />
                <YAxis stroke="#9ca3af" width={40} tickFormatter={(val) => Math.floor(val).toLocaleString()} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} 
                  formatter={(value: number) => [Math.floor(value).toLocaleString(), "Profit"]}
                />
                <Line type="monotone" dataKey="house_profit" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win Rate Chart */}
        <div key="chart-winrate" className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg flex flex-col overflow-hidden">
          <div className="grid-card-header flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800/50">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-blue-500" />
              Efficiency
            </h3>
            <GripVertical className="w-4 h-4 text-gray-600 hover:text-gray-400 transition-colors" />
          </div>
          <div className="flex-1 p-4 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="step" stroke="#9ca3af" tickFormatter={(val) => `${val/1000}k`} />
                <YAxis stroke="#9ca3af" domain={[0, 100]} width={30} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                <Line name="Win Rate" type="monotone" dataKey="win_rate" stroke="#60a5fa" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line name="Counter" type="monotone" dataKey="counter_usage" stroke="#c084fc" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Legend iconSize={10} verticalAlign="top" height={36}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Player Balance Chart */}
        <div key="chart-player" className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg flex flex-col overflow-hidden">
          <div className="grid-card-header flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800/50">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Wallet className="w-3 h-3 text-green-500" />
              Player Liquidity
            </h3>
            <GripVertical className="w-4 h-4 text-gray-600 hover:text-gray-400 transition-colors" />
          </div>
          <div className="flex-1 p-4 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="step" stroke="#9ca3af" tickFormatter={(val) => `${val/1000}k`} />
                <YAxis stroke="#9ca3af" width={50} tickFormatter={(val) => Math.floor(val).toLocaleString()} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} formatter={(val: number) => Math.floor(val).toLocaleString()} />
                <Line type="monotone" dataKey="player_money" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table Logs */}
        <div key="table-logs" className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg flex flex-col overflow-hidden">
          <div className="grid-card-header flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800/50">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <List className="w-3 h-3 text-gray-400" />
              Real-time Logs
            </h3>
            <GripVertical className="w-4 h-4 text-gray-600 hover:text-gray-400 transition-colors" />
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs text-left text-gray-400">
              <thead className="text-[10px] text-gray-500 uppercase bg-gray-900/50 sticky top-0">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2 text-right">Step</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                  <th className="px-4 py-2 text-right">Win%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {[...logs].reverse().slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-1.5 opacity-60 font-mono">{new Date(log.created_at).toLocaleTimeString([], { hour12: false })}</td>
                    <td className="px-4 py-1.5 text-right font-mono">{(log.step/1000).toFixed(1)}k</td>
                    <td className={`px-4 py-1.5 text-right font-bold ${log.house_profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {log.house_profit > 0 ? '+' : ''}{Math.floor(log.house_profit).toLocaleString()}
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono">{log.win_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-gray-600">
                <Activity className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">Waiting for telemetry...</p>
              </div>
            )}
          </div>
        </div>
      </ResponsiveGridLayout>
    </div>
  );
};

export default Dashboard;
    