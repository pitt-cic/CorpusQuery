import { useSettingsForm } from '@/hooks/useSettingsForm';
import { useSecrets } from '@/hooks/useSecrets';
import ModelConfigCard from '@/components/ModelConfigCard';
import RetrievalConfigCard from '@/components/RetrievalConfigCard';
import ApiKeysCard from '@/components/ApiKeysCard';
import { Provider } from '@/contracts';

export default function SettingsPanel() {
  const {
    settings,
    isLoading,
    localRetrievalConfig,
    updateField,
    saveRetrievalConfig,
    saveModelConfig,
    errors,
    isDirty,
    isSaving,
  } = useSettingsForm();

  const { secretsStatus, updateSecrets, isSaving: isSecretsSaving } = useSecrets();

  const hasNonBedrockProvider =
    settings?.modelConfig &&
    [settings.modelConfig.llm, settings.modelConfig.summaryLlm, settings.modelConfig.agentLlm].some(
      (m) => m?.provider !== Provider.BEDROCK
    );

  if (isLoading) return <div className="h-full overflow-y-auto"><div className="max-w-[680px] mx-auto p-8">Loading...</div></div>;

  return (
    <div className="h-full overflow-y-auto scrollbar-hidden">
    <div className="max-w-[680px] mx-auto py-8 px-6">
      <h2 className="font-serif text-2xl font-medium mb-6">Settings</h2>

      <ModelConfigCard
        config={settings?.modelConfig}
        onSave={saveModelConfig}
        isSaving={isSaving}
      />

      <ApiKeysCard
        secretsStatus={secretsStatus}
        onSave={updateSecrets}
        isSaving={isSecretsSaving}
        visible={!!hasNonBedrockProvider}
      />

      <RetrievalConfigCard
        config={localRetrievalConfig}
        errors={errors}
        isDirty={isDirty}
        isSaving={isSaving}
        onFieldChange={updateField}
        onSave={saveRetrievalConfig}
        updatedAt={settings?.retrievalConfig.updatedAt}
      />
    </div>
    </div>
  );
}
