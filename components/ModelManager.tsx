import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ModelFile, GameConfig } from '../types';
import { Download, Package, UploadCloud, Loader2, RefreshCw, Trash2, Database, PlusCircle, CheckCircle2, FileArchive, ChevronRight, CheckSquare, Square, Info, ChevronUp, ChevronDown } from 'lucide-react';
import JSZip from 'jszip';

interface ModelManagerProps {
  onSelectResume: (name: string | null) => void;
  selectedModel: string | null;
}

const ModelManager: React.FC<ModelManagerProps> = ({ onSelectResume, selectedModel }) => {
  const [models, setModels] = useState<ModelFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  const writeMetadataToZip = async (zipData: ArrayBuffer, metadata: any): Promise<Blob> => {
    const zip = await JSZip.loadAsync(zipData);
    const metadataContent = JSON.stringify({
      ...metadata,
      embedded_at: new Date().toISOString(),
      generator: "QuantumWaste Control Center v8.6"
    }, null, 2);
    
    zip.file('training_config.json', metadataContent);
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  };

  const findAssociatedConfig = async (model: ModelFile): Promise<GameConfig | null> => {
    try {
      const { data: cmdData } = await supabase
        .from('system_commands')
        .select('payload')
        .eq('command', 'START_TRAINING')
        .lte('created_at', model.created_at)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      const configId = cmdData?.payload?.config_id;
      if (configId) {
        const { data: config } = await supabase
          .from('game_configs')
          .select('*')
          .eq('id', configId)
          .single();
        return config;
      }
      
      const { data: latestConfig } = await supabase
        .from('game_configs')
        .select('*')
        .lte('created_at', model.created_at)
        .order('id', { ascending: false })
        .limit(1)
        .single();
        
      return latestConfig;
    } catch (e) {
      return null;
    }
  };

  const handleDownloadWithMetadata = async (model: ModelFile) => {
    setDownloadingModel(model.name);
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('models')
        .download(model.name);
      
      if (downloadError) throw downloadError;

      const config = await findAssociatedConfig(model);
      const arrayBuffer = await fileData.arrayBuffer();
      const modifiedZipBlob = await writeMetadataToZip(arrayBuffer, {
        model_name: model.name,
        created_at: model.created_at,
        training_parameters: config
      });

      const url = URL.createObjectURL(modifiedZipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = model.name.endsWith('.zip') ? model.name : `${model.name}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingModel(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const toggleBulkSelect = (name: string) => {
    const next = new Set(selectedForBulk);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedForBulk(next);
  };

  const selectAll = () => {
    if (selectedForBulk.size === models.length) setSelectedForBulk(new Set());
    else setSelectedForBulk(new Set(models.map(m => m.name)));
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
    } catch (err: any) {
      alert('Command failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setActionLoading(true);
    try {
      const filesToDelete = Array.from(selectedForBulk);
      const { error } = await supabase.storage.from('models').remove(filesToDelete);
      if (error) throw error;
      if (selectedModel && filesToDelete.includes(selectedModel)) onSelectResume(null);
      setSelectedForBulk(new Set());
      setBulkDeleteConfirm(false);
      await fetchModels();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-5 shadow-xl border border-gray-700 transition-all duration-300 flex flex-col ${isCollapsed ? 'h-auto' : 'h-full'}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-400" />
          Checkpoint Repository
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors bg-gray-700/50 rounded-md"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          {!isCollapsed && (
            <>
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
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold uppercase py-1.5 px-3 rounded-md transition-all disabled:opacity-50 shadow-lg shadow-purple-900/20"
              >
                {actionLoading ? <Loader2 className="animate-spin w-3 h-3" /> : <UploadCloud className="w-3 h-3" />}
                Snap
              </button>
            </>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Fresh Start Toggle */}
          <button
            onClick={() => onSelectResume(null)}
            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
              selectedModel === null 
                ? 'bg-green-900/20 border-green-500/50 ring-1 ring-green-500/30' 
                : 'bg-gray-900/40 border-gray-700 hover:bg-gray-700/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selectedModel === null ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                 <PlusCircle className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className={`block text-xs font-black uppercase tracking-wider ${selectedModel === null ? 'text-green-400' : 'text-gray-400'}`}>Fresh Init</span>
                <span className="block text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">Random Seed Weights</span>
              </div>
            </div>
            {selectedModel === null && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          </button>

          <div className="flex items-center gap-3 px-2">
             <span className="text-[9px] uppercase font-black text-gray-600 tracking-[0.2em] whitespace-nowrap">Saved History</span>
             <div className="h-px bg-gray-700 flex-1"></div>
             {models.length > 0 && (
               <button onClick={selectAll} className="text-[9px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest">
                 {selectedForBulk.size === models.length ? 'Clear' : 'All'}
               </button>
             )}
          </div>

          {/* Model List with Selection */}
          <div className="overflow-y-auto space-y-2 pr-1 max-h-[300px] custom-scrollbar">
            {models.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-gray-900/20 border border-dashed border-gray-700 rounded-xl">
                 <FileArchive className="w-8 h-8 text-gray-700 mb-2" />
                 <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No models archived</p>
              </div>
            )}
            
            {models.map((m) => {
              const isSelectedForResume = selectedModel === m.name;
              const isSelectedForAction = selectedForBulk.has(m.name);
              const isDownloading = downloadingModel === m.name;
              
              return (
                <div 
                  key={m.id}
                  className={`flex items-center gap-3 p-2 rounded-lg border transition-all group ${
                    isSelectedForResume 
                      ? 'bg-blue-900/20 border-blue-500/50' 
                      : 'bg-gray-900/40 border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <button 
                    onClick={() => toggleBulkSelect(m.name)}
                    className={`p-1 rounded transition-colors ${isSelectedForAction ? 'text-blue-500' : 'text-gray-700 hover:text-gray-500'}`}
                  >
                    {isSelectedForAction ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                  
                  <button 
                    onClick={() => onSelectResume(m.name)}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
                  >
                    <div className={`p-1.5 rounded-md ${isSelectedForResume ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 group-hover:bg-gray-700'}`}>
                      <Database className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-bold truncate ${isSelectedForResume ? 'text-blue-300' : 'text-gray-300'}`}>{m.name}</p>
                      <div className="flex items-center gap-2 text-[9px] text-gray-600 font-mono mt-0.5">
                        <span>{formatFileSize(m.metadata?.size)}</span>
                        <span>•</span>
                        <span>{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </button>
                  
                  <div className="flex items-center gap-1.5">
                     <button 
                      onClick={(e) => { e.stopPropagation(); handleDownloadWithMetadata(m); }}
                      disabled={isDownloading}
                      className="p-1.5 rounded-md bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                      title="Download with embedded metadata"
                     >
                       {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                     </button>
                     {isSelectedForResume && <ChevronRight className="w-3 h-3 text-blue-500" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bulk Actions Footer */}
          {selectedForBulk.size > 0 && (
            <div className="pt-3 border-t border-gray-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
              {bulkDeleteConfirm ? (
                <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-3 flex flex-col gap-3">
                   <p className="text-[10px] font-black text-red-400 uppercase tracking-widest text-center">Delete {selectedForBulk.size} items?</p>
                   <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setBulkDeleteConfirm(false)} className="py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-[10px] font-black uppercase text-gray-400 transition-colors">Cancel</button>
                      <button onClick={handleBulkDelete} disabled={actionLoading} className="py-2 bg-red-600 hover:bg-red-500 rounded-lg text-[10px] font-black uppercase text-white shadow-lg transition-all flex items-center justify-center">
                         {actionLoading ? <Loader2 className="animate-spin w-3 h-3" /> : 'Destroy'}
                      </button>
                   </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setBulkDeleteConfirm(true)}
                    className="flex items-center justify-center gap-2 py-2.5 bg-red-900/10 hover:bg-red-900/30 border border-red-900/30 text-red-500 rounded-xl text-[10px] font-black uppercase transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete ({selectedForBulk.size})
                  </button>
                  <button 
                    onClick={() => {
                      selectedForBulk.forEach(async name => {
                        const model = models.find(m => m.name === name);
                        if (model) await handleDownloadWithMetadata(model);
                      });
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-[10px] font-black uppercase text-gray-300 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Load ({selectedForBulk.size})
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-2 bg-blue-900/10 border border-blue-800/30 rounded-lg p-2 flex items-start gap-2">
             <Info className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
             <p className="text-[8px] text-blue-300/80 leading-relaxed italic">
               Metadata <span className="text-blue-400 font-bold">training_config.json</span> is automatically embedded in downloads.
             </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelManager;