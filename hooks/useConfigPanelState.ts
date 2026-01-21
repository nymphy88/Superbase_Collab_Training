
import { useState, useCallback, useEffect } from 'react';
import { GameConfig } from '../types';
import { DEFAULT_CONFIG } from '../config.types';
import { configService } from '../config.service';

export const useConfigPanelState = (onClearResume?: () => void) => {
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [formConfig, setFormConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [ngrokUrl, setNgrokUrl] = useState<string | null>(null);
  const [isEngineOnline, setIsEngineOnline] = useState<boolean | 'checking'>('checking');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const checkEngineStatus = useCallback(async () => {
    const { exists, url } = await configService.checkTunnelStatus();
    setIsEngineOnline(exists);
    setNgrokUrl(url || null);
    return exists;
  }, []);

  const fetchLatestConfig = useCallback(async (syncForm: boolean = false) => {
    setLoading(true);
    try {
      const { data } = await configService.fetchLatest();
      if (data) {
        setActiveConfig(data);
        if (syncForm) setFormConfig({ ...DEFAULT_CONFIG, ...data });
      }
      await checkEngineStatus();
    } catch (err) {
      console.error("Failed to fetch latest config", err);
    } finally {
      setLoading(false);
    }
  }, [checkEngineStatus]);

  useEffect(() => {
    fetchLatestConfig(true);
  }, [fetchLatestConfig]);

  const handleReload = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      // If we have an active config, update it. Otherwise, deploy a new one.
      if (activeConfig?.id) {
        data = await configService.updateConfig(activeConfig.id, formConfig);
      } else {
        data = await configService.deployNewConfig(formConfig);
      }
      
      await configService.sendCommand('RELOAD_CONFIG', { config_id: data.id, config: data });
      setActiveConfig(data);
      setMessage({ type: 'success', text: `v${data.id} Updated & Reloaded` });
      await checkEngineStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [formConfig, activeConfig, checkEngineStatus]);

  const handleStart = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const online = await checkEngineStatus();
      if (!online) {
        throw new Error("UNLINKED: Run Colab script first.");
      }

      if (onClearResume) onClearResume();
      // Always deploy a NEW config for a fresh session
      const data = await configService.deployNewConfig(formConfig);
      
      await configService.sendCommand('START_TRAINING', { resume: false, config_id: data.id, config: data });
      
      try {
        await configService.triggerNgrok('/start', { 
          command: 'START_TRAINING', 
          config_id: data.id 
        });
        setMessage({ type: 'success', text: `v${data.id} Live Signal Sent` });
      } catch (triggerErr: any) {
        console.warn("Direct trigger failed:", triggerErr.message);
        setMessage({ 
          type: 'success', 
          text: `v${data.id} Queued via DB (Direct signal failed)` 
        });
      }

      setActiveConfig(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [formConfig, onClearResume, checkEngineStatus]);

  const handleStop = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      await configService.stopTraining();
      
      try {
        await configService.triggerNgrok('/stop', { command: 'STOP_TRAINING' });
        setMessage({ type: 'success', text: 'Termination Signal Sent (Fast)' });
      } catch (e) {
        setMessage({ type: 'success', text: 'Termination Queued via DB' });
      }
      
      await checkEngineStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [checkEngineStatus]);

  const setFormValue = useCallback((key: string, val: any) => {
    setFormConfig(prev => {
        if ((prev as any)[key] === val) return prev;
        return { ...prev, [key]: val };
    });
  }, []);

  return {
    activeConfig,
    formConfig,
    loading,
    copying,
    setCopying,
    ngrokUrl,
    isEngineOnline,
    message,
    fetchLatestConfig,
    handleReload,
    handleStart,
    handleStop,
    setFormValue
  };
};
