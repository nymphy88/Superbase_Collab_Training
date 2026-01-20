import { useState, useCallback, useEffect } from 'react';
import { GameConfig } from '../../../types';
import { DEFAULT_CONFIG } from '../config.types';
import { configService } from '../config.service';

export const useConfigPanelState = (onClearResume?: () => void) => {
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [formConfig, setFormConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLatestConfig = useCallback(async (syncForm: boolean = false) => {
    setLoading(true);
    try {
      const { data } = await configService.fetchLatest();
      if (data) {
        setActiveConfig(data);
        if (syncForm) setFormConfig(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLatestConfig(true);
  }, [fetchLatestConfig]);

  const handleReload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await configService.deployNewConfig(formConfig);
      await configService.sendCommand('RELOAD_CONFIG', { config_id: data.id, config: data });
      setActiveConfig(data);
      setMessage({ type: 'success', text: `v${data.id} Reloaded & Deployed` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [formConfig]);

  const handleStart = useCallback(async () => {
    setLoading(true);
    try {
      if (onClearResume) onClearResume();
      const data = await configService.deployNewConfig(formConfig);
      await configService.sendCommand('START_TRAINING', { resume: false, config_id: data.id, config: data });
      setActiveConfig(data);
      setMessage({ type: 'success', text: `v${data.id} Fresh Session Started` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [formConfig, onClearResume]);

  const setFormValue = useCallback((key: string, val: number) => {
    setFormConfig(prev => {
        // Prevent re-render if value is same
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
    message,
    fetchLatestConfig,
    handleReload,
    handleStart,
    setFormValue
  };
};