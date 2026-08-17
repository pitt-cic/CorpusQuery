import { useState, useCallback, useEffect } from 'react';
import { useSettings } from './useSettings';
import type { RetrievalConfig, ModelConfig } from '@/contracts';

interface ValidationErrors {
  evidenceK?: string;
  maxSources?: string;
  mmrLambda?: string;
  evidenceSummaryLength?: string;
  answerLength?: string;
}

export function useSettingsForm() {
  const { settings, isLoading, updateSettings, isSaving } = useSettings();
  const [localRetrievalConfig, setLocalRetrievalConfig] = useState<Partial<RetrievalConfig>>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings?.retrievalConfig) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync server state into local form state on load
      setLocalRetrievalConfig({
        evidenceK: settings.retrievalConfig.evidenceK,
        maxSources: settings.retrievalConfig.maxSources,
        mmrLambda: settings.retrievalConfig.mmrLambda,
        evidenceSummaryLength: settings.retrievalConfig.evidenceSummaryLength,
        answerLength: settings.retrievalConfig.answerLength,
      });
    }
  }, [settings]);

  const validate = useCallback((config: Partial<RetrievalConfig>): ValidationErrors => {
    const errs: ValidationErrors = {};
    if (config.evidenceK !== undefined && config.evidenceK < 1) {
      errs.evidenceK = 'Must be at least 1';
    }
    if (config.maxSources !== undefined && config.maxSources < 1) {
      errs.maxSources = 'Must be at least 1';
    }
    if (config.mmrLambda !== undefined && (config.mmrLambda < 0 || config.mmrLambda > 1)) {
      errs.mmrLambda = 'Must be between 0 and 1';
    }
    if (config.evidenceSummaryLength !== undefined && (config.evidenceSummaryLength < 50 || config.evidenceSummaryLength > 500)) {
      errs.evidenceSummaryLength = 'Must be between 50 and 500';
    }
    if (config.answerLength !== undefined && (config.answerLength < 100 || config.answerLength > 1000)) {
      errs.answerLength = 'Must be between 100 and 1000';
    }
    return errs;
  }, []);

  const updateField = useCallback(
    (field: keyof RetrievalConfig, value: number) => {
      setLocalRetrievalConfig((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
      const newErrors = validate({ ...localRetrievalConfig, [field]: value });
      setErrors(newErrors);
    },
    [localRetrievalConfig, validate]
  );

  const saveRetrievalConfig = useCallback(async () => {
    const validationErrors = validate(localRetrievalConfig);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    await updateSettings({ retrievalConfig: localRetrievalConfig });
    setIsDirty(false);
  }, [localRetrievalConfig, validate, updateSettings]);

  const saveModelConfig = useCallback(
    async (modelConfig: Partial<ModelConfig>) => {
      await updateSettings({ modelConfig });
    },
    [updateSettings]
  );

  return {
    settings,
    isLoading,
    localRetrievalConfig,
    updateField,
    saveRetrievalConfig,
    saveModelConfig,
    errors,
    isDirty,
    isSaving,
  };
}
