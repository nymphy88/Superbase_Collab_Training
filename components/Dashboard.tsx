
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { TrainingLog } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, Activity, AlertTriangle, List, Wallet } from 'lucide-react';
import StatCard from './StatCard';

const Dashboard: React.FC = () => {
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 1. Fetch initial history
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('training_logs')
        .select('*')
        .order('id', { ascending: false }) // Get latest first for stats
        .limit(50);
      
      if (data) {
        // Reverse for chart (oldest to newest left to right)
        setLogs(data.reverse());
      }
    };

    fetchInitial();

    // 2. Subscribe to new inserts
    const channel = supabase
      .channel('table-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'training_logs',
        },
        (payload) => {
          const newLog = payload.new as TrainingLog;
          setLogs((prev) => {
            const updated = [...prev, newLog];
            // Keep only last 50 points for chart performance
            if (updated.length > 50) return updated.slice(updated.length - 50);
            return updated;
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Calculate current stats from the very last log
  const latest = logs.length > 0 ? logs[logs.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="text-green-400" />
          Live Monitoring
        </h2>
        <span className={`text-xs px-2 py-1 rounded-full border ${isConnected ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-red-900/30 border-red-500 text-red-400'}`}>
          {isConnected ? '● Realtime Connected' : '○ Connecting...'}
        </span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="House Profit" 
          value={latest ? latest.house_profit.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'} 
          icon={<DollarSign className="text-yellow-400" />}
          color="text-yellow-400"
        />
        <StatCard 
          title="Win Rate" 
          value={latest ? `${latest.win_rate.toFixed(1)}%` : '0%'} 
          icon={<TrendingUp className="text-blue-400" />}
          color="text-blue-400"
        />
        <StatCard 
          title="Refills (Bankrupt)" 
          value={latest ? latest.refill_count : 0} 
          icon={<AlertTriangle className="text-red-400" />}
          color="text-red-400"
        />
        <StatCard 
          title="Counter Usage" 
          value={latest ? `${latest.counter_usage.toFixed(1)}%` : '0%'} 
          icon={<Activity className="text-purple-400" />}
          color="text-purple-400"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* House Profit Chart */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg">
          <h3 className="text-sm font-semibold mb-4 text-gray-300">House Profit vs Steps</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="step" stroke="#9ca3af" tickFormatter={(val) => `${val/1000}k`} />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                />
                <Line type="monotone" dataKey="house_profit" stroke="#fbbf24" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win Rate Chart */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg">
          <h3 className="text-sm font-semibold mb-4 text-gray-300">Win Rate %</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="step" stroke="#9ca3af" tickFormatter={(val) => `${val/1000}k`} />
                <YAxis stroke="#9ca3af" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                />
                <Line type="monotone" dataKey="win_rate" stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="counter_usage" stroke="#c084fc" strokeWidth={2} dot={false} />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Player Money Chart */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-gray-300">Player Money vs Steps</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="step" stroke="#9ca3af" tickFormatter={(val) => `${val/1000}k`} />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                />
                <Line type="monotone" dataKey="player_money" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Logs Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center gap-2">
          <List className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-300">Recent Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
              <tr>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Step</th>
                <th className="px-6 py-3">Profit</th>
                <th className="px-6 py-3">Player Money</th>
                <th className="px-6 py-3">Win Rate</th>
                <th className="px-6 py-3">Refills</th>
              </tr>
            </thead>
            <tbody>
              {[...logs].reverse().slice(0, 10).map((log) => (
                <tr key={log.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                  <td className="px-6 py-2">{new Date(log.created_at).toLocaleTimeString()}</td>
                  <td className="px-6 py-2 font-mono">{log.step}</td>
                  <td className={`px-6 py-2 ${log.house_profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {log.house_profit.toLocaleString()}
                  </td>
                  <td className="px-6 py-2 text-green-300">
                    {log.player_money.toLocaleString()}
                  </td>
                  <td className="px-6 py-2">{log.win_rate.toFixed(1)}%</td>
                  <td className="px-6 py-2">{log.refill_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
