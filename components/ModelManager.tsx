
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ModelFile } from '../types';
import { Download, Package, UploadCloud, Loader2, RefreshCw, Trash2, FileArchive, PlayCircle, Clock, Database, PlusCircle, Eye, CheckCircle2 } from 'lucide-react';

interface ModelManagerProps {
  onSelectResume: (name: string | null) => void;
  selectedModel: string | null;
}

const ModelManager: React.FC<ModelManagerProps> = ({ onSelectResume, selectedModel }) => {
  const [models, setModels] = useState<ModelFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from('models').list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'desc' },
      });

      if (error) throw error;
      setModels(data as unknown as ModelFile[]);
    } catch (err: any) {
      console.error('Error fetching models:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const triggerSnapshot = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.from('system_commands').insert([
        { command: 'SAVE_MODEL', payload: { timestamp: new Date().toISOString() }, processed: false }
      ]);
      if (error) throw error;
      alert('Snapshot command sent to Colab!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getDownloadUrl = (name: string) => {
    const { data } = supabase.storage.from('models').getPublicUrl(name);
    return data.publicUrl;
  };

  const deleteModel = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation(); // Prevent selection when deleting
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const { error } = await supabase.storage.from('models').remove([name]);
      if (error) throw error;
      fetchModels();
      if (selectedModel === name) onSelectResume(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-400" />
          Model Repository
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={fetchModels}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={triggerSnapshot}
            disabled={actionLoading}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase py-1.5 px-3 rounded transition-all disabled:opacity-50 shadow-lg shadow-purple-900/20"
          >
            {actionLoading ? <Loader2 className="animate-spin w-3 h-3" /> : <UploadCloud className="w-3 h-3" />}
            Take Snapshot
          </button>
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1 flex-1">
        {/* Fresh Start Option */}
        <button
          onClick={() => onSelectResume(null)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all group ${
            selectedModel === null 
              ? 'border-green-500 bg-green-900/10 ring-1 ring-green-500' 
              : 'border-gray-700 bg-gray-900/30 hover:border-green-500/50'
          }`}
        >
          <div className={`p-2 rounded-lg border flex-shrink-0 ${selectedModel === null ? 'bg-green-600 border-green-500' : 'bg-gray-800 border-gray-700 group-hover:bg-green-900/20 group-hover:border-green-500/30'}`}>
            {selectedModel === null ? <CheckCircle2 className="w-5 h-5 text-white" /> : <PlusCircle className="w-5 h-5 text-green-500" />}
          </div>
          <div className="text-left min-w-0">
            <p className={`text-sm font-bold ${selectedModel === null ? 'text-white' : 'text-gray-300'}`}>Fresh Session</p>
            <p className="text-[10px] text-gray-500 truncate italic">Random weight initialization</p>
          </div>
        </button>

        <div className="relative py-3">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-700/50"></div>
          </div>
          <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em]">
            <span className="bg-gray-800 px-3 text-gray-500">Stored Models</span>
          </div>
        </div>

        {loading && models.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center gap-3 opacity-40">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-xs font-mono">Syncing storage...</p>
          </div>
        ) : models.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-gray-700 rounded-xl text-gray-500 text-xs">
            No models found in Supabase.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 pb-4">
            {models.map((model) => (
              <div 
                key={model.id} 
                onClick={() => onSelectResume(model.name)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${
                  selectedModel === model.name 
                    ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-900/10' 
                    : 'border-gray-700 bg-gray-900/30 hover:border-blue-500/40 hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                  <div className={`p-2 rounded-lg border flex-shrink-0 transition-colors ${
                    selectedModel === model.name ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-700 group-hover:bg-blue-900/20 group-hover:border-blue-500/30'
                  }`}>
                    {selectedModel === model.name ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <FileArchive className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${selectedModel === model.name ? 'text-white' : 'text-gray-200 group-hover:text-blue-200'}`}>
                      {model.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(model.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-blue-400/70 font-mono flex items-center gap-1">
                        <Database className="w-2.5 h-2.5" />
                        {formatFileSize(model.metadata?.size)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-1 ml-4 flex-shrink-0">
                  <a 
                    href={getDownloadUrl(model.name)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 bg-gray-900/80 hover:bg-gray-800 rounded-md text-gray-400 hover:text-blue-400 border border-gray-700 transition-colors"
                    title="Download ZIP"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button 
                    onClick={(e) => deleteModel(e, model.name)}
                    className="p-1.5 bg-gray-900/80 hover:bg-red-900/30 rounded-md text-gray-400 hover:text-red-400 border border-gray-700 transition-colors"
                    title="Delete model"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelManager;
