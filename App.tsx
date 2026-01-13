
import React, { useState } from 'react';
import ConfigPanel from './components/ConfigPanel';
import Dashboard from './components/Dashboard';
import ModelManager from './components/ModelManager';
import { Cpu } from 'lucide-react';

const App: React.FC = () => {
  const [resumeModelName, setResumeModelName] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Cpu className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">QuantumWaste AI</h1>
                <p className="text-xs text-blue-400 font-mono">V8.6 Control Center</p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Configuration & Models Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ConfigPanel 
              resumeModelName={resumeModelName} 
              onClearResume={() => setResumeModelName(null)} 
            />
          </div>
          <div>
            <ModelManager onSelectResume={setResumeModelName} selectedModel={resumeModelName} />
          </div>
        </div>

        {/* Visualization Section */}
        <section>
          <Dashboard />
        </section>

      </main>
    </div>
  );
};

export default App;
