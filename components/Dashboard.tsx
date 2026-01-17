
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { TrainingLog } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, Activity, Wallet, GripVertical, RotateCcw, ArrowUpRight, User, MousePointer2 } from 'lucide-react';
import StatCard from './StatCard';
import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);
const STORAGE_KEY = 'dashboard_layout_v4_pro';

const Dashboard: React.FC = () => {
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Updated layout to include the new Player Profit card and a more balanced grid
  const initialLayouts = {
    lg: [
      { i: 'stats-house-profit', x: 0, y: 0, w: 2, h: 2 },
      { i: 'stats-player-profit', x: 2, y: 0, w: 2, h: 2 },
      { i: 'stats-winrate', x: 4, y: 0, w: 3, h: 2 },
      { i: 'stats-refills', x: 7, y: 0, w: 2, h: 2 },
      { i: 'stats-counter', x: 9, y: 0, w: 3, h: 2 },
      { i: 'chart-house', x: 0, y: 2, w: 6, h: 8 },
      { i: 'chart-winrate', x: 6, y: 2, w: 6, h: 8 },
      { i: 'chart-player', x: 0, y: 10, w: 12, h: 8 },
      { i: 'table-logs', x: 0, y: 18, w: 12, h: 8 },
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
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('training_logs')
        .select('*')
        .order('id', { ascending: false })
        .limit(60);
      
      if (data) {
        setLogs(data.reverse());
      }
    };

    fetchInitial();

    const logsChannel = supabase
      .channel('logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'training_logs' },
        (payload) => {
          const newLog = payload.new as TrainingLog;
          setLogs((prev) => {
            const updated = [...prev, newLog];
            return updated.slice(-60);
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(logsChannel);
    };
  }, []);

  const latest = logs.length > 0 ? logs[logs.length - 1] : null;
  const playerNetProfit = latest ? -latest.house_profit : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Activity className="text-blue-400" />
          <h2 className="text-2xl font-bold tracking-tight">System Telemetry</h2>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              {isConnected ? 'Real-time Linked' : 'Stream Interrupted'}
            </span>
          </div>
        </div>
        <button 
          onClick={resetLayout}
          className="flex items-center gap-2 text-[10px] font-bold text-gray-400 hover:text-white transition-colors bg-gray-800/50 px-3 py-1.5 rounded border border-gray-700 uppercase tracking-wider"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Layout
        </button>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={35}
        draggableHandle=".grid-card-header"
        onLayoutChange={onLayoutChange}
      >
        {/* Stat Cards */}
        <div key="stats-house-profit">
          <StatCard 
            title="House Net Profit" 
            value={latest ? Math.floor(latest.house_profit).toLocaleString() : '0'} 
            icon={<DollarSign className="text-yellow-400 w-4 h-4" />}
            color="text-yellow-400"
          />
        </div>
        <div key="stats-player-profit">
          <StatCard 
            title="Player Net Profit" 
            value={playerNetProfit ? Math.floor(playerNetProfit).toLocaleString() : '0'} 
            icon={<User className="text-emerald-400 w-4 h-4" />}
            color="text-emerald-400"
          />
        </div>
        <div key="stats-winrate">
          <div className="h-full w-full bg-blue-900/10 border border-blue-500/30 rounded-xl p-3 flex items-center justify-between group grid-card-header hover:bg-blue-900/20 transition-all">
            <div className="pointer-events-none">
              <p className="text-blue-400/60 text-[9px] uppercase font-black tracking-widest">Player Win Rate</p>
              <h3 className="text-xl lg:text-2xl font-black mt-0.5 text-blue-300 tracking-tighter tabular-nums">
                {latest ? `${latest.win_rate.toFixed(1)}%` : '0%'}
              </h3>
            </div>
            <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30">
              <TrendingUp className="text-blue-400 w-5 h-5" />
            </div>
          </div>
        </div>
        <div key="stats-refills">
          <StatCard 
            title="Bankrupt Refills" 
            value={latest ? latest.refill_count : 0} 
            icon={<RotateCcw className="text-red-400 w-4 h-4" />}
            color="text-red-400"
          />
        </div>
        <div key="stats-counter">
          <StatCard 
            title="Counter Triggered" 
            value={latest ? `${latest.counter_usage.toFixed(1)}%` : '0%'} 
            icon={<Activity className="text-purple-400 w-4 h-4" />}
            color="text-purple-400"
          />
        </div>

        {/* House Profit Chart */}
        <div key="chart-house" className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden group">
          <div className="grid-card-header flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900/20">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">House Performance</h3>
              {latest && (
                <div className="flex items-center gap-1.5 bg-yellow-900/30 px-2 py-0.5 rounded border border-yellow-700/50 animate-in fade-in zoom-in">
                  <span className="text-[10px] font-mono font-black text-yellow-400">${Math.floor(latest.house_profit).toLocaleString()}</span>
                  <ArrowUpRight className="w-2.5 h-2.5 text-yellow-500" />
                </div>
              )}
            </div>
            <GripVertical className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" />
          </div>
          <div className="flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="step" hide />
                <YAxis 
                  stroke="#4b5563" 
                  fontSize={10} 
                  width={50} 
                  tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '11px' }} 
                  formatter={(val: number) => [`$${Math.floor(val).toLocaleString()}`, 'House Profit']}
                />
                <Line type="stepAfter" dataKey="house_profit" stroke="#fbbf24" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win Rate Chart */}
        <div key="chart-winrate" className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden group">
          <div className="grid-card-header flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900/20">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Win Efficiency</h3>
              {latest && (
                <div className="flex items-center gap-1.5 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-700/50 animate-in fade-in zoom-in">
                  <span className="text-[10px] font-mono font-black text-blue-400">{latest.win_rate.toFixed(1)}%</span>
                  <Activity className="w-2.5 h-2.5 text-blue-500" />
                </div>
              )}
            </div>
            <GripVertical className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" />
          </div>
          <div className="flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="step" hide />
                <YAxis 
                  stroke="#4b5563" 
                  fontSize={10} 
                  width={40} 
                  domain={[0, 100]} 
                  tickFormatter={(val) => `${val}%`}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '11px' }} />
                <Line name="Player Win Rate" type="monotone" dataKey="win_rate" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} />
                <Line name="Counter Usage" type="monotone" dataKey="counter_usage" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} strokeDasharray="5 5" />
                <Legend iconSize={8} verticalAlign="top" align="right" wrapperStyle={{ fontSize: '10px', marginTop: '-10px' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Player Liquidity Chart */}
        <div key="chart-player" className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden group">
          <div className="grid-card-header flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900/20">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Player Liquidity Lifecycle</h3>
              {latest && (
                <div className="flex items-center gap-1.5 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-700/50 animate-in fade-in zoom-in">
                  <span className="text-[10px] font-mono font-black text-emerald-400">${Math.floor(latest.player_money).toLocaleString()}</span>
                  <Wallet className="w-2.5 h-2.5 text-emerald-500" />
                </div>
              )}
            </div>
            <GripVertical className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" />
          </div>
          <div className="flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="step" hide />
                <YAxis 
                  stroke="#4b5563" 
                  fontSize={10} 
                  width={55} 
                  tickFormatter={(val) => `$${Math.floor(val).toLocaleString()}`} 
                />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '11px' }} />
                <Line type="monotone" dataKey="player_money" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Stream Table */}
        <div key="table-logs" className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden group">
          <div className="grid-card-header flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900/20">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <MousePointer2 className="w-3 h-3" />
              Live Feed Sequence
            </h3>
            <GripVertical className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" />
          </div>
          <div className="flex-1 overflow-auto scrollbar-hide">
            <table className="w-full text-[11px] text-left text-gray-400">
              <thead className="text-[9px] text-gray-500 uppercase bg-gray-900/80 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3 text-right">Iteration</th>
                  <th className="px-4 py-3 text-right">House Profit</th>
                  <th className="px-4 py-3 text-right">P-Win %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {[...logs].reverse().slice(0, 30).map((log) => (
                  <tr key={log.id} className="hover:bg-gray-700/30 transition-colors group/row">
                    <td className="px-4 py-2.5 opacity-50 font-mono">{new Date(log.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-400/80">{(log.step/1000).toFixed(1)}k</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${log.house_profit >= 0 ? 'text-yellow-500/80' : 'text-emerald-500/80'}`}>
                      {log.house_profit > 0 ? '+' : ''}{Math.floor(log.house_profit).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-gray-300">{log.win_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ResponsiveGridLayout>
    </div>
  );
};

export default Dashboard;
