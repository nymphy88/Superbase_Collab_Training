import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { DiagnosticLog, ConnectionStatus } from '../types';
import { 
  Terminal, 
  Activity, 
  ShieldCheck, 
  Wifi, 
  Database, 
  HardDrive, 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Zap, 
  RefreshCw,
  Filter,
  ArrowUpDown,
  Search,
  X
} from 'lucide-react';

const LOG_TYPES: (DiagnosticLog['type'] | 'ALL')[] = ['ALL', 'INFO', 'CMD', 'DATA', 'SUCCESS', 'WARN', 'ERROR', 'DEBUG'];

const DiagnosticsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [filterType, setFilterType] = useState<DiagnosticLog['type'] | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [status, setStatus] = useState<ConnectionStatus>({
    supabase: 'PENDING',
    realtime: 'DISCONNECTED',
    storage: 'CHECKING',
    tables: 'CHECKING'
  });
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: DiagnosticLog['type'] = 'INFO', payload?: any) => {
    const newLog: DiagnosticLog = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      payload
    };
    setLogs(prev => [...prev.slice(-199), newLog]);
  };

  const runHealthCheck = async () => {
    addLog('Initiating System Self-Test...', 'DEBUG');
    
    try {
      const start = Date.now();
      const { data, error } = await supabase.from('game_configs').select('count').limit(1);
      const latency = Date.now() - start;
      
      if (error) throw error;
      
      setStatus(prev => ({ ...prev, supabase: 'ONLINE', tables: 'SYNCED' }));
      addLog(`API Gateway Online (${latency}ms)`, 'SUCCESS');
    } catch (e: any) {
      setStatus(prev => ({ ...prev, supabase: 'OFFLINE', tables: 'ERROR' }));
      addLog(`Database connectivity failure: ${e.message}`, 'ERROR');
    }

    try {
      const { error } = await supabase.storage.from('models').list();
      if (error) throw error;
      setStatus(prev => ({ ...prev, storage: 'READY' }));
      addLog('Checkpoint Storage bucket verified', 'SUCCESS');
    } catch (e: any) {
      setStatus(prev => ({ ...prev, storage: 'ERROR' }));
      addLog('Storage bucket access denied', 'WARN');
    }
  };

  useEffect(() => {
    runHealthCheck();

    const channel = supabase
      .channel('system_diagnostics')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_commands' }, (payload) => {
        addLog(`CMD_OUT: ${payload.new.command}`, 'CMD', payload.new.payload);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'training_logs' }, (payload) => {
        addLog(`DATA_IN: Step ${payload.new.step} synced`, 'DATA', payload.new);
      })
      .on('system', { event: '*' }, (payload: any) => {
        addLog(`SOCKET_EVENT: ${payload.event}`, 'DEBUG');
      })
      .subscribe((status) => {
        const mappedStatus = status === 'SUBSCRIBED' ? 'CONNECTED' : 'DISCONNECTED';
        setStatus(prev => ({ ...prev, realtime: mappedStatus }));
        addLog(`Transport: ${status}`, status === 'SUBSCRIBED' ? 'SUCCESS' : 'INFO');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (terminalEndRef.current && sortOrder === 'ASC') {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, sortOrder, filterType, searchQuery]);

  const filteredLogs = useMemo(() => {
    let result = filterType === 'ALL' ? logs : logs.filter(l => l.type === filterType);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(l => 
        l.message.toLowerCase().includes(query) || 
        (l.payload && JSON.stringify(l.payload).toLowerCase().includes(query))
      );
    }
    
    return sortOrder === 'DESC' ? [...result].reverse() : result;
  }, [logs, filterType, sortOrder, searchQuery]);

  const getStatusColor = (val: string) => {
    if (['ONLINE', 'CONNECTED', 'READY', 'SYNCED'].includes(val)) return 'text-emerald-400';
    if (['OFFLINE', 'DISCONNECTED', 'ERROR'].includes(val)) return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-[60] transition-all duration-500 ease-in-out border-t border-white/10 ${
        isOpen ? 'h-[450px]' : 'h-10'
      } bg-[#0f172a]/95 backdrop-blur-xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)]`}
    >
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 px-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Activity className={`w-3.5 h-3.5 ${isOpen ? 'text-blue-400' : 'text-gray-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">System Diagnostics</span>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${status.supabase === 'ONLINE' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="text-[8px] font-mono font-bold text-gray-500 uppercase">API</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${status.realtime === 'CONNECTED' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="text-[8px] font-mono font-bold text-gray-500 uppercase">RT</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-[9px] font-mono text-blue-400/60 uppercase animate-pulse">
            {logs.length > 0 ? `LATEST: ${logs[logs.length-1].message.slice(0, 40)}${logs[logs.length-1].message.length > 40 ? '...' : ''}` : 'HUB STANDBY'}
          </div>
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
        </div>
      </div>

      {isOpen && (
        <div className="h-[410px] grid grid-cols-1 lg:grid-cols-4 gap-px bg-white/5 overflow-hidden">
          <div className="lg:col-span-1 bg-gray-950 p-6 space-y-6 overflow-y-auto border-r border-white/5">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Integrity Check
              </h3>
              <button onClick={runHealthCheck} className="p-1 hover:bg-white/5 rounded text-gray-500 hover:text-white transition-all">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            
            <div className="space-y-4">
              <StatusItem icon={<Wifi className="w-3.5 h-3.5" />} label="Database API" value={status.supabase} color={getStatusColor(status.supabase)} />
              <StatusItem icon={<Zap className="w-3.5 h-3.5" />} label="Real-time Node" value={status.realtime} color={getStatusColor(status.realtime)} />
              <StatusItem icon={<Database className="w-3.5 h-3.5" />} label="Table Schemas" value={status.tables} color={getStatusColor(status.tables)} />
              <StatusItem icon={<HardDrive className="w-3.5 h-3.5" />} label="Bucket Access" value={status.storage} color={getStatusColor(status.storage)} />
            </div>

            <div className="pt-6 border-t border-white/5">
               <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                 <p className="text-[9px] text-blue-300 leading-relaxed font-medium">
                   Real-time events captured via <span className="text-blue-400 font-mono">system_diagnostics</span> channel.
                 </p>
               </div>
            </div>
          </div>

          <div className="lg:col-span-3 bg-black/40 flex flex-col min-h-0">
            <div className="h-10 px-4 flex items-center justify-between border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 mr-2 whitespace-nowrap">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-wider">Console</span>
                </div>
                
                {/* Search Bar Implementation */}
                <div className="flex items-center gap-1.5 bg-white/5 rounded-md px-2 py-1 border border-transparent focus-within:border-blue-500/50 transition-all">
                  <Search className="w-3 h-3 text-gray-600" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-[9px] font-bold text-gray-400 placeholder:text-gray-700 uppercase outline-none w-24 sm:w-32 focus:text-white transition-colors"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-gray-600 hover:text-white">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-white/5 rounded-md px-2 py-1">
                  <Filter className="w-3 h-3 text-gray-600" />
                  <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="bg-transparent text-[9px] font-bold text-gray-400 uppercase outline-none cursor-pointer hover:text-white transition-colors"
                  >
                    {LOG_TYPES.map(t => <option key={t} value={t} className="bg-gray-900">{t}</option>)}
                  </select>
                </div>

                <button 
                  onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${sortOrder === 'DESC' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">{sortOrder}</span>
                </button>
              </div>

              <button 
                onClick={() => setLogs([])}
                className="text-[9px] font-bold text-gray-600 hover:text-red-400 uppercase flex items-center gap-1.5 transition-colors whitespace-nowrap ml-2"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] custom-scrollbar selection:bg-blue-500 selection:text-white bg-black/30">
              {filteredLogs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50">
                  <p className="uppercase tracking-widest text-[9px] font-black">
                    {searchQuery ? `No results for "${searchQuery}"` : 'Buffer Empty'}
                  </p>
                </div>
              )}
              {filteredLogs.map((log, idx) => (
                <div key={idx} className="mb-1.5 animate-in fade-in slide-in-from-left-1 duration-150 border-l-2 border-transparent hover:border-white/10 hover:bg-white/[0.02] pl-2 -ml-2 transition-colors">
                  <span className="text-gray-600">[{log.timestamp}]</span>{' '}
                  <span className={`font-black px-1 rounded-sm ${getLogTypeColor(log.type)}`}>[{log.type}]</span>{' '}
                  <span className="text-gray-300 leading-relaxed">{log.message}</span>
                  {log.payload && (
                    <span className="text-gray-500 ml-2 italic text-[8px] opacity-60">
                      {JSON.stringify(log.payload).slice(0, 100)}...
                    </span>
                  )}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusItem: React.FC<{ icon: any, label: string, value: string, color: string }> = ({ icon, label, value, color }) => (
  <div className="flex items-center justify-between group">
    <div className="flex items-center gap-3">
      <div className="p-1.5 rounded bg-gray-900 border border-white/5 text-gray-500 group-hover:text-blue-400 transition-colors">
        {icon}
      </div>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{label}</span>
    </div>
    <span className={`text-[10px] font-mono font-black ${color} tracking-widest`}>{value}</span>
  </div>
);

const getLogTypeColor = (type: DiagnosticLog['type']) => {
  switch (type) {
    case 'CMD': return 'text-purple-400 bg-purple-400/5';
    case 'DATA': return 'text-blue-400 bg-blue-400/5';
    case 'ERROR': return 'text-red-400 bg-red-400/5';
    case 'SUCCESS': return 'text-emerald-400 bg-emerald-400/5';
    case 'WARN': return 'text-amber-400 bg-amber-400/5';
    case 'DEBUG': return 'text-slate-500 bg-slate-500/5';
    default: return 'text-gray-400 bg-gray-400/5';
  }
};

export default DiagnosticsPanel;