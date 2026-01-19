
import React, { useState } from 'react';
import ConfigPanel from './components/ConfigPanel';
import Dashboard from './components/Dashboard';
import ModelManager from './components/ModelManager';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import { Cpu, ChevronUp, ChevronDown, Settings2, LayoutDashboard, Maximize2, Minimize2 } from 'lucide-react';

const App: React.FC = () => {
  const [resumeModelName, setResumeModelName] = useState<string | null>(null);
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-blue-500/30 pb-16">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-lg shadow-lg shadow-blue-900/20">
                <Cpu className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white leading-tight">QuantumWaste AI</h1>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">V8.6 Engine</span>
                  <span className="text-[10px] text-gray-500 font-medium">Telemetry Hub</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-xs font-bold uppercase tracking-wide group ${
                  isControlsExpanded 
                    ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-blue-500 hover:text-white shadow-inner' 
                    : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/40'
                }`}
              >
                {isControlsExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                {isControlsExpanded ? 'Hide Setup' : 'Show Controls'}
                {isControlsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Configuration & Models Section - Collapsible Shelf */}
        <div 
          className={`transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
            isControlsExpanded 
              ? 'opacity-100 max-h-[3000px] mb-8 translate-y-0 scale-100' 
              : 'opacity-0 max-h-0 mb-0 -translate-y-8 scale-[0.98] pointer-events-none'
          }`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ConfigPanel 
                resumeModelName={resumeModelName} 
                onClearResume={() => setResumeModelName(null)} 
              />
            </div>
            <div className="h-full">
              <ModelManager onSelectResume={setResumeModelName} selectedModel={resumeModelName} />
            </div>
          </div>
        </div>

        {/* Visualization Section */}
        <section className={`transition-all duration-500 ${!isControlsExpanded ? 'pt-4' : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gray-800 border border-gray-700 ${!isControlsExpanded ? 'shadow-md shadow-blue-900/10' : ''}`}>
                <LayoutDashboard className="w-5 h-5 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Real-time Performance Metrics</h2>
            </div>
            
            {!isControlsExpanded && (
               <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold bg-gray-800/50 px-3 py-1 rounded-full border border-gray-800">
                 <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                 Full View Mode Active
               </div>
            )}
          </div>
          
          <div className="bg-gray-900/50 rounded-xl border border-gray-800/50">
            <Dashboard />
          </div>
        </section>

      </main>

      {/* Footer / Status Bar */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center border-t border-gray-800/30 mt-12 mb-20">
        <div className="flex flex-col items-center gap-4">
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-[0.2em]">
            QuantumWaste AI Systems • Project Blackjack Dice • V8.6.0
          </p>
        </div>
      </footer>

      {/* Floating Action Toggle for quick access when collapsed */}
      <button 
        onClick={() => setIsControlsExpanded(true)}
        className={`fixed bottom-14 right-8 p-4 rounded-full shadow-2xl z-50 transition-all duration-500 transform hover:scale-110 active:scale-95 flex items-center gap-3 font-bold ${
          isControlsExpanded 
            ? 'bg-gray-800 text-gray-400 border border-gray-700 translate-y-24 opacity-0 pointer-events-none' 
            : 'bg-blue-600 text-white shadow-blue-900/60 translate-y-0 opacity-100'
        }`}
      >
        <Settings2 className="w-6 h-6" />
        <span className="text-sm pr-2 tracking-wide uppercase">Open Control Panel</span>
      </button>

      {/* System Diagnostics HUD - The Engine Room */}
      <DiagnosticsPanel />
    </div>
  );
};

export default App;
