
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ModelFile } from '../types';
import { Download, Package, UploadCloud, Loader2, RefreshCw, Trash2, Clock, Database, PlusCircle, CheckCircle2, FileArchive, XCircle } from 'lucide-react';

interface ModelManagerProps {
  onSelectResume: (name: string | null) => void;
  selectedModel: string | null;
}

const ModelManager: React.FC<ModelManagerProps> = ({ onSelectResume, selectedModel }) => {
  const [models, setModels] = useState<ModelFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
        { 
          command: 'SAVE_MODEL', 
          payload: { timestamp: new Date().toISOString() }, 
          processed: false,
          created_at: new Date().toISOString()
        }
      ]);
      if (error) throw error;
      alert('Snapshot command sent!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const { error } = await supabase.storage.from('models').remove([name]);
      if (error) throw error;
      if (selectedModel === name) onSelectResume(null);
      setDeleteConfirm(null);
      fetchModels();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const selectedModelData = models.find(m => m.name === selectedModel);

  return (
    <div className="bg-gray-800 rounded-lg p-5 shadow-xl border border-gray-700 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-400" />
          Models
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={fetchModels}
            className="p-1.5 text-gray-400 hover:text-white transition-colors bg-gray-700/50 rounded-md"
            title="Refresh List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={triggerSnapshot}
            disabled={actionLoading}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold uppercase py-1.5 px-3 rounded-md transition-all disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="animate-spin w-3 h-3" /> : <UploadCloud className="w-3 h-3" />}
            Snapshot
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {/* 1. Fresh Start Button */}
        <button
          onClick={() => onSelectResume(null)}
          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
            selectedModel === null 
              ? 'bg-green-900/20 border-green-500 ring-1 ring-green-500/50' 
              : 'bg-gray-700/30 border-gray-700 hover:bg-gray-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-full ${selectedModel === null ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-400'}`}>
               <PlusCircle className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className={`block text-xs font-bold ${selectedModel === null ? 'text-white' : 'text-gray-300'}`}>Start Fresh</span>
              <span className="block text-[10px] text-gray-500">Random weights</span>
            </div>
          </div>
          {selectedModel === null && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        </button>

        <div className="flex items-center gap-3 px-1 opacity-50">
           <div className="h-px bg-gray-600 flex-1"></div>
           <span className="text-[10px] uppercase font-bold text-gray-500">OR RESUME</span>
           <div className="h-px bg-gray-600 flex-1"></div>
        </div>

        {/* 2. Native Select Dropdown (Bulletproof for overflows) */}
        <div className="relative">
          <FileArchive className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <select
            value={selectedModel || ""}
            onChange={(e) => onSelectResume(e.target.value || null)}
            className="w-full bg-gray-900 border border-gray-600 text-gray-200 text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none focus:border-blue-500 appearance-none cursor-pointer hover:border-gray-500 transition-colors truncate"
          >
            <option value="">-- Select a Checkpoint --</option>
            {models.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name} ({formatFileSize(m.metadata?.size)})
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>

        {/* 3. Selected Model Info Panel */}
        {selectedModelData && (
          <div className="mt-auto bg-gray-900/50 border border-blue-900/30 rounded-lg p-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-3 mb-3">
               <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                  <Database className="w-4 h-4 text-blue-400" />
               </div>
               <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate" title={selectedModelData.name}>{selectedModelData.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(selectedModelData.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{formatFileSize(selectedModelData.metadata?.size)}</span>
                  </div>
               </div>
            </div>

            {/* Inline Delete Confirmation or Actions */}
            {deleteConfirm === selectedModelData.name ? (
              <div className="bg-red-900/20 border border-red-900/50 rounded p-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-red-400">Confirm Delete?</span>
                <div className="flex gap-2">
                   <button onClick={() => setDeleteConfirm(null)} className="text-[10px] text-gray-400 hover:text-white px-2 py-1 bg-gray-800 rounded">Cancel</button>
                   <button onClick={() => handleDelete(selectedModelData.name)} className="text-[10px] text-white bg-red-600 hover:bg-red-500 px-2 py-1 rounded font-bold">Yes, Delete</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <a 
                  href={supabase.storage.from('models').getPublicUrl(selectedModelData.name).data.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-[10px] font-bold text-gray-300 transition-colors"
                >
                  <Download className="w-3 h-3" /> Download
                </a>
                <button 
                  onClick={() => setDeleteConfirm(selectedModelData.name)}
                  className="flex items-center justify-center gap-1.5 py-1.5 bg-red-900/10 hover:bg-red-900/30 border border-red-900/30 text-red-400 hover:text-red-300 rounded text-[10px] font-bold transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelManager;
    