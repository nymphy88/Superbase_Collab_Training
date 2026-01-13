
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ModelFile } from '../types';
import { Download, Package, UploadCloud, Loader2, RefreshCw, Trash2, FileArchive, PlayCircle, Clock, Database } from 'lucide-react';

interface ModelManagerProps {
  onSelectResume: (name: string) => void;
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

  const deleteModel = async (name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const { error } = await supabase.storage.from('models').remove([name]);
      if (error) throw error;
      fetchModels();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-400" />
          Model Snapshots
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={fetchModels}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={triggerSnapshot}
            disabled={actionLoading}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 px-4 rounded transition-all disabled:opacity-50 shadow-lg shadow-purple-900/20"
          >
            {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <UploadCloud className="w-4 h-4" />}
            Save Now
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {loading && models.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm">Loading snapshots...</div>
        ) : models.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-gray-700 rounded-lg text-gray-500 text-sm">
            No model files found in storage.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {models.map((model) => (
              <div 
                key={model.id} 
                className={`flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border transition-all ${selectedModel === model.name ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-900/10' : 'border-gray-700 hover:border-gray-600'}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-gray-800 rounded-lg border border-gray-700">
                    <FileArchive className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-200 truncate">{model.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                      <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        Created: {new Date(model.created_at).toLocaleDateString()}
                      </p>
                      {model.last_accessed_at && (
                        <p className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Accessed: {new Date(model.last_accessed_at).toLocaleDateString()}
                        </p>
                      )}
                      <p className="text-[10px] text-blue-400 font-mono flex items-center gap-1">
                        <Database className="w-2.5 h-2.5" />
                        {formatFileSize(model.metadata?.size)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 ml-4">
                  <button 
                    onClick={() => onSelectResume(model.name)}
                    className={`p-2 rounded transition-colors ${selectedModel === model.name ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:text-blue-400 border border-gray-700 hover:border-blue-400'}`}
                    title="Select this model to resume training"
                  >
                    <PlayCircle className="w-4 h-4" />
                  </button>
                  <a 
                    href={getDownloadUrl(model.name)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-blue-400 border border-gray-700"
                    title="Download model ZIP"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={() => deleteModel(model.name)}
                    className="p-2 bg-gray-800 hover:bg-red-900/30 rounded text-red-400 border border-gray-700"
                    title="Delete model"
                  >
                    <Trash2 className="w-4 h-4" />
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
