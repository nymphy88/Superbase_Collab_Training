import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { TrainingLog } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Activity, GripVertical, RotateCcw, User } from 'lucide-react';
import StatCard from './StatCard';
import * as RGL from 'react-grid-layout';

// Robustly extract components to avoid TypeError in ESM environments
const { Responsive, WidthProvider } = RGL;
const ResponsiveGridLayout = WidthProvider(Responsive);

const CONFIG = {
  STORAGE_KEY: 'dashboard_layout_v4_pro',
  DATA_LIMIT: 60,
  BREAKPOINTS: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
  COLS: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  ROW_HEIGHT: 35,
};

const INITIAL_LAYOUTS = {
  lg: [
    { i: 'stats-house-profit', x: 0, y: 0, w: 2, h: 2 },
    { i: 'stats-player-profit', x: 2, y: 0, w: 2, h: 2 },
    { i: 'stats-winrate', x: 4, y: 0, w: 2, h: 2 },
    { i: 'stats-counter', x: 6, y: 0, w: 2, h: 2 },
    { i: 'stats-refills', x: 8, y: 0, w: 2, h: 2 },
    { i: 'chart-house', x: 0, y: 2, w: 6, h: 8 },
    { i: 'chart-winrate', x: 6, y: 2, w: 6, h: 8 },
    { i: 'chart-player', x: 0, y: 10, w: 12, h: 8 },
    { i: 'table-logs', x: 0, y: 18, w: 12, h: 8 },
  ],
};

const Dashboard: React.FC = () => {
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_LAYOUTS;
    } catch (e) {
      return INITIAL_LAYOUTS;
    }
  });

  const onLayoutChange = useCallback((currentLayout: any, allLayouts: any) => {
    setLayouts(allLayouts);
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(allLayouts));
  }, []);

  const resetLayout = () => {
    setLayouts(INITIAL_LAYOUTS);
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  };

  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('training_logs')
        .select('*')
        .order('id', { ascending: false })
        .limit(CONFIG.DATA_LIMIT);

      if (data) {
        setLogs(data.reverse());
      }
    };

    fetchInitial();

    const logsChannel = supabase
      .channel('logs-realtime-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'training_logs' },
        (payload) => {
          const newLog = payload.new as TrainingLog;
          setLogs((prev) => {
            const updated = [...prev, newLog];
            return updated.slice(-CONFIG.DATA_LIMIT);
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
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Activity className="text-blue-400" />
          <h2 className="text-xl font-bold tracking-tight text-white">System Telemetry</h2>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
              {isConnected ? 'Real-time Linked' : 'Stream Interrupted'}
            </span>
          </div>
        </div>
        <button
          onClick={resetLayout}
          className="flex items-center gap-2 text-[9px] font-bold text-gray-500 hover:text-white transition-colors bg-gray-800/50 px-3 py-1 rounded border border-gray-700 uppercase tracking-wider"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Layout
        </button>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={CONFIG.BREAKPOINTS}
        cols={CONFIG.COLS}
        rowHeight={CONFIG.ROW_HEIGHT}
        draggableHandle=".grid-card-header"
        onLayoutChange={onLayoutChange}
        margin={[12, 12]}
      >
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
          <div className="h-full w-full bg-blue-900/10 border border-blue-500/30 rounded-xl p-3 flex items-center justify-between group grid-card-header hover:bg-blue-900/20 transition-all cursor-grab active:cursor-grabbing">
            <div className="pointer-events-none">
              <p className="text-blue-400/60 text-[9px] uppercase font-black tracking-widest">Win Rate</p>
              <h3 className="text-xl font-black mt-0.5 text-blue-300 tracking-tighter tabular-nums">
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

        <div key="chart-house" className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden group">
          <div className="grid-card-header flex items-center justify-between p-2.5 border-b border-gray-700 bg-gray-900/20 cursor-grab active:cursor-grabbing">
            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest">House Performance</h3>
            <GripVertical className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" />
          </div>
          <div className="flex-1 p-4 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="step" hide />
                <YAxis stroke="#4b5563" fontSize={10} width={40} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '11px' }} />
                <Line type="stepAfter" dataKey="house_profit" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div key="chart-winrate" className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden group">
          <div className="grid-card-header flex items-center justify-between p-2.5 border-b border-gray-700 bg-gray-900/20 cursor-grab active:cursor-grabbing">
            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Win Efficiency</h3>
            <GripVertical className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" />
          </div>
          <div className="flex-1 p-4 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="step" hide />
                <YAxis stroke="#4b5563" fontSize={10} width={40} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '11px' }} />
                <Line type="monotone" dataKey="win_rate" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div key="chart-player" className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden group">
          <div className="grid-card-header flex items-center justify-between p-2.5 border-b border-gray-700 bg-gray-900/20 cursor-grab active:cursor-grabbing">
            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Player Liquidity</h3>
            <GripVertical className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" />
          </div>
          <div className="flex-1 p-4 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="step" hide />
                <YAxis stroke="#4b5563" fontSize={10} width={40} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '11px' }} />
                <Line type="monotone" dataKey="player_money" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div key="table-logs" className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden group">
          <div className="grid-card-header flex items-center justify-between p-2.5 border-b border-gray-700 bg-gray-900/20 cursor-grab active:cursor-grabbing">
            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Real-time Data Stream</h3>
            <GripVertical className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" />
          </div>
          <div className="flex-1 overflow-auto p-2 custom-scrollbar">
             <table className="w-full text-left text-[10px] text-gray-400">
                <thead>
                  <tr className="border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
                    <th className="p-2">Step</th>
                    <th className="p-2">Profit</th>
                    <th className="p-2">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {[...logs].reverse().map((log, idx) => (
                    <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-700/30 transition-colors">
                      <td className="p-2 tabular-nums">{log.step}</td>
                      <td className={`p-2 font-bold ${log.house_profit >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {log.house_profit.toFixed(2)}
                      </td>
                      <td className="p-2 text-blue-400 tabular-nums">{log.win_rate.toFixed(1)}%</td>
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